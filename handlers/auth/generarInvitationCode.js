const { putItem, generateUUID, getTimestamp } = require('../../shared/dynamodb');
const { response } = require('../../shared/response');
const { requireStaff, CORS_HEADERS } = require('../../shared/auth');

const TABLA_INVITATION_CODES = process.env.TABLA_INVITATION_CODES;

// Generar código de invitación único de 8 caracteres
function generateInvitationCode() {
  return generateUUID().substring(0, 8).toUpperCase();
}

exports.handler = async (event) => {
  try {
    console.log('Evento de generación de código de invitación recibido');
    
    // Verificar autenticación y que sea admin
    const auth = requireStaff(event, 'generate_invitation_codes');
    if (auth.error) {
      return auth.error;
    }
    
    // Parsear body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      body = {};
    }
    
    // Parámetros configurables
    const max_uses = body.max_uses || 10;
    const expires_in_days = body.expires_in_days || 30;
    const created_by = auth.payload.user_id || 'system';
    
    // Generar código único
    const code = generateInvitationCode();
    
    // Configurar fechas
    const currentTime = new Date();
    const currentTimeISO = getTimestamp();
    const expiresAt = new Date(currentTime.getTime() + (expires_in_days * 24 * 60 * 60 * 1000));
    
    // TTL para DynamoDB (48 horas después de expiración para limpieza)
    const ttl = Math.floor((expiresAt.getTime() + (2 * 24 * 60 * 60 * 1000)) / 1000);
    
    // Crear item del código
    const invitationItem = {
      code,
      is_active: true,
      expires_at: expiresAt.toISOString(),
      max_uses,
      used_count: 0,
      created_by,
      created_at: currentTimeISO,
      ttl
    };
    
    // Guardar en DynamoDB
    await putItem(TABLA_INVITATION_CODES, invitationItem);
    
    console.log(`Código de invitación generado: ${code} por ${created_by}`);
    
    // Preparar respuesta
    const responseData = {
      message: 'Código de invitación generado exitosamente',
      invitation_code: code,
      details: {
        max_uses,
        expires_at: expiresAt.toISOString(),
        expires_in_days,
        created_by,
        created_at: currentTimeISO
      },
      usage_instructions: {
        para_staff: 'Use este código para registrar nuevo personal staff',
        endpoint: '/auth/registro',
        campo: 'invitation_code'
      }
    };
    
    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify(responseData)
    };
    
  } catch (error) {
    console.error('Error generando código de invitación:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ 
        message: 'Error interno del servidor al generar código de invitación',
        error: error.message 
      })
    };
  }
};

