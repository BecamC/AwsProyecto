const { updateItem, getTimestamp } = require('../../shared/dynamodb');
const { publish, buildNotificationAttributes } = require('../../shared/sns');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;
const SNS_TOPIC_ARN = process.env.SNS_NOTIFICACIONES_ARN;

exports.handler = async (event) => {
  const detail = event.detail || event;
  const tenantId = detail.tenant_id;
  const pedidoId = detail.pedido_id;

  if (!tenantId || !pedidoId) {
    console.warn('despachandoComida sin tenant/pedido');
    return;
  }

  await updateItem({
    TableName: TABLA_PEDIDOS,
    Key: { tenant_id: tenantId, pedido_id: pedidoId },
    UpdateExpression: 'SET estado = :estado, fecha_actualizacion = :fecha',
    ExpressionAttributeValues: {
      ':estado': 'despachando',
      ':fecha': getTimestamp(),
    },
  });

  if (SNS_TOPIC_ARN) {
    await publish({
      topicArn: SNS_TOPIC_ARN,
      subject: 'Pedido listo para despacho',
      message: {
        pedido_id: pedidoId,
        tenant_id: tenantId,
        estado: 'despachando',
      },
      attributes: buildNotificationAttributes({ pedidoId, tipo: 'despachando' }),
    });
  }
};

