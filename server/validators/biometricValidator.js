const { validateNumberRange } = require('./common');

const BIOMETRIC_FIELDS = [
  'hrvMs',
  'restingHrBpm',
  'spo2Percent',
  'sleepDurationMin',
  'sleepEfficiency',
  'remDurationMin',
  'deepDurationMin',
  'sleepScore',
  'readinessScore',
  'bodyTempC',
  'stressScore',
  'steps',
  'activeCalories',
  'vo2Max',
];

const validateCreateBiometricBody = (body = {}) => {
  const errors = [];

  const source = body.source;
  if (source !== undefined) {
    const allowed = ['manual', 'apple_watch', 'oura', 'garmin', 'fitbit'];
    if (!allowed.includes(String(source))) {
      errors.push({
        field: 'source',
        message: `Source must be one of: ${allowed.join(', ')}.`,
      });
    }
  }

  if (body.recordedAt !== undefined) {
    const timestamp = Date.parse(body.recordedAt);
    if (Number.isNaN(timestamp)) {
      errors.push({
        field: 'recordedAt',
        message: 'recordedAt must be a valid ISO date string.',
      });
    }
  }

  const hasAtLeastOneMetric = BIOMETRIC_FIELDS.some((field) => (
    body[field] !== undefined && body[field] !== null && body[field] !== ''
  ));

  if (!hasAtLeastOneMetric) {
    errors.push({
      field: 'body',
      message: 'At least one biometric metric must be provided.',
    });
  }

  validateNumberRange(errors, 'hrvMs', body.hrvMs, 5, 250);
  validateNumberRange(errors, 'restingHrBpm', body.restingHrBpm, 25, 220);
  validateNumberRange(errors, 'spo2Percent', body.spo2Percent, 60, 100);
  validateNumberRange(errors, 'sleepDurationMin', body.sleepDurationMin, 0, 1200);
  validateNumberRange(errors, 'sleepEfficiency', body.sleepEfficiency, 0, 100);
  validateNumberRange(errors, 'remDurationMin', body.remDurationMin, 0, 600);
  validateNumberRange(errors, 'deepDurationMin', body.deepDurationMin, 0, 600);
  validateNumberRange(errors, 'sleepScore', body.sleepScore, 0, 100);
  validateNumberRange(errors, 'readinessScore', body.readinessScore, 0, 100);
  validateNumberRange(errors, 'bodyTempC', body.bodyTempC, 30, 45);
  validateNumberRange(errors, 'stressScore', body.stressScore, 0, 100);
  validateNumberRange(errors, 'steps', body.steps, 0, 150000);
  validateNumberRange(errors, 'activeCalories', body.activeCalories, 0, 10000);
  validateNumberRange(errors, 'vo2Max', body.vo2Max, 5, 100);

  return errors;
};

const validateBiometricQuery = (query = {}) => {
  const errors = [];
  if (query.limit === undefined) {
    return errors;
  }

  const limit = Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    errors.push({
      field: 'limit',
      message: 'limit must be an integer between 1 and 100.',
    });
  }

  return errors;
};

module.exports = {
  validateCreateBiometricBody,
  validateBiometricQuery,
};
