const db = require('../db');
const ApiError = require('../utils/apiError');
const { getEntitlementsForPlan, normalizePlan } = require('./entitlementService');

const WEARABLE_PROVIDERS = Object.freeze([
  'apple_health',
  'oura',
  'garmin',
  'fitbit',
]);

const PROVIDER_SOURCE_MAP = Object.freeze({
  apple_health: 'apple_watch',
  oura: 'oura',
  garmin: 'garmin',
  fitbit: 'fitbit',
});

const NUMERIC_METRIC_RULES = Object.freeze({
  hrvMs: { min: 5, max: 250, integer: false },
  restingHrBpm: { min: 25, max: 220, integer: false },
  spo2Percent: { min: 60, max: 100, integer: false },
  sleepDurationMin: { min: 0, max: 1200, integer: true },
  sleepEfficiency: { min: 0, max: 100, integer: false },
  remDurationMin: { min: 0, max: 600, integer: true },
  deepDurationMin: { min: 0, max: 600, integer: true },
  sleepScore: { min: 0, max: 100, integer: false },
  readinessScore: { min: 0, max: 100, integer: false },
  bodyTempC: { min: 30, max: 45, integer: false },
  stressScore: { min: 0, max: 100, integer: false },
  steps: { min: 0, max: 150000, integer: true },
  activeCalories: { min: 0, max: 10000, integer: true },
  vo2Max: { min: 5, max: 100, integer: false },
});

const METRIC_ALIAS_GROUPS = Object.freeze({
  hrvMs: ['hrvMs', 'hrv', 'hrv_ms'],
  restingHrBpm: ['restingHrBpm', 'restingHeartRate', 'resting_hr_bpm', 'rhr'],
  spo2Percent: ['spo2Percent', 'spo2', 'bloodOxygenPercent', 'spo2_percent'],
  sleepDurationMin: ['sleepDurationMin', 'sleepMinutes', 'totalSleepMin', 'sleep_duration_min'],
  sleepEfficiency: ['sleepEfficiency', 'sleepEfficiencyPercent', 'sleep_efficiency'],
  remDurationMin: ['remDurationMin', 'remSleepMin', 'rem_duration_min'],
  deepDurationMin: ['deepDurationMin', 'deepSleepMin', 'deep_duration_min'],
  sleepScore: ['sleepScore', 'sleep_score'],
  readinessScore: ['readinessScore', 'readiness', 'readiness_score'],
  bodyTempC: ['bodyTempC', 'bodyTemperatureC', 'tempC', 'body_temp_c'],
  stressScore: ['stressScore', 'stress', 'stress_score'],
  steps: ['steps', 'stepCount'],
  activeCalories: ['activeCalories', 'caloriesActive', 'active_calories'],
  vo2Max: ['vo2Max', 'vo2max', 'vo2_max'],
});

let schemaEnsured = false;

const providerIsValid = (provider) => WEARABLE_PROVIDERS.includes(String(provider || '').trim().toLowerCase());

const toProvider = (provider) => String(provider || '').trim().toLowerCase();

const toBiometricSource = (provider) => {
  const normalized = toProvider(provider);
  return PROVIDER_SOURCE_MAP[normalized] || normalized;
};

const toDateOrNull = (value) => {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp);
};

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const sanitizeMetricValue = (value, rule) => {
  const numeric = toNumberOrNull(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (numeric < rule.min || numeric > rule.max) {
    return null;
  }

  if (rule.integer) {
    return Math.round(numeric);
  }

  return Number(numeric.toFixed(2));
};

const pickAliasedValue = (payload, aliases = []) => {
  for (const alias of aliases) {
    if (payload[alias] !== undefined && payload[alias] !== null && payload[alias] !== '') {
      return payload[alias];
    }
  }
  return null;
};

const mapConnection = (row) => ({
  id: row.id,
  userId: row.user_id,
  provider: row.provider,
  connected: row.is_active === true,
  hasAccessToken: Boolean(row.access_token),
  hasRefreshToken: Boolean(row.refresh_token),
  tokenExpiresAt: row.token_expires || null,
  lastSyncedAt: row.last_synced_at || null,
  createdAt: row.created_at || null,
});

const ensureWearableSchema = async () => {
  if (schemaEnsured) {
    return;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS wearable_connections (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider        VARCHAR(50) NOT NULL,
      access_token    TEXT,
      refresh_token   TEXT,
      token_expires   TIMESTAMPTZ,
      last_synced_at  TIMESTAMPTZ,
      is_active       BOOLEAN     DEFAULT true,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, provider)
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_wearable_connections_user
      ON wearable_connections(user_id, provider)
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_biometrics_wearable_dedupe
      ON biometric_entries(user_id, source, recorded_at)
      WHERE source <> 'manual'
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS wearable_import_events (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID        REFERENCES users(id) ON DELETE CASCADE,
      provider      VARCHAR(50) NOT NULL,
      status        VARCHAR(30) NOT NULL,
      processed     INTEGER     DEFAULT 0,
      inserted      INTEGER     DEFAULT 0,
      updated       INTEGER     DEFAULT 0,
      skipped       INTEGER     DEFAULT 0,
      error_message TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_wearable_import_events_created
      ON wearable_import_events(created_at DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_wearable_import_events_user
      ON wearable_import_events(user_id, created_at DESC)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS wearable_import_usage (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      usage_date    DATE        NOT NULL,
      imports_count INTEGER     NOT NULL DEFAULT 0,
      updated_at    TIMESTAMPTZ DEFAULT NOW(),
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, usage_date)
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_wearable_import_usage_user_date
      ON wearable_import_usage(user_id, usage_date DESC)
  `);

  schemaEnsured = true;
};

const getWearableImportUsageToday = async (userId) => {
  const { rows } = await db.query(`
    SELECT imports_count
    FROM wearable_import_usage
    WHERE user_id = $1
      AND usage_date = CURRENT_DATE
    LIMIT 1
  `, [userId]);

  return Number(rows[0]?.imports_count || 0);
};

const reserveWearableImportUsage = async (client, userId) => {
  const { rows } = await client.query(`
    INSERT INTO wearable_import_usage (user_id, usage_date, imports_count)
    VALUES ($1, CURRENT_DATE, 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET
      imports_count = wearable_import_usage.imports_count + 1,
      updated_at = NOW()
    RETURNING imports_count
  `, [userId]);

  return Number(rows[0]?.imports_count || 1);
};

const logImportEvent = async ({
  userId,
  provider,
  status,
  processed = 0,
  inserted = 0,
  updated = 0,
  skipped = 0,
  errorMessage = null,
}) => {
  await db.query(`
    INSERT INTO wearable_import_events (
      user_id,
      provider,
      status,
      processed,
      inserted,
      updated,
      skipped,
      error_message
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [userId, provider, status, processed, inserted, updated, skipped, errorMessage]);
};

const listWearableConnections = async (userId) => {
  await ensureWearableSchema();

  const { rows } = await db.query(`
    SELECT *
    FROM wearable_connections
    WHERE user_id = $1
    ORDER BY provider ASC
  `, [userId]);

  const byProvider = new Map(rows.map((row) => [row.provider, mapConnection(row)]));
  const connections = WEARABLE_PROVIDERS.map((provider) => (
    byProvider.get(provider) || {
      provider,
      connected: false,
      hasAccessToken: false,
      hasRefreshToken: false,
      tokenExpiresAt: null,
      lastSyncedAt: null,
      createdAt: null,
    }
  ));

  return {
    providers: [...WEARABLE_PROVIDERS],
    connections,
  };
};

const connectWearableProvider = async (userId, payload = {}) => {
  await ensureWearableSchema();

  const provider = toProvider(payload.provider);
  if (!providerIsValid(provider)) {
    throw ApiError.badRequest('Unsupported wearable provider.');
  }

  const tokenExpires = toDateOrNull(payload.tokenExpires);
  if (payload.tokenExpires !== undefined && !tokenExpires) {
    throw ApiError.badRequest('tokenExpires must be a valid ISO date.');
  }

  const accessToken = typeof payload.accessToken === 'string' && payload.accessToken.trim()
    ? payload.accessToken.trim()
    : null;
  const refreshToken = typeof payload.refreshToken === 'string' && payload.refreshToken.trim()
    ? payload.refreshToken.trim()
    : null;
  const isActive = payload.isActive === undefined ? true : payload.isActive === true;

  const { rows } = await db.query(`
    INSERT INTO wearable_connections (
      user_id,
      provider,
      access_token,
      refresh_token,
      token_expires,
      is_active
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (user_id, provider)
    DO UPDATE SET
      access_token = COALESCE(EXCLUDED.access_token, wearable_connections.access_token),
      refresh_token = COALESCE(EXCLUDED.refresh_token, wearable_connections.refresh_token),
      token_expires = COALESCE(EXCLUDED.token_expires, wearable_connections.token_expires),
      is_active = EXCLUDED.is_active
    RETURNING *
  `, [userId, provider, accessToken, refreshToken, tokenExpires, isActive]);

  return mapConnection(rows[0]);
};

const normalizeReading = (provider, reading = {}) => {
  const recordedAt = toDateOrNull(
    reading.recordedAt
    || reading.timestamp
    || reading.recorded_at
    || reading.time
  );

  if (!recordedAt) {
    return null;
  }

  const metricPayload = {};
  for (const [metric, aliases] of Object.entries(METRIC_ALIAS_GROUPS)) {
    const rule = NUMERIC_METRIC_RULES[metric];
    const value = pickAliasedValue(reading, aliases);
    metricPayload[metric] = sanitizeMetricValue(value, rule);
  }

  const hasMetric = Object.values(metricPayload).some((value) => value !== null);
  if (!hasMetric) {
    return null;
  }

  return {
    provider: toProvider(provider),
    source: toBiometricSource(provider),
    recordedAt,
    ...metricPayload,
  };
};

const upsertSyncedAtConnection = async (client, userId, provider) => {
  const { rows } = await client.query(`
    INSERT INTO wearable_connections (
      user_id,
      provider,
      last_synced_at,
      is_active
    )
    VALUES ($1, $2, NOW(), true)
    ON CONFLICT (user_id, provider)
    DO UPDATE SET
      last_synced_at = NOW(),
      is_active = true
    RETURNING *
  `, [userId, provider]);

  return mapConnection(rows[0]);
};

const ingestWearableBiometrics = async (userId, provider, readings = [], options = {}) => {
  await ensureWearableSchema();

  const normalizedProvider = toProvider(provider);
  if (!providerIsValid(normalizedProvider)) {
    throw ApiError.badRequest('Unsupported wearable provider.');
  }

  const plan = normalizePlan(options.plan || 'free');
  const entitlements = getEntitlementsForPlan(plan);
  const usageToday = await getWearableImportUsageToday(userId);
  if (usageToday >= entitlements.wearableImportsPerDay) {
    throw ApiError.forbidden(
      `Daily wearable import limit reached for ${plan} plan (${entitlements.wearableImportsPerDay}/day).`
    );
  }

  if (!Array.isArray(readings) || readings.length === 0) {
    throw ApiError.badRequest('readings must be a non-empty array.');
  }

  const normalized = readings
    .map((reading) => normalizeReading(normalizedProvider, reading))
    .filter(Boolean);

  if (normalized.length === 0) {
    throw ApiError.badRequest('No valid biometric readings found in import payload.');
  }

  const upsertQuery = `
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
    ON CONFLICT (user_id, source, recorded_at) WHERE source <> 'manual'
    DO UPDATE SET
      hrv_ms = COALESCE(EXCLUDED.hrv_ms, biometric_entries.hrv_ms),
      resting_hr_bpm = COALESCE(EXCLUDED.resting_hr_bpm, biometric_entries.resting_hr_bpm),
      spo2_percent = COALESCE(EXCLUDED.spo2_percent, biometric_entries.spo2_percent),
      sleep_duration_min = COALESCE(EXCLUDED.sleep_duration_min, biometric_entries.sleep_duration_min),
      sleep_efficiency = COALESCE(EXCLUDED.sleep_efficiency, biometric_entries.sleep_efficiency),
      rem_duration_min = COALESCE(EXCLUDED.rem_duration_min, biometric_entries.rem_duration_min),
      deep_duration_min = COALESCE(EXCLUDED.deep_duration_min, biometric_entries.deep_duration_min),
      sleep_score = COALESCE(EXCLUDED.sleep_score, biometric_entries.sleep_score),
      readiness_score = COALESCE(EXCLUDED.readiness_score, biometric_entries.readiness_score),
      body_temp_c = COALESCE(EXCLUDED.body_temp_c, biometric_entries.body_temp_c),
      stress_score = COALESCE(EXCLUDED.stress_score, biometric_entries.stress_score),
      steps = COALESCE(EXCLUDED.steps, biometric_entries.steps),
      active_calories = COALESCE(EXCLUDED.active_calories, biometric_entries.active_calories),
      vo2_max = COALESCE(EXCLUDED.vo2_max, biometric_entries.vo2_max)
    RETURNING (xmax = 0) AS inserted
  `;

  const client = await db.pool.connect();
  let inserted = 0;
  let updated = 0;

  try {
    await client.query('BEGIN');
    await reserveWearableImportUsage(client, userId);

    for (const reading of normalized) {
      const values = [
        userId,
        reading.recordedAt,
        reading.source,
        reading.hrvMs,
        reading.restingHrBpm,
        reading.spo2Percent,
        reading.sleepDurationMin,
        reading.sleepEfficiency,
        reading.remDurationMin,
        reading.deepDurationMin,
        reading.sleepScore,
        reading.readinessScore,
        reading.bodyTempC,
        reading.stressScore,
        reading.steps,
        reading.activeCalories,
        reading.vo2Max,
      ];

      const { rows } = await client.query(upsertQuery, values);
      if (rows[0]?.inserted === true) {
        inserted += 1;
      } else {
        updated += 1;
      }
    }

    const connection = await upsertSyncedAtConnection(client, userId, normalizedProvider);
    await client.query('COMMIT');

    const latestRecordedAt = normalized.reduce((latest, row) => (
      !latest || row.recordedAt > latest ? row.recordedAt : latest
    ), null);

    await logImportEvent({
      userId,
      provider: normalizedProvider,
      status: 'success',
      processed: normalized.length,
      inserted,
      updated,
      skipped: Math.max(0, readings.length - normalized.length),
    });

    return {
      provider: normalizedProvider,
      source: toBiometricSource(normalizedProvider),
      plan,
      usageToday: usageToday + 1,
      dailyLimit: entitlements.wearableImportsPerDay,
      received: readings.length,
      processed: normalized.length,
      inserted,
      updated,
      skipped: Math.max(0, readings.length - normalized.length),
      latestRecordedAt: latestRecordedAt ? latestRecordedAt.toISOString() : null,
      connection,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    try {
      await logImportEvent({
        userId,
        provider: normalizedProvider,
        status: 'failed',
        errorMessage: error.message,
      });
    } catch (loggingError) {
      // no-op: failing telemetry should not override original import failure
    }
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  WEARABLE_PROVIDERS,
  getWearableImportUsageToday,
  listWearableConnections,
  connectWearableProvider,
  ingestWearableBiometrics,
};
