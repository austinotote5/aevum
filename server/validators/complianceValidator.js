const { EMAIL_REGEX, UUID_REGEX } = require('./common');

const validateConsentBody = (body = {}) => {
  const errors = [];

  const booleanFields = [
    'acceptedTerms',
    'acceptedPrivacy',
    'acceptedClinicalDisclaimer',
    'acceptedMarketing',
  ];

  booleanFields.forEach((field) => {
    if (body[field] !== undefined && typeof body[field] !== 'boolean') {
      errors.push({
        field,
        message: `${field} must be a boolean when provided.`,
      });
    }
  });

  if (body.consentVersion !== undefined) {
    const version = String(body.consentVersion || '').trim();
    if (!version) {
      errors.push({
        field: 'consentVersion',
        message: 'consentVersion cannot be empty.',
      });
    } else if (version.length > 20) {
      errors.push({
        field: 'consentVersion',
        message: 'consentVersion must be 20 characters or fewer.',
      });
    }
  }

  return errors;
};

const validateDeletionBody = (body = {}) => {
  const errors = [];
  if (body.reason !== undefined && typeof body.reason !== 'string') {
    errors.push({
      field: 'reason',
      message: 'reason must be a string when provided.',
    });
  }

  if (typeof body.reason === 'string' && body.reason.length > 2000) {
    errors.push({
      field: 'reason',
      message: 'reason must be 2000 characters or fewer.',
    });
  }

  return errors;
};

const validateHipaaAttestationBody = (body = {}) => {
  const errors = [];
  const booleanFields = [
    'securityRuleAcknowledged',
    'privacyRuleAcknowledged',
    'breachRuleAcknowledged',
    'minimumNecessaryAcknowledged',
    'baaRequired',
  ];

  booleanFields.forEach((field) => {
    if (body[field] !== undefined && typeof body[field] !== 'boolean') {
      errors.push({
        field,
        message: `${field} must be a boolean when provided.`,
      });
    }
  });

  const stringFields = [
    ['attestationVersion', 20],
    ['organizationName', 200],
    ['attestedBy', 120],
    ['attestorRole', 120],
  ];

  stringFields.forEach(([field, maxLength]) => {
    if (body[field] !== undefined && typeof body[field] !== 'string') {
      errors.push({
        field,
        message: `${field} must be a string when provided.`,
      });
      return;
    }

    if (typeof body[field] === 'string' && body[field].trim().length > maxLength) {
      errors.push({
        field,
        message: `${field} must be ${maxLength} characters or fewer.`,
      });
    }
  });

  if (body.contactEmail !== undefined) {
    if (typeof body.contactEmail !== 'string') {
      errors.push({
        field: 'contactEmail',
        message: 'contactEmail must be a string when provided.',
      });
    } else {
      const email = body.contactEmail.trim();
      if (email && !EMAIL_REGEX.test(email)) {
        errors.push({
          field: 'contactEmail',
          message: 'contactEmail must be a valid email address.',
        });
      }
    }
  }

  if (body.baaStatus !== undefined) {
    const status = String(body.baaStatus || '').trim().toLowerCase();
    const allowed = ['not_required', 'not_requested', 'requested', 'in_review', 'executed', 'declined'];
    if (!allowed.includes(status)) {
      errors.push({
        field: 'baaStatus',
        message: `baaStatus must be one of: ${allowed.join(', ')}.`,
      });
    }
  }

  return errors;
};

const validateBaaRequestBody = (body = {}) => {
  const errors = [];

  if (typeof body.organizationName !== 'string' || !body.organizationName.trim()) {
    errors.push({
      field: 'organizationName',
      message: 'organizationName is required.',
    });
  } else if (body.organizationName.trim().length > 200) {
    errors.push({
      field: 'organizationName',
      message: 'organizationName must be 200 characters or fewer.',
    });
  }

  if (typeof body.contactEmail !== 'string' || !body.contactEmail.trim()) {
    errors.push({
      field: 'contactEmail',
      message: 'contactEmail is required.',
    });
  } else if (!EMAIL_REGEX.test(body.contactEmail.trim())) {
    errors.push({
      field: 'contactEmail',
      message: 'contactEmail must be a valid email address.',
    });
  }

  if (body.requestedBy !== undefined && typeof body.requestedBy !== 'string') {
    errors.push({
      field: 'requestedBy',
      message: 'requestedBy must be a string when provided.',
    });
  } else if (typeof body.requestedBy === 'string' && body.requestedBy.trim().length > 120) {
    errors.push({
      field: 'requestedBy',
      message: 'requestedBy must be 120 characters or fewer.',
    });
  }

  if (body.requestNote !== undefined && typeof body.requestNote !== 'string') {
    errors.push({
      field: 'requestNote',
      message: 'requestNote must be a string when provided.',
    });
  } else if (typeof body.requestNote === 'string' && body.requestNote.length > 2000) {
    errors.push({
      field: 'requestNote',
      message: 'requestNote must be 2000 characters or fewer.',
    });
  }

  return errors;
};

const validateBaaReviewParams = (params = {}) => {
  const errors = [];
  const requestId = String(params.requestId || '').trim();

  if (!requestId) {
    errors.push({
      field: 'requestId',
      message: 'requestId is required.',
    });
  } else if (!UUID_REGEX.test(requestId)) {
    errors.push({
      field: 'requestId',
      message: 'requestId must be a valid UUID.',
    });
  }

  return errors;
};

const validateBaaReviewBody = (body = {}) => {
  const errors = [];
  const status = String(body.status || '').trim().toLowerCase();
  const allowed = ['in_review', 'executed', 'declined'];

  if (!status) {
    errors.push({
      field: 'status',
      message: 'status is required.',
    });
  } else if (!allowed.includes(status)) {
    errors.push({
      field: 'status',
      message: `status must be one of: ${allowed.join(', ')}.`,
    });
  }

  if (body.legalNote !== undefined && typeof body.legalNote !== 'string') {
    errors.push({
      field: 'legalNote',
      message: 'legalNote must be a string when provided.',
    });
  } else if (typeof body.legalNote === 'string' && body.legalNote.length > 2000) {
    errors.push({
      field: 'legalNote',
      message: 'legalNote must be 2000 characters or fewer.',
    });
  }

  if (status === 'declined' && !String(body.legalNote || '').trim()) {
    errors.push({
      field: 'legalNote',
      message: 'legalNote is required when status is declined.',
    });
  }

  return errors;
};

const validateComplianceQuery = (query = {}) => {
  const errors = [];
  if (query.limit === undefined) {
    return errors;
  }

  const limit = Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    errors.push({
      field: 'limit',
      message: 'limit must be an integer between 1 and 50.',
    });
  }

  return errors;
};

module.exports = {
  validateConsentBody,
  validateDeletionBody,
  validateHipaaAttestationBody,
  validateBaaRequestBody,
  validateBaaReviewParams,
  validateBaaReviewBody,
  validateComplianceQuery,
};
