const ApiError = require('../utils/apiError');
const { isPlanAtLeast, normalizePlan } = require('../services/entitlementService');

const requirePlan = (minimumPlan = 'free') => (req, res, next) => {
  const currentPlan = normalizePlan(req.auth?.plan);
  if (!isPlanAtLeast(currentPlan, minimumPlan)) {
    return next(ApiError.forbidden(`This endpoint requires ${minimumPlan} plan.`));
  }

  return next();
};

module.exports = requirePlan;
