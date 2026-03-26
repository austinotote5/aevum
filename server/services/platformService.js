const db = require('../db');
const ApiError = require('../utils/apiError');
const { buildRealUserEmailFilterSql } = require('../utils/realUserFilter');

let platformSchemaEnsured = false;
const CLINICAL_STATUSES = new Set(['planned', 'recruiting', 'active', 'completed', 'published']);
const REGULATORY_STATUSES = new Set(['draft', 'review', 'approved']);

const REGULATORY_ARTIFACT_SEED = Object.freeze([
  {
    key: 'claims_boundary_matrix',
    title: 'Claims Boundary Matrix',
    owner: 'Medical Affairs',
    status: 'draft',
    version: '0.1.0',
    critical: true,
  },
  {
    key: 'intended_use_statement',
    title: 'Intended Use Statement',
    owner: 'Clinical Governance',
    status: 'draft',
    version: '0.1.0',
    critical: true,
  },
  {
    key: 'clinical_disclaimer_policy',
    title: 'Clinical Disclaimer Policy',
    owner: 'Legal',
    status: 'draft',
    version: '0.1.0',
    critical: true,
  },
  {
    key: 'privacy_policy',
    title: 'Privacy Policy',
    owner: 'Privacy Office',
    status: 'review',
    version: '1.0.0',
    critical: true,
  },
  {
    key: 'terms_of_use',
    title: 'Terms of Use',
    owner: 'Legal',
    status: 'review',
    version: '1.0.0',
    critical: true,
  },
  {
    key: 'hipaa_risk_assessment',
    title: 'HIPAA Risk Assessment',
    owner: 'Security',
    status: 'draft',
    version: '0.1.0',
    critical: true,
  },
  {
    key: 'incident_response_playbook',
    title: 'Incident Response Playbook',
    owner: 'Security',
    status: 'approved',
    version: '1.0.0',
    critical: false,
  },
  {
    key: 'soc2_control_matrix',
    title: 'SOC 2 Control Matrix',
    owner: 'Security',
    status: 'draft',
    version: '0.1.0',
    critical: false,
  },
]);

const ensurePlatformSchema = async () => {
  if (platformSchemaEnsured) {
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
    CREATE TABLE IF NOT EXISTS clinical_validation_studies (
      id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      study_code          VARCHAR(50)  NOT NULL UNIQUE,
      title               VARCHAR(255) NOT NULL,
      status              VARCHAR(30)  NOT NULL DEFAULT 'planned', -- planned | recruiting | active | completed | published
      external_partner    VARCHAR(255),
      principal_investigator VARCHAR(160),
      cohort_size_target  INTEGER,
      cohort_size_enrolled INTEGER,
      primary_endpoint    VARCHAR(255),
      endpoint_achieved   BOOLEAN      DEFAULT false,
      started_at          DATE,
      completed_at        DATE,
      publication_url     TEXT,
      notes               TEXT,
      created_at          TIMESTAMPTZ  DEFAULT NOW(),
      updated_at          TIMESTAMPTZ  DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_clinical_validation_status
      ON clinical_validation_studies(status, updated_at DESC)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS regulatory_artifacts (
      id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      artifact_key        VARCHAR(100) NOT NULL UNIQUE,
      title               VARCHAR(255) NOT NULL,
      owner               VARCHAR(160),
      status              VARCHAR(30)  NOT NULL DEFAULT 'draft', -- draft | review | approved
      version             VARCHAR(40)  DEFAULT '0.1.0',
      critical            BOOLEAN      DEFAULT false,
      link_url            TEXT,
      notes               TEXT,
      created_at          TIMESTAMPTZ  DEFAULT NOW(),
      updated_at          TIMESTAMPTZ  DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_regulatory_artifacts_status
      ON regulatory_artifacts(status, critical, updated_at DESC)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS billing_plan_events (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_plan        VARCHAR(50) NOT NULL,
      to_plan          VARCHAR(50) NOT NULL,
      delta_mrr        INTEGER     NOT NULL DEFAULT 0,
      changed_at       TIMESTAMPTZ DEFAULT NOW(),
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_billing_plan_events_changed
      ON billing_plan_events(changed_at DESC)
  `);

  for (const artifact of REGULATORY_ARTIFACT_SEED) {
    await db.query(`
      INSERT INTO regulatory_artifacts (
        artifact_key,
        title,
        owner,
        status,
        version,
        critical
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (artifact_key) DO NOTHING
    `, [
      artifact.key,
      artifact.title,
      artifact.owner,
      artifact.status,
      artifact.version,
      artifact.critical,
    ]);
  }

  await db.query(`
    INSERT INTO clinical_validation_studies (
      study_code,
      title,
      status,
      external_partner,
      principal_investigator,
      cohort_size_target,
      cohort_size_enrolled,
      primary_endpoint,
      notes
    )
    VALUES (
      'AEVUM-CV-001',
      'Prospective biomarker-guided protocol feasibility study',
      'planned',
      'Independent Clinical Research Partner',
      'TBD',
      120,
      0,
      '30-day protocol adherence and readiness lift',
      'External validation placeholder until partner onboarding completes.'
    )
    ON CONFLICT (study_code) DO NOTHING
  `);

  platformSchemaEnsured = true;
};

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const average = (values = []) => {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeDateOrNull = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest(`${fieldName} must be a valid date.`);
  }

  return date.toISOString().slice(0, 10);
};

const mapClinicalStudy = (row) => ({
  id: row.id,
  studyCode: row.study_code,
  title: row.title,
  status: row.status,
  externalPartner: row.external_partner || '',
  principalInvestigator: row.principal_investigator || '',
  cohortSizeTarget: toNumber(row.cohort_size_target, 0),
  cohortSizeEnrolled: toNumber(row.cohort_size_enrolled, 0),
  primaryEndpoint: row.primary_endpoint || '',
  endpointAchieved: Boolean(row.endpoint_achieved),
  startedAt: row.started_at || null,
  completedAt: row.completed_at || null,
  publicationUrl: row.publication_url || '',
  notes: row.notes || '',
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const mapRegulatoryArtifact = (row) => ({
  id: row.id,
  artifactKey: row.artifact_key,
  title: row.title,
  owner: row.owner || '',
  status: row.status,
  version: row.version || '',
  critical: Boolean(row.critical),
  linkUrl: row.link_url || '',
  notes: row.notes || '',
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const getCohortAnalytics = async (userIds = []) => {
  if (userIds.length === 0) {
    return {
      activeMembers: 0,
      avgReadiness: 0,
      avgRisk: 0,
      engagementRate: 0,
      riskBands: { low: 0, moderate: 0, high: 0 },
      planMix: { free: 0, premium: 0, enterprise: 0 },
    };
  }

  const [latestBiometrics, latestProtocols, planMix, engagement] = await Promise.all([
    db.query(`
      SELECT DISTINCT ON (user_id)
        user_id,
        readiness_score,
        recorded_at
      FROM biometric_entries
      WHERE user_id = ANY($1::uuid[])
      ORDER BY user_id, recorded_at DESC
    `, [userIds]),
    db.query(`
      SELECT DISTINCT ON (user_id)
        user_id,
        nutrition ->> 'riskScore' AS risk_score
      FROM daily_protocols
      WHERE user_id = ANY($1::uuid[])
      ORDER BY user_id, protocol_date DESC, generated_at DESC
    `, [userIds]),
    db.query(`
      SELECT plan, COUNT(*)::int AS count
      FROM users
      WHERE id = ANY($1::uuid[])
      GROUP BY plan
    `, [userIds]),
    db.query(`
      SELECT COUNT(DISTINCT user_id)::int AS engaged
      FROM protocol_completions
      WHERE user_id = ANY($1::uuid[])
        AND completed_at >= NOW() - INTERVAL '7 days'
    `, [userIds]),
  ]);

  const readinessValues = latestBiometrics.rows
    .map((row) => toNumber(row.readiness_score, null))
    .filter((value) => Number.isFinite(value));
  const riskValues = latestProtocols.rows
    .map((row) => toNumber(row.risk_score, null))
    .filter((value) => Number.isFinite(value));

  const riskBands = {
    low: riskValues.filter((value) => value < 45).length,
    moderate: riskValues.filter((value) => value >= 45 && value < 70).length,
    high: riskValues.filter((value) => value >= 70).length,
  };

  const planMap = { free: 0, premium: 0, enterprise: 0 };
  planMix.rows.forEach((row) => {
    const key = String(row.plan || 'free').toLowerCase();
    if (planMap[key] !== undefined) {
      planMap[key] = Number(row.count || 0);
    }
  });

  const activeMembers = userIds.length;
  const engaged = Number(engagement.rows[0]?.engaged || 0);
  const engagementRate = activeMembers > 0 ? (engaged / activeMembers) * 100 : 0;

  return {
    activeMembers,
    avgReadiness: Number((average(readinessValues) || 0).toFixed(1)),
    avgRisk: Number((average(riskValues) || 0).toFixed(1)),
    engagementRate: Number(engagementRate.toFixed(1)),
    riskBands,
    planMix: planMap,
  };
};

const getRoiEngine = async (userIds = [], cohort = null) => {
  if (userIds.length === 0) {
    return {
      riskReductionPct: 0,
      productivityGainPct: 0,
      costSavedPerMemberYear: 0,
      projectedRoiX: 0,
      confidence: 'low',
    };
  }

  const { rows } = await db.query(`
    WITH scoped AS (
      SELECT
        user_id,
        COALESCE((nutrition ->> 'riskScore')::numeric, 0) AS risk_score,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY protocol_date ASC, generated_at ASC) AS rn_asc,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY protocol_date DESC, generated_at DESC) AS rn_desc
      FROM daily_protocols
      WHERE user_id = ANY($1::uuid[])
        AND protocol_date >= CURRENT_DATE - INTERVAL '60 days'
    )
    SELECT
      AVG(CASE WHEN rn_asc <= 7 THEN risk_score END) AS baseline_risk,
      AVG(CASE WHEN rn_desc <= 7 THEN risk_score END) AS current_risk
    FROM scoped
  `, [userIds]);

  const baselineRisk = toNumber(rows[0]?.baseline_risk, 0);
  const currentRisk = toNumber(rows[0]?.current_risk, baselineRisk);
  const riskReductionPct = baselineRisk > 0
    ? ((baselineRisk - currentRisk) / baselineRisk) * 100
    : 0;
  const engagementRate = toNumber(cohort?.engagementRate, 0);
  const productivityGainPct = clamp((riskReductionPct * 0.42) + ((engagementRate - 55) * 0.22), 0, 40);
  const costSavedPerMemberYear = clamp(Math.round(650 + (riskReductionPct * 19) + (productivityGainPct * 28)), 350, 4200);
  const platformCostPerMemberYear = 29 * 12;
  const projectedRoiX = platformCostPerMemberYear > 0
    ? costSavedPerMemberYear / platformCostPerMemberYear
    : 0;

  const confidence = riskReductionPct >= 12 ? 'high' : riskReductionPct >= 6 ? 'medium' : 'emerging';

  return {
    riskReductionPct: Number(riskReductionPct.toFixed(1)),
    productivityGainPct: Number(productivityGainPct.toFixed(1)),
    costSavedPerMemberYear,
    projectedRoiX: Number(projectedRoiX.toFixed(2)),
    confidence,
  };
};

const getInterventionEffectiveness = async (userIds = []) => {
  if (userIds.length === 0) {
    return {
      actionsAnalyzed: 0,
      topActions: [],
    };
  }

  const protocols = await db.query(`
    SELECT id, vital_score, actions
    FROM daily_protocols
    WHERE user_id = ANY($1::uuid[])
      AND protocol_date >= CURRENT_DATE - INTERVAL '90 days'
    ORDER BY protocol_date DESC, generated_at DESC
    LIMIT 500
  `, [userIds]);

  const protocolIds = protocols.rows.map((row) => row.id);
  if (protocolIds.length === 0) {
    return {
      actionsAnalyzed: 0,
      topActions: [],
    };
  }

  const completions = await db.query(`
    SELECT protocol_id, action_index
    FROM protocol_completions
    WHERE protocol_id = ANY($1::uuid[])
  `, [protocolIds]);

  const completionMap = new Map();
  completions.rows.forEach((row) => {
    if (!completionMap.has(row.protocol_id)) {
      completionMap.set(row.protocol_id, new Set());
    }
    completionMap.get(row.protocol_id).add(Number(row.action_index));
  });

  const actionMap = new Map();
  protocols.rows.forEach((protocol) => {
    const actions = Array.isArray(protocol.actions) ? protocol.actions : [];
    const completionSet = completionMap.get(protocol.id) || new Set();
    const readiness = toNumber(protocol.vital_score, 0);

    actions.forEach((action, index) => {
      if (action?.blocked) {
        return;
      }

      const key = String(action.id || action.title || `action_${index}`);
      if (!actionMap.has(key)) {
        actionMap.set(key, {
          actionId: key,
          title: String(action.title || key),
          offered: 0,
          completed: 0,
          readinessCompleted: [],
          readinessMissed: [],
        });
      }

      const aggregate = actionMap.get(key);
      aggregate.offered += 1;
      if (completionSet.has(index)) {
        aggregate.completed += 1;
        aggregate.readinessCompleted.push(readiness);
      } else {
        aggregate.readinessMissed.push(readiness);
      }
    });
  });

  const summarized = Array.from(actionMap.values()).map((item) => {
    const completionRate = item.offered > 0 ? (item.completed / item.offered) * 100 : 0;
    const readinessCompleted = average(item.readinessCompleted) || 0;
    const readinessMissed = average(item.readinessMissed) || 0;
    const readinessLift = readinessCompleted - readinessMissed;
    const effectivenessScore = clamp((completionRate * 0.72) + (readinessLift * 2.5), 0, 100);

    return {
      actionId: item.actionId,
      title: item.title,
      offered: item.offered,
      completed: item.completed,
      completionRate: Number(completionRate.toFixed(1)),
      readinessLift: Number(readinessLift.toFixed(1)),
      effectivenessScore: Number(effectivenessScore.toFixed(1)),
    };
  });

  const topActions = summarized
    .filter((item) => item.offered >= 4)
    .sort((a, b) => b.effectivenessScore - a.effectivenessScore)
    .slice(0, 5);

  return {
    actionsAnalyzed: summarized.length,
    topActions,
  };
};

const getReliabilityDashboard = async (userIds = []) => {
  if (userIds.length === 0) {
    return {
      dataQualityScore: 0,
      syncCoveragePct: 0,
      nonManualIngestionPct: 0,
      importFailureRatePct: 0,
      staleUserCount: 0,
    };
  }

  const [latestBiometrics, ingestionMix, importFailures] = await Promise.all([
    db.query(`
      SELECT DISTINCT ON (user_id)
        user_id,
        recorded_at
      FROM biometric_entries
      WHERE user_id = ANY($1::uuid[])
      ORDER BY user_id, recorded_at DESC
    `, [userIds]),
    db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE source <> 'manual')::int AS automated
      FROM biometric_entries
      WHERE user_id = ANY($1::uuid[])
        AND recorded_at >= NOW() - INTERVAL '30 days'
    `, [userIds]),
    db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
      FROM wearable_import_events
      WHERE user_id = ANY($1::uuid[])
        AND created_at >= NOW() - INTERVAL '7 days'
    `, [userIds]),
  ]);

  const staleThreshold = Date.now() - (72 * 60 * 60 * 1000);
  const staleUserCount = latestBiometrics.rows.filter((row) => {
    const ts = new Date(row.recorded_at).getTime();
    return !Number.isFinite(ts) || ts < staleThreshold;
  }).length;
  const syncCoveragePct = ((userIds.length - staleUserCount) / userIds.length) * 100;

  const totalEntries = toNumber(ingestionMix.rows[0]?.total, 0);
  const automatedEntries = toNumber(ingestionMix.rows[0]?.automated, 0);
  const nonManualIngestionPct = totalEntries > 0 ? (automatedEntries / totalEntries) * 100 : 0;

  const totalImports = toNumber(importFailures.rows[0]?.total, 0);
  const failedImports = toNumber(importFailures.rows[0]?.failed, 0);
  const importFailureRatePct = totalImports > 0 ? (failedImports / totalImports) * 100 : 0;

  const dataQualityScore = clamp(
    (syncCoveragePct * 0.55) + (nonManualIngestionPct * 0.35) + ((100 - importFailureRatePct) * 0.1),
    0,
    100
  );

  return {
    dataQualityScore: Number(dataQualityScore.toFixed(1)),
    syncCoveragePct: Number(syncCoveragePct.toFixed(1)),
    nonManualIngestionPct: Number(nonManualIngestionPct.toFixed(1)),
    importFailureRatePct: Number(importFailureRatePct.toFixed(1)),
    staleUserCount,
  };
};

const getClinicianOps = async (userIds = []) => {
  if (userIds.length === 0) {
    return {
      noteCount: 0,
      signedOffCount: 0,
      pendingSignoff: 0,
      signoffRate: 0,
    };
  }

  const { rows } = await db.query(`
    SELECT
      COUNT(*)::int AS note_count,
      COUNT(*) FILTER (WHERE signed_off = true)::int AS signed_off_count
    FROM clinician_notes
    WHERE user_id = ANY($1::uuid[])
  `, [userIds]);

  const noteCount = toNumber(rows[0]?.note_count, 0);
  const signedOffCount = toNumber(rows[0]?.signed_off_count, 0);
  const pendingSignoff = Math.max(0, noteCount - signedOffCount);
  const signoffRate = noteCount > 0 ? (signedOffCount / noteCount) * 100 : 0;

  return {
    noteCount,
    signedOffCount,
    pendingSignoff,
    signoffRate: Number(signoffRate.toFixed(1)),
  };
};

const getMonetization = async (userIds = [], cohort = null) => {
  const planMix = cohort?.planMix || { free: 0, premium: 0, enterprise: 0 };
  const premiumUsers = toNumber(planMix.premium, 0);
  const enterpriseUsers = toNumber(planMix.enterprise, 0);
  const paidUsers = premiumUsers + enterpriseUsers;
  const mrrEstimate = (premiumUsers * 29) + (enterpriseUsers * 99);

  return {
    paidUsers,
    premiumUsers,
    enterpriseUsers,
    mrrEstimate,
    conversionRatePct: userIds.length > 0
      ? Number(((paidUsers / userIds.length) * 100).toFixed(1))
      : 0,
  };
};

const getTractionMetrics = async (userIds = [], monetization = null) => {
  if (userIds.length === 0) {
    return {
      paidMembers: 0,
      retention30Pct: 0,
      expansionMrr90: 0,
      contractionMrr90: 0,
      netExpansionRatePct: 0,
      pilotOutcomeSamples: 0,
      avgRiskReductionPct: 0,
    };
  }

  const paidMembers = toNumber(monetization?.paidUsers, 0);
  const currentMrr = toNumber(monetization?.mrrEstimate, 0);

  const [retentionRows, planEvents, riskMovement] = await Promise.all([
    db.query(`
      WITH paid_users AS (
        SELECT id
        FROM users
        WHERE id = ANY($1::uuid[])
          AND plan IN ('premium', 'enterprise')
          AND created_at <= NOW() - INTERVAL '30 days'
      ),
      retained AS (
        SELECT COUNT(DISTINCT pc.user_id)::int AS retained_count
        FROM protocol_completions pc
        JOIN paid_users pu ON pu.id = pc.user_id
        WHERE pc.completed_at >= NOW() - INTERVAL '30 days'
      )
      SELECT
        (SELECT COUNT(*)::int FROM paid_users) AS eligible_count,
        (SELECT retained_count FROM retained) AS retained_count
    `, [userIds]),
    db.query(`
      SELECT
        COALESCE(SUM(delta_mrr) FILTER (WHERE delta_mrr > 0), 0)::int AS expansion_mrr,
        COALESCE(SUM(ABS(delta_mrr)) FILTER (WHERE delta_mrr < 0), 0)::int AS contraction_mrr
      FROM billing_plan_events
      WHERE user_id = ANY($1::uuid[])
        AND changed_at >= NOW() - INTERVAL '90 days'
    `, [userIds]),
    db.query(`
      WITH paid AS (
        SELECT id
        FROM users
        WHERE id = ANY($1::uuid[])
          AND plan IN ('premium', 'enterprise')
      ),
      scoped AS (
        SELECT
          dp.user_id,
          COALESCE((dp.nutrition ->> 'riskScore')::numeric, 0) AS risk_score,
          ROW_NUMBER() OVER (PARTITION BY dp.user_id ORDER BY dp.protocol_date ASC, dp.generated_at ASC) AS rn_asc,
          ROW_NUMBER() OVER (PARTITION BY dp.user_id ORDER BY dp.protocol_date DESC, dp.generated_at DESC) AS rn_desc
        FROM daily_protocols dp
        JOIN paid p ON p.id = dp.user_id
        WHERE dp.protocol_date >= CURRENT_DATE - INTERVAL '90 days'
      )
      SELECT
        COUNT(DISTINCT user_id)::int AS sampled_users,
        AVG(CASE WHEN rn_asc <= 7 THEN risk_score END) AS baseline_risk,
        AVG(CASE WHEN rn_desc <= 7 THEN risk_score END) AS current_risk
      FROM scoped
    `, [userIds]),
  ]);

  const eligibleCount = toNumber(retentionRows.rows[0]?.eligible_count, 0);
  const retainedCount = toNumber(retentionRows.rows[0]?.retained_count, 0);
  const retention30Pct = eligibleCount > 0 ? (retainedCount / eligibleCount) * 100 : 0;

  const expansionMrr90 = toNumber(planEvents.rows[0]?.expansion_mrr, 0);
  const contractionMrr90 = toNumber(planEvents.rows[0]?.contraction_mrr, 0);
  const netExpansionRatePct = currentMrr > 0
    ? ((expansionMrr90 - contractionMrr90) / currentMrr) * 100
    : 0;

  const sampledUsers = toNumber(riskMovement.rows[0]?.sampled_users, 0);
  const baselineRisk = toNumber(riskMovement.rows[0]?.baseline_risk, 0);
  const currentRisk = toNumber(riskMovement.rows[0]?.current_risk, baselineRisk);
  const avgRiskReductionPct = baselineRisk > 0
    ? ((baselineRisk - currentRisk) / baselineRisk) * 100
    : 0;

  return {
    paidMembers,
    retention30Pct: Number(retention30Pct.toFixed(1)),
    expansionMrr90,
    contractionMrr90,
    netExpansionRatePct: Number(netExpansionRatePct.toFixed(1)),
    pilotOutcomeSamples: sampledUsers,
    avgRiskReductionPct: Number(avgRiskReductionPct.toFixed(1)),
  };
};

const getClinicalValidationSummary = async () => {
  const [statusRows, latestRows] = await Promise.all([
    db.query(`
      SELECT
        status,
        COUNT(*)::int AS count
      FROM clinical_validation_studies
      GROUP BY status
    `),
    db.query(`
      SELECT
        study_code,
        title,
        status,
        external_partner,
        cohort_size_target,
        cohort_size_enrolled,
        primary_endpoint,
        endpoint_achieved,
        started_at,
        completed_at,
        publication_url,
        updated_at
      FROM clinical_validation_studies
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 3
    `),
  ]);

  const counts = {
    planned: 0,
    recruiting: 0,
    active: 0,
    completed: 0,
    published: 0,
  };

  statusRows.rows.forEach((row) => {
    const key = String(row.status || '').toLowerCase();
    if (counts[key] !== undefined) {
      counts[key] = Number(row.count || 0);
    }
  });

  return {
    totalStudies: Object.values(counts).reduce((total, value) => total + value, 0),
    ...counts,
    latest: latestRows.rows.map((row) => ({
      studyCode: row.study_code,
      title: row.title,
      status: row.status,
      externalPartner: row.external_partner || '',
      cohortTarget: toNumber(row.cohort_size_target, 0),
      cohortEnrolled: toNumber(row.cohort_size_enrolled, 0),
      primaryEndpoint: row.primary_endpoint || '',
      endpointAchieved: Boolean(row.endpoint_achieved),
      startedAt: row.started_at || null,
      completedAt: row.completed_at || null,
      publicationUrl: row.publication_url || '',
      updatedAt: row.updated_at || null,
    })),
  };
};

const getRegulatoryReadinessSummary = async () => {
  const { rows } = await db.query(`
    SELECT
      artifact_key,
      title,
      owner,
      status,
      version,
      critical,
      updated_at
    FROM regulatory_artifacts
    ORDER BY critical DESC, updated_at DESC, created_at DESC
  `);

  const statusCounts = {
    draft: 0,
    review: 0,
    approved: 0,
  };

  const artifacts = rows.map((row) => {
    const status = String(row.status || 'draft').toLowerCase();
    if (statusCounts[status] !== undefined) {
      statusCounts[status] += 1;
    }

    return {
      key: row.artifact_key,
      title: row.title,
      owner: row.owner || '',
      status,
      version: row.version || '',
      critical: Boolean(row.critical),
      updatedAt: row.updated_at || null,
    };
  });

  const totalArtifacts = artifacts.length;
  const approved = statusCounts.approved || 0;
  const readinessPct = totalArtifacts > 0 ? (approved / totalArtifacts) * 100 : 0;
  const criticalOpen = artifacts.filter((artifact) => artifact.critical && artifact.status !== 'approved').length;

  return {
    totalArtifacts,
    approvedArtifacts: approved,
    draftArtifacts: statusCounts.draft || 0,
    inReviewArtifacts: statusCounts.review || 0,
    readinessPct: Number(readinessPct.toFixed(1)),
    criticalOpen,
    artifacts: artifacts.slice(0, 8),
  };
};

const listClinicalStudies = async ({ limit = 50 } = {}) => {
  await ensurePlatformSchema();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));

  const { rows } = await db.query(`
    SELECT
      id,
      study_code,
      title,
      status,
      external_partner,
      principal_investigator,
      cohort_size_target,
      cohort_size_enrolled,
      primary_endpoint,
      endpoint_achieved,
      started_at,
      completed_at,
      publication_url,
      notes,
      created_at,
      updated_at
    FROM clinical_validation_studies
    ORDER BY updated_at DESC, created_at DESC
    LIMIT $1
  `, [safeLimit]);

  return rows.map(mapClinicalStudy);
};

const createClinicalStudy = async (payload = {}) => {
  await ensurePlatformSchema();

  const studyCode = String(payload.studyCode || '').trim().slice(0, 50);
  const title = String(payload.title || '').trim().slice(0, 255);
  const status = String(payload.status || 'planned').trim().toLowerCase();
  const externalPartner = String(payload.externalPartner || '').trim().slice(0, 255);
  const principalInvestigator = String(payload.principalInvestigator || '').trim().slice(0, 160);
  const cohortSizeTarget = payload.cohortSizeTarget === undefined || payload.cohortSizeTarget === null || payload.cohortSizeTarget === ''
    ? null
    : Math.max(0, Math.round(Number(payload.cohortSizeTarget)));
  const cohortSizeEnrolled = payload.cohortSizeEnrolled === undefined || payload.cohortSizeEnrolled === null || payload.cohortSizeEnrolled === ''
    ? 0
    : Math.max(0, Math.round(Number(payload.cohortSizeEnrolled)));
  const primaryEndpoint = String(payload.primaryEndpoint || '').trim().slice(0, 255);
  const endpointAchieved = payload.endpointAchieved === true;
  const startedAt = normalizeDateOrNull(payload.startedAt, 'startedAt');
  const completedAt = normalizeDateOrNull(payload.completedAt, 'completedAt');
  const publicationUrl = String(payload.publicationUrl || '').trim().slice(0, 2000);
  const notes = String(payload.notes || '').trim().slice(0, 4000);

  if (!studyCode) {
    throw ApiError.badRequest('studyCode is required.');
  }
  if (!title) {
    throw ApiError.badRequest('title is required.');
  }
  if (!CLINICAL_STATUSES.has(status)) {
    throw ApiError.badRequest('status must be one of: planned, recruiting, active, completed, published.');
  }

  const { rows } = await db.query(`
    INSERT INTO clinical_validation_studies (
      study_code,
      title,
      status,
      external_partner,
      principal_investigator,
      cohort_size_target,
      cohort_size_enrolled,
      primary_endpoint,
      endpoint_achieved,
      started_at,
      completed_at,
      publication_url,
      notes
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13
    )
    RETURNING *
  `, [
    studyCode,
    title,
    status,
    externalPartner || null,
    principalInvestigator || null,
    Number.isFinite(cohortSizeTarget) ? cohortSizeTarget : null,
    Number.isFinite(cohortSizeEnrolled) ? cohortSizeEnrolled : 0,
    primaryEndpoint || null,
    endpointAchieved,
    startedAt,
    completedAt,
    publicationUrl || null,
    notes || null,
  ]);

  return mapClinicalStudy(rows[0]);
};

const updateClinicalStudy = async (studyId, payload = {}) => {
  await ensurePlatformSchema();

  const { rows: existingRows } = await db.query(`
    SELECT *
    FROM clinical_validation_studies
    WHERE id = $1
    LIMIT 1
  `, [studyId]);

  const existing = existingRows[0];
  if (!existing) {
    throw ApiError.notFound('Clinical study not found.');
  }

  const next = {
    studyCode: payload.studyCode !== undefined ? String(payload.studyCode || '').trim().slice(0, 50) : existing.study_code,
    title: payload.title !== undefined ? String(payload.title || '').trim().slice(0, 255) : existing.title,
    status: payload.status !== undefined ? String(payload.status || '').trim().toLowerCase() : existing.status,
    externalPartner: payload.externalPartner !== undefined ? String(payload.externalPartner || '').trim().slice(0, 255) : (existing.external_partner || ''),
    principalInvestigator: payload.principalInvestigator !== undefined ? String(payload.principalInvestigator || '').trim().slice(0, 160) : (existing.principal_investigator || ''),
    cohortSizeTarget: payload.cohortSizeTarget !== undefined
      ? (payload.cohortSizeTarget === null || payload.cohortSizeTarget === '' ? null : Math.max(0, Math.round(Number(payload.cohortSizeTarget))))
      : existing.cohort_size_target,
    cohortSizeEnrolled: payload.cohortSizeEnrolled !== undefined
      ? (payload.cohortSizeEnrolled === null || payload.cohortSizeEnrolled === '' ? 0 : Math.max(0, Math.round(Number(payload.cohortSizeEnrolled))))
      : existing.cohort_size_enrolled,
    primaryEndpoint: payload.primaryEndpoint !== undefined ? String(payload.primaryEndpoint || '').trim().slice(0, 255) : (existing.primary_endpoint || ''),
    endpointAchieved: payload.endpointAchieved !== undefined ? payload.endpointAchieved === true : Boolean(existing.endpoint_achieved),
    startedAt: payload.startedAt !== undefined ? normalizeDateOrNull(payload.startedAt, 'startedAt') : existing.started_at,
    completedAt: payload.completedAt !== undefined ? normalizeDateOrNull(payload.completedAt, 'completedAt') : existing.completed_at,
    publicationUrl: payload.publicationUrl !== undefined ? String(payload.publicationUrl || '').trim().slice(0, 2000) : (existing.publication_url || ''),
    notes: payload.notes !== undefined ? String(payload.notes || '').trim().slice(0, 4000) : (existing.notes || ''),
  };

  if (!next.studyCode) {
    throw ApiError.badRequest('studyCode cannot be empty.');
  }
  if (!next.title) {
    throw ApiError.badRequest('title cannot be empty.');
  }
  if (!CLINICAL_STATUSES.has(next.status)) {
    throw ApiError.badRequest('status must be one of: planned, recruiting, active, completed, published.');
  }

  const { rows } = await db.query(`
    UPDATE clinical_validation_studies
    SET
      study_code = $2,
      title = $3,
      status = $4,
      external_partner = $5,
      principal_investigator = $6,
      cohort_size_target = $7,
      cohort_size_enrolled = $8,
      primary_endpoint = $9,
      endpoint_achieved = $10,
      started_at = $11,
      completed_at = $12,
      publication_url = $13,
      notes = $14,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [
    studyId,
    next.studyCode,
    next.title,
    next.status,
    next.externalPartner || null,
    next.principalInvestigator || null,
    Number.isFinite(Number(next.cohortSizeTarget)) ? Number(next.cohortSizeTarget) : null,
    Number.isFinite(Number(next.cohortSizeEnrolled)) ? Number(next.cohortSizeEnrolled) : 0,
    next.primaryEndpoint || null,
    next.endpointAchieved,
    next.startedAt,
    next.completedAt,
    next.publicationUrl || null,
    next.notes || null,
  ]);

  return mapClinicalStudy(rows[0]);
};

const listRegulatoryArtifacts = async ({ limit = 100 } = {}) => {
  await ensurePlatformSchema();
  const safeLimit = Math.max(1, Math.min(300, Number(limit) || 100));

  const { rows } = await db.query(`
    SELECT
      id,
      artifact_key,
      title,
      owner,
      status,
      version,
      critical,
      link_url,
      notes,
      created_at,
      updated_at
    FROM regulatory_artifacts
    ORDER BY critical DESC, updated_at DESC, created_at DESC
    LIMIT $1
  `, [safeLimit]);

  return rows.map(mapRegulatoryArtifact);
};

const createRegulatoryArtifact = async (payload = {}) => {
  await ensurePlatformSchema();

  const artifactKey = String(payload.artifactKey || '').trim().toLowerCase().replace(/\s+/g, '_').slice(0, 100);
  const title = String(payload.title || '').trim().slice(0, 255);
  const owner = String(payload.owner || '').trim().slice(0, 160);
  const status = String(payload.status || 'draft').trim().toLowerCase();
  const version = String(payload.version || '0.1.0').trim().slice(0, 40);
  const critical = payload.critical === true;
  const linkUrl = String(payload.linkUrl || '').trim().slice(0, 2000);
  const notes = String(payload.notes || '').trim().slice(0, 4000);

  if (!artifactKey) {
    throw ApiError.badRequest('artifactKey is required.');
  }
  if (!title) {
    throw ApiError.badRequest('title is required.');
  }
  if (!REGULATORY_STATUSES.has(status)) {
    throw ApiError.badRequest('status must be one of: draft, review, approved.');
  }

  const { rows } = await db.query(`
    INSERT INTO regulatory_artifacts (
      artifact_key,
      title,
      owner,
      status,
      version,
      critical,
      link_url,
      notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [
    artifactKey,
    title,
    owner || null,
    status,
    version || '0.1.0',
    critical,
    linkUrl || null,
    notes || null,
  ]);

  return mapRegulatoryArtifact(rows[0]);
};

const updateRegulatoryArtifact = async (artifactId, payload = {}) => {
  await ensurePlatformSchema();

  const { rows: existingRows } = await db.query(`
    SELECT *
    FROM regulatory_artifacts
    WHERE id = $1
    LIMIT 1
  `, [artifactId]);

  const existing = existingRows[0];
  if (!existing) {
    throw ApiError.notFound('Regulatory artifact not found.');
  }

  const next = {
    artifactKey: payload.artifactKey !== undefined
      ? String(payload.artifactKey || '').trim().toLowerCase().replace(/\s+/g, '_').slice(0, 100)
      : existing.artifact_key,
    title: payload.title !== undefined ? String(payload.title || '').trim().slice(0, 255) : existing.title,
    owner: payload.owner !== undefined ? String(payload.owner || '').trim().slice(0, 160) : (existing.owner || ''),
    status: payload.status !== undefined ? String(payload.status || '').trim().toLowerCase() : existing.status,
    version: payload.version !== undefined ? String(payload.version || '').trim().slice(0, 40) : (existing.version || ''),
    critical: payload.critical !== undefined ? payload.critical === true : Boolean(existing.critical),
    linkUrl: payload.linkUrl !== undefined ? String(payload.linkUrl || '').trim().slice(0, 2000) : (existing.link_url || ''),
    notes: payload.notes !== undefined ? String(payload.notes || '').trim().slice(0, 4000) : (existing.notes || ''),
  };

  if (!next.artifactKey) {
    throw ApiError.badRequest('artifactKey cannot be empty.');
  }
  if (!next.title) {
    throw ApiError.badRequest('title cannot be empty.');
  }
  if (!REGULATORY_STATUSES.has(next.status)) {
    throw ApiError.badRequest('status must be one of: draft, review, approved.');
  }

  const { rows } = await db.query(`
    UPDATE regulatory_artifacts
    SET
      artifact_key = $2,
      title = $3,
      owner = $4,
      status = $5,
      version = $6,
      critical = $7,
      link_url = $8,
      notes = $9,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [
    artifactId,
    next.artifactKey,
    next.title,
    next.owner || null,
    next.status,
    next.version || '0.1.0',
    next.critical,
    next.linkUrl || null,
    next.notes || null,
  ]);

  return mapRegulatoryArtifact(rows[0]);
};

const getEvidenceConsole = async ({ limit = 100 } = {}) => {
  await ensurePlatformSchema();
  const [clinicalStudies, regulatoryArtifacts, clinicalValidationSummary, regulatorySummary] = await Promise.all([
    listClinicalStudies({ limit }),
    listRegulatoryArtifacts({ limit }),
    getClinicalValidationSummary(),
    getRegulatoryReadinessSummary(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    clinicalStudies,
    regulatoryArtifacts,
    summaries: {
      clinicalValidation: clinicalValidationSummary,
      regulatory: regulatorySummary,
    },
  };
};

const getPlatformSummary = async () => {
  await ensurePlatformSchema();
  const realUserFilter = buildRealUserEmailFilterSql('u.email');

  const usersResult = await db.query(`
    SELECT u.id
    FROM users u
    WHERE u.is_active = true
      AND (${realUserFilter})
  `);
  const userIds = usersResult.rows.map((row) => row.id);

  const cohort = await getCohortAnalytics(userIds);
  const [roi, interventions, reliability, clinicianOps, monetization] = await Promise.all([
    getRoiEngine(userIds, cohort),
    getInterventionEffectiveness(userIds),
    getReliabilityDashboard(userIds),
    getClinicianOps(userIds),
    getMonetization(userIds, cohort),
  ]);
  const [traction, clinicalValidation, regulatory] = await Promise.all([
    getTractionMetrics(userIds, monetization),
    getClinicalValidationSummary(),
    getRegulatoryReadinessSummary(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    cohort,
    roi,
    clinicianOps,
    interventions,
    reliability,
    monetization,
    traction,
    clinicalValidation,
    regulatory,
  };
};

module.exports = {
  getPlatformSummary,
  getEvidenceConsole,
  createClinicalStudy,
  updateClinicalStudy,
  createRegulatoryArtifact,
  updateRegulatoryArtifact,
};
