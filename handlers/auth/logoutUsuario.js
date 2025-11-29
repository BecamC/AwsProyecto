const { CORS_HEADERS } = require('../../shared/auth');
const { getTimestamp } = require('../../shared/dynamodb');

exports.handler = async (event) => {
  try {
    console.log('Evento de logout recibido');
    
    const currentTime = getTimestamp();
    
    // El logout en JWT es stateless - el token simplemente deja de usarse en el cliente
    // Aquí solo retornamos un mensaje de éxito
    const responseData = {
      message: 'Sesión cerrada exitosamente',
      timestamp: currentTime,
      note: 'El token JWT seguirá siendo válido hasta su expiración natural. Asegúrate de eliminarlo del cliente.'
    };
    
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(responseData)
    };
    
  } catch (error) {
    console.error('Error en logout:', error);
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

