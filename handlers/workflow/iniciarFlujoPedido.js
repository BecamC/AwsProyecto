const { startExecution } = require('../../shared/stepfunctions');

const STEP_FUNCTIONS_ARN = process.env.STEP_FUNCTIONS_ARN;

exports.handler = async (event) => {
  const detail = event.detail || event;
  const tenantId = detail.tenant_id;
  const pedidoId = detail.pedido_id;

  if (!tenantId || !pedidoId) {
    console.warn('iniciarFlujoPedido sin tenant_id/pedido_id', event);
    return;
  }

  if (!STEP_FUNCTIONS_ARN) {
    console.error('STEP_FUNCTIONS_ARN no configurado');
    return;
  }

  try {
    console.log(`[INFO] Iniciando Step Functions para pedido ${pedidoId}`);
    
    const result = await startExecution({
      stateMachineArn: STEP_FUNCTIONS_ARN,
      input: {
        tenant_id: tenantId,
        pedido_id: pedidoId,
      },
    });

    console.log('[INFO] Step Functions iniciado exitosamente:', result.executionArn);
    return result;
  } catch (error) {
    console.error('Error iniciando Step Functions:', error);
    throw error;
  }
};

