const { getItem, updateItem } = require('../../shared/dynamodb');
const { putEvent } = require('../../shared/eventbridge');
const { registrarLog } = require('../../shared/logs');
const { startExecution } = require('../../shared/stepfunctions');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;
const TABLA_INVENTARIO = process.env.TABLA_INVENTARIO;
const STEP_FUNCTIONS_ARN = process.env.STEP_FUNCTIONS_ARN;

exports.handler = async (event) => {
  const detail = event.detail || {};
  const tenantId = detail.tenant_id;
  const pedidoId = detail.pedido_id;

  if (!tenantId || !pedidoId) {
    console.warn('Evento sin tenant_id o pedido_id', event);
    return;
  }

  try {
    const pedido = await getItem(TABLA_PEDIDOS, {
      tenant_id: tenantId,
      pedido_id: pedidoId,
    });

    if (!pedido) {
      console.warn('Pedido no encontrado para inventario', pedidoId);
      return;
    }

    for (const item of pedido.productos || []) {
      const inventory = await getItem(TABLA_INVENTARIO, {
        tenant_id: tenantId,
        producto_id: item.product_id,
      });

      // Usar stock_actual (campo unificado)
      const stockActual = inventory?.stock_actual ?? inventory?.cantidad_disponible ?? 0;
      if (stockActual < item.quantity) {
        throw new Error(`Inventario insuficiente para producto ${item.product_id}`);
      }

      const nuevosMovimientos = [
        {
          type: 'salida',
          cantidad: item.quantity,
          pedido_id: pedidoId,
          reason: 'venta',
          timestamp: new Date().toISOString(),
        },
        ...(inventory?.ultimos_movimientos || []).slice(0, 9),
      ];

      await updateItem({
        TableName: TABLA_INVENTARIO,
        Key: {
          tenant_id: tenantId,
          producto_id: item.product_id,
        },
        UpdateExpression: 'SET stock_actual = :stock, ultima_actualizacion = :timestamp',
        ExpressionAttributeValues: {
          ':stock': stockActual - item.quantity,
          ':timestamp': new Date().toISOString(),
        },
      });
    }

    await putEvent({
      source: 'inventario.microservicio',
      detailType: 'Inventario Actualizado',
      detail: {
        tenant_id: tenantId,
        pedido_id: pedidoId,
      },
    });

    if (STEP_FUNCTIONS_ARN) {
      await startExecution({
        stateMachineArn: STEP_FUNCTIONS_ARN,
        input: {
          tenant_id: tenantId,
          pedido_id: pedidoId,
        },
      });
    }

    await registrarLog({
      userId: pedido.user_id,
      actionType: 'actualizar_inventario',
      pedidoId,
      detalles: { tenant_id: tenantId, pedido_id: pedidoId },
    });
  } catch (error) {
    console.error('Error actualizando inventario', error);
    await registrarLog({
      userId: detail.usuario_id,
      actionType: 'actualizar_inventario',
      resultado: 'Fallido',
      pedidoId,
      errorMessage: error.message,
    });
    throw error;
  }
};

