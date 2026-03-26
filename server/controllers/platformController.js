const asyncHandler = require('../utils/asyncHandler');
const {
  getPlatformSummary,
  getEvidenceConsole,
  createClinicalStudy,
  updateClinicalStudy,
  createRegulatoryArtifact,
  updateRegulatoryArtifact,
} = require('../services/platformService');

const summary = asyncHandler(async (req, res) => {
  const data = await getPlatformSummary();
  res.status(200).json({ data });
});

const evidence = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const data = await getEvidenceConsole({ limit });
  res.status(200).json({ data });
});

const postClinicalStudy = asyncHandler(async (req, res) => {
  const data = await createClinicalStudy(req.body || {});
  res.status(201).json({ data });
});

const patchClinicalStudy = asyncHandler(async (req, res) => {
  const data = await updateClinicalStudy(req.params.studyId, req.body || {});
  res.status(200).json({ data });
});

const postRegulatoryArtifact = asyncHandler(async (req, res) => {
  const data = await createRegulatoryArtifact(req.body || {});
  res.status(201).json({ data });
});

const patchRegulatoryArtifact = asyncHandler(async (req, res) => {
  const data = await updateRegulatoryArtifact(req.params.artifactId, req.body || {});
  res.status(200).json({ data });
});

module.exports = {
  summary,
  evidence,
  postClinicalStudy,
  patchClinicalStudy,
  postRegulatoryArtifact,
  patchRegulatoryArtifact,
};
