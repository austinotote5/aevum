const db = require('../db');

const DEFAULT_PROFILE = Object.freeze({
  id: null,
  avoidHighIntensity: false,
  avoidColdExposure: false,
  avoidBreathwork: false,
  recentInjury: false,
  clinicianOverride: false,
  notes: '',
  updatedAt: null,
});

let tableEnsured = false;

const ensureContraindicationTable = async () => {
  if (tableEnsured) {
    return;
  }

  const query = `
    CREATE TABLE IF NOT EXISTS user_contraindications (
      id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      avoid_high_intensity  BOOLEAN     DEFAULT false,
      avoid_cold_exposure   BOOLEAN     DEFAULT false,
      avoid_breathwork      BOOLEAN     DEFAULT false,
      recent_injury         BOOLEAN     DEFAULT false,
      clinician_override    BOOLEAN     DEFAULT false,
      notes                 TEXT,
      updated_at            TIMESTAMPTZ DEFAULT NOW(),
      created_at            TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await db.query(query);
  tableEnsured = true;
};

const toProfile = (row) => {
  if (!row) {
    return { ...DEFAULT_PROFILE };
  }

  return {
    id: row.id || null,
    avoidHighIntensity: Boolean(row.avoid_high_intensity),
    avoidColdExposure: Boolean(row.avoid_cold_exposure),
    avoidBreathwork: Boolean(row.avoid_breathwork),
    recentInjury: Boolean(row.recent_injury),
    clinicianOverride: Boolean(row.clinician_override),
    notes: typeof row.notes === 'string' ? row.notes : '',
    updatedAt: row.updated_at || null,
  };
};

const getContraindicationProfile = async (userId) => {
  await ensureContraindicationTable();

  const query = `
    SELECT *
    FROM user_contraindications
    WHERE user_id = $1
    LIMIT 1
  `;
  const { rows } = await db.query(query, [userId]);
  return toProfile(rows[0] || null);
};

const sanitizeNotes = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, 1200);
};

const toBool = (value) => value === true;

const insertContraindicationAuditLogEntry = async ({
  userId,
  actorId,
  action,
  resourceId = null,
  requestId = null,
  ipAddress = null,
  userAgent = null,
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
        ip_address,
        user_agent
      )
      VALUES ($1, $2, $3, 'user_contraindications', $4, $5, $6)
    `, [
      userId,
      actorId || userId,
      String(action || 'contraindications.updated').slice(0, 100),
      resourceId,
      ipAddress || null,
      JSON.stringify({
        requestId: requestId || null,
        userAgent: userAgent || null,
        details: details || null,
      }),
    ]);
  } catch {
    // Best-effort audit logging only.
  }
};

const upsertContraindicationProfile = async (userId, updates = {}, auditContext = {}) => {
  await ensureContraindicationTable();
  const current = await getContraindicationProfile(userId);

  const nextProfile = {
    avoidHighIntensity: updates.avoidHighIntensity === undefined
      ? current.avoidHighIntensity
      : toBool(updates.avoidHighIntensity),
    avoidColdExposure: updates.avoidColdExposure === undefined
      ? current.avoidColdExposure
      : toBool(updates.avoidColdExposure),
    avoidBreathwork: updates.avoidBreathwork === undefined
      ? current.avoidBreathwork
      : toBool(updates.avoidBreathwork),
    recentInjury: updates.recentInjury === undefined
      ? current.recentInjury
      : toBool(updates.recentInjury),
    clinicianOverride: updates.clinicianOverride === undefined
      ? current.clinicianOverride
      : toBool(updates.clinicianOverride),
    notes: updates.notes === undefined ? current.notes : sanitizeNotes(updates.notes),
  };

  const query = `
    INSERT INTO user_contraindications (
      user_id,
      avoid_high_intensity,
      avoid_cold_exposure,
      avoid_breathwork,
      recent_injury,
      clinician_override,
      notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (user_id)
    DO UPDATE SET
      avoid_high_intensity = EXCLUDED.avoid_high_intensity,
      avoid_cold_exposure = EXCLUDED.avoid_cold_exposure,
      avoid_breathwork = EXCLUDED.avoid_breathwork,
      recent_injury = EXCLUDED.recent_injury,
      clinician_override = EXCLUDED.clinician_override,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING *
  `;

  const values = [
    userId,
    nextProfile.avoidHighIntensity,
    nextProfile.avoidColdExposure,
    nextProfile.avoidBreathwork,
    nextProfile.recentInjury,
    nextProfile.clinicianOverride,
    nextProfile.notes,
  ];

  const { rows } = await db.query(query, values);
  const updatedProfile = toProfile(rows[0] || null);

  const changedFields = Object.entries(nextProfile)
    .filter(([key, value]) => current[key] !== value)
    .map(([key]) => key);
  const overrideChanged = current.clinicianOverride !== updatedProfile.clinicianOverride;

  await insertContraindicationAuditLogEntry({
    userId,
    actorId: auditContext.actorId || userId,
    action: 'contraindications.updated',
    resourceId: updatedProfile.id,
    requestId: auditContext.requestId || null,
    ipAddress: auditContext.ipAddress || null,
    userAgent: auditContext.userAgent || null,
    details: {
      changedFields,
      clinicianOverride: updatedProfile.clinicianOverride,
    },
  });

  if (overrideChanged) {
    await insertContraindicationAuditLogEntry({
      userId,
      actorId: auditContext.actorId || userId,
      action: updatedProfile.clinicianOverride
        ? 'contraindications.override.enabled'
        : 'contraindications.override.disabled',
      resourceId: updatedProfile.id,
      requestId: auditContext.requestId || null,
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
      details: {
        previous: current.clinicianOverride,
        current: updatedProfile.clinicianOverride,
        noteProvided: Boolean(updatedProfile.notes),
      },
    });
  }

  return updatedProfile;
};

module.exports = {
  getContraindicationProfile,
  upsertContraindicationProfile,
};
