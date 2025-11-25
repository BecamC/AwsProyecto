const { getItem } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { isUUID } = require('../../shared/validations');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;

/**
 * Lambda para obtener únicamente el estado de un pedido
 * Endpoint: GET /pedido/{pedido_id}/estado
 */
exports.handler = async (event) => {
  try {
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    const pedidoId = event.pathParameters?.pedido_id;

    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
    }

    if (!pedidoId || !isUUID(pedidoId)) {
      return response(400, { message: 'pedido_id inválido' });
    }

    const pedido = await getItem(TABLA_PEDIDOS, {
      tenant_id: tenantId,
      pedido_id: pedidoId,
    });

    if (!pedido) {
      return response(404, { message: 'Pedido no encontrado' });
    }

    // Retornar solo información relevante del estado
    return response(200, {
      pedido_id: pedido.pedido_id,
      tenant_id: pedido.tenant_id,
      estado: pedido.estado,
      fecha_inicio: pedido.fecha_inicio,
      fecha_actualizacion: pedido.fecha_actualizacion,
      chef_id: pedido.chef_id,
      motorizado_id: pedido.motorizado_id,
    });
  } catch (error) {
    console.error('[ERROR obtenerEstadoPedido]', error);
    return response(500, { message: 'Error interno al obtener estado del pedido' });
  }
};
