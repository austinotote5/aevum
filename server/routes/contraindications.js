const express = require('express');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate');
const {
  getProfile,
  updateProfile,
} = require('../controllers/contraindicationController');
const { validateContraindicationBody } = require('../validators/contraindicationValidator');

const router = express.Router();

router.use(authenticate);

router.get('/', getProfile);
router.put('/', validateRequest({ body: validateContraindicationBody }), updateProfile);

module.exports = router;
