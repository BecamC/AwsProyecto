const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function getItem(TableName, Key) {
  const command = new GetCommand({ TableName, Key });
  const { Item } = await docClient.send(command);
  return Item;
}

async function putItem(TableName, Item) {
  const command = new PutCommand({ TableName, Item });
  await docClient.send(command);
  return Item;
}

async function updateItem(params) {
  const command = new UpdateCommand(params);
  const { Attributes } = await docClient.send(command);
  return Attributes;
}

async function query(params) {
  const command = new QueryCommand(params);
  const { Items } = await docClient.send(command);
  return Items || [];
}

async function scan(params) {
  const command = new ScanCommand(params);
  const { Items } = await docClient.send(command);
  return Items || [];
}

async function deleteItem(TableName, Key) {
  const command = new DeleteCommand({ TableName, Key });
  await docClient.send(command);
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getTimestamp() {
  return new Date().toISOString();
}

module.exports = {
  getItem,
  putItem,
  updateItem,
  query,
  scan,
  deleteItem,
  generateUUID,
  getTimestamp,
};

