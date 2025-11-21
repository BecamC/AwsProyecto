const { putItem, generateUUID, getTimestamp } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { validateProducto } = require('../../shared/validations');

const TABLA_PRODUCTOS = process.env.TABLA_PRODUCTOS;

exports.handler = async (event) => {
  try {
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    
    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
    }

    const body = JSON.parse(event.body || '{}');
    body.tenant_id = tenantId;

    // Validar datos
    const validation = validateProducto(body);
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

    return response(201, { 
      message: 'Producto creado exitosamente',
      producto: body 
    });
  } catch (error) {
    console.error('Error creando producto', error);
    return response(500, { message: 'Error interno al crear producto' });
  }
};

