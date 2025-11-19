const { SFNClient, StartExecutionCommand, SendTaskSuccessCommand, SendTaskFailureCommand } = require('@aws-sdk/client-sfn');

const REGION = process.env.REGION || 'us-east-1';
const client = new SFNClient({ region: REGION });

async function startExecution({ stateMachineArn, input }) {
  const command = new StartExecutionCommand({
    stateMachineArn,
    input: JSON.stringify(input),
  });

  const response = await client.send(command);
  return response;
}

async function sendTaskSuccess({ taskToken, output }) {
  const command = new SendTaskSuccessCommand({
    taskToken,
    output: JSON.stringify(output),
  });
  await client.send(command);
}

async function sendTaskFailure({ taskToken, error, cause }) {
  const command = new SendTaskFailureCommand({
    taskToken,
    error,
    cause,
  });
  await client.send(command);
}

module.exports = {
  startExecution,
  sendTaskSuccess,
  sendTaskFailure,
};

