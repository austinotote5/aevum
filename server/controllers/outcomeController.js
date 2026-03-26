const asyncHandler = require('../utils/asyncHandler');
const { getOutcomeSummary } = require('../services/outcomeService');

const summary = asyncHandler(async (req, res) => {
  const data = await getOutcomeSummary(req.auth.userId);
  res.status(200).json({ data });
});

module.exports = {
  summary,
};
