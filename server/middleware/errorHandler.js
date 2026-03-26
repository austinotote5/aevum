const ApiError = require('../utils/apiError');
const { logger, serializeError } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  const isOperational = err instanceof ApiError;
  const statusCode = isOperational ? err.statusCode : 500;
  const code = isOperational ? err.code : 'INTERNAL_ERROR';
  const message = isOperational
    ? err.message
    : (process.env.NODE_ENV === 'production'
      ? 'An internal error occurred.'
      : err.message || 'An internal error occurred.');

  const logFn = statusCode >= 500 ? logger.error : logger.warn;
  logFn('request_failed', {
    requestId: req.requestId || null,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    error: statusCode >= 500
      ? serializeError(err)
      : {
        name: err?.name,
        message: err?.message,
      },
  });

  res.status(statusCode).json({
    error: {
      requestId: req.requestId || null,
      code,
      message,
      details: isOperational ? err.details : undefined,
    },
  });
};

module.exports = errorHandler;
