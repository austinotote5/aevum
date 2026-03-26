const validatePlanUpdateBody = (body = {}) => {
  const errors = [];
  const targetPlan = String(body.targetPlan || '').trim().toLowerCase();
  const allowed = ['free', 'premium', 'enterprise'];

  if (!targetPlan) {
    errors.push({
      field: 'targetPlan',
      message: 'targetPlan is required.',
    });
    return errors;
  }

  if (!allowed.includes(targetPlan)) {
    errors.push({
      field: 'targetPlan',
      message: `targetPlan must be one of: ${allowed.join(', ')}.`,
    });
  }

  return errors;
};

module.exports = {
  validatePlanUpdateBody,
};
