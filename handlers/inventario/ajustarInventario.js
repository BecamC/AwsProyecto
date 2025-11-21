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
    const { producto_id, cantidad, tipo_movimiento, reason, pedido_id } = body;

    if (!producto_id || cantidad === undefined || !tipo_movimiento) {
      return response(400, { 
        message: 'producto_id, cantidad y tipo_movimiento son requeridos' 
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
        cantidad_disponible: tipo_movimiento === 'entrada' ? cantidad : 0,
        ultimos_movimientos: [],
        stock_minimo: body.stock_minimo || 10,
        stock_maximo: body.stock_maximo || 1000,
        ultima_actualizacion: now
      };
    }

    // Actualizar cantidad disponible según tipo de movimiento
    if (tipo_movimiento === 'entrada') {
      inventario.cantidad_disponible = (inventario.cantidad_disponible || 0) + cantidad;
    } else if (tipo_movimiento === 'salida') {
      inventario.cantidad_disponible = Math.max(0, (inventario.cantidad_disponible || 0) - cantidad);
    } else if (tipo_movimiento === 'ajuste') {
      inventario.cantidad_disponible = cantidad;
    }

    // Agregar movimiento al historial
    const nuevoMovimiento = {
      type: tipo_movimiento,
      cantidad: cantidad,
      pedido_id: pedido_id || null,
      reason: reason || 'Ajuste manual',
      timestamp: now
    };

    if (!inventario.ultimos_movimientos) {
      inventario.ultimos_movimientos = [];
    }

    inventario.ultimos_movimientos.unshift(nuevoMovimiento);
    
    // Mantener solo los últimos 50 movimientos
    if (inventario.ultimos_movimientos.length > 50) {
      inventario.ultimos_movimientos = inventario.ultimos_movimientos.slice(0, 50);
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
        cantidad_disponible: inventario.cantidad_disponible,
        ultimo_movimiento: nuevoMovimiento
      }
    });
  } catch (error) {
    console.error('Error ajustando inventario', error);
    return response(500, { message: 'Error interno al ajustar inventario' });
  }
};

