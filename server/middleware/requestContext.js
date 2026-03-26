const { randomUUID } = require('crypto');

const HEADER_NAME = 'x-request-id';

const requestContext = (req, res, next) => {
  const inbound = String(req.headers[HEADER_NAME] || '').trim();
  const requestId = inbound || randomUUID();

  req.requestId = requestId;
  res.setHeader(HEADER_NAME, requestId);

  next();
};

module.exports = requestContext;
