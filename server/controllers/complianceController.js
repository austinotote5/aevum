const asyncHandler = require('../utils/asyncHandler');
const {
  getConsentProfile,
  updateConsentProfile,
  listDeletionRequests,
  requestDataDeletion,
  getHipaaAttestation,
  updateHipaaAttestation,
  listBaaRequests,
  createBaaRequest,
  updateBaaRequestStatus,
  getAuditBundle,
} = require('../services/complianceService');

const getConsent = asyncHandler(async (req, res) => {
  const data = await getConsentProfile(req.auth.userId);
  res.status(200).json({ data });
});

const putConsent = asyncHandler(async (req, res) => {
  const data = await updateConsentProfile(req.auth.userId, req.body || {});
  res.status(200).json({ data });
});

const getDeletionRequests = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const data = await listDeletionRequests(req.auth.userId, { limit });
  res.status(200).json({ data });
});

const postDeletionRequest = asyncHandler(async (req, res) => {
  const data = await requestDataDeletion(req.auth.userId, req.body || {});
  res.status(201).json({ data });
});

const getHipaa = asyncHandler(async (req, res) => {
  const data = await getHipaaAttestation(req.auth.userId);
  res.status(200).json({ data });
});

const putHipaa = asyncHandler(async (req, res) => {
  const data = await updateHipaaAttestation(req.auth.userId, req.body || {});
  res.status(200).json({ data });
});

const getBaaRequests = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const data = await listBaaRequests(req.auth.userId, { limit });
  res.status(200).json({ data });
});

const postBaaRequest = asyncHandler(async (req, res) => {
  const data = await createBaaRequest(req.auth.userId, req.body || {});
  res.status(201).json({ data });
});

const patchBaaRequestStatus = asyncHandler(async (req, res) => {
  const data = await updateBaaRequestStatus(req.auth.userId, req.params.requestId, req.body || {});
  res.status(200).json({ data });
});

const getBundle = asyncHandler(async (req, res) => {
  const data = await getAuditBundle(req.auth.userId);
  res.status(200).json({ data });
});

module.exports = {
  getConsent,
  putConsent,
  getDeletionRequests,
  postDeletionRequest,
  getHipaa,
  putHipaa,
  getBaaRequests,
  postBaaRequest,
  patchBaaRequestStatus,
  getBundle,
};
