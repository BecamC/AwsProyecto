const { getItem, query } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { isUUID } = require('../../shared/validations');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;

exports.handler = async (event) => {
  try {
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
    }

    const params = event.queryStringParameters || {};

    if (params.pedido_id) {
      if (!isUUID(params.pedido_id)) {
        return response(400, { message: 'pedido_id inválido' });
      }
      const pedido = await getItem(TABLA_PEDIDOS, {
        tenant_id: tenantId,
        pedido_id: params.pedido_id,
      });
      if (!pedido) {
        return response(404, { message: 'Pedido no encontrado' });
      }
      
      // Verificar permisos: solo el dueño o staff puede ver el pedido
      if (!isStaff && pedido.user_id !== authenticatedUserId) {
        return response(403, { message: 'No tienes permiso para ver este pedido' });
      }
      
      return response(200, { pedido });
    }

    if (params.usuario_id) {
      // Solo staff puede consultar pedidos de otros usuarios
      if (!isStaff && params.usuario_id !== authenticatedUserId) {
        return response(403, { message: 'No tienes permiso para ver pedidos de otros usuarios' });
      }
      
      const queryParams = {
        TableName: TABLA_PEDIDOS,
        IndexName: 'user_id-index',
        KeyConditionExpression: 'user_id = :user_id',
        ExpressionAttributeValues: {
          ':user_id': params.usuario_id,
        },
      };

      if (params.fecha_desde && params.fecha_hasta) {
        queryParams.KeyConditionExpression += ' AND fecha_inicio BETWEEN :desde AND :hasta';
        queryParams.ExpressionAttributeValues[':desde'] = params.fecha_desde;
        queryParams.ExpressionAttributeValues[':hasta'] = params.fecha_hasta;
      }

      const pedidos = await query(queryParams);
      return response(200, { pedidos });
    }

    // Consulta por tenant - solo staff puede ver todos los pedidos
    if (!isStaff) {
      // Si es cliente sin parámetros, retornar sus propios pedidos
      const queryParams = {
        TableName: TABLA_PEDIDOS,
        IndexName: 'user_id-index',
        KeyConditionExpression: 'user_id = :user_id',
        ExpressionAttributeValues: {
          ':user_id': authenticatedUserId,
        },
      };
      
      const pedidos = await query(queryParams);
      return response(200, { pedidos });
    }
    
    // Staff puede ver todos los pedidos del tenant
    const tenantQuery = {
      TableName: TABLA_PEDIDOS,
      KeyConditionExpression: 'tenant_id = :tenant_id',
      ExpressionAttributeValues: {
        ':tenant_id': tenantId,
      },
    };

    const pedidos = await query(tenantQuery);
    return response(200, { pedidos });
  } catch (error) {
    console.error('Error consultando pedidos', error);
    return response(500, { message: 'Error interno al consultar pedidos' });
  }
};

