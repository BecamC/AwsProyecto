const { putItem, generateUUID, getTimestamp } = require('./dynamodb');

const TABLA_ESTADOS = process.env.TABLA_ESTADOS;

/**
 * Registra un cambio de estado en la TablaEstados
 * @param {Object} params - Parámetros del cambio de estado
 * @param {string} params.pedido_id - ID del pedido
 * @param {string} params.tenant_id - ID del tenant
 * @param {string} params.estado_anterior - Estado anterior del pedido
 * @param {string} params.estado_nuevo - Nuevo estado del pedido
 * @param {string} params.usuario_id - ID del usuario que hace el cambio
 * @param {string} params.usuario_tipo - Tipo de usuario (cliente|staff)
 * @param {string} [params.motivo] - Motivo del cambio de estado
 * @param {string} [params.start_time] - Timestamp de inicio del estado anterior
 * @param {string} [params.end_time] - Timestamp de finalización del estado anterior (ahora)
 * @returns {Promise<void>}
 */
async function registrarCambioEstado({
  pedido_id,
  tenant_id,
  estado_anterior,
  estado_nuevo,
  usuario_id,
  usuario_tipo,
  motivo = null,
  start_time = null,
  end_time = null,
}) {
  if (!TABLA_ESTADOS) {
    console.warn('[WARN] TABLA_ESTADOS no está configurada, no se registrará el cambio de estado');
    return;
  }

  try {
    const timestamp = getTimestamp();
    
    const estadoItem = {
      estado_id: generateUUID(),
      pedido_id,
      tenant_id,
      estado_anterior,
      estado_nuevo,
      timestamp,
      usuario_id,
      usuario_tipo,
      motivo,
      // Tiempos de inicio y fin del estado anterior
      start_time: start_time || null,
      end_time: end_time || timestamp,
      // Duración en segundos (si hay start_time)
      duracion_segundos: start_time ? calcularDuracion(start_time, end_time || timestamp) : null,
    };

    await putItem(TABLA_ESTADOS, estadoItem);
    console.log(`[INFO] Cambio de estado registrado: ${estado_anterior} → ${estado_nuevo} para pedido ${pedido_id}`);
    if (estadoItem.duracion_segundos) {
      console.log(`[INFO] Duración del estado "${estado_anterior}": ${estadoItem.duracion_segundos} segundos`);
    }
  } catch (error) {
    console.error('[ERROR] Error registrando cambio de estado:', error);
    // No lanzar error para que no falle la operación principal
  }
}

/**
 * Calcula la duración en segundos entre dos timestamps ISO
 */
function calcularDuracion(startTime, endTime) {
  try {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return Math.floor((end - start) / 1000);
  } catch (error) {
    console.error('[ERROR] Error calculando duración:', error);
    return null;
  }
}

module.exports = {
  registrarCambioEstado,
};

