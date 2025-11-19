const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,x-tenant-id,x-user-id,x-user-role',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

function response(statusCode, body = {}, headers = {}) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

module.exports = {
  response,
  CORS_HEADERS,
};

