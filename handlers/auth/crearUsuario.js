const { putItem, getItem, generateUUID, getTimestamp } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { hashPassword, getStaffPermissions, CORS_HEADERS } = require('../../shared/auth');

const TABLA_CLIENTES = process.env.TABLA_CLIENTES;
const TABLA_STAFF = process.env.TABLA_STAFF;
const TABLA_INVITATION_CODES = process.env.TABLA_INVITATION_CODES;

// Validar código de invitación
async function validateInvitationCode(code) {
  if (!code) return false;
  
  try {
    const invitation = await getItem(TABLA_INVITATION_CODES, { code });
    
    if (!invitation) return false;
    
    // Validar que esté activo
    if (!invitation.is_active) return false;
    
    // Validar expiración
    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < new Date()) return false;
    
    // Validar usos
    const usedCount = invitation.used_count || 0;
    const maxUses = invitation.max_uses || 1;
    if (usedCount >= maxUses) return false;
    
    return true;
  } catch (error) {
    console.error('Error validando código de invitación:', error);
    return false;
  }
}

// Incrementar contador de uso del código
async function incrementInvitationCodeUsage(code) {
  try {
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
    
    const client = new DynamoDBClient({ region: process.env.REGION || 'us-east-1' });
    const docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true }
    });
    
    await docClient.send(new UpdateCommand({
      TableName: TABLA_INVITATION_CODES,
      Key: { code },
      UpdateExpression: 'SET used_count = if_not_exists(used_count, :zero) + :inc',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':zero': 0
      }
    }));
  } catch (error) {
    console.error('Error incrementando uso de código:', error);
  }
}

exports.handler = async (event) => {
  try {
    console.log('Evento de registro recibido');
    
    // Parsear body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return response(400, { message: 'Body inválido' });
    }
    
    // Extraer datos
    const {
      email,
      password,
      name,
      phone,
      gender,
      user_type = 'cliente',
      frontend_type = 'client',
      staff_tier,
      invitation_code,
      tenant_id_sede
    } = body;
    
    // Validaciones básicas
    if (!email || !password) {
      return response(400, { message: 'Email y password son requeridos' });
    }
    
    if (!name) {
      return response(400, { message: 'Nombre es requerido' });
    }
    
    // Validar email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return response(400, { message: 'Email inválido' });
    }
    
    // Validaciones de frontend y user_type
    if (frontend_type === 'staff') {
      if (user_type !== 'staff') {
        return response(403, { message: 'El portal staff es solo para personal autorizado' });
      }
      
      if (!staff_tier) {
        return response(400, { message: 'staff_tier es requerido para registro de staff' });
      }
      
      if (!['admin', 'trabajador'].includes(staff_tier)) {
        return response(400, { message: 'staff_tier debe ser "admin" o "trabajador"' });
      }
      
      if (!tenant_id_sede) {
        return response(400, { message: 'tenant_id_sede es requerido para staff' });
      }
      
      // Validar código de invitación
      const isValidCode = await validateInvitationCode(invitation_code);
      if (!isValidCode) {
        return response(403, { message: 'Código de invitación inválido o expirado' });
      }
    } else if (frontend_type === 'client') {
      if (user_type !== 'cliente') {
        return response(403, { message: 'El portal cliente es solo para usuarios clientes' });
      }
    }
    
    // Verificar si el email ya existe
    if (frontend_type === 'staff') {
      const existing = await getItem(TABLA_STAFF, { 
        tenant_id_sede,
        email: email.toLowerCase() 
      });
      if (existing) {
        return response(409, { message: 'Email ya registrado en esta sede' });
      }
    } else {
      const existing = await getItem(TABLA_CLIENTES, { 
        email: email.toLowerCase() 
      });
      if (existing) {
        return response(409, { message: 'Email ya registrado' });
      }
    }
    
    // Hashear password
    const hashedPassword = await hashPassword(password);
    const currentTime = getTimestamp();
    const userId = generateUUID();
    
    // Crear item de usuario
    const userItem = {
      user_id: userId,
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      phone: phone || null,
      gender: gender || null,
      user_type,
      created_at: currentTime,
      updated_at: currentTime,
      is_active: true,
      last_login: null,
      registration_source: frontend_type,
      is_verified: true
    };
    
    // Agregar campos específicos de staff
    if (user_type === 'staff') {
      userItem.tenant_id_sede = tenant_id_sede;
      userItem.staff_tier = staff_tier;
      userItem.permissions = getStaffPermissions(staff_tier);
    }
    
    // Guardar usuario
    if (frontend_type === 'staff') {
      await putItem(TABLA_STAFF, userItem);
      
      // Incrementar uso del código de invitación
      await incrementInvitationCodeUsage(invitation_code);
    } else {
      await putItem(TABLA_CLIENTES, userItem);
    }
    
    console.log(`Usuario registrado: ${email}`);
    
    // Preparar respuesta
    const responseData = {
      message: 'Usuario registrado exitosamente',
      user_id: userId,
      email: userItem.email,
      name: userItem.name,
      user_type: userItem.user_type,
      registration_source: frontend_type,
      is_verified: userItem.is_verified
    };
    
    if (user_type === 'staff') {
      responseData.staff_tier = userItem.staff_tier;
      responseData.permissions = userItem.permissions;
      responseData.tenant_id_sede = userItem.tenant_id_sede;
    }
    
    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify(responseData)
    };
    
  } catch (error) {
    console.error('Error en registro:', error);
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

