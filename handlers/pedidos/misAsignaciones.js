const { query } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { requireStaff } = require('../../shared/auth');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;

/**
 * GET /pedido/mis-asignaciones
 * Endpoint para que trabajadores (chef/motorizado) vean sus pedidos asignados
 */
exports.handler = async (event) => {
  try {
    // Manejar preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
      const { CORS_HEADERS } = require('../../shared/auth');
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: ''
      };
    }
    
    // Verificar que sea staff (trabajador o admin)
    const auth = requireStaff(event);
    if (auth.error) {
      return auth.error;
    }

    const { payload } = auth;
    const trabajadorId = payload.user_id;
    const isAdmin = payload.staff_tier === 'admin';
    
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
    }

    const params = event.queryStringParameters || {};
    const tipo = params.tipo; // 'chef', 'motorizado', o null (ambos)

    // Consultar todos los pedidos de la sede
    const tenantQuery = {
      TableName: TABLA_PEDIDOS,
      KeyConditionExpression: 'tenant_id = :tenant_id',
      ExpressionAttributeValues: {
        ':tenant_id': tenantId,
      },
    };

    const result = await query(tenantQuery);
    let pedidos = result.Items || [];

    // Si es admin, puede ver todo (opcionalmente filtrado por tipo)
    if (isAdmin) {
      if (tipo === 'chef') {
        pedidos = pedidos.filter(p => p.chef_id);
      } else if (tipo === 'motorizado') {
        pedidos = pedidos.filter(p => p.motorizado_id);
      }
      // Si no hay tipo, devuelve todos los pedidos con asignaciones
      else {
        pedidos = pedidos.filter(p => p.chef_id || p.motorizado_id);
      }
    } 
    // Si es trabajador, solo ve sus asignaciones
    else {
      if (tipo === 'chef') {
        pedidos = pedidos.filter(p => p.chef_id === trabajadorId);
      } else if (tipo === 'motorizado') {
        pedidos = pedidos.filter(p => p.motorizado_id === trabajadorId);
      } else {
        // Sin filtro, muestra ambos tipos de asignaciones
        pedidos = pedidos.filter(p => 
          p.chef_id === trabajadorId || 
          p.motorizado_id === trabajadorId
        );
      }
    }

    // Agregar información de rol en cada pedido
    const pedidosConRol = pedidos.map(p => ({
      ...p,
      mi_rol: {
        es_chef: p.chef_id === trabajadorId,
        es_motorizado: p.motorizado_id === trabajadorId,
      }
    }));

    return response(200, {
      pedidos: pedidosConRol,
      total: pedidosConRol.length,
      trabajador_id: trabajadorId,
      es_admin: isAdmin,
    });
  } catch (error) {
    console.error('Error consultando asignaciones:', error);
    return response(500, { message: 'Error interno al consultar asignaciones' });
  }
};

