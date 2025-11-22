const { updateItem, getItem, getTimestamp } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { sendTaskSuccess } = require('../../shared/stepfunctions');
const { publish, buildNotificationAttributes } = require('../../shared/sns');
const { registrarLog } = require('../../shared/logs');
const { putEvent } = require('../../shared/eventbridge');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;
const SNS_TOPIC_ARN = process.env.SNS_NOTIFICACIONES_ARN;

async function handleStepFunctionsInvocation(event) {
  const { taskToken, pedido_id: pedidoId, tenant_id: tenantId } = event;

  if (!taskToken || !pedidoId || !tenantId) {
    throw new Error('Evento inválido para ChefConfirma');
  }

  await updateItem({
    TableName: TABLA_PEDIDOS,
    Key: { tenant_id: tenantId, pedido_id: pedidoId },
    UpdateExpression: 'SET chef_task_token = :token',
    ExpressionAttributeValues: {
      ':token': taskToken,
    },
  });

  if (SNS_TOPIC_ARN) {
    await publish({
      topicArn: SNS_TOPIC_ARN,
      subject: 'Pedido pendiente de confirmación de chef',
      message: {
        pedido_id: pedidoId,
        tenant_id: tenantId,
        mensaje: 'Confirma si puedes preparar el pedido.',
      },
      attributes: buildNotificationAttributes({ pedidoId, tipo: 'pendiente_confirmacion' }),
    });
  }

  return { status: 'waiting_confirmation' };
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
  const chefId = body.chef_id;
  const aprobado = body.aprobado !== false;

  if (!tenantId || !pedidoId || !chefId) {
    return response(400, { message: 'tenant_id, pedido_id y chef_id son requeridos' });
  }

  const pedido = await getItem(TABLA_PEDIDOS, {
    tenant_id: tenantId,
    pedido_id: pedidoId,
  });

  if (!pedido || !pedido.chef_task_token) {
    return response(409, { message: 'No hay una confirmación pendiente para este pedido' });
  }

  if (!aprobado) {
  await sendTaskSuccess({
    taskToken: pedido.chef_task_token,
    output: {
      pedido_id: pedidoId,
      estado: 'rechazado',
    },
  });

    await updateItem({
      TableName: TABLA_PEDIDOS,
      Key: { tenant_id: tenantId, pedido_id: pedidoId },
      UpdateExpression: 'REMOVE chef_task_token SET estado = :estado, fecha_actualizacion = :fecha',
      ExpressionAttributeValues: {
        ':estado': 'cancelado',
        ':fecha': getTimestamp(),
      },
    });

    return response(200, { message: 'Pedido rechazado por el chef' });
  }

  await sendTaskSuccess({
    taskToken: pedido.chef_task_token,
    output: {
      pedido_id: pedidoId,
      estado: 'preparando',
    },
  });

  const fecha = getTimestamp();
  const updated = await updateItem({
    TableName: TABLA_PEDIDOS,
    Key: { tenant_id: tenantId, pedido_id: pedidoId },
    UpdateExpression: 'REMOVE chef_task_token SET estado = :estado, chef_id = :chef, fecha_actualizacion = :fecha',
    ExpressionAttributeValues: {
      ':estado': 'preparando',
      ':chef': chefId,
      ':fecha': fecha,
    },
    ReturnValues: 'ALL_NEW',
  });

  await registrarLog({
    userId: chefId,
    actionType: 'chef_confirma',
    pedidoId,
    detalles: { aprobado },
  });

  if (SNS_TOPIC_ARN) {
    await publish({
      topicArn: SNS_TOPIC_ARN,
      subject: 'Pedido aceptado por el chef',
      message: {
        pedido_id: pedidoId,
        tenant_id: tenantId,
        estado: 'preparando',
      },
      attributes: buildNotificationAttributes({ pedidoId, tipo: 'preparando' }),
    });
  }

  console.log('[INFO] Chef confirmó. Step Functions continuará automáticamente al siguiente estado.');

  return response(200, { message: 'Pedido confirmado', pedido: updated });
}

exports.handler = async (event) => {
  try {
    if (event.taskToken) {
      return await handleStepFunctionsInvocation(event);
    }
    if (event.requestContext) {
      return await handleHttpInvocation(event);
    }
    console.warn('Evento no reconocido en chefConfirma', event);
    return response(400, { message: 'Evento no soportado' });
  } catch (error) {
    console.error('Error en chefConfirma', error);
    if (event.requestContext) {
      return response(500, { message: 'Error interno al confirmar pedido' });
    }
    throw error;
  }
};

