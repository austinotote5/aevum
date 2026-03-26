const asyncHandler = require('../utils/asyncHandler');
const {
  getContraindicationProfile,
  upsertContraindicationProfile,
} = require('../services/contraindicationService');

const getProfile = asyncHandler(async (req, res) => {
  const profile = await getContraindicationProfile(req.auth.userId);
  res.status(200).json({ data: profile });
});

const updateProfile = asyncHandler(async (req, res) => {
  const profile = await upsertContraindicationProfile(
    req.auth.userId,
    req.body || {},
    {
      actorId: req.auth.userId,
      requestId: req.requestId || null,
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
    }
  );
  res.status(200).json({ data: profile });
});

module.exports = {
  getProfile,
  updateProfile,
};
