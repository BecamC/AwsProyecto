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
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];

    if (!tenantId) {
      return response(400, { message: 'x-tenant-id header es requerido' });
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

    // Construir parámetros de DynamoDB
    const dynamoParams = {
      TableName: TABLA_PRODUCTOS,
      KeyConditionExpression: 'tenant_id = :tenant_id',
      ExpressionAttributeValues: {
        ':tenant_id': tenantId,
      },
      Limit: limit,
    };

    // Agregar filtro por tipo_producto si se especifica
    if (tipoProducto) {
      dynamoParams.FilterExpression = 'tipo_producto = :tipo_producto';
      dynamoParams.ExpressionAttributeValues[':tipo_producto'] = tipoProducto;
    }

    // Si hay cursor, usarlo para continuar desde donde quedó
    if (cursor) {
      try {
        dynamoParams.ExclusiveStartKey = JSON.parse(decodeURIComponent(cursor));
      } catch (e) {
        return response(400, { message: 'Cursor inválido' });
      }
    }

    // Ejecutar consulta
    const result = await query(dynamoParams);
    let productos = result.Items || [];
    const hasMore = !!result.LastEvaluatedKey;

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
        next_cursor: hasMore 
          ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey))
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

