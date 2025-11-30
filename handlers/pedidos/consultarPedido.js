const { getItem, query } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { isUUID } = require('../../shared/validations');
const { requireAuth } = require('../../shared/auth');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;

exports.handler = async (event) => {
  try {
    // Verificar autenticación
    const auth = requireAuth(event);
    if (auth.error) {
      return auth.error;
    }
    
    const { payload } = auth;
    const authenticatedUserId = payload.user_id;
    const isStaff = payload.user_type === 'staff';
    
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
    }

    const params = event.queryStringParameters || {};

    if (params.pedido_id) {
      if (!isUUID(params.pedido_id)) {
        return response(400, { message: 'pedido_id inválido' });
      }
      
      // Buscar pedido en todas las sedes (no filtrar por tenant_id)
      // porque el usuario puede tener pedidos en diferentes sedes
      const pedido = await getItem(TABLA_PEDIDOS, {
        tenant_id: tenantId,
        pedido_id: params.pedido_id,
      });
      
      // Si no se encuentra con el tenant_id actual, buscar en otros tenants
      // (solo para usuarios que pueden tener pedidos en múltiples sedes)
      if (!pedido && !isStaff) {
        // Intentar buscar en otras sedes comunes
        const sedes = ['pardo_miraflores', 'pardo_surco'];
        for (const sede of sedes) {
          if (sede !== tenantId) {
            const pedidoEnOtraSede = await getItem(TABLA_PEDIDOS, {
              tenant_id: sede,
              pedido_id: params.pedido_id,
            });
            if (pedidoEnOtraSede && pedidoEnOtraSede.user_id === authenticatedUserId) {
              return response(200, { pedido: pedidoEnOtraSede });
            }
          }
        }
        return response(404, { message: 'Pedido no encontrado' });
      }
      
      if (!pedido) {
        return response(404, { message: 'Pedido no encontrado' });
      }
      
      // Verificar permisos: solo el dueño o staff puede ver el pedido
      if (!isStaff && pedido.user_id !== authenticatedUserId) {
        return response(403, { message: 'No tienes permiso para ver este pedido' });
      }
      
      // Si es trabajador (no admin), verificar que esté asignado al pedido
      if (isStaff && payload.staff_tier === 'trabajador') {
        const estaAsignado = 
          pedido.chef_id === authenticatedUserId || 
          pedido.motorizado_id === authenticatedUserId;
        
        if (!estaAsignado) {
          return response(403, { message: 'No tienes permiso para ver este pedido. No está asignado a ti.' });
        }
      }
      
      return response(200, { pedido });
    }

    if (params.usuario_id) {
      // Si es cliente consultando sus propios pedidos, permitir
      // Si es staff, puede consultar cualquier usuario
      if (!isStaff && params.usuario_id !== authenticatedUserId) {
        return response(403, { message: 'No tienes permiso para ver pedidos de otros usuarios' });
      }
      
      // Buscar pedidos del usuario en todas las sedes usando el índice user_id-index
      const queryParams = {
        TableName: TABLA_PEDIDOS,
        IndexName: 'user_id-index',
        KeyConditionExpression: 'user_id = :user_id',
        ExpressionAttributeValues: {
          ':user_id': params.usuario_id,
        },
      };

      // Si hay filtro de fecha, agregarlo como FilterExpression
      // (fecha_inicio es RANGE key del índice, pero podemos filtrar después de la query)
      if (params.fecha_desde && params.fecha_hasta) {
        queryParams.FilterExpression = 'fecha_inicio BETWEEN :desde AND :hasta';
        queryParams.ExpressionAttributeValues[':desde'] = params.fecha_desde;
        queryParams.ExpressionAttributeValues[':hasta'] = params.fecha_hasta;
      }

      const result = await query(queryParams);
      let pedidos = result.Items || [];
      
      // Filtrar por tenant_id si es necesario (para staff que quiere ver solo de su sede)
      if (isStaff && params.tenant_id) {
        pedidos = pedidos.filter(p => p.tenant_id === params.tenant_id);
      }
      
      return response(200, { pedidos });
    }

    // Consulta sin parámetros específicos
    if (!isStaff) {
      // Si es cliente sin parámetros, retornar sus propios pedidos de todas las sedes
      const queryParams = {
        TableName: TABLA_PEDIDOS,
        IndexName: 'user_id-index',
        KeyConditionExpression: 'user_id = :user_id',
        ExpressionAttributeValues: {
          ':user_id': authenticatedUserId,
        },
      };
      
      const result = await query(queryParams);
      const pedidos = result.Items || [];
      
      return response(200, { pedidos });
    }
    
    // Staff puede ver pedidos según su tier
    const tenantQuery = {
      TableName: TABLA_PEDIDOS,
      KeyConditionExpression: 'tenant_id = :tenant_id',
      ExpressionAttributeValues: {
        ':tenant_id': tenantId,
      },
    };

    const result = await query(tenantQuery);
    let pedidos = result.Items || [];
    
    // Si es trabajador (no admin), filtrar solo los pedidos asignados a él
    if (payload.staff_tier === 'trabajador') {
      pedidos = pedidos.filter(p => 
        p.chef_id === authenticatedUserId || 
        p.motorizado_id === authenticatedUserId
      );
    }
    
    return response(200, { pedidos });
  } catch (error) {
    console.error('Error consultando pedidos', error);
    return response(500, { message: 'Error interno al consultar pedidos' });
  }
};

