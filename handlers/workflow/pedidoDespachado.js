const { getItem, updateItem, getTimestamp } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { sendTaskSuccess } = require('../../shared/stepfunctions');
const { publish, buildNotificationAttributes } = require('../../shared/sns');
const { registrarLog } = require('../../shared/logs');
const { putEvent } = require('../../shared/eventbridge');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;
const SNS_TOPIC_ARN = process.env.SNS_NOTIFICACIONES_ARN;

async function handleStepFunctionsInvocation(event) {
  const { taskToken, pedido_id: pedidoId, tenant_id: tenantId } = event;

  await updateItem({
    TableName: TABLA_PEDIDOS,
    Key: { tenant_id: tenantId, pedido_id: pedidoId },
    UpdateExpression: 'SET despacho_task_token = :token, estado = :estado',
    ExpressionAttributeValues: {
      ':token': taskToken,
      ':estado': 'despachando',
    },
  });

  return { status: 'waiting_despacho' };
}

async function handleHttpInvocation(event) {
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
  if (!pedido || !pedido.despacho_task_token) {
    return response(409, { message: 'No hay despacho pendiente' });
  }

  await sendTaskSuccess({
    taskToken: pedido.despacho_task_token,
    output: {
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
    if (event.taskToken) {
      return await handleStepFunctionsInvocation(event);
    }
    if (event.requestContext) {
      return await handleHttpInvocation(event);
    }
    console.warn('Evento no soportado en pedidoDespachado', event);
    return response(400, { message: 'Evento no soportado' });
  } catch (error) {
    console.error('Error en pedidoDespachado', error);
    if (event.requestContext) {
      return response(500, { message: 'Error interno al despachar pedido' });
    }
    throw error;
  }
};

