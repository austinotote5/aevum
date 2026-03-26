const asyncHandler = require('../utils/asyncHandler');
const { signAuthToken } = require('../utils/token');
const { getBillingOverview, changePlan } = require('../services/billingService');

const entitlements = asyncHandler(async (req, res) => {
  const data = await getBillingOverview(req.auth.userId, req.auth.plan);
  res.status(200).json({ data });
});

const updatePlan = asyncHandler(async (req, res) => {
  const updatedUser = await changePlan(req.auth.userId, req.body.targetPlan);
  const token = signAuthToken(updatedUser);
  const data = await getBillingOverview(req.auth.userId, updatedUser.plan);

  res.status(200).json({
    data: {
      ...data,
      token,
    },
  });
});

module.exports = {
  entitlements,
  updatePlan,
};
