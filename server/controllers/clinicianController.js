const asyncHandler = require('../utils/asyncHandler');
const {
  listClinicianNotes,
  createClinicianNote,
  signOffClinicianNote,
} = require('../services/clinicianService');

const listNotes = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const notes = await listClinicianNotes(req.auth.userId, { limit });
  res.status(200).json({ data: notes });
});

const createNote = asyncHandler(async (req, res) => {
  const note = await createClinicianNote(req.auth.userId, req.body || {});
  res.status(201).json({ data: note });
});

const signoffNote = asyncHandler(async (req, res) => {
  const note = await signOffClinicianNote(req.auth.userId, req.params.noteId);
  res.status(200).json({ data: note });
});

module.exports = {
  listNotes,
  createNote,
  signoffNote,
};
