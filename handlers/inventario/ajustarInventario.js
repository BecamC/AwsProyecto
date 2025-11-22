const { getItem, putItem, getTimestamp } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');

const TABLA_INVENTARIO = process.env.TABLA_INVENTARIO;

exports.handler = async (event) => {
  try {
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    
    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
    }

    const body = JSON.parse(event.body || '{}');
    // Aceptar ambos formatos: cantidad/cantidad_ajuste, tipo_movimiento/tipo_ajuste
    const producto_id = body.producto_id;
    const cantidad = body.cantidad ?? body.cantidad_ajuste;
    const tipo_movimiento = body.tipo_movimiento ?? body.tipo_ajuste;
    const reason = body.reason ?? body.notas;
    const pedido_id = body.pedido_id;
    const user_id = body.user_id;

    if (!producto_id || cantidad === undefined || !tipo_movimiento) {
      return response(400, { 
        message: 'producto_id, cantidad (o cantidad_ajuste) y tipo_movimiento (o tipo_ajuste) son requeridos' 
      });
    }

    // Validar tipo_movimiento
    const tiposValidos = ['entrada', 'salida', 'ajuste'];
    if (!tiposValidos.includes(tipo_movimiento)) {
      return response(400, { 
        message: `tipo_movimiento debe ser uno de: ${tiposValidos.join(', ')}` 
      });
    }

    // Obtener inventario actual
    let inventario = await getItem(TABLA_INVENTARIO, {
      tenant_id: tenantId,
      producto_id: producto_id
    });

    const now = getTimestamp();

    if (!inventario) {
      // Crear nuevo registro de inventario
      inventario = {
        tenant_id: tenantId,
        producto_id: producto_id,
        stock_actual: tipo_movimiento === 'entrada' ? cantidad : 0,
        stock_minimo: body.stock_minimo || 10,
        stock_maximo: body.stock_maximo || 1000,
        ultima_actualizacion: now
      };
    }

    // Usar stock_actual (campo unificado)
    const stockActual = inventario?.stock_actual ?? inventario?.cantidad_disponible ?? 0;

    // Actualizar stock según tipo de movimiento
    if (tipo_movimiento === 'entrada') {
      inventario.stock_actual = stockActual + cantidad;
    } else if (tipo_movimiento === 'salida') {
      inventario.stock_actual = Math.max(0, stockActual - cantidad);
    } else if (tipo_movimiento === 'ajuste') {
      inventario.stock_actual = cantidad;
    }

    inventario.ultima_actualizacion = now;

    // Actualizar stock_minimo y stock_maximo si se proporcionan
    if (body.stock_minimo !== undefined) {
      inventario.stock_minimo = body.stock_minimo;
    }
    if (body.stock_maximo !== undefined) {
      inventario.stock_maximo = body.stock_maximo;
    }

    // Guardar inventario actualizado
    await putItem(TABLA_INVENTARIO, inventario);

    return response(200, { 
      message: 'Inventario ajustado exitosamente',
      inventario: {
        tenant_id: inventario.tenant_id,
        producto_id: inventario.producto_id,
        stock_actual: inventario.stock_actual,
        stock_minimo: inventario.stock_minimo,
        stock_maximo: inventario.stock_maximo,
        ultima_actualizacion: inventario.ultima_actualizacion
      }
    });
  } catch (error) {
    console.error('Error ajustando inventario', error);
    return response(500, { message: 'Error interno al ajustar inventario' });
  }
};

