const { query, getItem, scan } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { requireAuth } = require('../../shared/auth');

const TABLA_KPIS = process.env.TABLA_KPIS;

/**
 * GET /kpis/consultar
 * Consulta KPIs por tenant_id y fecha (opcional)
 * Si no se proporciona fecha, retorna KPIs agregados de todos los tiempos
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

    // Si se proporciona fecha, consultar solo ese día
    if (fecha) {
      const kpi = await getItem(TABLA_KPIS, {
        tenant_id: tenantId,
        fecha: fecha
      });

      if (!kpi) {
        return response(200, {
          tenant_id: tenantId,
          fecha: fecha,
          numero_pedidos: 0,
          ingresos_dia: 0,
          ticket_promedio: 0,
          top_productos: [],
          estados_pedidos: {
            completados: 0,
            cancelados: 0,
            pendientes: 0,
            preparando: 0,
            despachando: 0,
            en_camino: 0,
            entregado: 0,
            rechazado: 0
          },
          tasa_exito: 0,
          ingresos_por_hora: Array.from({ length: 24 }, (_, i) => ({
            hora: i,
            hora_formato: `${String(i).padStart(2, '0')}:00`,
            ingresos: 0
          })),
          metodos_pago: [],
          message: 'No hay KPIs calculados para esta fecha'
        });
      }

      return response(200, {
        tenant_id: kpi.tenant_id,
        fecha: kpi.fecha,
        numero_pedidos: kpi.numero_pedidos || 0,
        ingresos_dia: kpi.ingresos_dia || 0,
        ticket_promedio: kpi.ticket_promedio || 0,
        top_productos: kpi.top_productos || [],
        estados_pedidos: kpi.estados_pedidos || {
          completados: 0,
          cancelados: 0,
          pendientes: 0,
          preparando: 0,
          despachando: 0,
          en_camino: 0,
          entregado: 0,
          rechazado: 0
        },
        tasa_exito: kpi.tasa_exito || 0,
        ingresos_por_hora: (() => {
          // Formatear ingresos_por_hora si viene como array de números
          if (kpi.ingresos_por_hora && Array.isArray(kpi.ingresos_por_hora)) {
            // Verificar si ya está formateado como objetos
            if (kpi.ingresos_por_hora.length > 0 && typeof kpi.ingresos_por_hora[0] === 'object') {
              return kpi.ingresos_por_hora;
            } else {
              // Si es array de números, formatearlo
              return kpi.ingresos_por_hora.map((ingreso, hora) => ({
                hora: hora,
                hora_formato: `${String(hora).padStart(2, '0')}:00`,
                ingresos: Number(ingreso) || 0
              }));
            }
          }
          // Si no hay datos, crear array vacío con 24 horas
          return Array.from({ length: 24 }, (_, i) => ({
            hora: i,
            hora_formato: `${String(i).padStart(2, '0')}:00`,
            ingresos: 0
          }));
        })(),
        metodos_pago: kpi.metodos_pago || []
      });
    }

    // Si NO se proporciona fecha, buscar primero el KPI global (fecha: 'GLOBAL')
    let kpiData = await getItem(TABLA_KPIS, {
      tenant_id: tenantId,
      fecha: 'GLOBAL'
    });

    // Si no hay un KPI 'GLOBAL' precalculado, agregarlos manualmente
    if (!kpiData) {
      console.log('No se encontró KPI GLOBAL, agregando KPIs diarios...');
      const kpisQuery = {
        TableName: TABLA_KPIS,
        KeyConditionExpression: 'tenant_id = :tenant_id',
        ExpressionAttributeValues: {
          ':tenant_id': tenantId
        }
      };

      const kpisResult = await query(kpisQuery);
      const todosLosKPIs = kpisResult.Items || [];

      // Filtrar solo los KPIs diarios (excluir 'GLOBAL')
      const dailyKpis = todosLosKPIs.filter(k => k.fecha !== 'GLOBAL');

      if (dailyKpis.length === 0) {
      return response(200, {
        tenant_id: tenantId,
        fecha: null,
        numero_pedidos: 0,
        ingresos_dia: 0,
        ticket_promedio: 0,
        top_productos: [],
        estados_pedidos: {
          completados: 0,
          cancelados: 0,
          pendientes: 0,
          preparando: 0,
          despachando: 0,
          en_camino: 0,
          entregado: 0,
          rechazado: 0
        },
        tasa_exito: 0,
        ingresos_por_hora: Array(24).fill(0),
        metodos_pago: [],
        message: 'No hay KPIs calculados'
      });
    }

    // Agregar todos los KPIs
    let totalPedidos = 0;
    let totalIngresos = 0;
    const productosMap = {};
    const estadosAgregados = {
      completados: 0,
      cancelados: 0,
      pendientes: 0,
      preparando: 0,
      despachando: 0,
      en_camino: 0,
      entregado: 0,
      rechazado: 0
    };
    const ingresosPorHora = Array(24).fill(0);
    const metodosPagoMap = {};

      dailyKpis.forEach(kpi => {
      totalPedidos += kpi.numero_pedidos || 0;
      totalIngresos += kpi.ingresos_dia || 0;

      // Agregar estados
      if (kpi.estados_pedidos) {
        Object.keys(estadosAgregados).forEach(estado => {
          estadosAgregados[estado] += kpi.estados_pedidos[estado] || 0;
        });
      }

      // Agregar productos top
      if (kpi.top_productos && Array.isArray(kpi.top_productos)) {
        kpi.top_productos.forEach(producto => {
          const productId = producto.product_id;
          if (!productosMap[productId]) {
            productosMap[productId] = {
              product_id: productId,
              nombre: producto.nombre || 'Producto sin nombre',
              cantidad_vendida: 0
            };
          }
          // Manejar tanto cantidad_vendida como cantidad_total (para compatibilidad)
          const cantidad = producto.cantidad_vendida || producto.cantidad_total || 0;
          productosMap[productId].cantidad_vendida += cantidad;
        });
      }

      // Agregar ingresos por hora
      // Puede venir como array de números o array de objetos
      if (kpi.ingresos_por_hora && Array.isArray(kpi.ingresos_por_hora)) {
        kpi.ingresos_por_hora.forEach((item, index) => {
          const hora = index;
          let ingreso = 0;
          
          // Si es un objeto, extraer el valor de ingresos
          if (typeof item === 'object' && item !== null) {
            ingreso = Number(item.ingresos || item) || 0;
          } else {
            // Si es un número directo
            ingreso = Number(item) || 0;
          }
          
          if (hora >= 0 && hora < 24) {
            ingresosPorHora[hora] += ingreso;
          }
        });
      }

      // Agregar métodos de pago
      if (kpi.metodos_pago && Array.isArray(kpi.metodos_pago)) {
        kpi.metodos_pago.forEach(metodo => {
          const metodoKey = metodo.metodo || 'desconocido';
          if (!metodosPagoMap[metodoKey]) {
            metodosPagoMap[metodoKey] = {
              metodo: metodoKey,
              cantidad: 0,
              ingresos: 0
            };
          }
          metodosPagoMap[metodoKey].cantidad += metodo.cantidad || 0;
          metodosPagoMap[metodoKey].ingresos += metodo.ingresos || 0;
        });
      }
    });

    // Calcular top productos
    const topProductos = Object.values(productosMap)
      .sort((a, b) => b.cantidad_vendida - a.cantidad_vendida)
      .slice(0, 3);

    // Calcular métodos de pago con porcentajes
    const metodosPagoArray = Object.values(metodosPagoMap).map(mp => ({
      ...mp,
      ingresos: Number(mp.ingresos.toFixed(2)),
      porcentaje_cantidad: totalPedidos > 0 ? Number(((mp.cantidad / totalPedidos) * 100).toFixed(2)) : 0,
      porcentaje_ingresos: totalIngresos > 0 ? Number(((mp.ingresos / totalIngresos) * 100).toFixed(2)) : 0,
    }));

    const ticketPromedio = totalPedidos > 0 ? totalIngresos / totalPedidos : 0;
    const tasaExito = totalPedidos > 0 ? (estadosAgregados.completados / totalPedidos) * 100 : 0;

    // Formatear ingresos_por_hora como array de objetos para el frontend
    const ingresosPorHoraFormateado = ingresosPorHora.map((ingreso, hora) => ({
      hora: hora,
      hora_formato: `${String(hora).padStart(2, '0')}:00`,
      ingresos: Number(ingreso.toFixed(2))
    }));

      return response(200, {
        tenant_id: tenantId,
        fecha: null, // null indica que es agregado global
        numero_pedidos: totalPedidos,
        ingresos_dia: Number(totalIngresos.toFixed(2)),
        ticket_promedio: Number(ticketPromedio.toFixed(2)),
        top_productos: topProductos,
        estados_pedidos: estadosAgregados,
        tasa_exito: Number(tasaExito.toFixed(2)),
        ingresos_por_hora: ingresosPorHoraFormateado,
        metodos_pago: metodosPagoArray
      });
    }

    // Si existe el KPI global, usarlo directamente
    console.log('Usando KPI GLOBAL precalculado');
    const ingresosPorHoraFormateado = (() => {
      if (kpiData.ingresos_por_hora && Array.isArray(kpiData.ingresos_por_hora)) {
        if (kpiData.ingresos_por_hora.length > 0 && typeof kpiData.ingresos_por_hora[0] === 'object') {
          return kpiData.ingresos_por_hora;
        } else {
          return kpiData.ingresos_por_hora.map((ingreso, hora) => ({
            hora: hora,
            hora_formato: `${String(hora).padStart(2, '0')}:00`,
            ingresos: Number(ingreso) || 0
          }));
        }
      }
      return Array.from({ length: 24 }, (_, i) => ({
        hora: i,
        hora_formato: `${String(i).padStart(2, '0')}:00`,
        ingresos: 0
      }));
    })();

    return response(200, {
      tenant_id: kpiData.tenant_id,
      fecha: null, // null indica que es agregado global
      numero_pedidos: kpiData.numero_pedidos || 0,
      ingresos_dia: kpiData.ingresos_dia || 0,
      ticket_promedio: kpiData.ticket_promedio || 0,
      top_productos: kpiData.top_productos || [],
      estados_pedidos: kpiData.estados_pedidos || {
        completados: 0, cancelados: 0, pendientes: 0, preparando: 0,
        despachando: 0, en_camino: 0, entregado: 0, rechazado: 0,
      },
      tasa_exito: kpiData.tasa_exito || 0,
      ingresos_por_hora: ingresosPorHoraFormateado,
      metodos_pago: kpiData.metodos_pago || [],
    });
  } catch (error) {
    console.error('Error consultando KPIs:', error);
    return response(500, { message: 'Error interno al consultar KPIs', error: error.message });
  }
};

