const express = require('express');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate');
const {
  createEntry,
  latestEntry,
  recentEntries,
} = require('../controllers/biometricController');
const {
  validateCreateBiometricBody,
  validateBiometricQuery,
} = require('../validators/biometricValidator');

const router = express.Router();

router.use(authenticate);

router.post('/', validateRequest({ body: validateCreateBiometricBody }), createEntry);
router.get('/latest', latestEntry);
router.get('/recent', validateRequest({ query: validateBiometricQuery }), recentEntries);

module.exports = router;
