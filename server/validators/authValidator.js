const {
  EMAIL_REGEX,
  isNonEmptyString,
  pushIfInvalid,
} = require('./common');

const validateRegisterBody = (body = {}) => {
  const errors = [];

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();

  pushIfInvalid(errors, !EMAIL_REGEX.test(email), 'email', 'Valid email is required.');
  pushIfInvalid(
    errors,
    password.length < 12,
    'password',
    'Password must be at least 12 characters.'
  );
  pushIfInvalid(
    errors,
    !/[a-z]/.test(password)
      || !/[A-Z]/.test(password)
      || !/\d/.test(password)
      || !/[^A-Za-z0-9]/.test(password),
    'password',
    'Password must include uppercase, lowercase, number, and symbol.'
  );
  pushIfInvalid(errors, !isNonEmptyString(firstName), 'firstName', 'First name is required.');
  pushIfInvalid(errors, !isNonEmptyString(lastName), 'lastName', 'Last name is required.');

  return errors;
};

const validateLoginBody = (body = {}) => {
  const errors = [];

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  pushIfInvalid(errors, !EMAIL_REGEX.test(email), 'email', 'Valid email is required.');
  pushIfInvalid(errors, password.length < 1, 'password', 'Password is required.');

  return errors;
};

module.exports = {
  validateRegisterBody,
  validateLoginBody,
};
