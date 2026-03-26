const { validateNumberRange } = require('./common');

const ALLOWED_PROVIDERS = ['apple_health', 'oura', 'garmin', 'fitbit'];

const METRIC_FIELDS = [
  'hrvMs',
  'hrv',
  'restingHrBpm',
  'restingHeartRate',
  'spo2Percent',
  'spo2',
  'sleepDurationMin',
  'sleepMinutes',
  'sleepEfficiency',
  'remDurationMin',
  'deepDurationMin',
  'sleepScore',
  'readinessScore',
  'readiness',
  'bodyTempC',
  'stressScore',
  'stress',
  'steps',
  'activeCalories',
  'vo2Max',
];

const validateProvider = (errors, provider, field = 'provider') => {
  if (typeof provider !== 'string' || !provider.trim()) {
    errors.push({
      field,
      message: `${field} is required.`,
    });
    return;
  }

  if (!ALLOWED_PROVIDERS.includes(provider.trim().toLowerCase())) {
    errors.push({
      field,
      message: `provider must be one of: ${ALLOWED_PROVIDERS.join(', ')}.`,
    });
  }
};

const validateConnectWearableBody = (body = {}) => {
  const errors = [];

  validateProvider(errors, body.provider);

  if (body.accessToken !== undefined && typeof body.accessToken !== 'string') {
    errors.push({
      field: 'accessToken',
      message: 'accessToken must be a string when provided.',
    });
  }

  if (body.refreshToken !== undefined && typeof body.refreshToken !== 'string') {
    errors.push({
      field: 'refreshToken',
      message: 'refreshToken must be a string when provided.',
    });
  }

  if (body.tokenExpires !== undefined) {
    const timestamp = Date.parse(body.tokenExpires);
    if (Number.isNaN(timestamp)) {
      errors.push({
        field: 'tokenExpires',
        message: 'tokenExpires must be a valid ISO date string.',
      });
    }
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.push({
      field: 'isActive',
      message: 'isActive must be a boolean when provided.',
    });
  }

  return errors;
};

const validateImportWearablesBody = (body = {}) => {
  const errors = [];
  validateProvider(errors, body.provider);

  if (!Array.isArray(body.readings) || body.readings.length === 0) {
    errors.push({
      field: 'readings',
      message: 'readings must be a non-empty array.',
    });
    return errors;
  }

  if (body.readings.length > 500) {
    errors.push({
      field: 'readings',
      message: 'Maximum import size is 500 readings per request.',
    });
  }

  body.readings.forEach((reading, index) => {
    if (!reading || typeof reading !== 'object' || Array.isArray(reading)) {
      errors.push({
        field: `readings[${index}]`,
        message: 'Each reading must be an object.',
      });
      return;
    }

    const recordedAt = reading.recordedAt ?? reading.timestamp ?? reading.recorded_at ?? reading.time;
    if (!recordedAt || Number.isNaN(Date.parse(recordedAt))) {
      errors.push({
        field: `readings[${index}].recordedAt`,
        message: 'A valid recordedAt (or timestamp) ISO date is required for each reading.',
      });
    }

    const hasMetric = METRIC_FIELDS.some((field) => (
      reading[field] !== undefined && reading[field] !== null && reading[field] !== ''
    ));
    if (!hasMetric) {
      errors.push({
        field: `readings[${index}]`,
        message: 'At least one biometric metric must be provided.',
      });
      return;
    }

    validateNumberRange(errors, `readings[${index}].hrvMs`, reading.hrvMs ?? reading.hrv, 5, 250);
    validateNumberRange(
      errors,
      `readings[${index}].restingHrBpm`,
      reading.restingHrBpm ?? reading.restingHeartRate,
      25,
      220
    );
    validateNumberRange(errors, `readings[${index}].spo2Percent`, reading.spo2Percent ?? reading.spo2, 60, 100);
    validateNumberRange(
      errors,
      `readings[${index}].sleepDurationMin`,
      reading.sleepDurationMin ?? reading.sleepMinutes,
      0,
      1200
    );
    validateNumberRange(errors, `readings[${index}].sleepEfficiency`, reading.sleepEfficiency, 0, 100);
    validateNumberRange(errors, `readings[${index}].remDurationMin`, reading.remDurationMin, 0, 600);
    validateNumberRange(errors, `readings[${index}].deepDurationMin`, reading.deepDurationMin, 0, 600);
    validateNumberRange(errors, `readings[${index}].sleepScore`, reading.sleepScore, 0, 100);
    validateNumberRange(
      errors,
      `readings[${index}].readinessScore`,
      reading.readinessScore ?? reading.readiness,
      0,
      100
    );
    validateNumberRange(errors, `readings[${index}].bodyTempC`, reading.bodyTempC, 30, 45);
    validateNumberRange(errors, `readings[${index}].stressScore`, reading.stressScore ?? reading.stress, 0, 100);
    validateNumberRange(errors, `readings[${index}].steps`, reading.steps, 0, 150000);
    validateNumberRange(errors, `readings[${index}].activeCalories`, reading.activeCalories, 0, 10000);
    validateNumberRange(errors, `readings[${index}].vo2Max`, reading.vo2Max, 5, 100);
  });

  return errors;
};

module.exports = {
  ALLOWED_PROVIDERS,
  validateConnectWearableBody,
  validateImportWearablesBody,
};
