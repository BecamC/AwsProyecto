const { query } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');

const TABLA_INVENTARIO = process.env.TABLA_INVENTARIO;

exports.handler = async (event) => {
  try {
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
    }

    const inventario = await query({
      TableName: TABLA_INVENTARIO,
      KeyConditionExpression: 'tenant_id = :tenant_id',
      ExpressionAttributeValues: {
        ':tenant_id': tenantId,
      },
    });

    return response(200, { inventario });
  } catch (error) {
    console.error('Error consultando inventario', error);
    return response(500, { message: 'Error interno al consultar inventario' });
  }
};

