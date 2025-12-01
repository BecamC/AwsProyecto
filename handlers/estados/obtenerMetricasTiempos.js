const { query } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { requireStaff } = require('../../shared/auth');

const TABLA_ESTADOS = process.env.TABLA_ESTADOS;
const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;

/**
 * GET /estados/metricas-tiempos
 * Obtiene métricas de tiempos de transición entre estados
 * Query params: tenant_id, fecha (opcional, formato YYYY-MM-DD)
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

    const auth = requireStaff(event, 'view_reports');
    if (auth.error) {
      return auth.error;
    }

    const { payload } = auth;
    const params = event.queryStringParameters || {};
    const tenantId = params.tenant_id || event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    const fecha = params.fecha;

    if (!tenantId) {
      return response(400, { message: 'tenant_id es requerido' });
    }

    // Construir query según si hay fecha o no
    let estadosQuery;
    
    if (fecha) {
      // Si se proporciona fecha, consultar solo ese día
      const fechaInicio = `${fecha}T00:00:00.000Z`;
      const fechaFin = `${fecha}T23:59:59.999Z`;
      
      estadosQuery = {
        TableName: TABLA_ESTADOS,
        IndexName: 'tenant_id-index',
        KeyConditionExpression: 'tenant_id = :tenant_id AND #ts BETWEEN :fechaInicio AND :fechaFin',
        ExpressionAttributeNames: {
          '#ts': 'timestamp'
        },
        ExpressionAttributeValues: {
          ':tenant_id': tenantId,
          ':fechaInicio': fechaInicio,
          ':fechaFin': fechaFin,
        },
        ScanIndexForward: true,
      };
    } else {
      // Si NO se proporciona fecha, consultar todos los estados históricos
      estadosQuery = {
        TableName: TABLA_ESTADOS,
        IndexName: 'tenant_id-index',
        KeyConditionExpression: 'tenant_id = :tenant_id',
        ExpressionAttributeValues: {
          ':tenant_id': tenantId,
        },
        ScanIndexForward: true,
      };
    }

    const estadosResult = await query(estadosQuery);
    const estados = estadosResult.Items || [];

    // Agrupar por pedido_id para calcular métricas
    const pedidosMap = new Map();
    
    estados.forEach(estado => {
      const pedidoId = estado.pedido_id;
      
      if (!pedidosMap.has(pedidoId)) {
        pedidosMap.set(pedidoId, {
          pedido_id: pedidoId,
          transiciones: [],
          estados: new Set(),
        });
      }
      
      const pedidoData = pedidosMap.get(pedidoId);
      
      // Agregar transición
      if (estado.duracion_segundos !== null && estado.duracion_segundos !== undefined) {
        pedidoData.transiciones.push({
          estado_anterior: estado.estado_anterior,
          estado_nuevo: estado.estado_nuevo,
          duracion_segundos: estado.duracion_segundos,
          timestamp: estado.timestamp,
          start_time: estado.start_time,
          end_time: estado.end_time,
        });
      }
      
      pedidoData.estados.add(estado.estado_anterior);
      pedidoData.estados.add(estado.estado_nuevo);
    });

    // Calcular métricas agregadas
    const metricasPorEstado = {};
    const tiemposTotalesPorPedido = [];
    const tiemposPorTransicion = {};

    pedidosMap.forEach((pedidoData, pedidoId) => {
      let tiempoTotalPedido = 0;
      
      pedidoData.transiciones.forEach(transicion => {
        const duracion = transicion.duracion_segundos || 0;
        tiempoTotalPedido += duracion;
        
        // Agregar a métricas por estado anterior
        const estadoAnterior = transicion.estado_anterior;
        if (!metricasPorEstado[estadoAnterior]) {
          metricasPorEstado[estadoAnterior] = {
            estado: estadoAnterior,
            total_segundos: 0,
            cantidad_transiciones: 0,
            tiempos: [],
          };
        }
        
        metricasPorEstado[estadoAnterior].total_segundos += duracion;
        metricasPorEstado[estadoAnterior].cantidad_transiciones += 1;
        metricasPorEstado[estadoAnterior].tiempos.push(duracion);
        
        // Agregar a tiempos por transición
        const transicionKey = `${transicion.estado_anterior} → ${transicion.estado_nuevo}`;
        if (!tiemposPorTransicion[transicionKey]) {
          tiemposPorTransicion[transicionKey] = {
            transicion: transicionKey,
            total_segundos: 0,
            cantidad: 0,
            tiempos: [],
          };
        }
        
        tiemposPorTransicion[transicionKey].total_segundos += duracion;
        tiemposPorTransicion[transicionKey].cantidad += 1;
        tiemposPorTransicion[transicionKey].tiempos.push(duracion);
      });
      
      if (tiempoTotalPedido > 0) {
        tiemposTotalesPorPedido.push({
          pedido_id: pedidoId,
          tiempo_total_segundos: tiempoTotalPedido,
          cantidad_transiciones: pedidoData.transiciones.length,
        });
      }
    });

    // Calcular promedios y estadísticas
    const metricasFinales = Object.values(metricasPorEstado).map(metrica => {
      const tiempos = metrica.tiempos;
      const promedio = metrica.total_segundos / metrica.cantidad_transiciones;
      const minimo = Math.min(...tiempos);
      const maximo = Math.max(...tiempos);
      
      // Calcular mediana
      tiempos.sort((a, b) => a - b);
      const mediana = tiempos.length % 2 === 0
        ? (tiempos[tiempos.length / 2 - 1] + tiempos[tiempos.length / 2]) / 2
        : tiempos[Math.floor(tiempos.length / 2)];
      
      return {
        estado: metrica.estado,
        promedio_segundos: Math.round(promedio),
        promedio_minutos: Math.round(promedio / 60 * 100) / 100,
        minimo_segundos: minimo,
        maximo_segundos: maximo,
        mediana_segundos: Math.round(mediana),
        cantidad_transiciones: metrica.cantidad_transiciones,
        tiempo_total_segundos: metrica.total_segundos,
      };
    });

    const transicionesFinales = Object.values(tiemposPorTransicion).map(transicion => {
      const tiempos = transicion.tiempos;
      const promedio = transicion.total_segundos / transicion.cantidad;
      const minimo = Math.min(...tiempos);
      const maximo = Math.max(...tiempos);
      
      tiempos.sort((a, b) => a - b);
      const mediana = tiempos.length % 2 === 0
        ? (tiempos[tiempos.length / 2 - 1] + tiempos[tiempos.length / 2]) / 2
        : tiempos[Math.floor(tiempos.length / 2)];
      
      return {
        transicion: transicion.transicion,
        promedio_segundos: Math.round(promedio),
        promedio_minutos: Math.round(promedio / 60 * 100) / 100,
        minimo_segundos: minimo,
        maximo_segundos: maximo,
        mediana_segundos: Math.round(mediana),
        cantidad: transicion.cantidad,
        tiempo_total_segundos: transicion.total_segundos,
      };
    });

    // Calcular tiempo promedio total por pedido
    const tiempoPromedioTotal = tiemposTotalesPorPedido.length > 0
      ? tiemposTotalesPorPedido.reduce((sum, p) => sum + p.tiempo_total_segundos, 0) / tiemposTotalesPorPedido.length
      : 0;

    // Crear lista detallada de tiempos por pedido y estado
    const tiemposDetalladosPorPedido = Array.from(pedidosMap.entries()).map(([pedidoId, pedidoData]) => {
      // Agrupar transiciones por estado anterior para ver cuánto duró cada estado
      const tiemposPorEstado = {};
      
      pedidoData.transiciones.forEach(transicion => {
        const estado = transicion.estado_anterior;
        if (!tiemposPorEstado[estado]) {
          tiemposPorEstado[estado] = {
            estado: estado,
            duracion_segundos: 0,
            cantidad: 0,
            transiciones: []
          };
        }
        tiemposPorEstado[estado].duracion_segundos += transicion.duracion_segundos;
        tiemposPorEstado[estado].cantidad += 1;
        tiemposPorEstado[estado].transiciones.push({
          duracion_segundos: transicion.duracion_segundos,
          estado_nuevo: transicion.estado_nuevo,
          timestamp: transicion.timestamp,
          start_time: transicion.start_time,
          end_time: transicion.end_time,
        });
      });

      return {
        pedido_id: pedidoId,
        tiempo_total_segundos: pedidoData.transiciones.reduce((sum, t) => sum + (t.duracion_segundos || 0), 0),
        cantidad_transiciones: pedidoData.transiciones.length,
        tiempos_por_estado: Object.values(tiemposPorEstado).map(t => ({
          estado: t.estado,
          duracion_segundos: t.duracion_segundos,
          cantidad_veces: t.cantidad,
          transiciones: t.transiciones,
        })),
      };
    }).sort((a, b) => b.tiempo_total_segundos - a.tiempo_total_segundos); // Ordenar por tiempo total descendente

    return response(200, {
      tenant_id: tenantId,
      fecha: fecha || null, // null indica datos globales
      resumen: {
        total_pedidos_analizados: tiemposTotalesPorPedido.length,
        tiempo_promedio_total_segundos: Math.round(tiempoPromedioTotal),
        tiempo_promedio_total_minutos: Math.round(tiempoPromedioTotal / 60 * 100) / 100,
        total_transiciones: estados.length,
      },
      metricas_por_estado: metricasFinales,
      metricas_por_transicion: transicionesFinales,
      tiempos_totales_por_pedido: tiemposTotalesPorPedido.slice(0, 20), // Top 20 pedidos más lentos
      tiempos_detallados_por_pedido: tiemposDetalladosPorPedido, // Lista completa con tiempos individuales
    });
  } catch (error) {
    console.error('Error obteniendo métricas de tiempos:', error);
    return response(500, {
      message: 'Error interno al obtener métricas de tiempos',
      error: error.message,
    });
  }
};

