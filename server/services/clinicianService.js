const db = require('../db');
const ApiError = require('../utils/apiError');

let clinicianSchemaEnsured = false;

const ensureClinicianSchema = async () => {
  if (clinicianSchemaEnsured) {
    return;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS clinician_notes (
      id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      protocol_id    UUID         REFERENCES daily_protocols(id) ON DELETE SET NULL,
      clinician_name VARCHAR(120) NOT NULL,
      note           TEXT         NOT NULL,
      signed_off     BOOLEAN      DEFAULT false,
      signed_off_at  TIMESTAMPTZ,
      created_at     TIMESTAMPTZ  DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_clinician_notes_user_created
      ON clinician_notes(user_id, created_at DESC)
  `);

  clinicianSchemaEnsured = true;
};

const mapNote = (row) => ({
  id: row.id,
  userId: row.user_id,
  protocolId: row.protocol_id,
  clinicianName: row.clinician_name,
  note: row.note,
  signedOff: Boolean(row.signed_off),
  signedOffAt: row.signed_off_at || null,
  createdAt: row.created_at,
});

const listClinicianNotes = async (userId, { limit = 20 } = {}) => {
  await ensureClinicianSchema();
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));

  const { rows } = await db.query(`
    SELECT *
    FROM clinician_notes
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [userId, safeLimit]);

  return rows.map(mapNote);
};

const createClinicianNote = async (userId, payload = {}) => {
  await ensureClinicianSchema();

  const clinicianName = String(payload.clinicianName || '').trim();
  const note = String(payload.note || '').trim();
  if (!clinicianName) {
    throw ApiError.badRequest('clinicianName is required.');
  }
  if (!note) {
    throw ApiError.badRequest('note is required.');
  }

  const protocolId = payload.protocolId || null;
  const signOff = payload.signOff === true;

  const { rows } = await db.query(`
    INSERT INTO clinician_notes (
      user_id,
      protocol_id,
      clinician_name,
      note,
      signed_off,
      signed_off_at
    )
    VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 = true THEN NOW() ELSE NULL END)
    RETURNING *
  `, [userId, protocolId, clinicianName, note, signOff]);

  return mapNote(rows[0]);
};

const signOffClinicianNote = async (userId, noteId) => {
  await ensureClinicianSchema();

  const { rows } = await db.query(`
    UPDATE clinician_notes
    SET
      signed_off = true,
      signed_off_at = COALESCE(signed_off_at, NOW())
    WHERE id = $1
      AND user_id = $2
    RETURNING *
  `, [noteId, userId]);

  if (!rows[0]) {
    throw ApiError.notFound('Clinician note not found.');
  }

  return mapNote(rows[0]);
};

module.exports = {
  listClinicianNotes,
  createClinicianNote,
  signOffClinicianNote,
};
