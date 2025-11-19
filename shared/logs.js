const { putItem, generateUUID, getTimestamp } = require('./dynamodb');

const TABLA_LOGS = process.env.TABLA_LOGS;

async function registrarLog({
  userId,
  actionType,
  resultado = 'Exitoso',
  detalles = {},
  pedidoId = null,
  productoId = null,
  errorMessage = null,
}) {
  if (!TABLA_LOGS) return;

  const log = {
    log_id: generateUUID(),
    user_id: userId || 'anon',
    action_type: actionType,
    horario: getTimestamp(),
    resultado,
    detalles,
    pedido_id: pedidoId,
    producto_id: productoId,
    error_message: errorMessage,
  };

  await putItem(TABLA_LOGS, log);
}

module.exports = { registrarLog };

