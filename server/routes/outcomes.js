const express = require('express');
const authenticate = require('../middleware/authenticate');
const { summary } = require('../controllers/outcomeController');

const router = express.Router();

router.use(authenticate);
router.get('/summary', summary);

module.exports = router;
