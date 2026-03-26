const { UUID_REGEX } = require('./common');

const validateProtocolQuery = (query = {}) => {
  const errors = [];
  if (query.refresh === undefined) {
    return errors;
  }

  const value = String(query.refresh).toLowerCase();
  const allowed = ['1', '0', 'true', 'false', 'yes', 'no'];
  if (!allowed.includes(value)) {
    errors.push({
      field: 'refresh',
      message: 'refresh must be one of: 1, 0, true, false, yes, no.',
    });
  }

  return errors;
};

const validateProtocolParams = (params = {}) => {
  const errors = [];
  const protocolId = String(params.protocolId || '');
  if (!UUID_REGEX.test(protocolId)) {
    errors.push({ field: 'protocolId', message: 'protocolId must be a valid UUID.' });
  }
  return errors;
};

const validateProtocolCompletionBody = (body = {}) => {
  const errors = [];

  if (!Number.isInteger(body.actionIndex) || body.actionIndex < 0) {
    errors.push({
      field: 'actionIndex',
      message: 'actionIndex must be an integer greater than or equal to 0.',
    });
  }

  if (body.completed !== undefined && typeof body.completed !== 'boolean') {
    errors.push({
      field: 'completed',
      message: 'completed must be a boolean when provided.',
    });
  }

  return errors;
};

const validateProtocolVersionQuery = (query = {}) => {
  const errors = [];
  if (query.limit === undefined) {
    return errors;
  }

  const limit = Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
    errors.push({
      field: 'limit',
      message: 'limit must be an integer between 1 and 25.',
    });
  }

  return errors;
};

module.exports = {
  validateProtocolQuery,
  validateProtocolParams,
  validateProtocolCompletionBody,
  validateProtocolVersionQuery,
};
