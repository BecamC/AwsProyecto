const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const REGION = process.env.REGION || 'us-east-1';
const client = new SQSClient({ region: REGION });

async function sendMessage(queueUrl, body, messageAttributes = {}) {
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(body),
    MessageAttributes: messageAttributes,
  });

  await client.send(command);
}

module.exports = {
  sendMessage,
};

