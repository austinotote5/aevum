const express = require('express');
const authenticate = require('../middleware/authenticate');
const requirePlan = require('../middleware/requirePlan');
const { status } = require('../controllers/opsController');

const router = express.Router();

router.use(authenticate);
router.use(requirePlan('premium'));

router.get('/status', status);

module.exports = router;
