const db = require('../db');

const mapBiometric = (row) => ({
  id: row.id,
  userId: row.user_id,
  recordedAt: row.recorded_at,
  source: row.source,
  hrvMs: row.hrv_ms,
  restingHrBpm: row.resting_hr_bpm,
  spo2Percent: row.spo2_percent,
  sleepDurationMin: row.sleep_duration_min,
  sleepEfficiency: row.sleep_efficiency,
  remDurationMin: row.rem_duration_min,
  deepDurationMin: row.deep_duration_min,
  sleepScore: row.sleep_score,
  readinessScore: row.readiness_score,
  bodyTempC: row.body_temp_c,
  stressScore: row.stress_score,
  steps: row.steps,
  activeCalories: row.active_calories,
  vo2Max: row.vo2_max,
  createdAt: row.created_at,
});

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return Number(value);
};

const createBiometricEntry = async (userId, payload) => {
  const query = `
    INSERT INTO biometric_entries (
      user_id,
      recorded_at,
      source,
      hrv_ms,
      resting_hr_bpm,
      spo2_percent,
      sleep_duration_min,
      sleep_efficiency,
      rem_duration_min,
      deep_duration_min,
      sleep_score,
      readiness_score,
      body_temp_c,
      stress_score,
      steps,
      active_calories,
      vo2_max
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17
    )
    RETURNING *
  `;

  const values = [
    userId,
    payload.recordedAt ? new Date(payload.recordedAt) : new Date(),
    payload.source || 'manual',
    toNumberOrNull(payload.hrvMs),
    toNumberOrNull(payload.restingHrBpm),
    toNumberOrNull(payload.spo2Percent),
    toNumberOrNull(payload.sleepDurationMin),
    toNumberOrNull(payload.sleepEfficiency),
    toNumberOrNull(payload.remDurationMin),
    toNumberOrNull(payload.deepDurationMin),
    toNumberOrNull(payload.sleepScore),
    toNumberOrNull(payload.readinessScore),
    toNumberOrNull(payload.bodyTempC),
    toNumberOrNull(payload.stressScore),
    toNumberOrNull(payload.steps),
    toNumberOrNull(payload.activeCalories),
    toNumberOrNull(payload.vo2Max),
  ];

  const { rows } = await db.query(query, values);
  return mapBiometric(rows[0]);
};

const getLatestBiometricEntry = async (userId) => {
  const query = `
    SELECT *
    FROM biometric_entries
    WHERE user_id = $1
    ORDER BY recorded_at DESC
    LIMIT 1
  `;

  const { rows } = await db.query(query, [userId]);
  if (!rows[0]) {
    return null;
  }

  return mapBiometric(rows[0]);
};

const getRecentBiometricEntries = async (userId, limit = 30) => {
  const query = `
    SELECT *
    FROM biometric_entries
    WHERE user_id = $1
    ORDER BY recorded_at DESC
    LIMIT $2
  `;

  const { rows } = await db.query(query, [userId, limit]);
  return rows.map(mapBiometric);
};

module.exports = {
  createBiometricEntry,
  getLatestBiometricEntry,
  getRecentBiometricEntries,
};
