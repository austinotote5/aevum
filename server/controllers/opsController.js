const asyncHandler = require('../utils/asyncHandler');
const { getDeploymentObservabilityStatus } = require('../services/opsService');

const status = asyncHandler(async (req, res) => {
  const data = await getDeploymentObservabilityStatus();
  res.status(200).json({ data });
});

module.exports = {
  status,
};
