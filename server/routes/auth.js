const express = require('express');
const validateRequest = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const {
  register,
  login,
  me,
} = require('../controllers/authController');
const { validateRegisterBody, validateLoginBody } = require('../validators/authValidator');

const router = express.Router();

router.post('/register', validateRequest({ body: validateRegisterBody }), register);
router.post('/login', validateRequest({ body: validateLoginBody }), login);
router.get('/me', authenticate, me);

module.exports = router;
