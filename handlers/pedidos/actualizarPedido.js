const { getItem, updateItem } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { validateActualizarPedido, isUUID } = require('../../shared/validations');
const { registrarLog } = require('../../shared/logs');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;

exports.handler = async (event) => {
  const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
  const pedidoId = event.pathParameters?.pedido_id;

  if (!tenantId) {
    return response(400, { message: 'x-tenant-id header es requerido' });
  }

  if (!pedidoId || !isUUID(pedidoId)) {
    return response(400, { message: 'pedido_id inválido' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { message: 'Body inválido' });
  }

  const validation = validateActualizarPedido(payload);
  if (!validation.isValid) {
    return response(400, { message: 'Datos inválidos', detalles: validation.errors });
  }

  try {
    const pedidoActual = await getItem(TABLA_PEDIDOS, {
      tenant_id: tenantId,
      pedido_id: pedidoId,
    });

    if (!pedidoActual) {
      return response(404, { message: 'Pedido no encontrado' });
    }

    const updateParts = [];
    const attributeValues = {};
    const attributeNames = {};

    const applyUpdate = (field, value, attrName = field) => {
      updateParts.push(`#${attrName} = :${attrName}`);
      attributeValues[`:${attrName}`] = value;
      attributeNames[`#${attrName}`] = field;
    };

    if (payload.direccion_entrega && pedidoActual.estado === 'pendiente') {
      applyUpdate('direccion_entrega', payload.direccion_entrega);
    }
    if (payload.telefono && pedidoActual.estado === 'pendiente') {
      applyUpdate('telefono', payload.telefono);
    }
    if (payload.notas !== undefined) {
      applyUpdate('notas', payload.notas);
    }
    if (payload.estado) {
      applyUpdate('estado', payload.estado);
    }

    if (updateParts.length === 0) {
      return response(200, { message: 'No hay cambios para aplicar', pedido: pedidoActual });
    }

    applyUpdate('fecha_actualizacion', new Date().toISOString(), 'fecha_actualizacion');

    const updated = await updateItem({
      TableName: TABLA_PEDIDOS,
      Key: {
        tenant_id: tenantId,
        pedido_id: pedidoId,
      },
      UpdateExpression: `SET ${updateParts.join(', ')}`,
      ExpressionAttributeValues: attributeValues,
      ExpressionAttributeNames: attributeNames,
      ReturnValues: 'ALL_NEW',
    });

    await registrarLog({
      userId: payload.usuario_id || pedidoActual.user_id,
      actionType: 'actualizar_pedido',
      pedidoId,
      detalles: payload,
    });

    return response(200, { message: 'Pedido actualizado', pedido: updated });
  } catch (error) {
    console.error('Error actualizando pedido', error);
    await registrarLog({
      userId: payload.usuario_id,
      actionType: 'actualizar_pedido',
      resultado: 'Fallido',
      pedidoId,
      errorMessage: error.message,
    });
    return response(500, { message: 'Error interno al actualizar pedido' });
  }
};

