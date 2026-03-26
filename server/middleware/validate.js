const ApiError = require('../utils/apiError');

const runValidator = (validator, input, section) => {
  if (typeof validator !== 'function') {
    return [];
  }

  const errors = validator(input);
  if (!Array.isArray(errors)) {
    throw new Error(`Validator for "${section}" must return an array.`);
  }

  return errors.map((err) => ({
    field: err.field || section,
    message: err.message || 'Invalid value.',
    section,
  }));
};

const validateRequest = ({ params, query, body } = {}) => (req, res, next) => {
  const errors = [
    ...runValidator(params, req.params, 'params'),
    ...runValidator(query, req.query, 'query'),
    ...runValidator(body, req.body, 'body'),
  ];

  if (errors.length > 0) {
    return next(ApiError.badRequest('Validation failed.', errors));
  }

  return next();
};

module.exports = validateRequest;
