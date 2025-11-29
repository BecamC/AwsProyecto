const { getItem, deleteItem } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { requireStaff } = require('../../shared/auth');

const TABLA_PRODUCTOS = process.env.TABLA_PRODUCTOS;

exports.handler = async (event) => {
  try {
    // Verificar autenticación y permisos de staff
    const auth = requireStaff(event, 'manage_products');
    if (auth.error) {
      return auth.error;
    }
    
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    const productoId = event.pathParameters?.producto_id;

    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
    }

    if (!productoId) {
      return response(400, { message: 'producto_id es requerido en la URL' });
    }

    // Verificar que el producto existe
    const producto = await getItem(TABLA_PRODUCTOS, {
      tenant_id: tenantId,
      producto_id: productoId
    });

    if (!producto) {
      return response(404, { message: 'Producto no encontrado' });
    }

    // Eliminar producto
    await deleteItem(TABLA_PRODUCTOS, {
      tenant_id: tenantId,
      producto_id: productoId
    });

    return response(200, { 
      message: 'Producto eliminado exitosamente',
      producto_id: productoId 
    });
  } catch (error) {
    console.error('Error eliminando producto', error);
    return response(500, { message: 'Error interno al eliminar producto' });
  }
};

