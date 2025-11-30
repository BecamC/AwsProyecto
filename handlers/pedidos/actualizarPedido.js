const { getItem, updateItem } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { validateActualizarPedido, isUUID } = require('../../shared/validations');
const { registrarLog } = require('../../shared/logs');
const { requireAuth } = require('../../shared/auth');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;

exports.handler = async (event) => {
  // Verificar autenticación
  const auth = requireAuth(event);
  if (auth.error) {
    return auth.error;
  }
  
  const { payload } = auth;
  const authenticatedUserId = payload.user_id;
  const isStaff = payload.user_type === 'staff';
  
  const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
  const pedidoId = event.pathParameters?.pedido_id;

  if (!tenantId) {
    return response(400, { message: 'x-tenant-id header es requerido' });
  }

  if (!pedidoId || !isUUID(pedidoId)) {
    return response(400, { message: 'pedido_id inválido' });
  }

  let payloadBody;
  try {
    payloadBody = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { message: 'Body inválido' });
  }

  const validation = validateActualizarPedido(payloadBody);
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
    
    // Verificar permisos: solo el dueño o staff puede actualizar el pedido
    if (!isStaff && pedidoActual.user_id !== authenticatedUserId) {
      return response(403, { message: 'No tienes permiso para actualizar este pedido' });
    }

    const updateParts = [];
    const attributeValues = {};
    const attributeNames = {};

    const applyUpdate = (field, value, attrName = field) => {
      updateParts.push(`#${attrName} = :${attrName}`);
      attributeValues[`:${attrName}`] = value;
      attributeNames[`#${attrName}`] = field;
    };

    if (payloadBody.direccion_entrega && pedidoActual.estado === 'pendiente') {
      applyUpdate('direccion_entrega', payloadBody.direccion_entrega);
    }
    if (payloadBody.telefono && pedidoActual.estado === 'pendiente') {
      applyUpdate('telefono', payloadBody.telefono);
    }
    if (payloadBody.notas !== undefined) {
      applyUpdate('notas', payloadBody.notas);
    }
    // Solo staff puede cambiar el estado directamente
    if (payloadBody.estado && isStaff) {
      applyUpdate('estado', payloadBody.estado);
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
      userId: authenticatedUserId,
      actionType: 'actualizar_pedido',
      pedidoId,
      detalles: payloadBody,
    });

    return response(200, { message: 'Pedido actualizado', pedido: updated });
  } catch (error) {
    console.error('Error actualizando pedido', error);
    await registrarLog({
      userId: authenticatedUserId,
      actionType: 'actualizar_pedido',
      resultado: 'Fallido',
      pedidoId,
      errorMessage: error.message,
    });
    return response(500, { message: 'Error interno al actualizar pedido' });
  }
};

