const asyncHandler = require('../utils/asyncHandler');
const {
  createBiometricEntry,
  getLatestBiometricEntry,
  getRecentBiometricEntries,
} = require('../services/biometricService');

const createEntry = asyncHandler(async (req, res) => {
  const entry = await createBiometricEntry(req.auth.userId, req.body);

  res.status(201).json({
    data: entry,
  });
});

const latestEntry = asyncHandler(async (req, res) => {
  const entry = await getLatestBiometricEntry(req.auth.userId);

  res.status(200).json({
    data: entry,
  });
});

const recentEntries = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 30;
  const entries = await getRecentBiometricEntries(req.auth.userId, limit);

  res.status(200).json({
    data: entries,
  });
});

module.exports = {
  createEntry,
  latestEntry,
  recentEntries,
};
