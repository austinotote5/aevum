const express = require('express');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validate');
const { sendMessage, getMessages } = require('../controllers/coachController');
const { validateCoachMessageBody, validateSessionParams } = require('../validators/coachValidator');

const router = express.Router();

router.use(authenticate);

router.post('/message', validateRequest({ body: validateCoachMessageBody }), sendMessage);
router.get(
  '/sessions/:sessionId/messages',
  validateRequest({ params: validateSessionParams }),
  getMessages
);

module.exports = router;
