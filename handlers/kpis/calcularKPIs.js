const { query, putItem, getTimestamp, generateUUID, scan, getItem } = require('../../shared/dynamodb');

const TABLA_ESTADOS = process.env.TABLA_ESTADOS;
const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;
const TABLA_KPIS = process.env.TABLA_KPIS;

function getStartOfDay() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function getEndOfDay() {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now.toISOString();
}

async function obtenerPedidosDelDia(tenantId) {
  const startOfDay = getStartOfDay();
  const endOfDay = getEndOfDay();

  const estadosQuery = {
    TableName: TABLA_ESTADOS,
    IndexName: 'tenant_id-index',
    KeyConditionExpression: 'tenant_id = :tenant_id AND #ts BETWEEN :start AND :end',
    ExpressionAttributeNames: {
      '#ts': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':tenant_id': tenantId,
      ':start': startOfDay,
      ':end': endOfDay
    }
  };

  const estadosResult = await query(estadosQuery);
  const estadosDelDia = estadosResult.Items || [];

  const pedidosCreados = new Set();
  estadosDelDia.forEach(estado => {
    if (estado.estado_anterior === null || estado.estado_anterior === undefined) {
      if (estado.estado_nuevo === 'pendiente') {
        pedidosCreados.add(estado.pedido_id);
      }
    }
  });

  return Array.from(pedidosCreados);
}

async function obtenerDetallesPedidos(pedidoIds, tenantId) {
  const pedidos = [];
  
  for (const pedidoId of pedidoIds) {
    try {
      const pedido = await getItem(TABLA_PEDIDOS, {
        tenant_id: tenantId,
        pedido_id: pedidoId
      });
      
      if (pedido) {
        pedidos.push(pedido);
      }
    } catch (error) {
      console.error(`Error obteniendo pedido ${pedidoId}:`, error);
    }
  }
  
  return pedidos;
}

function calcularTopProductos(pedidos) {
  const productosCount = {};
  
  pedidos.forEach(pedido => {
    if (pedido.productos && Array.isArray(pedido.productos)) {
      pedido.productos.forEach(producto => {
        const productId = producto.product_id;
        if (productId) {
          if (!productosCount[productId]) {
            productosCount[productId] = {
              product_id: productId,
              cantidad_total: 0,
              nombre: null
            };
          }
          productosCount[productId].cantidad_total += (producto.quantity || 0);
        }
      });
    }
  });
  
  const productosArray = Object.values(productosCount);
  productosArray.sort((a, b) => b.cantidad_total - a.cantidad_total);
  
  return productosArray.slice(0, 3);
}

async function obtenerNombresProductos(productosTop, tenantId) {
  const TABLA_PRODUCTOS = process.env.TABLA_PRODUCTOS;
  
  for (const producto of productosTop) {
    try {
      const productoDetalle = await getItem(TABLA_PRODUCTOS, {
        tenant_id: tenantId,
        producto_id: producto.product_id
      });
      
      if (productoDetalle) {
        producto.nombre = productoDetalle.nombre_producto || 'Producto sin nombre';
      }
    } catch (error) {
      console.error(`Error obteniendo nombre del producto ${producto.product_id}:`, error);
      producto.nombre = 'Producto no encontrado';
    }
  }
  
  return productosTop;
}

async function obtenerTenantsDelDia() {
  const startOfDay = getStartOfDay();
  const endOfDay = getEndOfDay();
  
  const scanParams = {
    TableName: TABLA_ESTADOS,
    FilterExpression: '#ts BETWEEN :start AND :end',
    ExpressionAttributeNames: {
      '#ts': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':start': startOfDay,
      ':end': endOfDay
    }
  };
  
  const result = await scan(scanParams);
  const tenants = new Set();
  
  (result || []).forEach(item => {
    if (item.tenant_id) {
      tenants.add(item.tenant_id);
    }
  });
  
  return Array.from(tenants);
}

async function calcularKPIsParaTenant(tenantId) {
  const fechaActual = new Date();
  const fechaHora = getTimestamp();
  const fecha = fechaActual.toISOString().split('T')[0];

  console.log(`Calculando KPIs para tenant: ${tenantId}, fecha: ${fecha}`);

  const pedidoIds = await obtenerPedidosDelDia(tenantId);
  console.log(`Pedidos encontrados del día: ${pedidoIds.length}`);

  if (pedidoIds.length === 0) {
    const kpiVacio = {
      kpi_id: generateUUID(),
      tenant_id: tenantId,
      fecha: fecha,
      timestamp: fechaHora,
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
      metodos_pago: []
    };

    if (TABLA_KPIS) {
      await putItem(TABLA_KPIS, kpiVacio);
    }

    return kpiVacio;
  }

  const pedidos = await obtenerDetallesPedidos(pedidoIds, tenantId);
  console.log(`Pedidos con detalles obtenidos: ${pedidos.length}`);

  const numeroPedidos = pedidos.length;
  const ingresosDia = pedidos.reduce((total, pedido) => {
    const precio = pedido.precio_total || 0;
    return total + Number(precio);
  }, 0);

  const ticketPromedio = numeroPedidos > 0 ? ingresosDia / numeroPedidos : 0;

  let topProductos = calcularTopProductos(pedidos);
  topProductos = await obtenerNombresProductos(topProductos, tenantId);

  // Calcular métricas de estado de pedidos
  const estadosPedidos = {
    completados: 0,
    cancelados: 0,
    pendientes: 0,
    preparando: 0,
    despachando: 0,
    en_camino: 0,
    entregado: 0,
    rechazado: 0
  };

  pedidos.forEach(pedido => {
    const estado = pedido.estado || 'pendiente';
    if (estadosPedidos.hasOwnProperty(estado)) {
      estadosPedidos[estado]++;
    }
    if (estado === 'entregado') {
      estadosPedidos.completados++;
    }
  });

  const totalConEstado = Object.values(estadosPedidos).reduce((sum, val) => sum + val, 0);
  const tasaExito = totalConEstado > 0 ? (estadosPedidos.completados / totalConEstado) * 100 : 0;

  // Calcular ingresos por hora
  const ingresosPorHora = {};
  for (let i = 0; i < 24; i++) {
    ingresosPorHora[i] = 0;
  }

  pedidos.forEach(pedido => {
    if (pedido.fecha_inicio) {
      const fecha = new Date(pedido.fecha_inicio);
      const hora = fecha.getHours();
      const precio = pedido.precio_total || 0;
      ingresosPorHora[hora] = (ingresosPorHora[hora] || 0) + Number(precio);
    }
  });

  const ingresosPorHoraArray = Object.keys(ingresosPorHora).map(hora => ({
    hora: parseInt(hora),
    hora_formato: `${String(hora).padStart(2, '0')}:00`,
    ingresos: Number(ingresosPorHora[hora].toFixed(2))
  }));

  // Calcular distribución por método de pago
  const metodosPago = {};
  pedidos.forEach(pedido => {
    const metodo = pedido.medio_pago || 'no_especificado';
    const precio = pedido.precio_total || 0;
    
    if (!metodosPago[metodo]) {
      metodosPago[metodo] = {
        metodo: metodo,
        cantidad: 0,
        ingresos: 0
      };
    }
    
    metodosPago[metodo].cantidad++;
    metodosPago[metodo].ingresos += Number(precio);
  });

  const metodosPagoArray = Object.values(metodosPago).map(m => ({
    metodo: m.metodo,
    cantidad: m.cantidad,
    ingresos: Number(m.ingresos.toFixed(2)),
    porcentaje_cantidad: numeroPedidos > 0 ? Number(((m.cantidad / numeroPedidos) * 100).toFixed(2)) : 0,
    porcentaje_ingresos: ingresosDia > 0 ? Number(((m.ingresos / ingresosDia) * 100).toFixed(2)) : 0
  }));

  // Calcular top productos (ya existe, pero lo mantenemos)
  const topProductosArray = topProductos.map(p => ({
    product_id: p.product_id,
    nombre: p.nombre,
    cantidad_vendida: p.cantidad_total
  }));

  const kpi = {
    kpi_id: generateUUID(),
    tenant_id: tenantId,
    fecha: fecha,
    timestamp: fechaHora,
    numero_pedidos: numeroPedidos,
    ingresos_dia: Number(ingresosDia.toFixed(2)),
    ticket_promedio: Number(ticketPromedio.toFixed(2)),
    top_productos: topProductosArray,
    // Nuevas métricas
    estados_pedidos: estadosPedidos,
    tasa_exito: Number(tasaExito.toFixed(2)),
    ingresos_por_hora: ingresosPorHoraArray,
    metodos_pago: metodosPagoArray
  };

  if (TABLA_KPIS) {
    await putItem(TABLA_KPIS, kpi);
    console.log('KPIs guardados en tabla');
  }

  return kpi;
}

async function obtenerTodosLosTenants() {
  const scanParams = {
    TableName: TABLA_PEDIDOS,
    ProjectionExpression: 'tenant_id'
  };
  
  const result = await scan(scanParams);
  const tenants = new Set();
  
  (result || []).forEach(item => {
    if (item.tenant_id) {
      tenants.add(item.tenant_id);
    }
  });
  
  return Array.from(tenants);
}

async function calcularKPIsGlobalesParaTenant(tenantId) {
  console.log(`Calculando KPIs GLOBALES para tenant: ${tenantId}`);
  
  // Obtener TODOS los pedidos del tenant (sin filtrar por fecha)
  const pedidosQuery = {
    TableName: TABLA_PEDIDOS,
    KeyConditionExpression: 'tenant_id = :tenant_id',
    ExpressionAttributeValues: {
      ':tenant_id': tenantId
    }
  };
  
  const pedidosResult = await query(pedidosQuery);
  const pedidos = pedidosResult.Items || [];
  
  console.log(`Pedidos totales encontrados para ${tenantId}: ${pedidos.length}`);
  
  if (pedidos.length === 0) {
    console.log(`No hay pedidos para ${tenantId}, retornando KPIs vacíos`);
    return null; // No crear KPI global vacío
  }
  
  // Calcular métricas globales (igual que calcularKPIsParaTenant pero sin filtrar por fecha)
  const numeroPedidos = pedidos.length;
  const ingresosDia = pedidos.reduce((total, pedido) => {
    const precio = pedido.precio_total || 0;
    return total + Number(precio);
  }, 0);
  
  const ticketPromedio = numeroPedidos > 0 ? ingresosDia / numeroPedidos : 0;
  
  let topProductos = calcularTopProductos(pedidos);
  topProductos = await obtenerNombresProductos(topProductos, tenantId);
  
  // Mapear cantidad_total a cantidad_vendida (igual que en calcularKPIsParaTenant)
  const topProductosArray = topProductos.map(p => ({
    product_id: p.product_id,
    nombre: p.nombre,
    cantidad_vendida: p.cantidad_total || 0
  }));
  
  // Calcular métricas de estado de pedidos
  const estadosPedidos = {
    completados: 0,
    cancelados: 0,
    pendientes: 0,
    preparando: 0,
    despachando: 0,
    en_camino: 0,
    entregado: 0,
    rechazado: 0
  };
  
  pedidos.forEach(pedido => {
    const estado = pedido.estado || 'pendiente';
    if (estadosPedidos.hasOwnProperty(estado)) {
      estadosPedidos[estado]++;
    }
    if (estado === 'entregado') {
      estadosPedidos.completados++;
    }
  });
  
  const totalConEstado = Object.values(estadosPedidos).reduce((sum, val) => sum + val, 0);
  const tasaExito = totalConEstado > 0 ? (estadosPedidos.completados / totalConEstado) * 100 : 0;
  
  // Calcular ingresos por hora (de todos los pedidos históricos)
  const ingresosPorHora = Array(24).fill(0);
  pedidos.forEach(pedido => {
    if (pedido.fecha_inicio) {
      const fecha = new Date(pedido.fecha_inicio);
      const hora = fecha.getHours();
      const precio = pedido.precio_total || 0;
      ingresosPorHora[hora] += Number(precio);
    }
  });
  
  const ingresosPorHoraArray = ingresosPorHora.map((ingreso, hora) => ({
    hora: hora,
    hora_formato: `${String(hora).padStart(2, '0')}:00`,
    ingresos: Number(ingreso.toFixed(2))
  }));
  
  // Calcular distribución por método de pago
  const metodosPago = {};
  pedidos.forEach(pedido => {
    const metodo = pedido.medio_pago || 'no_especificado';
    const precio = pedido.precio_total || 0;
    
    if (!metodosPago[metodo]) {
      metodosPago[metodo] = {
        metodo: metodo,
        cantidad: 0,
        ingresos: 0
      };
    }
    
    metodosPago[metodo].cantidad++;
    metodosPago[metodo].ingresos += Number(precio);
  });
  
  const metodosPagoArray = Object.values(metodosPago).map(m => ({
    metodo: m.metodo,
    cantidad: m.cantidad,
    ingresos: Number(m.ingresos.toFixed(2)),
    porcentaje_cantidad: numeroPedidos > 0 ? Number(((m.cantidad / numeroPedidos) * 100).toFixed(2)) : 0,
    porcentaje_ingresos: ingresosDia > 0 ? Number(((m.ingresos / ingresosDia) * 100).toFixed(2)) : 0
  }));
  
  const fechaHora = getTimestamp();
  const kpiGlobal = {
    kpi_id: generateUUID(),
    tenant_id: tenantId,
    fecha: 'GLOBAL', // Marcar como global
    timestamp: fechaHora,
    numero_pedidos: numeroPedidos,
    ingresos_dia: Number(ingresosDia.toFixed(2)),
    ticket_promedio: Number(ticketPromedio.toFixed(2)),
    top_productos: topProductosArray,
    estados_pedidos: estadosPedidos,
    tasa_exito: Number(tasaExito.toFixed(2)),
    ingresos_por_hora: ingresosPorHoraArray,
    metodos_pago: metodosPagoArray
  };
  
  // Guardar KPI global (usando fecha: 'GLOBAL' como clave)
  if (TABLA_KPIS) {
    await putItem(TABLA_KPIS, kpiGlobal);
    console.log('KPIs GLOBALES guardados en tabla');
  }
  
  return kpiGlobal;
}

// Exportar la función para uso en otros handlers
exports.calcularKPIsGlobalesParaTenant = calcularKPIsGlobalesParaTenant;

exports.handler = async (event) => {
  try {
    console.log('Evento recibido:', JSON.stringify(event));
    
    const tenantId = event.tenant_id || event.detail?.tenant_id;
    
    if (tenantId) {
      // Calcular KPIs del día y globales para un tenant específico
      const kpiDia = await calcularKPIsParaTenant(tenantId);
      const kpiGlobal = await calcularKPIsGlobalesParaTenant(tenantId);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'KPIs calculados exitosamente',
          tenant_id: tenantId,
          kpis_dia: kpiDia,
          kpis_global: kpiGlobal
        })
      };
    }
    
    // Si no hay tenant específico, calcular para todos los tenants del día Y globales
    const tenantsDelDia = await obtenerTenantsDelDia();
    const todosLosTenants = await obtenerTodosLosTenants();
    
    console.log(`Tenants encontrados del día: ${tenantsDelDia.length}`);
    console.log(`Tenants totales encontrados: ${todosLosTenants.length}`);
    
    const resultados = [];
    
    // Calcular KPIs del día para tenants con pedidos del día
    for (const tenant of tenantsDelDia) {
      try {
        const kpi = await calcularKPIsParaTenant(tenant);
        resultados.push({
          tenant_id: tenant,
          tipo: 'dia',
          kpis: kpi
        });
      } catch (error) {
        console.error(`Error calculando KPIs del día para tenant ${tenant}:`, error);
        resultados.push({
          tenant_id: tenant,
          tipo: 'dia',
          error: error.message
        });
      }
    }
    
    // Calcular KPIs globales para todos los tenants
    for (const tenant of todosLosTenants) {
      try {
        const kpiGlobal = await calcularKPIsGlobalesParaTenant(tenant);
        if (kpiGlobal) {
          resultados.push({
            tenant_id: tenant,
            tipo: 'global',
            kpis: kpiGlobal
          });
        }
      } catch (error) {
        console.error(`Error calculando KPIs globales para tenant ${tenant}:`, error);
        resultados.push({
          tenant_id: tenant,
          tipo: 'global',
          error: error.message
        });
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'KPIs calculados para todos los tenants (día y globales)',
        total_tenants_dia: tenantsDelDia.length,
        total_tenants_global: todosLosTenants.length,
        resultados: resultados
      })
    };
  } catch (error) {
    console.error('Error calculando KPIs:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Error interno al calcular KPIs',
        message: error.message
      })
    };
  }
};

