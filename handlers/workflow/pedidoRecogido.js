const { getItem, updateItem, getTimestamp } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { sendTaskSuccess } = require('../../shared/stepfunctions');
const { publish, buildNotificationAttributes } = require('../../shared/sns');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;
const SNS_TOPIC_ARN = process.env.SNS_NOTIFICACIONES_ARN;

async function handleStepFunctionsInvocation(event) {
  const { taskToken, pedido_id: pedidoId, tenant_id: tenantId } = event;

  await updateItem({
    TableName: TABLA_PEDIDOS,
    Key: { tenant_id: tenantId, pedido_id: pedidoId },
    UpdateExpression: 'SET delivery_task_token = :token, estado = :estado',
    ExpressionAttributeValues: {
      ':token': taskToken,
      ':estado': 'recogiendo',
    },
  });

  return { status: 'waiting_delivery_pickup' };
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
  const motorizadoId = body.motorizado_id;

  if (!tenantId || !pedidoId || !motorizadoId) {
    return response(400, { message: 'tenant_id, pedido_id y motorizado_id son requeridos' });
  }

  const pedido = await getItem(TABLA_PEDIDOS, { tenant_id: tenantId, pedido_id: pedidoId });
  if (!pedido || !pedido.delivery_task_token) {
    return response(409, { message: 'No hay recogida pendiente' });
  }

  await sendTaskSuccess({
    taskToken: pedido.delivery_task_token,
    output: {
      tenant_id: tenantId,
      pedido_id: pedidoId,
      estado: 'en_camino',
    },
  });

  const fecha = getTimestamp();
  const updated = await updateItem({
    TableName: TABLA_PEDIDOS,
    Key: { tenant_id: tenantId, pedido_id: pedidoId },
    UpdateExpression:
      'REMOVE delivery_task_token SET estado = :estado, motorizado_id = :moto, fecha_actualizacion = :fecha',
    ExpressionAttributeValues: {
      ':estado': 'en_camino',
      ':moto': motorizadoId,
      ':fecha': fecha,
    },
    ReturnValues: 'ALL_NEW',
  });

  if (SNS_TOPIC_ARN) {
    await publish({
      topicArn: SNS_TOPIC_ARN,
      subject: 'Pedido en camino',
      message: {
        pedido_id: pedidoId,
        tenant_id: tenantId,
        estado: 'en_camino',
      },
      attributes: buildNotificationAttributes({ pedidoId, tipo: 'en_camino' }),
    });
  }

  return response(200, { message: 'Pedido marcado como en camino', pedido: updated });
}

exports.handler = async (event) => {
  try {
    if (event.taskToken) {
      return await handleStepFunctionsInvocation(event);
    }
    if (event.requestContext) {
      return await handleHttpInvocation(event);
    }
    console.warn('Evento no soportado en pedidoRecogido', event);
    return response(400, { message: 'Evento no soportado' });
  } catch (error) {
    console.error('Error en pedidoRecogido', error);
    if (event.requestContext) {
      return response(500, { message: 'Error interno al confirmar recogida' });
    }
    throw error;
  }
};

