const express = require('express');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate');
const {
  getTodayProtocol,
  completeProtocolAction,
  listProtocolVersions,
} = require('../controllers/protocolController');
const {
  validateProtocolQuery,
  validateProtocolParams,
  validateProtocolCompletionBody,
  validateProtocolVersionQuery,
} = require('../validators/protocolValidator');

const router = express.Router();

router.use(authenticate);

router.get('/today', validateRequest({ query: validateProtocolQuery }), getTodayProtocol);
router.get(
  '/:protocolId/versions',
  validateRequest({ params: validateProtocolParams, query: validateProtocolVersionQuery }),
  listProtocolVersions
);
router.post(
  '/:protocolId/complete',
  validateRequest({ params: validateProtocolParams, body: validateProtocolCompletionBody }),
  completeProtocolAction
);

module.exports = router;
