const { query } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');

const TABLA_INVENTARIO = process.env.TABLA_INVENTARIO;

exports.handler = async (event) => {
  try {
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
    }

    // Permitir filtro opcional desde el body
    const body = JSON.parse(event.body || '{}');
    const productoId = body.producto_id;

    let inventario;
    if (productoId) {
      // Consultar un producto específico
      const { getItem } = require('../../shared/dynamodb');
      const item = await getItem(TABLA_INVENTARIO, {
        tenant_id: tenantId,
        producto_id: productoId
      });
      inventario = item ? [item] : [];
    } else {
      // Consultar todos los productos del tenant
      inventario = await query({
        TableName: TABLA_INVENTARIO,
        KeyConditionExpression: 'tenant_id = :tenant_id',
        ExpressionAttributeValues: {
          ':tenant_id': tenantId
        }
      });
    }

    return response(200, { inventario });
  } catch (error) {
    console.error('Error consultando inventario', error);
    return response(500, { message: 'Error interno al consultar inventario' });
  }
};

