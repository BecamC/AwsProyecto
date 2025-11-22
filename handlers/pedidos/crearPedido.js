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
      const producto = await getItem(TABLA_PRODUCTOS, {
        tenant_id: tenantId,
        producto_id: item.producto_id,
      });
      if (!producto || producto.is_active === false) {
        return response(400, { message: `Producto ${item.producto_id} no está disponible` });
      }

      const inventario = await getItem(TABLA_INVENTARIO, {
        tenant_id: tenantId,
        producto_id: item.producto_id,
      });

      // Usar stock_actual (campo unificado)
      const stockDisponible = inventario?.stock_actual ?? inventario?.cantidad_disponible ?? 0;
      if (!inventario || stockDisponible < item.cantidad) {
        return response(400, { message: `Inventario insuficiente para producto ${item.producto_id}` });
      }

      const price = Number(producto.precio_producto);
      const subtotal = price * item.cantidad;

      productosDetallados.push({
        product_id: item.producto_id,
        sku: producto.sku,
        price,
        quantity: item.cantidad,
      });

      total += subtotal;
    }

    const pedido = {
      tenant_id: tenantId,
      pedido_id: pedidoId,
      user_id: payload.usuario_id,
      productos: productosDetallados,
      precio_total: total,
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

    await putItem(TABLA_PEDIDOS, pedido);

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
      pedidoId,
      detalles: pedido,
    });

    return response(201, { message: 'Pedido creado', pedido });
  } catch (error) {
    console.error('Error creando pedido', error);
    await registrarLog({
      userId: payload.usuario_id,
      actionType: 'crear_pedido',
      resultado: 'Fallido',
      pedidoId,
      errorMessage: error.message,
    });
    return response(500, { message: 'Error interno al crear pedido' });
  }
};

