const express = require('express');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate');
const { entitlements, updatePlan } = require('../controllers/billingController');
const { validatePlanUpdateBody } = require('../validators/billingValidator');

const router = express.Router();

router.use(authenticate);

router.get('/entitlements', entitlements);
router.post('/plan', validateRequest({ body: validatePlanUpdateBody }), updatePlan);

module.exports = router;
