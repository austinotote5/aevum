const express = require('express');
const authenticate = require('../middleware/authenticate');
const requirePlan = require('../middleware/requirePlan');
const validateRequest = require('../middleware/validate');
const {
  listNotes,
  createNote,
  signoffNote,
} = require('../controllers/clinicianController');
const {
  validateClinicianQuery,
  validateCreateClinicianNoteBody,
  validateClinicianNoteParams,
} = require('../validators/clinicianValidator');

const router = express.Router();

router.use(authenticate);
router.use(requirePlan('premium'));

router.get('/notes', validateRequest({ query: validateClinicianQuery }), listNotes);
router.post('/notes', validateRequest({ body: validateCreateClinicianNoteBody }), createNote);
router.post(
  '/notes/:noteId/signoff',
  validateRequest({ params: validateClinicianNoteParams }),
  signoffNote
);

module.exports = router;
