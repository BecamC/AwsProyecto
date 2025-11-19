const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

const REGION = process.env.REGION || 'us-east-1';
const client = new EventBridgeClient({ region: REGION });

async function putEvent({ source, detailType, detail }) {
  const command = new PutEventsCommand({
    Entries: [
      {
        Source: source,
        DetailType: detailType,
        Detail: JSON.stringify(detail),
      },
    ],
  });

  await client.send(command);
}

module.exports = { putEvent };

