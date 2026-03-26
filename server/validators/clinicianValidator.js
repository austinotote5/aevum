const { UUID_REGEX } = require('./common');

const validateClinicianQuery = (query = {}) => {
  const errors = [];
  if (query.limit === undefined) {
    return errors;
  }

  const limit = Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    errors.push({
      field: 'limit',
      message: 'limit must be an integer between 1 and 100.',
    });
  }

  return errors;
};

const validateCreateClinicianNoteBody = (body = {}) => {
  const errors = [];
  const clinicianName = String(body.clinicianName || '').trim();
  const note = String(body.note || '').trim();

  if (!clinicianName) {
    errors.push({
      field: 'clinicianName',
      message: 'clinicianName is required.',
    });
  } else if (clinicianName.length > 120) {
    errors.push({
      field: 'clinicianName',
      message: 'clinicianName must be 120 characters or fewer.',
    });
  }

  if (!note) {
    errors.push({
      field: 'note',
      message: 'note is required.',
    });
  } else if (note.length > 4000) {
    errors.push({
      field: 'note',
      message: 'note must be 4000 characters or fewer.',
    });
  }

  if (body.protocolId !== undefined && body.protocolId !== null && body.protocolId !== '') {
    if (!UUID_REGEX.test(String(body.protocolId))) {
      errors.push({
        field: 'protocolId',
        message: 'protocolId must be a valid UUID when provided.',
      });
    }
  }

  if (body.signOff !== undefined && typeof body.signOff !== 'boolean') {
    errors.push({
      field: 'signOff',
      message: 'signOff must be a boolean when provided.',
    });
  }

  return errors;
};

const validateClinicianNoteParams = (params = {}) => {
  const errors = [];
  if (!UUID_REGEX.test(String(params.noteId || ''))) {
    errors.push({
      field: 'noteId',
      message: 'noteId must be a valid UUID.',
    });
  }
  return errors;
};

module.exports = {
  validateClinicianQuery,
  validateCreateClinicianNoteBody,
  validateClinicianNoteParams,
};
