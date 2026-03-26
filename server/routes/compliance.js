const express = require('express');
const authenticate = require('../middleware/authenticate');
const requirePlan = require('../middleware/requirePlan');
const validateRequest = require('../middleware/validate');
const {
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
} = require('../controllers/complianceController');
const {
  validateConsentBody,
  validateDeletionBody,
  validateHipaaAttestationBody,
  validateBaaRequestBody,
  validateBaaReviewParams,
  validateBaaReviewBody,
  validateComplianceQuery,
} = require('../validators/complianceValidator');

const router = express.Router();

router.use(authenticate);
router.use(requirePlan('premium'));

router.get('/consent', getConsent);
router.put('/consent', validateRequest({ body: validateConsentBody }), putConsent);
router.get('/hipaa-attestation', getHipaa);
router.put('/hipaa-attestation', validateRequest({ body: validateHipaaAttestationBody }), putHipaa);
router.get('/baa-requests', validateRequest({ query: validateComplianceQuery }), getBaaRequests);
router.post('/baa-requests', validateRequest({ body: validateBaaRequestBody }), postBaaRequest);
router.patch(
  '/baa-requests/:requestId/status',
  validateRequest({ params: validateBaaReviewParams, body: validateBaaReviewBody }),
  patchBaaRequestStatus
);
router.get('/deletion-requests', validateRequest({ query: validateComplianceQuery }), getDeletionRequests);
router.post('/deletion-requests', validateRequest({ body: validateDeletionBody }), postDeletionRequest);
router.get('/audit-bundle', getBundle);

module.exports = router;
