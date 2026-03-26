const express = require('express');
const authenticate = require('../middleware/authenticate');
const requirePlan = require('../middleware/requirePlan');
const validateRequest = require('../middleware/validate');
const {
  summary,
  evidence,
  postClinicalStudy,
  patchClinicalStudy,
  postRegulatoryArtifact,
  patchRegulatoryArtifact,
} = require('../controllers/platformController');
const {
  validatePlatformQuery,
  validateClinicalStudyCreateBody,
  validateClinicalStudyPatchBody,
  validateRegulatoryArtifactCreateBody,
  validateRegulatoryArtifactPatchBody,
  validateStudyIdParams,
  validateArtifactIdParams,
} = require('../validators/platformValidator');

const router = express.Router();

router.use(authenticate);
router.use(requirePlan('premium'));

router.get('/summary', summary);
router.get('/evidence', requirePlan('enterprise'), validateRequest({ query: validatePlatformQuery }), evidence);
router.post(
  '/clinical-studies',
  requirePlan('enterprise'),
  validateRequest({ body: validateClinicalStudyCreateBody }),
  postClinicalStudy
);
router.patch(
  '/clinical-studies/:studyId',
  requirePlan('enterprise'),
  validateRequest({ params: validateStudyIdParams, body: validateClinicalStudyPatchBody }),
  patchClinicalStudy
);
router.post(
  '/regulatory-artifacts',
  requirePlan('enterprise'),
  validateRequest({ body: validateRegulatoryArtifactCreateBody }),
  postRegulatoryArtifact
);
router.patch(
  '/regulatory-artifacts/:artifactId',
  requirePlan('enterprise'),
  validateRequest({ params: validateArtifactIdParams, body: validateRegulatoryArtifactPatchBody }),
  patchRegulatoryArtifact
);

module.exports = router;
