const asyncHandler = require('../utils/asyncHandler');
const {
  getTodayClinicalPlan,
  getProtocolVersions,
  setProtocolActionCompletion,
} = require('../services/protocolService');

const getTodayProtocol = asyncHandler(async (req, res) => {
  const refresh = String(req.query.refresh || '').toLowerCase();
  const shouldRefresh = refresh === '1' || refresh === 'true' || refresh === 'yes';
  const plan = await getTodayClinicalPlan(req.auth.userId, { refresh: shouldRefresh });

  res.status(200).json({
    data: plan,
  });
});

const completeProtocolAction = asyncHandler(async (req, res) => {
  const actionIndex = Number(req.body.actionIndex);
  const completed = req.body.completed === undefined ? true : Boolean(req.body.completed);

  const plan = await setProtocolActionCompletion({
    userId: req.auth.userId,
    protocolId: req.params.protocolId,
    actionIndex,
    completed,
  });

  res.status(200).json({
    data: plan,
  });
});

const listProtocolVersions = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 8;
  const versions = await getProtocolVersions(req.auth.userId, req.params.protocolId, { limit });

  res.status(200).json({
    data: versions,
  });
});

module.exports = {
  getTodayProtocol,
  completeProtocolAction,
  listProtocolVersions,
};
