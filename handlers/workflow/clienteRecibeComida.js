const { updateItem, getTimestamp } = require('../../shared/dynamodb');
const { publish, buildNotificationAttributes } = require('../../shared/sns');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;
const SNS_TOPIC_ARN = process.env.SNS_NOTIFICACIONES_ARN;

exports.handler = async (event) => {
  const detail = event.detail || event;
  const tenantId = detail.tenant_id;
  const pedidoId = detail.pedido_id;

  if (!tenantId || !pedidoId) {
    console.warn('clienteRecibeComida sin tenant/pedido');
    return { status: 'missing-data' };
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

  return { status: 'completed', pedido_id: pedidoId };
};

