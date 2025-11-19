const { query } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');

const TABLA_PRODUCTOS = process.env.TABLA_PRODUCTOS;

exports.handler = async (event) => {
  try {
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];

    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
    }

    const productos = await query({
      TableName: TABLA_PRODUCTOS,
      KeyConditionExpression: 'tenant_id = :tenant_id',
      ExpressionAttributeValues: {
        ':tenant_id': tenantId,
      },
    });

    return response(200, { productos });
  } catch (error) {
    console.error('Error obteniendo productos', error);
    return response(500, { message: 'Error interno al obtener productos' });
  }
};

