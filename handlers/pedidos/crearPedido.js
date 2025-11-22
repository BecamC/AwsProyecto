const { getItem, putItem, generateUUID, getTimestamp } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { validateCrearPedido } = require('../../shared/validations');
const { sendMessage } = require('../../shared/sqs');
const { registrarLog } = require('../../shared/logs');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;
const TABLA_PRODUCTOS = process.env.TABLA_PRODUCTOS;
const TABLA_INVENTARIO = process.env.TABLA_INVENTARIO;
const SQS_PEDIDOS_URL = process.env.SQS_PEDIDOS_URL;

exports.handler = async (event) => {
  const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
  if (!tenantId) {
    return response(400, { message: 'x-tenant-id header es requerido' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { message: 'Body inválido' });
  }

  const validation = validateCrearPedido(payload);
  if (!validation.isValid) {
    return response(400, { message: 'Datos inválidos', detalles: validation.errors });
  }

  const pedidoId = generateUUID();
  const fechaInicio = getTimestamp();

  try {
    const productosDetallados = [];
    let total = 0;

    for (const item of payload.productos) {
      console.log('[DEBUG] Procesando producto:', JSON.stringify(item));
      
      const producto = await getItem(TABLA_PRODUCTOS, {
        tenant_id: tenantId,
        producto_id: item.producto_id,
      });
      
      console.log('[DEBUG] Producto obtenido de BD:', JSON.stringify(producto));
      
      if (!producto || producto.is_active === false) {
        return response(400, { message: `Producto ${item.producto_id} no está disponible` });
      }

      const inventario = await getItem(TABLA_INVENTARIO, {
        tenant_id: tenantId,
        producto_id: item.producto_id,
      });
      
      console.log('[DEBUG] Inventario obtenido:', JSON.stringify(inventario));

      // Usar stock_actual (campo unificado)
      const stockDisponible = inventario?.stock_actual ?? inventario?.cantidad_disponible ?? 0;
      if (!inventario || stockDisponible < item.cantidad) {
        return response(400, { message: `Inventario insuficiente para producto ${item.producto_id}` });
      }

      // Obtener precio y validar
      const precioProducto = producto.precio_producto;
      console.log('[DEBUG] Precio del producto:', precioProducto, 'Tipo:', typeof precioProducto);
      
      const price = (precioProducto !== undefined && precioProducto !== null && !isNaN(precioProducto)) 
        ? Number(precioProducto) 
        : 0;
      const subtotal = price * item.cantidad;
      
      console.log('[DEBUG] Precio calculado:', price, 'Subtotal:', subtotal);

      // Validar y generar SKU si no existe
      let sku = producto.sku;
      console.log('[DEBUG] SKU del producto:', sku, 'Tipo:', typeof sku);
      
      if (!sku || (typeof sku === 'string' && sku.trim() === '') || sku === undefined || sku === null) {
        // Generar SKU por defecto usando los primeros 8 caracteres del producto_id
        sku = `SKU-${item.producto_id.substring(0, 8).toUpperCase()}`;
        console.log(`[SKU] Producto ${item.producto_id} no tiene SKU. Generado automáticamente: ${sku}`);
      }

      // Asegurar que todos los campos tengan valores válidos (no undefined, no NaN)
      const productoDetalle = {
        product_id: item.producto_id,
        sku: (sku && typeof sku === 'string') ? sku : '', // Asegurar que sea string válido
        price: (isNaN(price) ? 0 : price), // Asegurar que nunca sea NaN
        quantity: (item.cantidad && !isNaN(item.cantidad)) ? Number(item.cantidad) : 1, // Asegurar que sea número válido
      };
      
      console.log('[DEBUG] Producto detalle a agregar:', JSON.stringify(productoDetalle));
      
      // Verificar si hay algún undefined antes de agregar
      for (const [key, value] of Object.entries(productoDetalle)) {
        if (value === undefined) {
          console.error(`[ERROR] Campo ${key} es undefined en productoDetalle!`);
        }
      }
      
      productosDetallados.push(productoDetalle);

      total += subtotal;
    }
    
    console.log('[DEBUG] Total productos procesados:', productosDetallados.length);
    console.log('[DEBUG] Productos detallados completos:', JSON.stringify(productosDetallados));

    // Asegurar que total sea un número válido
    const precioTotal = (isNaN(total) || total === undefined || total === null) ? 0 : Number(total);

    const pedido = {
      tenant_id: tenantId,
      pedido_id: pedidoId,
      user_id: payload.usuario_id, // Mantener user_id en la BD, pero recibir usuario_id del payload
      productos: productosDetallados,
      precio_total: precioTotal,
      direccion_entrega: payload.direccion_entrega,
      telefono: payload.telefono,
      notas: payload.notas || '',
      estado: 'pendiente',
      fecha_inicio: fechaInicio,
      fecha_fin: null,
      medio_pago: payload.medio_pago || 'no_especificado',
      chef_id: null,
      motorizado_id: null,
    };
    
    console.log('[DEBUG] Pedido antes de limpiar:', JSON.stringify(pedido));
    
    // Limpiar explícitamente todos los campos que podrían ser undefined
    // Asegurar que todos los campos tengan valores válidos
    if (pedido.fecha_fin === undefined) pedido.fecha_fin = null;
    if (pedido.chef_id === undefined) pedido.chef_id = null;
    if (pedido.motorizado_id === undefined) pedido.motorizado_id = null;
    if (pedido.notas === undefined) pedido.notas = '';
    if (pedido.medio_pago === undefined) pedido.medio_pago = 'no_especificado';
    
    // Validar que productosDetallados no tenga undefined
    pedido.productos = pedido.productos.map(p => {
      console.log('[DEBUG] Limpiando producto:', JSON.stringify(p));
      
      // Verificar cada campo antes de la limpieza
      if (p.product_id === undefined) console.error('[ERROR] product_id es undefined');
      if (p.sku === undefined) console.error('[ERROR] sku es undefined');
      if (p.price === undefined) console.error('[ERROR] price es undefined');
      if (p.quantity === undefined) console.error('[ERROR] quantity es undefined');
      
      return {
        product_id: p.product_id || '',
        sku: p.sku || '',
        price: (p.price !== undefined && !isNaN(p.price)) ? Number(p.price) : 0,
        quantity: (p.quantity !== undefined && !isNaN(p.quantity)) ? Number(p.quantity) : 1,
      };
    });
    
    console.log('[DEBUG] Pedido después de limpiar:', JSON.stringify(pedido));
    
    // Verificar si hay algún undefined en el pedido completo
    const checkUndefined = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (value === undefined) {
          console.error(`[ERROR] Campo ${currentPath} es undefined!`);
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          checkUndefined(value, currentPath);
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              checkUndefined(item, `${currentPath}[${index}]`);
            }
          });
        }
      }
    };
    
    console.log('[DEBUG] Verificando undefined en el pedido completo...');
    checkUndefined(pedido);

    console.log('[DEBUG] Intentando guardar pedido en DynamoDB...');
    await putItem(TABLA_PEDIDOS, pedido);
    console.log('[DEBUG] Pedido guardado exitosamente en DynamoDB');

    if (SQS_PEDIDOS_URL) {
      await sendMessage(SQS_PEDIDOS_URL, {
        source: 'pedidos.microservicio',
        type: 'Pedido Creado',
        detalle: {
          tenant_id: tenantId,
          pedido_id: pedidoId,
        },
      });
    }

    await registrarLog({
      userId: payload.usuario_id,
      actionType: 'crear_pedido',
      pedidoId: pedidoId,
      productoId: productosDetallados.length > 0 ? productosDetallados[0].product_id : null, // Primer producto del pedido
      detalles: pedido,
    });

    return response(201, { message: 'Pedido creado', pedido });
  } catch (error) {
    console.error('Error creando pedido', error);
    await registrarLog({
      userId: payload.usuario_id,
      actionType: 'crear_pedido',
      resultado: 'Fallido',
      pedidoId: pedidoId,
      productoId: null,
      errorMessage: error.message,
    });
    return response(500, { message: 'Error interno al crear pedido' });
  }
};

