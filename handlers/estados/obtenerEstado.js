const { getItem, query } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { requireAuth } = require('../../shared/auth');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;
const TABLA_ESTADOS = process.env.TABLA_ESTADOS;

exports.handler = async (event) => {
  try {
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

    const params = event.queryStringParameters || {};
    const { pedido_id, incluir_historial } = params;

    if (!pedido_id) {
      return response(400, { message: 'pedido_id es requerido como query parameter' });
    }

    const pedido = await getItem(TABLA_PEDIDOS, {
      tenant_id: tenantId,
      pedido_id: pedido_id,
    });

    if (!pedido) {
      return response(404, { message: 'Pedido no encontrado' });
    }

    if (!isStaff && pedido.user_id !== authenticatedUserId) {
      return response(403, { message: 'No tienes permiso para ver este pedido' });
    }

    const estadoActual = {
      pedido_id: pedido_id,
      tenant_id: tenantId,
      estado: pedido.estado,
      fecha_actualizacion: pedido.fecha_actualizacion,
      fecha_inicio: pedido.fecha_inicio,
      fecha_fin: pedido.fecha_fin,
    };

    let historial = null;
    if (incluir_historial === 'true' || incluir_historial === true) {
      const historialQuery = {
        TableName: TABLA_ESTADOS,
        KeyConditionExpression: 'pedido_id = :pedido_id',
        ExpressionAttributeValues: {
          ':pedido_id': pedido_id,
        },
        ScanIndexForward: false,
      };

      const result = await query(historialQuery);
      historial = (result.Items || []).map(item => ({
        estado_id: item.estado_id,
        estado_anterior: item.estado_anterior,
        estado_nuevo: item.estado_nuevo,
        timestamp: item.timestamp,
        usuario_id: item.usuario_id,
        usuario_tipo: item.usuario_tipo,
        motivo: item.motivo,
      }));
    }

    const respuesta = {
      estado_actual: estadoActual,
    };

    if (historial !== null) {
      respuesta.historial = historial;
      respuesta.total_cambios = historial.length;
    }

    return response(200, respuesta);
  } catch (error) {
    console.error('Error obteniendo estado:', error);
    return response(500, {
      message: 'Error interno al obtener estado',
      error: error.message,
    });
  }
};

