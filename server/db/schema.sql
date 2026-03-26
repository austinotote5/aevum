-- ─────────────────────────────────────────────────────────────────────────────
-- AEVUM Database Schema
-- PostgreSQL 14+
--
-- Run this file once to create all tables:
--   psql -U postgres -d aevum -f schema.sql
--
-- Design principles:
--   1. UUIDs as primary keys — not sequential integers.
--      Sequential IDs leak user count to competitors and are enumerable.
--   2. created_at / updated_at on every table — required for HIPAA audit trails.
--   3. Passwords are NEVER stored. Only bcrypt hashes.
--   4. All timestamps in UTC.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation (built-in PostgreSQL extension)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ───────────────────────────────────────────────────────────────────
-- Core identity table. Health data in separate tables — never mixed with auth.
CREATE TABLE IF NOT EXISTS users (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255)  NOT NULL UNIQUE,
  password_hash   VARCHAR(255)  NOT NULL,
  first_name      VARCHAR(100)  NOT NULL,
  last_name       VARCHAR(100)  NOT NULL,
  date_of_birth   DATE,
  biological_sex  VARCHAR(20),                    -- used for hormonal baselines
  height_cm       NUMERIC(5,1),
  weight_kg       NUMERIC(5,1),
  timezone        VARCHAR(100)  DEFAULT 'UTC',
  plan            VARCHAR(50)   DEFAULT 'free',   -- free | premium | enterprise
  is_active       BOOLEAN       DEFAULT true,
  email_verified  BOOLEAN       DEFAULT false,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- ─── BIOMETRIC ENTRIES ───────────────────────────────────────────────────────
-- One row per biometric reading session (typically once per day from wearable).
-- Nullable columns — not every wearable provides every metric.
CREATE TABLE IF NOT EXISTS biometric_entries (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at         TIMESTAMPTZ NOT NULL,         -- when the data was measured
  source              VARCHAR(50) DEFAULT 'manual', -- apple_watch | oura | garmin | manual

  -- Cardiovascular
  hrv_ms              NUMERIC(6,1),   -- heart rate variability in milliseconds
  resting_hr_bpm      NUMERIC(5,1),   -- resting heart rate
  spo2_percent        NUMERIC(5,2),   -- blood oxygen saturation

  -- Sleep
  sleep_duration_min  INTEGER,        -- total sleep in minutes
  sleep_efficiency    NUMERIC(5,2),   -- percentage of time in bed actually asleep
  rem_duration_min    INTEGER,        -- REM stage duration
  deep_duration_min   INTEGER,        -- slow-wave sleep duration
  sleep_score         NUMERIC(5,1),   -- composite score from wearable (0–100)

  -- Readiness & Recovery
  readiness_score     NUMERIC(5,1),   -- composite readiness (0–100)
  body_temp_c         NUMERIC(4,2),   -- skin temperature in Celsius
  stress_score        NUMERIC(5,1),   -- stress index (0–100, lower = better)

  -- Activity
  steps               INTEGER,
  active_calories     INTEGER,
  vo2_max             NUMERIC(5,1),

  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast retrieval of a user's recent entries
CREATE INDEX IF NOT EXISTS idx_biometrics_user_date
  ON biometric_entries(user_id, recorded_at DESC);

-- Deduplicates wearable sync payloads while still allowing manual entries.
-- Applies to non-manual sources only (apple_watch, oura, garmin, fitbit, etc.).
CREATE UNIQUE INDEX IF NOT EXISTS idx_biometrics_wearable_dedupe
  ON biometric_entries(user_id, source, recorded_at)
  WHERE source <> 'manual';

-- ─── DAILY PROTOCOLS ─────────────────────────────────────────────────────────
-- AI-generated personalised action plans. One per user per day.
CREATE TABLE IF NOT EXISTS daily_protocols (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  protocol_date   DATE        NOT NULL,
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  vital_score     NUMERIC(5,1),                  -- composite score for the day

  -- Stored as JSON arrays — flexible structure, no premature normalisation
  actions         JSONB       DEFAULT '[]',       -- array of timed action objects
  insights        JSONB       DEFAULT '[]',       -- AI-generated insight strings
  nutrition       JSONB       DEFAULT '{}',       -- macro targets + meal plan
  supplements     JSONB       DEFAULT '[]',       -- supplement stack for the day

  UNIQUE(user_id, protocol_date)                 -- one protocol per user per day
);

CREATE INDEX IF NOT EXISTS idx_protocols_user_date
  ON daily_protocols(user_id, protocol_date DESC);

-- ─── PROTOCOL COMPLETIONS ────────────────────────────────────────────────────
-- Tracks which individual protocol actions a user has marked complete.
CREATE TABLE IF NOT EXISTS protocol_completions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  protocol_id   UUID        NOT NULL REFERENCES daily_protocols(id) ON DELETE CASCADE,
  action_index  INTEGER     NOT NULL,   -- index into the protocol's actions array
  completed_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_protocol_completions_unique
  ON protocol_completions(user_id, protocol_id, action_index);

-- Immutable protocol version snapshots for diff tracking and auditability.
CREATE TABLE IF NOT EXISTS protocol_versions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id     UUID        NOT NULL REFERENCES daily_protocols(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version_number  INTEGER     NOT NULL,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tier            VARCHAR(50),
  risk_score      NUMERIC(5,1),
  readiness_score NUMERIC(5,1),
  actions_json    JSONB       NOT NULL DEFAULT '[]',
  meta_json       JSONB       NOT NULL DEFAULT '{}',
  diff_json       JSONB       NOT NULL DEFAULT '{}',
  reason          VARCHAR(120),
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(protocol_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_protocol_versions_protocol
  ON protocol_versions(protocol_id, version_number DESC);

-- User-specific clinical contraindications that safety checks consume
-- when generating and validating protocol actions.
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
);

CREATE INDEX IF NOT EXISTS idx_user_contraindications_user
  ON user_contraindications(user_id);

-- ─── AI COACH CONVERSATIONS ──────────────────────────────────────────────────
-- Full conversation history per user. Required for personalised AI context.
-- Each row is one message (role: user | assistant).
CREATE TABLE IF NOT EXISTS coach_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id  UUID        NOT NULL,                -- groups messages into sessions
  role        VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT        NOT NULL,
  tokens_used INTEGER,                             -- track API usage for billing
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_user_session
  ON coach_messages(user_id, session_id, created_at ASC);

-- ─── WEARABLE CONNECTIONS ────────────────────────────────────────────────────
-- OAuth tokens for connected wearable devices.
-- Tokens are sensitive — this table requires column-level encryption in production.
CREATE TABLE IF NOT EXISTS wearable_connections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        VARCHAR(50) NOT NULL,   -- apple_health | oura | garmin | fitbit
  access_token    TEXT,                   -- encrypted at rest in production
  refresh_token   TEXT,                   -- encrypted at rest in production
  token_expires   TIMESTAMPTZ,
  last_synced_at  TIMESTAMPTZ,
  is_active       BOOLEAN     DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_wearable_connections_user
  ON wearable_connections(user_id, provider);

-- Wearable sync ingestion telemetry for reliability monitoring.
CREATE TABLE IF NOT EXISTS wearable_import_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES users(id) ON DELETE CASCADE,
  provider      VARCHAR(50) NOT NULL,
  status        VARCHAR(30) NOT NULL, -- success | failed
  processed     INTEGER     DEFAULT 0,
  inserted      INTEGER     DEFAULT 0,
  updated       INTEGER     DEFAULT 0,
  skipped       INTEGER     DEFAULT 0,
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wearable_import_events_created
  ON wearable_import_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wearable_import_events_user
  ON wearable_import_events(user_id, created_at DESC);

-- Daily usage ledger that powers plan-based limits and monetization analytics.
CREATE TABLE IF NOT EXISTS wearable_import_usage (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date    DATE        NOT NULL,
  imports_count INTEGER     NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_wearable_import_usage_user_date
  ON wearable_import_usage(user_id, usage_date DESC);

-- Billing plan change ledger for retention/expansion analytics.
CREATE TABLE IF NOT EXISTS billing_plan_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_plan        VARCHAR(50) NOT NULL,
  to_plan          VARCHAR(50) NOT NULL,
  delta_mrr        INTEGER     NOT NULL DEFAULT 0,
  changed_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_plan_events_user_changed
  ON billing_plan_events(user_id, changed_at DESC);

-- External clinical validation registry.
CREATE TABLE IF NOT EXISTS clinical_validation_studies (
  id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  study_code             VARCHAR(50)  NOT NULL UNIQUE,
  title                  VARCHAR(255) NOT NULL,
  status                 VARCHAR(30)  NOT NULL DEFAULT 'planned', -- planned | recruiting | active | completed | published
  external_partner       VARCHAR(255),
  principal_investigator VARCHAR(160),
  cohort_size_target     INTEGER,
  cohort_size_enrolled   INTEGER,
  primary_endpoint       VARCHAR(255),
  endpoint_achieved      BOOLEAN      DEFAULT false,
  started_at             DATE,
  completed_at           DATE,
  publication_url        TEXT,
  notes                  TEXT,
  created_at             TIMESTAMPTZ  DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_validation_status
  ON clinical_validation_studies(status, updated_at DESC);

-- Formal regulatory package tracker (claims, policy, legal artifacts).
CREATE TABLE IF NOT EXISTS regulatory_artifacts (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_key VARCHAR(100) NOT NULL UNIQUE,
  title        VARCHAR(255) NOT NULL,
  owner        VARCHAR(160),
  status       VARCHAR(30)  NOT NULL DEFAULT 'draft', -- draft | review | approved
  version      VARCHAR(40)  DEFAULT '0.1.0',
  critical     BOOLEAN      DEFAULT false,
  link_url     TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regulatory_artifacts_status
  ON regulatory_artifacts(status, critical, updated_at DESC);

-- Clinical operations notes + signoff workflow.
CREATE TABLE IF NOT EXISTS clinician_notes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  protocol_id    UUID        REFERENCES daily_protocols(id) ON DELETE SET NULL,
  clinician_name VARCHAR(120) NOT NULL,
  note           TEXT        NOT NULL,
  signed_off     BOOLEAN     DEFAULT false,
  signed_off_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinician_notes_user_created
  ON clinician_notes(user_id, created_at DESC);

-- User-level consent registry for legal/compliance controls.
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
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user
  ON user_consents(user_id);

-- Data deletion workflow for privacy/legal operations.
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending | processing | completed | rejected
  reason           TEXT,
  requested_at     TIMESTAMPTZ DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ,
  resolution_note  TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_user
  ON data_deletion_requests(user_id, requested_at DESC);

-- HIPAA safeguards attestation record per user/workspace.
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
);

CREATE INDEX IF NOT EXISTS idx_hipaa_attestations_user
  ON hipaa_attestations(user_id);

-- BAA request workflow (request -> legal review -> executed/declined).
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
);

CREATE INDEX IF NOT EXISTS idx_baa_requests_user_created
  ON baa_requests(user_id, requested_at DESC, created_at DESC);

-- ─── ENTERPRISE ORGANISATIONS ────────────────────────────────────────────────
-- For the enterprise / HR dashboard product.
CREATE TABLE IF NOT EXISTS organisations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  plan          VARCHAR(50)  DEFAULT 'growth',  -- growth | performance | sovereign
  seat_limit    INTEGER      DEFAULT 250,
  billing_email VARCHAR(255),
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- Junction table linking users to organisations (many-to-many)
CREATE TABLE IF NOT EXISTS organisation_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            VARCHAR(50) DEFAULT 'member',  -- member | admin | hr_manager
  joined_at       TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organisation_id, user_id)
);

-- ─── AUDIT LOG ───────────────────────────────────────────────────────────────
-- HIPAA requires logging who accessed what health data and when.
-- This table is append-only — rows are never updated or deleted.
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id),
  actor_id    UUID        REFERENCES users(id), -- who performed the action
  action      VARCHAR(100) NOT NULL,            -- e.g. 'biometric.read', 'auth.login'
  resource    VARCHAR(100),                     -- e.g. 'biometric_entries'
  resource_id UUID,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user
  ON audit_log(user_id, created_at DESC);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────
-- Automatically updates the updated_at column on any row change.
-- Applied to tables that have an updated_at field.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orgs_updated_at
  BEFORE UPDATE ON organisations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER contraindications_updated_at
  BEFORE UPDATE ON user_contraindications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
