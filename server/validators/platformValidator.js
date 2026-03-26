const { UUID_REGEX } = require('./common');

const CLINICAL_STATUSES = new Set(['planned', 'recruiting', 'active', 'completed', 'published']);
const REGULATORY_STATUSES = new Set(['draft', 'review', 'approved']);

const validatePlatformQuery = (query = {}) => {
  const errors = [];
  if (query.limit === undefined) {
    return errors;
  }

  const limit = Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    errors.push({
      field: 'limit',
      message: 'limit must be an integer between 1 and 200.',
    });
  }

  return errors;
};

const validateClinicalStudyCreateBody = (body = {}) => {
  const errors = [];

  if (typeof body.studyCode !== 'string' || !body.studyCode.trim()) {
    errors.push({
      field: 'studyCode',
      message: 'studyCode is required.',
    });
  } else if (body.studyCode.trim().length > 50) {
    errors.push({
      field: 'studyCode',
      message: 'studyCode must be 50 characters or fewer.',
    });
  }

  if (typeof body.title !== 'string' || !body.title.trim()) {
    errors.push({
      field: 'title',
      message: 'title is required.',
    });
  } else if (body.title.trim().length > 255) {
    errors.push({
      field: 'title',
      message: 'title must be 255 characters or fewer.',
    });
  }

  if (body.status !== undefined) {
    const status = String(body.status || '').trim().toLowerCase();
    if (!CLINICAL_STATUSES.has(status)) {
      errors.push({
        field: 'status',
        message: 'status must be one of: planned, recruiting, active, completed, published.',
      });
    }
  }

  if (body.endpointAchieved !== undefined && typeof body.endpointAchieved !== 'boolean') {
    errors.push({
      field: 'endpointAchieved',
      message: 'endpointAchieved must be a boolean when provided.',
    });
  }

  const numericFields = ['cohortSizeTarget', 'cohortSizeEnrolled'];
  numericFields.forEach((field) => {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return;
    }
    const value = Number(body[field]);
    if (!Number.isFinite(value) || value < 0) {
      errors.push({
        field,
        message: `${field} must be a non-negative number when provided.`,
      });
    }
  });

  return errors;
};

const validateClinicalStudyPatchBody = (body = {}) => {
  const keys = Object.keys(body || {});
  if (keys.length === 0) {
    return [{
      field: 'body',
      message: 'At least one field is required.',
    }];
  }

  return validateClinicalStudyCreateBody({
    ...body,
    studyCode: body.studyCode === undefined ? 'skip' : body.studyCode,
    title: body.title === undefined ? 'skip' : body.title,
  }).filter((error) => (
    !(error.field === 'studyCode' && body.studyCode === undefined)
    && !(error.field === 'title' && body.title === undefined)
  ));
};

const validateRegulatoryArtifactCreateBody = (body = {}) => {
  const errors = [];

  if (typeof body.artifactKey !== 'string' || !body.artifactKey.trim()) {
    errors.push({
      field: 'artifactKey',
      message: 'artifactKey is required.',
    });
  } else if (body.artifactKey.trim().length > 100) {
    errors.push({
      field: 'artifactKey',
      message: 'artifactKey must be 100 characters or fewer.',
    });
  }

  if (typeof body.title !== 'string' || !body.title.trim()) {
    errors.push({
      field: 'title',
      message: 'title is required.',
    });
  } else if (body.title.trim().length > 255) {
    errors.push({
      field: 'title',
      message: 'title must be 255 characters or fewer.',
    });
  }

  if (body.status !== undefined) {
    const status = String(body.status || '').trim().toLowerCase();
    if (!REGULATORY_STATUSES.has(status)) {
      errors.push({
        field: 'status',
        message: 'status must be one of: draft, review, approved.',
      });
    }
  }

  if (body.critical !== undefined && typeof body.critical !== 'boolean') {
    errors.push({
      field: 'critical',
      message: 'critical must be a boolean when provided.',
    });
  }

  return errors;
};

const validateRegulatoryArtifactPatchBody = (body = {}) => {
  const keys = Object.keys(body || {});
  if (keys.length === 0) {
    return [{
      field: 'body',
      message: 'At least one field is required.',
    }];
  }

  return validateRegulatoryArtifactCreateBody({
    ...body,
    artifactKey: body.artifactKey === undefined ? 'skip' : body.artifactKey,
    title: body.title === undefined ? 'skip' : body.title,
  }).filter((error) => (
    !(error.field === 'artifactKey' && body.artifactKey === undefined)
    && !(error.field === 'title' && body.title === undefined)
  ));
};

const validateStudyIdParams = (params = {}) => {
  const errors = [];
  const studyId = String(params.studyId || '').trim();
  if (!studyId || !UUID_REGEX.test(studyId)) {
    errors.push({
      field: 'studyId',
      message: 'studyId must be a valid UUID.',
    });
  }
  return errors;
};

const validateArtifactIdParams = (params = {}) => {
  const errors = [];
  const artifactId = String(params.artifactId || '').trim();
  if (!artifactId || !UUID_REGEX.test(artifactId)) {
    errors.push({
      field: 'artifactId',
      message: 'artifactId must be a valid UUID.',
    });
  }
  return errors;
};

module.exports = {
  validatePlatformQuery,
  validateClinicalStudyCreateBody,
  validateClinicalStudyPatchBody,
  validateRegulatoryArtifactCreateBody,
  validateRegulatoryArtifactPatchBody,
  validateStudyIdParams,
  validateArtifactIdParams,
};
