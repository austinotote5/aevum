const { logger } = require('../utils/logger');
const { recordHttpEvent } = require('../services/runtimeMetrics');

const requestLogger = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - startedAt;
    const durationMs = Number(durationNs / 1000000n);

    logger.info('http_request', {
      requestId: req.requestId || null,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      ip: req.ip,
    });

    recordHttpEvent({
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
};

module.exports = requestLogger;
