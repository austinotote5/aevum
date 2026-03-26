const db = require('../db');
const ApiError = require('../utils/apiError');
const { mapUser, findUserById } = require('./userService');

const DEFAULT_CONSENT = Object.freeze({
  consentVersion: '1.0.0',
  acceptedTerms: false,
  acceptedPrivacy: false,
  acceptedClinicalDisclaimer: false,
  acceptedMarketing: false,
  consentedAt: null,
  updatedAt: null,
});

const DEFAULT_HIPAA_ATTESTATION = Object.freeze({
  attestationVersion: '2026.1',
  organizationName: '',
  attestedBy: '',
  attestorRole: '',
  contactEmail: '',
  securityRuleAcknowledged: false,
  privacyRuleAcknowledged: false,
  breachRuleAcknowledged: false,
  minimumNecessaryAcknowledged: false,
  baaRequired: false,
  baaStatus: 'not_required',
  attestedAt: null,
  updatedAt: null,
});

const VALID_BAA_STATUS = new Set([
  'not_required',
  'not_requested',
  'requested',
  'in_review',
  'executed',
  'declined',
]);

const VALID_BAA_REVIEW_STATUS = new Set([
  'in_review',
  'executed',
  'declined',
]);

let complianceSchemaEnsured = false;

const ensureComplianceSchema = async () => {
  if (complianceSchemaEnsured) {
    return;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_consents (
      id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      consent_version               VARCHAR(20) NOT NULL DEFAULT '1.0.0',
      accepted_terms                BOOLEAN     DEFAULT false,
      accepted_privacy              BOOLEAN     DEFAULT false,
      accepted_clinical_disclaimer  BOOLEAN     DEFAULT false,
      accepted_marketing            BOOLEAN     DEFAULT false,
      consented_at                  TIMESTAMPTZ,
      updated_at                    TIMESTAMPTZ DEFAULT NOW(),
      created_at                    TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_user_consents_user
      ON user_consents(user_id)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS data_deletion_requests (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status           VARCHAR(30) NOT NULL DEFAULT 'pending',
      reason           TEXT,
      requested_at     TIMESTAMPTZ DEFAULT NOW(),
      resolved_at      TIMESTAMPTZ,
      resolution_note  TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_deletion_requests_user
      ON data_deletion_requests(user_id, requested_at DESC)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS hipaa_attestations (
      id                             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      attestation_version            VARCHAR(20)  NOT NULL DEFAULT '2026.1',
      organization_name              VARCHAR(200),
      attested_by                    VARCHAR(120),
      attestor_role                  VARCHAR(120),
      contact_email                  VARCHAR(255),
      security_rule_acknowledged     BOOLEAN      DEFAULT false,
      privacy_rule_acknowledged      BOOLEAN      DEFAULT false,
      breach_rule_acknowledged       BOOLEAN      DEFAULT false,
      minimum_necessary_acknowledged BOOLEAN      DEFAULT false,
      baa_required                   BOOLEAN      DEFAULT false,
      baa_status                     VARCHAR(30)  NOT NULL DEFAULT 'not_required',
      attested_at                    TIMESTAMPTZ,
      updated_at                     TIMESTAMPTZ  DEFAULT NOW(),
      created_at                     TIMESTAMPTZ  DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_hipaa_attestations_user
      ON hipaa_attestations(user_id)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS baa_requests (
      id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_name VARCHAR(200) NOT NULL,
      contact_email     VARCHAR(255) NOT NULL,
      requested_by      VARCHAR(120),
      request_note      TEXT,
      status            VARCHAR(30)  NOT NULL DEFAULT 'requested',
      requested_at      TIMESTAMPTZ  DEFAULT NOW(),
      reviewed_at       TIMESTAMPTZ,
      executed_at       TIMESTAMPTZ,
      legal_note        TEXT,
      created_at        TIMESTAMPTZ  DEFAULT NOW(),
      updated_at        TIMESTAMPTZ  DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_baa_requests_user_created
      ON baa_requests(user_id, requested_at DESC, created_at DESC)
  `);

  complianceSchemaEnsured = true;
};

const mapConsent = (row) => {
  if (!row) {
    return { ...DEFAULT_CONSENT };
  }

  return {
    consentVersion: row.consent_version || '1.0.0',
    acceptedTerms: Boolean(row.accepted_terms),
    acceptedPrivacy: Boolean(row.accepted_privacy),
    acceptedClinicalDisclaimer: Boolean(row.accepted_clinical_disclaimer),
    acceptedMarketing: Boolean(row.accepted_marketing),
    consentedAt: row.consented_at || null,
    updatedAt: row.updated_at || null,
  };
};

const mapDeletionRequest = (row) => ({
  id: row.id,
  userId: row.user_id,
  status: row.status,
  reason: row.reason || '',
  requestedAt: row.requested_at || row.created_at,
  resolvedAt: row.resolved_at || null,
  resolutionNote: row.resolution_note || '',
});

const mapHipaaAttestation = (row) => {
  if (!row) {
    return { ...DEFAULT_HIPAA_ATTESTATION };
  }

  const baaStatus = VALID_BAA_STATUS.has(String(row.baa_status || '').toLowerCase())
    ? String(row.baa_status).toLowerCase()
    : 'not_required';

  return {
    attestationVersion: row.attestation_version || '2026.1',
    organizationName: row.organization_name || '',
    attestedBy: row.attested_by || '',
    attestorRole: row.attestor_role || '',
    contactEmail: row.contact_email || '',
    securityRuleAcknowledged: Boolean(row.security_rule_acknowledged),
    privacyRuleAcknowledged: Boolean(row.privacy_rule_acknowledged),
    breachRuleAcknowledged: Boolean(row.breach_rule_acknowledged),
    minimumNecessaryAcknowledged: Boolean(row.minimum_necessary_acknowledged),
    baaRequired: Boolean(row.baa_required),
    baaStatus,
    attestedAt: row.attested_at || null,
    updatedAt: row.updated_at || null,
  };
};

const mapBaaRequest = (row) => ({
  id: row.id,
  userId: row.user_id,
  organizationName: row.organization_name,
  contactEmail: row.contact_email,
  requestedBy: row.requested_by || '',
  requestNote: row.request_note || '',
  status: String(row.status || 'requested').toLowerCase(),
  requestedAt: row.requested_at || row.created_at || null,
  reviewedAt: row.reviewed_at || null,
  executedAt: row.executed_at || null,
  legalNote: row.legal_note || '',
});

const insertComplianceAuditLogEntry = async ({
  userId,
  action,
  resource,
  resourceId = null,
  details = null,
}) => {
  try {
    await db.query(`
      INSERT INTO audit_log (
        user_id,
        actor_id,
        action,
        resource,
        resource_id,
        user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      userId,
      userId,
      action,
      String(resource || 'compliance').slice(0, 100),
      resourceId,
      details ? JSON.stringify(details) : null,
    ]);
  } catch {
    // Best-effort logging only. Compliance workflows must stay available.
  }
};

const getConsentProfile = async (userId) => {
  await ensureComplianceSchema();

  const { rows } = await db.query(`
    SELECT *
    FROM user_consents
    WHERE user_id = $1
    LIMIT 1
  `, [userId]);

  return mapConsent(rows[0] || null);
};

const updateConsentProfile = async (userId, payload = {}) => {
  await ensureComplianceSchema();
  const current = await getConsentProfile(userId);

  const consentVersion = String(payload.consentVersion || current.consentVersion || '1.0.0').trim();
  const acceptedTerms = payload.acceptedTerms === undefined
    ? current.acceptedTerms
    : payload.acceptedTerms === true;
  const acceptedPrivacy = payload.acceptedPrivacy === undefined
    ? current.acceptedPrivacy
    : payload.acceptedPrivacy === true;
  const acceptedClinicalDisclaimer = payload.acceptedClinicalDisclaimer === undefined
    ? current.acceptedClinicalDisclaimer
    : payload.acceptedClinicalDisclaimer === true;
  const acceptedMarketing = payload.acceptedMarketing === undefined
    ? current.acceptedMarketing
    : payload.acceptedMarketing === true;

  const consentedAt = (acceptedTerms && acceptedPrivacy && acceptedClinicalDisclaimer)
    ? new Date()
    : null;

  const { rows } = await db.query(`
    INSERT INTO user_consents (
      user_id,
      consent_version,
      accepted_terms,
      accepted_privacy,
      accepted_clinical_disclaimer,
      accepted_marketing,
      consented_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (user_id)
    DO UPDATE SET
      consent_version = EXCLUDED.consent_version,
      accepted_terms = EXCLUDED.accepted_terms,
      accepted_privacy = EXCLUDED.accepted_privacy,
      accepted_clinical_disclaimer = EXCLUDED.accepted_clinical_disclaimer,
      accepted_marketing = EXCLUDED.accepted_marketing,
      consented_at = EXCLUDED.consented_at,
      updated_at = NOW()
    RETURNING *
  `, [
    userId,
    consentVersion,
    acceptedTerms,
    acceptedPrivacy,
    acceptedClinicalDisclaimer,
    acceptedMarketing,
    consentedAt,
  ]);

  return mapConsent(rows[0] || null);
};

const listDeletionRequests = async (userId, { limit = 10 } = {}) => {
  await ensureComplianceSchema();
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));

  const { rows } = await db.query(`
    SELECT *
    FROM data_deletion_requests
    WHERE user_id = $1
    ORDER BY requested_at DESC, created_at DESC
    LIMIT $2
  `, [userId, safeLimit]);

  return rows.map(mapDeletionRequest);
};

const requestDataDeletion = async (userId, payload = {}) => {
  await ensureComplianceSchema();

  const reason = String(payload.reason || '').trim().slice(0, 2000);
  const { rows: pendingRows } = await db.query(`
    SELECT id
    FROM data_deletion_requests
    WHERE user_id = $1
      AND status IN ('pending', 'processing')
    ORDER BY requested_at DESC
    LIMIT 1
  `, [userId]);

  if (pendingRows[0]) {
    throw ApiError.conflict('You already have a pending deletion request.');
  }

  const { rows } = await db.query(`
    INSERT INTO data_deletion_requests (
      user_id,
      status,
      reason
    )
    VALUES ($1, 'pending', $2)
    RETURNING *
  `, [userId, reason || null]);

  return mapDeletionRequest(rows[0]);
};

const getHipaaAttestation = async (userId) => {
  await ensureComplianceSchema();

  const { rows } = await db.query(`
    SELECT *
    FROM hipaa_attestations
    WHERE user_id = $1
    LIMIT 1
  `, [userId]);

  return mapHipaaAttestation(rows[0] || null);
};

const updateHipaaAttestation = async (userId, payload = {}) => {
  await ensureComplianceSchema();
  const current = await getHipaaAttestation(userId);

  const attestationVersion = String(payload.attestationVersion || current.attestationVersion || '2026.1')
    .trim()
    .slice(0, 20);
  const organizationName = String(payload.organizationName || current.organizationName || '').trim().slice(0, 200);
  const attestedBy = String(payload.attestedBy || current.attestedBy || '').trim().slice(0, 120);
  const attestorRole = String(payload.attestorRole || current.attestorRole || '').trim().slice(0, 120);
  const contactEmail = String(payload.contactEmail || current.contactEmail || '').trim().toLowerCase().slice(0, 255);
  const securityRuleAcknowledged = payload.securityRuleAcknowledged === undefined
    ? current.securityRuleAcknowledged
    : payload.securityRuleAcknowledged === true;
  const privacyRuleAcknowledged = payload.privacyRuleAcknowledged === undefined
    ? current.privacyRuleAcknowledged
    : payload.privacyRuleAcknowledged === true;
  const breachRuleAcknowledged = payload.breachRuleAcknowledged === undefined
    ? current.breachRuleAcknowledged
    : payload.breachRuleAcknowledged === true;
  const minimumNecessaryAcknowledged = payload.minimumNecessaryAcknowledged === undefined
    ? current.minimumNecessaryAcknowledged
    : payload.minimumNecessaryAcknowledged === true;
  const baaRequired = payload.baaRequired === undefined
    ? current.baaRequired
    : payload.baaRequired === true;

  const allSafeguardsAcknowledged = (
    securityRuleAcknowledged
    && privacyRuleAcknowledged
    && breachRuleAcknowledged
    && minimumNecessaryAcknowledged
  );
  const isAttested = allSafeguardsAcknowledged
    && Boolean(organizationName)
    && Boolean(attestedBy)
    && Boolean(contactEmail);
  const attestedAt = isAttested ? new Date() : null;

  let baaStatus = payload.baaStatus !== undefined
    ? String(payload.baaStatus || '').trim().toLowerCase()
    : String(current.baaStatus || '').trim().toLowerCase();

  if (!VALID_BAA_STATUS.has(baaStatus)) {
    baaStatus = 'not_required';
  }
  if (!baaRequired) {
    baaStatus = 'not_required';
  } else if (baaStatus === 'not_required') {
    baaStatus = 'not_requested';
  }

  const { rows } = await db.query(`
    INSERT INTO hipaa_attestations (
      user_id,
      attestation_version,
      organization_name,
      attested_by,
      attestor_role,
      contact_email,
      security_rule_acknowledged,
      privacy_rule_acknowledged,
      breach_rule_acknowledged,
      minimum_necessary_acknowledged,
      baa_required,
      baa_status,
      attested_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12, $13
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      attestation_version = EXCLUDED.attestation_version,
      organization_name = EXCLUDED.organization_name,
      attested_by = EXCLUDED.attested_by,
      attestor_role = EXCLUDED.attestor_role,
      contact_email = EXCLUDED.contact_email,
      security_rule_acknowledged = EXCLUDED.security_rule_acknowledged,
      privacy_rule_acknowledged = EXCLUDED.privacy_rule_acknowledged,
      breach_rule_acknowledged = EXCLUDED.breach_rule_acknowledged,
      minimum_necessary_acknowledged = EXCLUDED.minimum_necessary_acknowledged,
      baa_required = EXCLUDED.baa_required,
      baa_status = EXCLUDED.baa_status,
      attested_at = EXCLUDED.attested_at,
      updated_at = NOW()
    RETURNING *
  `, [
    userId,
    attestationVersion || '2026.1',
    organizationName || null,
    attestedBy || null,
    attestorRole || null,
    contactEmail || null,
    securityRuleAcknowledged,
    privacyRuleAcknowledged,
    breachRuleAcknowledged,
    minimumNecessaryAcknowledged,
    baaRequired,
    baaStatus,
    attestedAt,
  ]);

  const mapped = mapHipaaAttestation(rows[0] || null);
  await insertComplianceAuditLogEntry({
    userId,
    action: 'compliance.hipaa_attestation.updated',
    resource: 'hipaa_attestations',
    resourceId: rows[0]?.id || null,
    details: {
      baaRequired: mapped.baaRequired,
      baaStatus: mapped.baaStatus,
      attestedAt: mapped.attestedAt,
    },
  });

  return mapped;
};

const listBaaRequests = async (userId, { limit = 10 } = {}) => {
  await ensureComplianceSchema();
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));

  const { rows } = await db.query(`
    SELECT *
    FROM baa_requests
    WHERE user_id = $1
    ORDER BY requested_at DESC, created_at DESC
    LIMIT $2
  `, [userId, safeLimit]);

  return rows.map(mapBaaRequest);
};

const createBaaRequest = async (userId, payload = {}) => {
  await ensureComplianceSchema();

  const organizationName = String(payload.organizationName || '').trim().slice(0, 200);
  const contactEmail = String(payload.contactEmail || '').trim().toLowerCase().slice(0, 255);
  const requestedBy = String(payload.requestedBy || '').trim().slice(0, 120);
  const requestNote = String(payload.requestNote || '').trim().slice(0, 2000);

  if (!organizationName || !contactEmail) {
    throw ApiError.badRequest('organizationName and contactEmail are required.');
  }

  const { rows: pendingRows } = await db.query(`
    SELECT id
    FROM baa_requests
    WHERE user_id = $1
      AND status IN ('requested', 'in_review')
    ORDER BY requested_at DESC
    LIMIT 1
  `, [userId]);

  if (pendingRows[0]) {
    throw ApiError.conflict('A BAA request is already pending legal review.');
  }

  const { rows } = await db.query(`
    INSERT INTO baa_requests (
      user_id,
      organization_name,
      contact_email,
      requested_by,
      request_note,
      status
    )
    VALUES ($1, $2, $3, $4, $5, 'requested')
    RETURNING *
  `, [
    userId,
    organizationName,
    contactEmail,
    requestedBy || null,
    requestNote || null,
  ]);

  await db.query(`
    INSERT INTO hipaa_attestations (
      user_id,
      baa_required,
      baa_status,
      updated_at
    )
    VALUES ($1, true, 'requested', NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      baa_required = true,
      baa_status = 'requested',
      updated_at = NOW()
  `, [userId]);

  const mapped = mapBaaRequest(rows[0]);
  await insertComplianceAuditLogEntry({
    userId,
    action: 'compliance.baa.requested',
    resource: 'baa_requests',
    resourceId: rows[0]?.id || null,
    details: {
      organizationName: mapped.organizationName,
      contactEmail: mapped.contactEmail,
      status: mapped.status,
    },
  });

  return mapped;
};

const isBaaStatusTransitionAllowed = (currentStatus, nextStatus) => {
  if (currentStatus === nextStatus) {
    return true;
  }

  const transitions = {
    requested: new Set(['in_review', 'executed', 'declined']),
    in_review: new Set(['executed', 'declined']),
    declined: new Set(['in_review']),
    executed: new Set([]),
  };

  const allowed = transitions[currentStatus];
  if (!allowed) {
    return false;
  }

  return allowed.has(nextStatus);
};

const updateBaaRequestStatus = async (userId, requestId, payload = {}) => {
  await ensureComplianceSchema();

  const nextStatus = String(payload.status || '').trim().toLowerCase();
  if (!VALID_BAA_REVIEW_STATUS.has(nextStatus)) {
    throw ApiError.badRequest('status must be one of: in_review, executed, declined.');
  }

  const legalNote = String(payload.legalNote || '').trim().slice(0, 2000);
  if (nextStatus === 'declined' && !legalNote) {
    throw ApiError.badRequest('legalNote is required when declining a BAA request.');
  }

  const { rows: existingRows } = await db.query(`
    SELECT *
    FROM baa_requests
    WHERE id = $1
      AND user_id = $2
    LIMIT 1
  `, [requestId, userId]);

  const existing = existingRows[0] || null;
  if (!existing) {
    throw ApiError.notFound('BAA request not found.');
  }

  const currentStatus = String(existing.status || 'requested').toLowerCase();
  if (!isBaaStatusTransitionAllowed(currentStatus, nextStatus)) {
    throw ApiError.conflict(`Cannot change BAA status from ${currentStatus} to ${nextStatus}.`);
  }

  const { rows } = await db.query(`
    UPDATE baa_requests
    SET
      status = $3::varchar(30),
      reviewed_at = CASE
        WHEN $3::varchar(30) IN ('in_review', 'executed', 'declined') THEN COALESCE(reviewed_at, NOW())
        ELSE reviewed_at
      END,
      executed_at = CASE
        WHEN $3::varchar(30) = 'executed' THEN COALESCE(executed_at, NOW())
        WHEN $3::varchar(30) <> 'executed' THEN NULL
        ELSE executed_at
      END,
      legal_note = CASE
        WHEN $4::text IS NULL THEN legal_note
        WHEN LENGTH(BTRIM($4::text)) = 0 THEN legal_note
        ELSE $4::text
      END,
      updated_at = NOW()
    WHERE id = $1
      AND user_id = $2
    RETURNING *
  `, [requestId, userId, nextStatus, legalNote || null]);

  await db.query(`
    INSERT INTO hipaa_attestations (
      user_id,
      baa_required,
      baa_status,
      updated_at
    )
    VALUES ($1, true, $2, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      baa_required = true,
      baa_status = EXCLUDED.baa_status,
      updated_at = NOW()
  `, [userId, nextStatus]);

  const mapped = mapBaaRequest(rows[0] || null);
  await insertComplianceAuditLogEntry({
    userId,
    action: `compliance.baa.status.${nextStatus}`,
    resource: 'baa_requests',
    resourceId: mapped?.id || requestId,
    details: {
      from: currentStatus,
      to: nextStatus,
      legalNotePresent: Boolean(legalNote),
    },
  });

  return mapped;
};

const getAuditBundle = async (userId) => {
  await ensureComplianceSchema();

  const user = await findUserById(userId);
  if (!user) {
    throw ApiError.notFound('User not found.');
  }

  const [
    consent,
    deletionRequests,
    hipaaAttestation,
    baaRequests,
    biometricCounts,
    protocolCounts,
    clinicianCounts,
    recentAuditLog,
  ] = await Promise.all([
    getConsentProfile(userId),
    listDeletionRequests(userId, { limit: 10 }),
    getHipaaAttestation(userId),
    listBaaRequests(userId, { limit: 10 }),
    db.query(`
      SELECT
        COUNT(*)::int AS total,
        MIN(recorded_at) AS first_recorded_at,
        MAX(recorded_at) AS last_recorded_at
      FROM biometric_entries
      WHERE user_id = $1
    `, [userId]),
    db.query(`
      SELECT
        COUNT(*)::int AS protocol_total,
        COUNT(*) FILTER (WHERE generated_at >= NOW() - INTERVAL '30 days')::int AS protocols_last_30d
      FROM daily_protocols
      WHERE user_id = $1
    `, [userId]),
    db.query(`
      SELECT
        COUNT(*)::int AS note_total,
        COUNT(*) FILTER (WHERE signed_off = true)::int AS signed_off_total
      FROM clinician_notes
      WHERE user_id = $1
    `, [userId]),
    db.query(`
      SELECT
        action,
        resource,
        created_at
      FROM audit_log
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId]),
  ]);

  const biometrics = biometricCounts.rows[0] || {};
  const protocols = protocolCounts.rows[0] || {};
  const clinicians = clinicianCounts.rows[0] || {};
  const baaRequestsOpen = baaRequests.filter((request) => (
    ['requested', 'in_review'].includes(String(request.status || '').toLowerCase())
  )).length;
  const latestBaaRequest = baaRequests[0] || null;
  const baaFinalOutcome = !hipaaAttestation?.baaRequired
    ? 'not_required'
    : latestBaaRequest && ['executed', 'declined'].includes(String(latestBaaRequest.status || '').toLowerCase())
      ? String(latestBaaRequest.status || '').toLowerCase()
      : baaRequestsOpen > 0
        ? 'pending'
        : 'not_started';
  const baaFinalizedAt = baaFinalOutcome === 'executed'
    ? latestBaaRequest?.executedAt || latestBaaRequest?.reviewedAt || null
    : baaFinalOutcome === 'declined'
      ? latestBaaRequest?.reviewedAt || null
      : null;

  return {
    generatedAt: new Date().toISOString(),
    bundleVersion: '1.0.0',
    user: mapUser(user),
    consent,
    deletionRequests,
    hipaaAttestation,
    baaRequests,
    complianceReadiness: {
      hipaaAttested: Boolean(hipaaAttestation?.attestedAt),
      baaRequired: Boolean(hipaaAttestation?.baaRequired),
      baaStatus: hipaaAttestation?.baaStatus || 'not_required',
      baaRequestsOpen,
      baaFinalOutcome,
      baaFinalizedAt,
      baaLatestRequest: latestBaaRequest
        ? {
          id: latestBaaRequest.id,
          status: latestBaaRequest.status,
          requestedAt: latestBaaRequest.requestedAt,
          reviewedAt: latestBaaRequest.reviewedAt,
          executedAt: latestBaaRequest.executedAt,
        }
        : null,
    },
    records: {
      biometrics: {
        total: Number(biometrics.total || 0),
        firstRecordedAt: biometrics.first_recorded_at || null,
        lastRecordedAt: biometrics.last_recorded_at || null,
      },
      protocols: {
        total: Number(protocols.protocol_total || 0),
        last30Days: Number(protocols.protocols_last_30d || 0),
      },
      clinicianOps: {
        totalNotes: Number(clinicians.note_total || 0),
        signedOffNotes: Number(clinicians.signed_off_total || 0),
      },
    },
    recentAuditEvents: recentAuditLog.rows.map((row) => ({
      action: row.action,
      resource: row.resource,
      createdAt: row.created_at,
    })),
  };
};

module.exports = {
  getConsentProfile,
  updateConsentProfile,
  listDeletionRequests,
  requestDataDeletion,
  getHipaaAttestation,
  updateHipaaAttestation,
  listBaaRequests,
  createBaaRequest,
  updateBaaRequestStatus,
  getAuditBundle,
};
