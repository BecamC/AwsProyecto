const { getItem, putItem, updateItem, query, getTimestamp, generateUUID } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { requireAuth, requireStaff } = require('../../shared/auth');
const { registrarLog } = require('../../shared/logs');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;
const TABLA_ESTADOS = process.env.TABLA_ESTADOS;

const ESTADOS_VALIDOS = [
  'pendiente',
  'preparando',
  'despachando',
  'despachado',
  'recogiendo',
  'en_camino',
  'entregado',
  'cancelado',
  'rechazado'
];

exports.handler = async (event) => {
  try {
    // Manejar preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
      const { CORS_HEADERS } = require('../../shared/auth');
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: ''
      };
    }
    
    const auth = requireAuth(event);
    if (auth.error) {
      return auth.error;
    }

    const { payload } = auth;
    const authenticatedUserId = payload.user_id;
    const isStaff = payload.user_type === 'staff';
    
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    
    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return response(400, { message: 'Body inválido' });
    }

    const { pedido_id, estado, motivo } = body;

    if (!pedido_id) {
      return response(400, { message: 'pedido_id es requerido' });
    }

    if (!estado) {
      return response(400, { message: 'estado es requerido' });
    }

    if (!ESTADOS_VALIDOS.includes(estado)) {
      return response(400, { 
        message: 'Estado inválido',
        estados_validos: ESTADOS_VALIDOS 
      });
    }

    const pedido = await getItem(TABLA_PEDIDOS, {
      tenant_id: tenantId,
      pedido_id: pedido_id,
    });

    if (!pedido) {
      return response(404, { message: 'Pedido no encontrado' });
    }

    if (!isStaff) {
      if (pedido.user_id !== authenticatedUserId) {
        return response(403, { message: 'No tienes permiso para actualizar este pedido' });
      }
      if (estado !== 'cancelado' || pedido.estado !== 'pendiente') {
        return response(403, { 
          message: 'Solo puedes cancelar pedidos pendientes' 
        });
      }
    } else {
      const staffAuth = requireStaff(event, 'update_order_status');
      if (staffAuth.error) {
        return staffAuth.error;
      }
    }

    const estadoActual = pedido.estado;
    const transicionesValidas = {
      'pendiente': ['preparando', 'cancelado', 'rechazado'],
      'preparando': ['despachando', 'cancelado'],
      'despachando': ['despachado', 'cancelado'],
      'despachado': ['recogiendo', 'cancelado'],
      'recogiendo': ['en_camino', 'cancelado'],
      'en_camino': ['entregado', 'cancelado'],
      'entregado': [],
      'cancelado': [],
      'rechazado': []
    };

    if (estadoActual && transicionesValidas[estadoActual]) {
      if (!transicionesValidas[estadoActual].includes(estado)) {
        return response(400, {
          message: `No se puede cambiar de "${estadoActual}" a "${estado}"`,
          transiciones_validas: transicionesValidas[estadoActual]
        });
      }
    }

    const timestamp = getTimestamp();
    const estadoId = generateUUID();

    const estadoItem = {
      estado_id: estadoId,
      pedido_id: pedido_id,
      tenant_id: tenantId,
      estado_anterior: estadoActual,
      estado_nuevo: estado,
      timestamp: timestamp,
      usuario_id: authenticatedUserId,
      usuario_tipo: isStaff ? 'staff' : 'cliente',
      motivo: motivo || null,
    };

    await putItem(TABLA_ESTADOS, estadoItem);

    const updateExpression = 'SET estado = :estado, fecha_actualizacion = :fecha';
    const expressionAttributeValues = {
      ':estado': estado,
      ':fecha': timestamp,
    };

    if (estado === 'entregado' || estado === 'cancelado' || estado === 'rechazado') {
      const updateExpressionWithFin = 'SET estado = :estado, fecha_fin = :fecha, fecha_actualizacion = :fecha';
      await updateItem({
        TableName: TABLA_PEDIDOS,
        Key: {
          tenant_id: tenantId,
          pedido_id: pedido_id,
        },
        UpdateExpression: updateExpressionWithFin,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      });
    } else {
      await updateItem({
        TableName: TABLA_PEDIDOS,
        Key: {
          tenant_id: tenantId,
          pedido_id: pedido_id,
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      });
    }

    await registrarLog({
      userId: authenticatedUserId,
      actionType: 'actualizar_estado',
      pedidoId: pedido_id,
      detalles: {
        estado_anterior: estadoActual,
        estado_nuevo: estado,
        motivo: motivo,
      },
    });

    return response(200, {
      message: 'Estado actualizado exitosamente',
      pedido_id: pedido_id,
      estado_anterior: estadoActual,
      estado_nuevo: estado,
      timestamp: timestamp,
    });
  } catch (error) {
    console.error('Error actualizando estado:', error);
    return response(500, {
      message: 'Error interno al actualizar estado',
      error: error.message,
    });
  }
};

