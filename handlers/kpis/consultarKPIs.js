const { query, getItem } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { requireAuth } = require('../../shared/auth');

const TABLA_KPIS = process.env.TABLA_KPIS;

/**
 * GET /kpis/consultar
 * Consulta KPIs por tenant_id y fecha
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

    // Verificar autenticación
    const auth = requireAuth(event);
    if (auth.error) {
      return auth.error;
    }

    const { payload } = auth;
    
    // Solo staff puede ver KPIs
    if (payload.user_type !== 'staff') {
      return response(403, { message: 'Acceso denegado. Solo para personal autorizado.' });
    }

    const params = event.queryStringParameters || {};
    const tenantId = params.tenant_id || event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    const fecha = params.fecha;

    if (!tenantId) {
      return response(400, { message: 'tenant_id es requerido' });
    }

    // Si no se proporciona fecha, usar la fecha actual
    const fechaConsulta = fecha || new Date().toISOString().split('T')[0];

    // Consultar KPIs por tenant_id y fecha
    const kpi = await getItem(TABLA_KPIS, {
      tenant_id: tenantId,
      fecha: fechaConsulta
    });

    if (!kpi) {
      // Si no hay KPIs para esa fecha, retornar estructura vacía
      return response(200, {
        tenant_id: tenantId,
        fecha: fechaConsulta,
        numero_pedidos: 0,
        ingresos_dia: 0,
        ticket_promedio: 0,
        top_productos: [],
        message: 'No hay KPIs calculados para esta fecha'
      });
    }

    return response(200, {
      tenant_id: kpi.tenant_id,
      fecha: kpi.fecha,
      numero_pedidos: kpi.numero_pedidos || 0,
      ingresos_dia: kpi.ingresos_dia || 0,
      ticket_promedio: kpi.ticket_promedio || 0,
      top_productos: kpi.top_productos || []
    });
  } catch (error) {
    console.error('Error consultando KPIs:', error);
    return response(500, { message: 'Error interno al consultar KPIs', error: error.message });
  }
};

