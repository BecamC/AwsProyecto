const { getItem, updateItem, getTimestamp } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');

const TABLA_PRODUCTOS = process.env.TABLA_PRODUCTOS;

exports.handler = async (event) => {
  try {
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    const productoId = event.pathParameters?.producto_id;

    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
    }

    if (!productoId) {
      return response(400, { message: 'producto_id es requerido en la URL' });
    }

    // Verificar que el producto existe
    const productoExistente = await getItem(TABLA_PRODUCTOS, {
      tenant_id: tenantId,
      producto_id: productoId
    });

    if (!productoExistente) {
      return response(404, { message: 'Producto no encontrado' });
    }

    const body = JSON.parse(event.body || '{}');
    
    // No permitir cambiar tenant_id ni producto_id
    delete body.tenant_id;
    delete body.producto_id;

    // Actualizar fecha_actualizacion
    body.fecha_actualizacion = getTimestamp();

    // Construir UpdateExpression dinámicamente
    const updateExpressions = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    Object.keys(body).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = body[key];
      updateExpressions.push(`${attrName} = ${attrValue}`);
    });

    if (updateExpressions.length === 0) {
      return response(400, { message: 'No hay campos para actualizar' });
    }

    await updateItem({
      TableName: TABLA_PRODUCTOS,
      Key: { tenant_id: tenantId, producto_id: productoId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW'
    });

    // Obtener producto actualizado
    const productoActualizado = await getItem(TABLA_PRODUCTOS, {
      tenant_id: tenantId,
      producto_id: productoId
    });

    return response(200, { 
      message: 'Producto actualizado exitosamente',
      producto: productoActualizado 
    });
  } catch (error) {
    console.error('Error actualizando producto', error);
    return response(500, { message: 'Error interno al actualizar producto' });
  }
};

