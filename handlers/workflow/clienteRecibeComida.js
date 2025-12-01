const { updateItem, getItem, getTimestamp } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { publish, buildNotificationAttributes } = require('../../shared/sns');
const { registrarCambioEstado } = require('../../shared/estados');
const { requireAuth } = require('../../shared/auth');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;
const SNS_TOPIC_ARN = process.env.SNS_NOTIFICACIONES_ARN;

async function marcarComoEntregado(tenantId, pedidoId, usuarioId = null) {
  // Obtener pedido actual para conocer el estado anterior
  const pedido = await getItem(TABLA_PEDIDOS, {
    tenant_id: tenantId,
    pedido_id: pedidoId,
  });

  if (!pedido) {
    throw new Error('Pedido no encontrado');
  }

  // Verificar que el pedido esté en un estado válido para ser entregado
  if (pedido.estado !== 'en_camino') {
    throw new Error(`El pedido debe estar en estado "en_camino" para ser marcado como entregado. Estado actual: ${pedido.estado}`);
  }

  const fecha = getTimestamp();
  await updateItem({
    TableName: TABLA_PEDIDOS,
    Key: { tenant_id: tenantId, pedido_id: pedidoId },
    UpdateExpression: 'SET estado = :estado, fecha_fin = :fin, fecha_actualizacion = :fin',
    ExpressionAttributeValues: {
      ':estado': 'entregado',
      ':fin': fecha,
    },
  });

  // Registrar cambio de estado en TablaEstados
  await registrarCambioEstado({
    pedido_id: pedidoId,
    tenant_id: tenantId,
    estado_anterior: pedido.estado,
    estado_nuevo: 'entregado',
    usuario_id: usuarioId || pedido.user_id || 'cliente',
    usuario_tipo: usuarioId ? 'staff' : 'cliente',
    motivo: usuarioId ? 'Pedido entregado por staff' : 'Cliente confirma recepción del pedido',
    start_time: pedido.fecha_actualizacion || pedido.fecha_inicio,
    end_time: fecha,
  });

  if (SNS_TOPIC_ARN) {
    await publish({
      topicArn: SNS_TOPIC_ARN,
      subject: 'Pedido entregado',
      message: {
        pedido_id: pedidoId,
        tenant_id: tenantId,
        estado: 'entregado',
      },
      attributes: buildNotificationAttributes({ pedidoId, tipo: 'entregado' }),
    });
  }

  return { status: 'completed', pedido_id: pedidoId, fecha_fin: fecha };
}

async function handleHttpInvocation(event) {
  // Verificar autenticación
  const auth = requireAuth(event);
  if (auth.error) {
    return auth.error;
  }

  const { payload } = auth;
  const authenticatedUserId = payload.user_id;

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { message: 'Body inválido' });
  }

  const tenantId = body.tenant_id || event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
  const pedidoId = body.pedido_id;

  if (!tenantId || !pedidoId) {
    return response(400, { message: 'tenant_id y pedido_id son requeridos' });
  }

  // Verificar que el pedido pertenece al usuario autenticado
  const pedido = await getItem(TABLA_PEDIDOS, {
    tenant_id: tenantId,
    pedido_id: pedidoId,
  });

  if (!pedido) {
    return response(404, { message: 'Pedido no encontrado' });
  }

  // Solo el dueño del pedido puede confirmar recepción
  if (pedido.user_id !== authenticatedUserId && payload.user_type !== 'staff') {
    return response(403, { message: 'No tienes permiso para confirmar este pedido' });
  }

  const resultado = await marcarComoEntregado(tenantId, pedidoId, authenticatedUserId);

  return response(200, {
    message: 'Pedido marcado como entregado exitosamente',
    pedido: {
      pedido_id: pedidoId,
      estado: 'entregado',
      fecha_fin: resultado.fecha_fin,
    },
  });
}

async function handleEventBridgeInvocation(event) {
  const detail = event.detail || event;
  const tenantId = detail.tenant_id;
  const pedidoId = detail.pedido_id;

  if (!tenantId || !pedidoId) {
    console.warn('clienteRecibeComida sin tenant/pedido');
    return { status: 'missing-data' };
  }

  const resultado = await marcarComoEntregado(tenantId, pedidoId);
  return resultado;
}

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

    // Verificar si es invocación HTTP
    if (event.requestContext || event.httpMethod) {
      return await handleHttpInvocation(event);
    }

    // Si no es HTTP, asumir que es EventBridge (Step Functions)
    return await handleEventBridgeInvocation(event);
  } catch (error) {
    console.error('Error en clienteRecibeComida:', error);
    
    // Si es HTTP, retornar respuesta de error
    if (event.requestContext || event.httpMethod) {
      return response(500, {
        message: 'Error interno al confirmar recepción',
        error: error.message,
      });
    }
    
    // Si es EventBridge, re-lanzar el error
    throw error;
  }
};

