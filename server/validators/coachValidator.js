const { UUID_REGEX } = require('./common');

const validateCoachMessageBody = (body = {}) => {
  const errors = [];

  const message = String(body.message || '').trim();
  if (message.length < 2) {
    errors.push({ field: 'message', message: 'Message must be at least 2 characters.' });
  }
  if (message.length > 4000) {
    errors.push({ field: 'message', message: 'Message must be at most 4000 characters.' });
  }

  if (body.sessionId !== undefined && !UUID_REGEX.test(String(body.sessionId))) {
    errors.push({ field: 'sessionId', message: 'sessionId must be a valid UUID.' });
  }

  if (body.context !== undefined) {
    const context = String(body.context);
    if (context.length > 2000) {
      errors.push({ field: 'context', message: 'context must be at most 2000 characters.' });
    }
  }

  return errors;
};

const validateSessionParams = (params = {}) => {
  const errors = [];
  const sessionId = String(params.sessionId || '');
  if (!UUID_REGEX.test(sessionId)) {
    errors.push({ field: 'sessionId', message: 'sessionId must be a valid UUID.' });
  }
  return errors;
};

module.exports = {
  validateCoachMessageBody,
  validateSessionParams,
};
