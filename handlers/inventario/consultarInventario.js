const { query } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { requireStaff } = require('../../shared/auth');

const TABLA_INVENTARIO = process.env.TABLA_INVENTARIO;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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

    // Verificar que sea staff (solo staff puede consultar inventario)
    const auth = requireStaff(event);
    if (auth.error) {
      return auth.error;
    }
    
    const { payload } = auth;
    const isAdmin = payload.staff_tier === 'admin';
    const adminTenantId = payload.tenant_id_sede;
    
    const tenantId = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
    
    // Si es admin general (tenant_id_sede es null o 'GENERAL'), puede ver todas las sedes
    // Si no, solo puede ver su sede
    let sedesAConsultar = [];
    if (isAdmin && (!adminTenantId || adminTenantId === 'GENERAL')) {
      // Admin general: puede ver todas las sedes
      if (tenantId && tenantId !== 'GENERAL') {
        // Si especifica una sede en el header, solo esa
        sedesAConsultar = [tenantId];
      } else {
        // Si no especifica, todas las sedes
        sedesAConsultar = ['pardo_miraflores', 'pardo_surco'];
      }
    } else {
      // Admin por sede o trabajador: solo su sede
      const sedeUsuario = adminTenantId || tenantId;
      if (!sedeUsuario) {
        return response(400, { message: 'x-tenant-id header es requerido' });
      }
      sedesAConsultar = [sedeUsuario];
    }

    // Permitir filtro opcional desde el body
    const body = JSON.parse(event.body || '{}');
    const productoId = body.producto_id;
    
    // Paginación
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(body.limit) || DEFAULT_LIMIT));
    const cursor = body.cursor; // Cursor opcional para paginación

    let inventario = [];
    let hasMore = false;
    let lastEvaluatedKey = null;
    const { getItem } = require('../../shared/dynamodb');
    const TABLA_PRODUCTOS = process.env.TABLA_PRODUCTOS;

    if (productoId) {
      // Consultar un producto específico en las sedes permitidas (sin paginación)
      for (const sede of sedesAConsultar) {
        const item = await getItem(TABLA_INVENTARIO, {
          tenant_id: sede,
          producto_id: productoId
        });
        if (item) {
          inventario.push(item);
        }
      }
    } else {
      // Consultar todos los productos de las sedes permitidas con paginación
      for (const sede of sedesAConsultar) {
        const dynamoParams = {
          TableName: TABLA_INVENTARIO,
          KeyConditionExpression: 'tenant_id = :tenant_id',
          ExpressionAttributeValues: {
            ':tenant_id': sede
          },
          Limit: limit,
        };
        
        // Si hay cursor, usarlo para continuar desde donde quedó (solo en la primera sede)
        if (cursor && sede === sedesAConsultar[0]) {
          try {
            dynamoParams.ExclusiveStartKey = JSON.parse(decodeURIComponent(cursor));
          } catch (e) {
            return response(400, { message: 'Cursor inválido' });
          }
        }
        
        const result = await query(dynamoParams);
        if (result.Items && result.Items.length > 0) {
          inventario = inventario.concat(result.Items);
        }
        
        if (result.LastEvaluatedKey) {
          hasMore = true;
          lastEvaluatedKey = result.LastEvaluatedKey;
        }
      }
    }

    // Enriquecer inventario con nombres de productos
    const inventarioConNombres = await Promise.all(inventario.map(async (item) => {
      // Buscar el producto en la sede correspondiente
      const producto = await getItem(TABLA_PRODUCTOS, {
        tenant_id: item.tenant_id,
        producto_id: item.producto_id
      });
      
      return {
        ...item,
        nombre_producto: producto?.nombre_producto || null
      };
    }));

    // Construir respuesta con metadatos de paginación
    const responseData = {
      inventario: inventarioConNombres,
      pagination: {
        limit,
        has_more: hasMore && !productoId, // Solo si no es búsqueda por producto específico
        next_cursor: hasMore && lastEvaluatedKey && !productoId
          ? encodeURIComponent(JSON.stringify(lastEvaluatedKey))
          : null,
      },
    };

    return response(200, responseData);
  } catch (error) {
    console.error('Error consultando inventario', error);
    return response(500, { message: 'Error interno al consultar inventario' });
  }
};

