const ApiError = require('../utils/apiError');

const PLAN_RANK = Object.freeze({
  free: 0,
  premium: 1,
  enterprise: 2,
});

const PLAN_ENTITLEMENTS = Object.freeze({
  free: {
    wearableImportsPerDay: 2,
    supportsWearables: true,
    supportsOutcomes: true,
    supportsCohortAnalytics: false,
    supportsRoiEngine: false,
    supportsClinicianOps: false,
    supportsInterventionIntelligence: false,
    supportsReliabilityDashboard: false,
  },
  premium: {
    wearableImportsPerDay: 20,
    supportsWearables: true,
    supportsOutcomes: true,
    supportsCohortAnalytics: true,
    supportsRoiEngine: true,
    supportsClinicianOps: true,
    supportsInterventionIntelligence: true,
    supportsReliabilityDashboard: true,
  },
  enterprise: {
    wearableImportsPerDay: 200,
    supportsWearables: true,
    supportsOutcomes: true,
    supportsCohortAnalytics: true,
    supportsRoiEngine: true,
    supportsClinicianOps: true,
    supportsInterventionIntelligence: true,
    supportsReliabilityDashboard: true,
  },
});

const normalizePlan = (plan) => {
  const value = String(plan || 'free').trim().toLowerCase();
  if (PLAN_RANK[value] === undefined) {
    return 'free';
  }
  return value;
};

const getEntitlementsForPlan = (plan) => {
  const normalized = normalizePlan(plan);
  return {
    plan: normalized,
    ...(PLAN_ENTITLEMENTS[normalized] || PLAN_ENTITLEMENTS.free),
  };
};

const isPlanAtLeast = (plan, minimumPlan) => {
  const current = PLAN_RANK[normalizePlan(plan)] ?? PLAN_RANK.free;
  const minimum = PLAN_RANK[normalizePlan(minimumPlan)] ?? PLAN_RANK.free;
  return current >= minimum;
};

const assertPlanAtLeast = (plan, minimumPlan, message) => {
  if (!isPlanAtLeast(plan, minimumPlan)) {
    throw ApiError.forbidden(message || `This action requires ${minimumPlan} plan.`);
  }
};

module.exports = {
  PLAN_RANK,
  normalizePlan,
  getEntitlementsForPlan,
  isPlanAtLeast,
  assertPlanAtLeast,
};
