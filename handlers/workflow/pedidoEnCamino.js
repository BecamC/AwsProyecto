const { updateItem, getTimestamp } = require('../../shared/dynamodb');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;

exports.handler = async (event) => {
  const detail = event.detail || event;
  const tenantId = detail.tenant_id;
  const pedidoId = detail.pedido_id;

  if (!tenantId || !pedidoId) {
    console.warn('pedidoEnCamino invocado sin tenant_id/pedido_id');
    return;
  }

  await updateItem({
    TableName: TABLA_PEDIDOS,
    Key: { tenant_id: tenantId, pedido_id: pedidoId },
    UpdateExpression: 'SET estado = :estado, fecha_actualizacion = :fecha',
    ExpressionAttributeValues: {
      ':estado': 'en_camino',
      ':fecha': getTimestamp(),
    },
  });
};

