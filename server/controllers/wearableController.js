const asyncHandler = require('../utils/asyncHandler');
const {
  listWearableConnections,
  connectWearableProvider,
  ingestWearableBiometrics,
} = require('../services/wearableService');

const listConnections = asyncHandler(async (req, res) => {
  const data = await listWearableConnections(req.auth.userId);
  res.status(200).json({ data });
});

const connectProvider = asyncHandler(async (req, res) => {
  const connection = await connectWearableProvider(req.auth.userId, req.body || {});
  res.status(200).json({ data: connection });
});

const importReadings = asyncHandler(async (req, res) => {
  const result = await ingestWearableBiometrics(
    req.auth.userId,
    req.body.provider,
    req.body.readings,
    { plan: req.auth.plan }
  );

  res.status(200).json({ data: result });
});

module.exports = {
  listConnections,
  connectProvider,
  importReadings,
};
