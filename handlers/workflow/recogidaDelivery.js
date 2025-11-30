const { updateItem, getItem, getTimestamp } = require('../../shared/dynamodb');
const { publish, buildNotificationAttributes } = require('../../shared/sns');
const { registrarCambioEstado } = require('../../shared/estados');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;
const SNS_TOPIC_ARN = process.env.SNS_NOTIFICACIONES_ARN;

exports.handler = async (event) => {
  const detail = event.detail || event;
  const tenantId = detail.tenant_id;
  const pedidoId = detail.pedido_id;

  if (!tenantId || !pedidoId) {
    console.warn('recogidaDelivery sin tenant/pedido');
    return;
  }

  // Obtener pedido actual
  const pedido = await getItem(TABLA_PEDIDOS, {
    tenant_id: tenantId,
    pedido_id: pedidoId,
  });

  const timestamp = getTimestamp();

  await updateItem({
    TableName: TABLA_PEDIDOS,
    Key: { tenant_id: tenantId, pedido_id: pedidoId },
    UpdateExpression: 'SET estado = :estado, fecha_actualizacion = :fecha',
    ExpressionAttributeValues: {
      ':estado': 'recogiendo',
      ':fecha': timestamp,
    },
  });

  // Registrar cambio de estado en TablaEstados
  if (pedido) {
    await registrarCambioEstado({
      pedido_id: pedidoId,
      tenant_id: tenantId,
      estado_anterior: pedido.estado, // despachado
      estado_nuevo: 'recogiendo',
      usuario_id: 'system',
      usuario_tipo: 'staff',
      motivo: 'Pedido listo para que el motorizado lo recoja',
      start_time: pedido.fecha_actualizacion || pedido.fecha_inicio,
      end_time: timestamp,
    });
  }

  if (SNS_TOPIC_ARN) {
    await publish({
      topicArn: SNS_TOPIC_ARN,
      subject: 'Pedido listo para recogida',
      message: {
        pedido_id: pedidoId,
        tenant_id: tenantId,
        estado: 'recogiendo',
      },
      attributes: buildNotificationAttributes({ pedidoId, tipo: 'recogiendo' }),
    });
  }
};
