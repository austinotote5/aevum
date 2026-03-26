const express = require('express');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate');
const {
  listConnections,
  connectProvider,
  importReadings,
} = require('../controllers/wearableController');
const {
  validateConnectWearableBody,
  validateImportWearablesBody,
} = require('../validators/wearableValidator');

const router = express.Router();

router.use(authenticate);

router.get('/connections', listConnections);
router.post('/connect', validateRequest({ body: validateConnectWearableBody }), connectProvider);
router.post('/import', validateRequest({ body: validateImportWearablesBody }), importReadings);

module.exports = router;
