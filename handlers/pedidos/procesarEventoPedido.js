const { putEvent } = require('../../shared/eventbridge');

exports.handler = async (event) => {
  const records = event.Records || [];
  for (const record of records) {
    try {
      const payload = JSON.parse(record.body);
      await putEvent({
        source: payload.source || 'pedidos.microservicio',
        detailType: payload.type || 'Pedido Creado',
        detail: payload.detalle || payload,
      });
    } catch (error) {
      console.error('Error procesando mensaje de SQS', error, record);
      throw error;
    }
  }
};

