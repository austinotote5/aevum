const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const pushIfInvalid = (errors, condition, field, message) => {
  if (condition) {
    errors.push({ field, message });
  }
};

const validateNumberRange = (errors, field, value, min, max) => {
  if (value === undefined || value === null || value === '') {
    return;
  }

  const number = Number(value);
  if (Number.isNaN(number)) {
    errors.push({ field, message: 'Must be a valid number.' });
    return;
  }

  if (number < min || number > max) {
    errors.push({ field, message: `Must be between ${min} and ${max}.` });
  }
};

module.exports = {
  EMAIL_REGEX,
  UUID_REGEX,
  isNonEmptyString,
  pushIfInvalid,
  validateNumberRange,
};
