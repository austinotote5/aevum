const BOOLEAN_FIELDS = [
  'avoidHighIntensity',
  'avoidColdExposure',
  'avoidBreathwork',
  'recentInjury',
  'clinicianOverride',
];

const validateContraindicationBody = (body = {}) => {
  const errors = [];

  BOOLEAN_FIELDS.forEach((field) => {
    if (body[field] !== undefined && typeof body[field] !== 'boolean') {
      errors.push({
        field,
        message: `${field} must be a boolean when provided.`,
      });
    }
  });

  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string') {
      errors.push({
        field: 'notes',
        message: 'notes must be a string when provided.',
      });
    } else if (body.notes.trim().length > 1200) {
      errors.push({
        field: 'notes',
        message: 'notes must be 1200 characters or fewer.',
      });
    }
  }

  if (body.clinicianOverride === true) {
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    if (notes.length < 10) {
      errors.push({
        field: 'notes',
        message: 'notes must include override justification (at least 10 characters) when clinicianOverride is true.',
      });
    }
  }

  return errors;
};

module.exports = {
  validateContraindicationBody,
};
