const { getItem, updateItem, getTimestamp } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { isUUID, validateTransicionEstado } = require('../../shared/validations');
const { registrarLog } = require('../../shared/logs');
const { publish, buildNotificationAttributes } = require('../../shared/sns');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;
const SNS_TOPIC_ARN = process.env.SNS_NOTIFICACIONES_ARN;

/**
 * Lambda centralizada para actualizar el estado de un pedido
 * Endpoint: PUT /pedido/{pedido_id}/estado
 * También puede ser invocada directamente por otros lambdas (workflows)
 */
exports.handler = async (event) => {
  try {
    let tenantId, pedidoId, nuevoEstado, userId, metadata;

    // Detectar si es invocación HTTP o directa
    if (event.requestContext) {
      // Invocación HTTP
      tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
      pedidoId = event.pathParameters?.pedido_id;
      
      if (!tenantId) {
        return response(400, { message: 'x-tenant-id header es requerido' });
      }

      if (!pedidoId || !isUUID(pedidoId)) {
        return response(400, { message: 'pedido_id inválido' });
      }

      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return response(400, { message: 'Body inválido' });
      }

      nuevoEstado = body.estado;
      userId = body.user_id;
      metadata = body.metadata || {};
    } else {
      // Invocación directa (desde otro lambda)
      tenantId = event.tenant_id;
      pedidoId = event.pedido_id;
      nuevoEstado = event.estado;
      userId = event.user_id;
      metadata = event.metadata || {};
    }

    if (!nuevoEstado) {
      const msg = 'estado es requerido';
      return event.requestContext ? response(400, { message: msg }) : { error: msg };
    }

    // Obtener pedido actual
    const pedido = await getItem(TABLA_PEDIDOS, {
      tenant_id: tenantId,
      pedido_id: pedidoId,
    });

    if (!pedido) {
      const msg = 'Pedido no encontrado';
      return event.requestContext ? response(404, { message: msg }) : { error: msg };
    }

    // Validar transición de estado
    const validacion = validateTransicionEstado(pedido.estado, nuevoEstado);
    if (!validacion.isValid) {
      const msg = validacion.errors[0];
      return event.requestContext ? response(400, { message: msg }) : { error: msg };
    }

    // Construir actualización
    const updateExpression = ['estado = :estado', 'fecha_actualizacion = :fecha'];
    const attributeValues = {
      ':estado': nuevoEstado,
      ':fecha': getTimestamp(),
    };

    // Agregar metadata adicional según el estado
    if (metadata.chef_id) {
      updateExpression.push('chef_id = :chef_id');
      attributeValues[':chef_id'] = metadata.chef_id;
    }
    if (metadata.motorizado_id) {
      updateExpression.push('motorizado_id = :motorizado_id');
      attributeValues[':motorizado_id'] = metadata.motorizado_id;
    }
    if (nuevoEstado === 'entregado') {
      updateExpression.push('fecha_fin = :fecha_fin');
      attributeValues[':fecha_fin'] = getTimestamp();
    }

    // Actualizar en DynamoDB
    const updated = await updateItem({
      TableName: TABLA_PEDIDOS,
      Key: { tenant_id: tenantId, pedido_id: pedidoId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeValues: attributeValues,
      ReturnValues: 'ALL_NEW',
    });

    // Registrar log
    await registrarLog({
      userId: userId || pedido.user_id,
      actionType: 'actualizar_estado_pedido',
      pedidoId,
      detalles: {
        estado_anterior: pedido.estado,
        estado_nuevo: nuevoEstado,
        metadata,
      },
    });

    // Notificar si SNS está disponible
    if (SNS_TOPIC_ARN) {
      await publish({
        topicArn: SNS_TOPIC_ARN,
        subject: `Pedido cambió a estado: ${nuevoEstado}`,
        message: {
          pedido_id: pedidoId,
          tenant_id: tenantId,
          estado_anterior: pedido.estado,
          estado_nuevo: nuevoEstado,
        },
        attributes: buildNotificationAttributes({ pedidoId, tipo: nuevoEstado }),
      });
    }

    console.log(`[INFO actualizarEstadoPedido] Pedido ${pedidoId} actualizado de ${pedido.estado} a ${nuevoEstado}`);

    if (event.requestContext) {
      return response(200, { message: 'Estado actualizado', pedido: updated });
    } else {
      return { success: true, pedido: updated };
    }
  } catch (error) {
    console.error('[ERROR actualizarEstadoPedido]', error);
    if (event.requestContext) {
      return response(500, { message: 'Error interno al actualizar estado' });
    } else {
      throw error;
    }
  }
};
