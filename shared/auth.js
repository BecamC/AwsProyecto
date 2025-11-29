const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'utec';
const SALT_ROUNDS = 10;

// Headers CORS para respuestas
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-Id, x-tenant-id',
  'Content-Type': 'application/json'
};

/**
 * Hashear contraseña con bcrypt
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verificar contraseña con bcrypt
 */
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generar token JWT
 */
function generateToken(userData) {
  const payload = {
    user_id: userData.user_id,
    email: userData.email,
    user_type: userData.user_type, // 'cliente' o 'staff'
    staff_tier: userData.staff_tier, // 'admin' o 'trabajador' (solo para staff)
    permissions: userData.permissions || [], // array de permisos (solo para staff)
    tenant_id_sede: userData.tenant_id_sede, // sede del staff (solo para staff)
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
  };

  return jwt.sign(payload, JWT_SECRET);
}

/**
 * Verificar token JWT
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Error verificando token:', error.message);
    return null;
  }
}

/**
 * Extraer token del header Authorization
 */
function extractTokenFromHeader(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.replace('Bearer ', '');
}

/**
 * Middleware: Requiere autenticación (cualquier usuario autenticado)
 * Retorna: { payload, error }
 */
function requireAuth(event) {
  const token = extractTokenFromHeader(event);
  
  if (!token) {
    return {
      payload: null,
      error: {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Token de autenticación requerido' })
      }
    };
  }
  
  const payload = verifyToken(token);
  
  if (!payload) {
    return {
      payload: null,
      error: {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Token inválido o expirado' })
      }
    };
  }
  
  return { payload, error: null };
}

/**
 * Middleware: Requiere autenticación de staff (admin o trabajador)
 * Opcionalmente verifica un permiso específico
 */
function requireStaff(event, requiredPermission = null) {
  const authResult = requireAuth(event);
  
  if (authResult.error) {
    return authResult;
  }
  
  const { payload } = authResult;
  
  // Verificar que sea staff
  if (payload.user_type !== 'staff') {
    return {
      payload: null,
      error: {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: 'Acceso denegado. Solo para personal autorizado.' })
      }
    };
  }
  
  // Verificar permiso específico si se requiere
  if (requiredPermission && !payload.permissions?.includes(requiredPermission)) {
    return {
      payload: null,
      error: {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ 
          message: 'Permisos insuficientes',
          required: requiredPermission 
        })
      }
    };
  }
  
  return { payload, error: null };
}

/**
 * Permisos por tier de staff
 */
function getStaffPermissions(tier) {
  const permissions = {
    trabajador: [
      'view_products',
      'view_orders',
      'update_order_status',
      'view_customers',
      'manage_own_profile'
    ],
    admin: [
      'view_products',
      'view_orders',
      'update_order_status',
      'view_customers',
      'manage_products',
      'manage_orders',
      'manage_staff_trabajador',
      'view_reports',
      'manage_inventory',
      'generate_invitation_codes',
      'manage_all_profiles'
    ]
  };
  
  return permissions[tier] || [];
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  requireAuth,
  requireStaff,
  getStaffPermissions,
  CORS_HEADERS
};

