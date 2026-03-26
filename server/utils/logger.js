const serializeError = (error) => ({
  name: error?.name,
  message: error?.message,
  stack: error?.stack,
});

const write = (level, message, meta = {}) => {
  const event = {
    timestamp: new Date().toISOString(),
    service: 'aevum-api',
    env: process.env.NODE_ENV || 'development',
    level,
    message,
    ...meta,
  };

  const line = JSON.stringify(event);
  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
};

const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};

module.exports = {
  logger,
  serializeError,
};
