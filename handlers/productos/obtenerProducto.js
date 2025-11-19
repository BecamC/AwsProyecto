const { getItem } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { isUUID } = require('../../shared/validations');

const TABLA_PRODUCTOS = process.env.TABLA_PRODUCTOS;

exports.handler = async (event) => {
  try {
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    const productoId = event.pathParameters?.producto_id;

    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
    }

    if (!productoId || !isUUID(productoId)) {
      return response(400, { message: 'producto_id inválido' });
    }

    const producto = await getItem(TABLA_PRODUCTOS, {
      tenant_id: tenantId,
      producto_id: productoId,
    });

    if (!producto) {
      return response(404, { message: 'Producto no encontrado' });
    }

    return response(200, { producto });
  } catch (error) {
    console.error('Error obteniendo producto', error);
    return response(500, { message: 'Error interno al obtener el producto' });
  }
};

