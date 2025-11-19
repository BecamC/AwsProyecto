const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const REGION = process.env.REGION || 'us-east-1';
const client = new SNSClient({ region: REGION });

async function publish({ topicArn, subject, message, attributes = {} }) {
  const command = new PublishCommand({
    TopicArn: topicArn,
    Subject: subject,
    Message: JSON.stringify(message),
    MessageAttributes: attributes,
  });

  await client.send(command);
}

function buildNotificationAttributes({ pedidoId, tipo, usuarioId }) {
  const attrs = {};
  if (pedidoId) {
    attrs.pedido_id = { DataType: 'String', StringValue: pedidoId };
  }
  if (tipo) {
    attrs.tipo_notificacion = { DataType: 'String', StringValue: tipo };
  }
  if (usuarioId) {
    attrs.usuario_id = { DataType: 'String', StringValue: usuarioId };
  }
  return attrs;
}

module.exports = {
  publish,
  buildNotificationAttributes,
};

