const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();

/**
 * Invoca la lambda actualizarEstadoPedido para centralizar cambios de estado
 */
async function actualizarEstado({ tenantId, pedidoId, estado, userId, metadata = {} }) {
  const payload = {
    tenant_id: tenantId,
    pedido_id: pedidoId,
    estado,
    user_id: userId,
    metadata,
  };

  try {
    const result = await lambda.invoke({
      FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME?.replace(/[^-]+-/, '') + '-actualizarEstadoPedido',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(payload),
    }).promise();

    const response = JSON.parse(result.Payload);
    
    if (response.error) {
      throw new Error(response.error);
    }

    return response;
  } catch (error) {
    console.error('[ERROR actualizarEstado helper]', error);
    throw error;
  }
}

module.exports = {
  actualizarEstado,
};
