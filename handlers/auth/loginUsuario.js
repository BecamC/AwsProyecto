const { getItem } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { verifyPassword, generateToken, CORS_HEADERS } = require('../../shared/auth');

const TABLA_CLIENTES = process.env.TABLA_CLIENTES;
const TABLA_STAFF = process.env.TABLA_STAFF;

// Función para actualizar last_login
async function updateLastLogin(tableName, key) {
  try {
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
    const { getTimestamp } = require('../../shared/dynamodb');
    
    const client = new DynamoDBClient({ region: process.env.REGION || 'us-east-1' });
    const docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true }
    });
    
    const currentTime = getTimestamp();
    
    await docClient.send(new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: 'SET last_login = :login_time, updated_at = :update_time',
      ExpressionAttributeValues: {
        ':login_time': currentTime,
        ':update_time': currentTime
      }
    }));
  } catch (error) {
    console.error('Error actualizando last_login:', error);
  }
}

exports.handler = async (event) => {
  try {
    console.log('Evento de login recibido');
    
    // Parsear body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return response(400, { message: 'Body inválido' });
    }
    
    const {
      email,
      password,
      frontend_type = 'client',
      tenant_id_sede
    } = body;
    
    // Validaciones básicas
    if (!email || !password) {
      return response(400, { message: 'Email y password son requeridos' });
    }
    
    const emailLower = email.toLowerCase();
    
    // Buscar usuario según frontend_type
    let user;
    let tableName;
    
    if (frontend_type === 'staff') {
      // Para staff, intentar buscar primero con el tenant_id_sede enviado
      // Si no se encuentra y se envió un tenant_id_sede, intentar con "GENERAL" (admin general)
      // NOTA: DynamoDB no permite null en claves primarias, usamos "GENERAL" para admin general
      tableName = TABLA_STAFF;
      
      // Normalizar tenant_id_sede: convertir null/undefined/empty a "GENERAL" para admin general
      const tenantIdNormalizado = (tenant_id_sede === null || tenant_id_sede === 'null' || tenant_id_sede === undefined || tenant_id_sede === '') 
        ? 'GENERAL' 
        : tenant_id_sede;
      
      if (tenantIdNormalizado === 'GENERAL') {
        // Buscar admin general con tenant_id_sede = "GENERAL"
        console.log('Buscando admin general con tenant_id_sede=GENERAL');
        user = await getItem(TABLA_STAFF, {
          tenant_id_sede: 'GENERAL',
          email: emailLower
        });
      } else {
        // Intentar buscar con el tenant_id_sede enviado
        user = await getItem(TABLA_STAFF, {
          tenant_id_sede: tenantIdNormalizado,
          email: emailLower
        });
        
        // Si no se encuentra, intentar con "GENERAL" (admin general)
        if (!user) {
          console.log(`Usuario no encontrado con tenant_id_sede=${tenantIdNormalizado}, intentando con GENERAL (admin general)`);
          user = await getItem(TABLA_STAFF, {
            tenant_id_sede: 'GENERAL',
            email: emailLower
          });
        }
      }
    } else {
      user = await getItem(TABLA_CLIENTES, {
        email: emailLower
      });
      tableName = TABLA_CLIENTES;
    }
    
    // Verificar que el usuario existe
    if (!user) {
      return response(401, { message: 'Credenciales inválidas' });
    }
    
    // Verificar contraseña
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return response(401, { message: 'Credenciales inválidas' });
    }
    
    // Verificar que el usuario esté activo
    if (!user.is_active) {
      return response(403, { message: 'Cuenta desactivada. Contacta al administrador.' });
    }
    
    // Validaciones de frontend
    const userType = user.user_type || 'cliente';
    
    if (frontend_type === 'staff' && userType !== 'staff') {
      return response(403, { 
        message: 'Acceso denegado. El portal staff es solo para personal autorizado.' 
      });
    }
    
    if (frontend_type === 'client' && userType === 'staff') {
      return response(403, { 
        message: 'Acceso denegado. El personal debe usar el portal staff.' 
      });
    }
    
    // Actualizar last_login
    // Usar el tenant_id_sede del usuario encontrado, no el enviado en el body
    const key = frontend_type === 'staff' 
      ? { tenant_id_sede: user.tenant_id_sede || 'GENERAL', email: emailLower }
      : { email: emailLower };
    
    await updateLastLogin(tableName, key);
    
    // Generar token JWT
    // Convertir "GENERAL" a null en el token para mantener compatibilidad
    const tenantIdForToken = (user.tenant_id_sede === 'GENERAL' || !user.tenant_id_sede) ? null : user.tenant_id_sede;
    
    const tokenData = {
      user_id: user.user_id,
      email: user.email,
      user_type: userType,
      staff_tier: user.staff_tier || null,
      permissions: user.permissions || [],
      tenant_id_sede: tenantIdForToken
    };
    
    const token = generateToken(tokenData);
    
    // Preparar datos de usuario para respuesta
    const userData = {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      user_type: userType,
      is_active: user.is_active,
      is_verified: user.is_verified
    };
    
    if (userType === 'staff') {
      userData.staff_tier = user.staff_tier;
      userData.permissions = user.permissions;
      // Convertir "GENERAL" a null en la respuesta para mantener compatibilidad
      userData.tenant_id_sede = (user.tenant_id_sede === 'GENERAL' || !user.tenant_id_sede) ? null : user.tenant_id_sede;
    }
    
    // Respuesta
    const responseData = {
      message: 'Login exitoso',
      user: userData,
      token,
      session: {
        frontend_type
      }
    };
    
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(responseData)
    };
    
  } catch (error) {
    console.error('Error en login:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ 
        message: 'Error interno del servidor',
        error: error.message 
      })
    };
  }
};

