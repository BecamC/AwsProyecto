const { query } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { VALID_PRODUCT_TYPES } = require('../../shared/validations');

const TABLA_PRODUCTOS = process.env.TABLA_PRODUCTOS;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Campos válidos para ordenamiento
const VALID_SORT_FIELDS = ['nombre_producto', 'precio_producto', 'fecha_creacion', 'fecha_actualizacion'];
const VALID_SORT_ORDERS = ['asc', 'desc'];

/**
 * Función auxiliar para ordenar productos
 */
function sortProductos(productos, sortBy, sortOrder) {
  if (!sortBy || !VALID_SORT_FIELDS.includes(sortBy)) {
    return productos;
  }

  const order = VALID_SORT_ORDERS.includes(sortOrder?.toLowerCase()) 
    ? sortOrder.toLowerCase() 
    : 'asc';

  return [...productos].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    // Manejar valores undefined/null
    if (aVal === undefined || aVal === null) aVal = '';
    if (bVal === undefined || bVal === null) bVal = '';

    // Ordenamiento numérico para precio
    if (sortBy === 'precio_producto') {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    }

    // Ordenamiento de fechas
    if (sortBy.includes('fecha')) {
      aVal = new Date(aVal).getTime() || 0;
      bVal = new Date(bVal).getTime() || 0;
    }

    // Comparación
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

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

    // Verificar autenticación para obtener información del usuario
    const { requireAuth } = require('../../shared/auth');
    const authResult = requireAuth(event);
    let payload = null;
    let isAdmin = false;
    let adminTenantId = null;
    
    if (!authResult.error) {
      payload = authResult.payload;
      isAdmin = payload?.staff_tier === 'admin';
      adminTenantId = payload?.tenant_id_sede;
    }

    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    
    // Determinar sedes a consultar según permisos
    let sedesAConsultar = [];
    if (isAdmin && (!adminTenantId || adminTenantId === 'GENERAL')) {
      // Admin general: puede ver todas las sedes
      if (tenantId && tenantId !== 'GENERAL') {
        sedesAConsultar = [tenantId];
      } else {
        sedesAConsultar = ['pardo_miraflores', 'pardo_surco'];
      }
    } else {
      // Admin por sede o usuario normal: solo su sede
      const sedeUsuario = adminTenantId || tenantId;
      if (!sedeUsuario) {
        return response(400, { message: 'x-tenant-id header es requerido' });
      }
      sedesAConsultar = [sedeUsuario];
    }

    // Obtener parámetros de consulta
    const queryParams = event.queryStringParameters || {};
    
    // Paginación
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(queryParams.limit) || DEFAULT_LIMIT));
    const cursor = queryParams.cursor; // Cursor opcional para paginación

    // Filtrado por tipo (acepta cualquier tipo, no limitamos)
    const tipoProducto = queryParams.tipo_producto || queryParams.tipo;

    // Ordenamiento
    const sortBy = queryParams.sort_by || queryParams.sortBy;
    const sortOrder = queryParams.sort_order || queryParams.order || 'asc';

    // Consultar productos de todas las sedes permitidas
    let todosLosProductos = [];
    let hasMore = false;
    let lastEvaluatedKey = null;

    for (const sede of sedesAConsultar) {
      const dynamoParams = {
        TableName: TABLA_PRODUCTOS,
        KeyConditionExpression: 'tenant_id = :tenant_id',
        ExpressionAttributeValues: {
          ':tenant_id': sede,
        },
        Limit: limit,
      };

      // Agregar filtro por tipo_producto si se especifica
      if (tipoProducto) {
        dynamoParams.FilterExpression = 'tipo_producto = :tipo_producto';
        dynamoParams.ExpressionAttributeValues[':tipo_producto'] = tipoProducto;
      }

      // Si hay cursor, usarlo para continuar desde donde quedó (solo en la primera sede)
      if (cursor && sede === sedesAConsultar[0]) {
        try {
          dynamoParams.ExclusiveStartKey = JSON.parse(decodeURIComponent(cursor));
        } catch (e) {
          return response(400, { message: 'Cursor inválido' });
        }
      }

      // Ejecutar consulta
      const result = await query(dynamoParams);
      if (result.Items && result.Items.length > 0) {
        todosLosProductos = todosLosProductos.concat(result.Items);
      }
      
      if (result.LastEvaluatedKey) {
        hasMore = true;
        lastEvaluatedKey = result.LastEvaluatedKey;
      }
    }

    let productos = todosLosProductos;

    // Si hay filtro y no se encontraron productos, devolver mensaje apropiado
    if (tipoProducto && productos.length === 0) {
      return response(200, {
        productos: [],
        message: `No se encontraron productos con tipo_producto: ${tipoProducto}`,
        pagination: {
          limit,
          has_more: false,
          next_cursor: null,
        },
        filters: {
          tipo_producto: tipoProducto,
        },
        sort: sortBy ? {
          field: sortBy,
          order: sortOrder,
        } : null,
      });
    }

    // Aplicar ordenamiento si se especifica
    if (sortBy) {
      productos = sortProductos(productos, sortBy, sortOrder);
    }

    // Construir respuesta con metadatos
    const responseData = {
      productos,
      pagination: {
        limit,
        has_more: hasMore,
        next_cursor: hasMore && lastEvaluatedKey
          ? encodeURIComponent(JSON.stringify(lastEvaluatedKey))
          : null,
      },
      filters: {
        tipo_producto: tipoProducto || null,
      },
      sort: sortBy ? {
        field: sortBy,
        order: sortOrder,
      } : null,
    };

    return response(200, responseData);
  } catch (error) {
    console.error('Error obteniendo productos', error);
    return response(500, { message: 'Error interno al obtener productos' });
  }
};

