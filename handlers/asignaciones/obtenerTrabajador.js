const { getItem, query } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { requireStaff } = require('../../shared/auth');

const TABLA_STAFF = process.env.TABLA_STAFF;

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
    
    // Verificar autenticación y permisos de staff
    const auth = requireStaff(event);
    if (auth.error) {
      return auth.error;
    }

    const { payload } = auth;
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    
    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
    }

    // Verificar permisos: admin general puede consultar trabajadores de cualquier sede
    // Admin por sede y trabajadores solo pueden consultar trabajadores de su propia sede
    const isAdminGeneral = payload.staff_tier === 'admin' && (!payload.tenant_id_sede || payload.tenant_id_sede === 'GENERAL');
    const userTenantId = payload.tenant_id_sede;
    
    if (!isAdminGeneral && userTenantId !== tenantId) {
      return response(403, { message: 'No tienes permiso para consultar trabajadores de esta sede' });
    }

    const params = event.queryStringParameters || {};
    const { email, staff_tier, is_active } = params;

    // Si se proporciona un email específico, obtener ese trabajador
    if (email) {
      const trabajador = await getItem(TABLA_STAFF, {
        tenant_id_sede: tenantId,
        email: email.toLowerCase(),
      });

      if (!trabajador) {
        return response(404, { message: 'Trabajador no encontrado' });
      }

      // No retornar la contraseña
      const { password, ...trabajadorSinPassword } = trabajador;

      return response(200, {
        trabajador: trabajadorSinPassword,
      });
    }

    // Si no hay email, listar todos los trabajadores de la sede
    const queryParams = {
      TableName: TABLA_STAFF,
      KeyConditionExpression: 'tenant_id_sede = :tenant_id',
      ExpressionAttributeValues: {
        ':tenant_id': tenantId,
      },
    };

    // Filtros opcionales
    const filterExpressions = [];
    
    if (staff_tier) {
      if (!['admin', 'trabajador'].includes(staff_tier)) {
        return response(400, { message: 'staff_tier debe ser "admin" o "trabajador"' });
      }
      filterExpressions.push('staff_tier = :staff_tier');
      queryParams.ExpressionAttributeValues[':staff_tier'] = staff_tier;
    }

    if (is_active !== undefined) {
      const isActiveBool = is_active === 'true' || is_active === true;
      filterExpressions.push('is_active = :is_active');
      queryParams.ExpressionAttributeValues[':is_active'] = isActiveBool;
    }

    if (filterExpressions.length > 0) {
      queryParams.FilterExpression = filterExpressions.join(' AND ');
    }

    const result = await query(queryParams);
    const trabajadores = (result.Items || []).map(trabajador => {
      // No retornar la contraseña
      const { password, ...trabajadorSinPassword } = trabajador;
      return trabajadorSinPassword;
    });

    return response(200, {
      trabajadores: trabajadores,
      total: trabajadores.length,
    });
  } catch (error) {
    console.error('Error obteniendo trabajadores:', error);
    return response(500, {
      message: 'Error interno al obtener trabajadores',
      error: error.message,
    });
  }
};

