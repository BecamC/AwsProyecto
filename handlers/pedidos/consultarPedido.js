const { getItem, query } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { isUUID } = require('../../shared/validations');
const { requireAuth } = require('../../shared/auth');

const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS;
const TABLA_PRODUCTOS = process.env.TABLA_PRODUCTOS;

// Función para enriquecer productos con nombres
async function obtenerNombresProductos(productos, tenantId) {
  if (!productos || productos.length === 0) {
    return [];
  }

  const productosConNombres = await Promise.all(productos.map(async (producto) => {
    try {
      // Si ya tiene nombre, mantenerlo
      if (producto.nombre || producto.nombre_producto) {
        return {
          ...producto,
          nombre: producto.nombre || producto.nombre_producto,
          nombre_producto: producto.nombre_producto || producto.nombre
        };
      }
      
      // Si no tiene nombre, buscarlo en la tabla de productos
      const productoDetalle = await getItem(TABLA_PRODUCTOS, {
        tenant_id: tenantId,
        producto_id: producto.product_id || producto.producto_id
      });
      
      return {
        ...producto,
        nombre: productoDetalle?.nombre_producto || 'Producto sin nombre',
        nombre_producto: productoDetalle?.nombre_producto || 'Producto sin nombre'
      };
    } catch (error) {
      console.error(`Error obteniendo nombre del producto ${producto.product_id || producto.producto_id}:`, error);
      return {
        ...producto,
        nombre: 'Producto no encontrado',
        nombre_producto: 'Producto no encontrado'
      };
    }
  }));
  
  return productosConNombres;
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
      
      // Enriquecer productos con nombres
      let pedidoConProductos = pedido;
      if (pedido.productos && pedido.productos.length > 0) {
        const productosConNombres = await obtenerNombresProductos(pedido.productos, pedido.tenant_id);
        pedidoConProductos = {
          ...pedido,
          productos: productosConNombres
        };
      }
      
      return response(200, { pedido: pedidoConProductos });
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
      
      // Enriquecer productos con nombres
      const pedidosConProductos = await Promise.all(pedidos.map(async (pedido) => {
        if (pedido.productos && pedido.productos.length > 0) {
          const productosConNombres = await obtenerNombresProductos(pedido.productos, pedido.tenant_id);
          return {
            ...pedido,
            productos: productosConNombres
          };
        }
        return pedido;
      }));
      
      return response(200, { pedidos: pedidosConProductos });
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
      
      // Enriquecer productos con nombres
      const pedidosConProductos = await Promise.all(pedidos.map(async (pedido) => {
        if (pedido.productos && pedido.productos.length > 0) {
          const productosConNombres = await obtenerNombresProductos(pedido.productos, pedido.tenant_id);
          return {
            ...pedido,
            productos: productosConNombres
          };
        }
        return pedido;
      }));
      
      return response(200, { pedidos: pedidosConProductos });
    }
    
    // Staff puede ver pedidos según su tier
    const isAdmin = payload.staff_tier === 'admin';
    
    // Si es admin, verificar si es admin general o admin por sede
    if (isAdmin) {
      // Si el admin tiene tenant_id_sede (y no es null), solo ve pedidos de su sede
      // Si no tiene tenant_id_sede o es null, es admin general y ve todas las sedes
      const adminTenantId = payload.tenant_id_sede;
      
      // Si adminTenantId es null o undefined, es admin general
      if (adminTenantId && adminTenantId !== 'GENERAL') {
        // Admin por sede: solo ve pedidos de su sede
        const tenantQuery = {
          TableName: TABLA_PEDIDOS,
          KeyConditionExpression: 'tenant_id = :tenant_id',
          ExpressionAttributeValues: {
            ':tenant_id': adminTenantId,
          },
        };
        
        const result = await query(tenantQuery);
        let pedidos = result.Items || [];
        
        // Enriquecer productos con nombres
        const pedidosConProductos = await Promise.all(pedidos.map(async (pedido) => {
          if (pedido.productos && pedido.productos.length > 0) {
            const productosConNombres = await obtenerNombresProductos(pedido.productos, pedido.tenant_id);
            return {
              ...pedido,
              productos: productosConNombres
            };
          }
          return pedido;
        }));
        
        return response(200, { 
          pedidos: pedidosConProductos,
          total: pedidosConProductos.length,
          sede_consultada: adminTenantId,
          nota: `Admin de sede ${adminTenantId} - Solo ve pedidos de su sede`
        });
      } else {
        // Admin general: ve pedidos de todas las sedes
        const sedes = ['pardo_miraflores', 'pardo_surco'];
        let todosLosPedidos = [];
        
        // Consultar pedidos de todas las sedes
        for (const sede of sedes) {
          const tenantQuery = {
            TableName: TABLA_PEDIDOS,
            KeyConditionExpression: 'tenant_id = :tenant_id',
            ExpressionAttributeValues: {
              ':tenant_id': sede,
            },
          };
          
          const result = await query(tenantQuery);
          if (result.Items && result.Items.length > 0) {
            todosLosPedidos = todosLosPedidos.concat(result.Items);
          }
        }
        
        // Enriquecer productos con nombres
        const pedidosConProductos = await Promise.all(todosLosPedidos.map(async (pedido) => {
          if (pedido.productos && pedido.productos.length > 0) {
            const productosConNombres = await obtenerNombresProductos(pedido.productos, pedido.tenant_id);
            return {
              ...pedido,
              productos: productosConNombres
            };
          }
          return pedido;
        }));
        
        return response(200, { 
          pedidos: pedidosConProductos,
          total: pedidosConProductos.length,
          sedes_consultadas: sedes,
          nota: 'Admin general - Puede ver pedidos de todas las sedes'
        });
      }
    }
    
    // Si es trabajador, solo ve pedidos de su sede asignados a él
    const tenantQuery = {
      TableName: TABLA_PEDIDOS,
      KeyConditionExpression: 'tenant_id = :tenant_id',
      ExpressionAttributeValues: {
        ':tenant_id': tenantId,
      },
    };

    const result = await query(tenantQuery);
    let pedidos = result.Items || [];
    
    // Filtrar solo los pedidos asignados al trabajador
    pedidos = pedidos.filter(p => 
      p.chef_id === authenticatedUserId || 
      p.motorizado_id === authenticatedUserId
    );
    
    // Enriquecer productos con nombres
    const pedidosConProductos = await Promise.all(pedidos.map(async (pedido) => {
      if (pedido.productos && pedido.productos.length > 0) {
        const productosConNombres = await obtenerNombresProductos(pedido.productos, pedido.tenant_id);
        return {
          ...pedido,
          productos: productosConNombres
        };
      }
      return pedido;
    }));
    
    return response(200, { 
      pedidos: pedidosConProductos,
      total: pedidosConProductos.length,
      sede: tenantId,
      nota: 'Trabajador solo ve pedidos asignados de su sede'
    });
  } catch (error) {
    console.error('Error consultando pedidos', error);
    return response(500, { message: 'Error interno al consultar pedidos' });
  }
};

