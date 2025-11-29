const { getItem, updateItem, getTimestamp } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { sendTaskSuccess } = require('../../shared/stepfunctions');
const { publish, buildNotificationAttributes } = require('../../shared/sns');
const { registrarLog } = require('../../shared/logs');
const { putEvent } = require('../../shared/eventbridge');
const { requireStaff } = require('../../shared/auth');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;
const SNS_TOPIC_ARN = process.env.SNS_NOTIFICACIONES_ARN;

async function handleStepFunctionsInvocation(event) {
  console.log('[DEBUG Step Functions pedidoDespachado] Evento recibido:', JSON.stringify(event));
  
  // Step Functions puede enviar el payload directamente o dentro de un objeto
  const payload = event.Payload || event;
  const { taskToken, pedido_id: pedidoId, tenant_id: tenantId } = payload;

  console.log('[DEBUG Step Functions pedidoDespachado] Extraído:', { taskToken: taskToken ? 'EXISTS' : 'MISSING', pedidoId, tenantId });

  if (!taskToken || !pedidoId || !tenantId) {
    console.error('[ERROR Step Functions pedidoDespachado] Faltan datos:', { taskToken: !!taskToken, pedidoId: !!pedidoId, tenantId: !!tenantId });
    throw new Error('Evento inválido para pedidoDespachado');
  }

  console.log(`[INFO Step Functions pedidoDespachado] Guardando despacho_task_token para pedido ${pedidoId}`);
  
  await updateItem({
    TableName: TABLA_PEDIDOS,
    Key: { tenant_id: tenantId, pedido_id: pedidoId },
    UpdateExpression: 'SET despacho_task_token = :token, estado = :estado',
    ExpressionAttributeValues: {
      ':token': taskToken,
      ':estado': 'despachando',
    },
  });
  
  console.log(`[INFO Step Functions pedidoDespachado] despacho_task_token guardado exitosamente para pedido ${pedidoId}`);

  return { status: 'waiting_despacho' };
}

async function handleHttpInvocation(event) {
  // Verificar autenticación y permisos de staff
  const auth = requireStaff(event, 'update_order_status');
  if (auth.error) {
    return auth.error;
  }
  
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { message: 'Body inválido' });
  }

  const tenantId = body.tenant_id;
  const pedidoId = body.pedido_id;

  if (!tenantId || !pedidoId) {
    return response(400, { message: 'tenant_id y pedido_id son requeridos' });
  }

  const pedido = await getItem(TABLA_PEDIDOS, { tenant_id: tenantId, pedido_id: pedidoId });
  
  console.log('[DEBUG HTTP pedidoDespachado] Pedido obtenido:', {
    pedidoExiste: !!pedido,
    tieneDespachoTaskToken: !!(pedido?.despacho_task_token),
    estado: pedido?.estado
  });

  if (!pedido || !pedido.despacho_task_token) {
    console.error('[ERROR HTTP pedidoDespachado] No hay despacho_task_token. Pedido:', {
      existe: !!pedido,
      estado: pedido?.estado,
      tieneToken: !!(pedido?.despacho_task_token)
    });
    return response(409, { 
      message: 'No hay despacho pendiente',
      debug: {
        pedidoExiste: !!pedido,
        estado: pedido?.estado,
        tieneToken: !!(pedido?.despacho_task_token)
      }
    });
  }

  await sendTaskSuccess({
    taskToken: pedido.despacho_task_token,
    output: {
      tenant_id: tenantId,
      pedido_id: pedidoId,
      estado: 'despachado',
    },
  });

  const fecha = getTimestamp();
  const updated = await updateItem({
    TableName: TABLA_PEDIDOS,
    Key: { tenant_id: tenantId, pedido_id: pedidoId },
    UpdateExpression: 'REMOVE despacho_task_token SET estado = :estado, fecha_actualizacion = :fecha',
    ExpressionAttributeValues: {
      ':estado': 'despachado',
      ':fecha': fecha,
    },
    ReturnValues: 'ALL_NEW',
  });

  if (SNS_TOPIC_ARN) {
    await publish({
      topicArn: SNS_TOPIC_ARN,
      subject: 'Pedido despachado',
      message: {
        pedido_id: pedidoId,
        tenant_id: tenantId,
        estado: 'despachado',
      },
      attributes: buildNotificationAttributes({ pedidoId, tipo: 'despachado' }),
    });
  }

  await registrarLog({
    userId: body.usuario_id,
    actionType: 'pedido_despachado',
    pedidoId,
  });

  console.log('[INFO] Pedido despachado confirmado. Step Functions continuará automáticamente.');

  return response(200, { message: 'Pedido marcado como despachado', pedido: updated });
}

exports.handler = async (event) => {
  try {
    console.log('[DEBUG pedidoDespachado] Tipo de evento recibido:', {
      hasTaskToken: !!(event.taskToken || event.Payload?.taskToken),
      hasRequestContext: !!event.requestContext,
      eventKeys: Object.keys(event)
    });

    // Verificar si es invocación de Step Functions
    if (event.taskToken || event.Payload?.taskToken) {
      console.log('[INFO pedidoDespachado] Invocación desde Step Functions detectada');
      return await handleStepFunctionsInvocation(event);
    }
    
    // Verificar si es invocación HTTP
    if (event.requestContext) {
      console.log('[INFO pedidoDespachado] Invocación HTTP detectada');
      return await handleHttpInvocation(event);
    }
    
    console.warn('[WARN pedidoDespachado] Evento no reconocido:', JSON.stringify(event));
    return response(400, { message: 'Evento no soportado' });
  } catch (error) {
    console.error('[ERROR pedidoDespachado] Error:', error);
    if (event.requestContext) {
      return response(500, { message: 'Error interno al despachar pedido' });
    }
    throw error;
  }
};

