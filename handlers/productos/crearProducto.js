const { putItem, generateUUID, getTimestamp } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { validateProducto } = require('../../shared/validations');

const TABLA_PRODUCTOS = process.env.TABLA_PRODUCTOS;
const TABLA_INVENTARIO = process.env.TABLA_INVENTARIO;

exports.handler = async (event) => {
  try {
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    
    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
    }

    const body = JSON.parse(event.body || '{}');
    body.tenant_id = tenantId;

    // Convertir precio_producto a número si viene como string
    if (body.precio_producto && typeof body.precio_producto === 'string') {
      body.precio_producto = parseFloat(body.precio_producto);
    }

    // Validar datos (isUpdate = false porque es creación)
    const validation = validateProducto(body, false);
    if (!validation.isValid) {
      return response(400, { 
        message: 'Datos inválidos',
        errors: validation.errors 
      });
    }

    // Generar producto_id si no existe
    if (!body.producto_id) {
      body.producto_id = generateUUID();
    }

    // Agregar timestamps
    const now = getTimestamp();
    body.fecha_creacion = now;
    body.fecha_actualizacion = now;

    // Valores por defecto
    if (body.is_active === undefined) {
      body.is_active = true;
    }

    // Guardar producto
    await putItem(TABLA_PRODUCTOS, body);

    // Inicializar inventario para el nuevo producto (solo el inventario controla el stock)
    const inventarioItem = {
      tenant_id: tenantId,
      producto_id: body.producto_id,
      stock_actual: 0, // Inicializar en 0, se ajustará manualmente o por el microservicio de inventario
      stock_minimo: 10,
      stock_maximo: 9999,
      ultima_actualizacion: now,
    };
    await putItem(TABLA_INVENTARIO, inventarioItem);

    return response(201, { 
      message: 'Producto creado exitosamente',
      producto: body 
    });
  } catch (error) {
    console.error('Error creando producto', error);
    return response(500, { 
      message: 'Error interno al crear producto',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

