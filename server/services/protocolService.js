const db = require('../db');
const ApiError = require('../utils/apiError');
const { logger } = require('../utils/logger');
const {
  getLatestBiometricEntry,
  getRecentBiometricEntries,
} = require('./biometricService');
const { getContraindicationProfile } = require('./contraindicationService');

let protocolVersionsTableEnsured = false;

const toNumber = (value, fallback = null) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toSigned = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0.0';
  return value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
};

const deriveTier = (riskScore) => {
  if (riskScore >= 70) return 'Critical Reset';
  if (riskScore >= 45) return 'Stabilize';
  return 'Performance';
};

const deriveSummary = (tier, riskScore, readinessScore) => {
  if (tier === 'Critical Reset') {
    return `Risk is elevated (${riskScore}/100). Prioritize recovery load today.`;
  }
  if (tier === 'Stabilize') {
    return `Moderate risk (${riskScore}/100) with readiness at ${readinessScore}/100. Use controlled training and strict sleep timing.`;
  }
  return `Low risk (${riskScore}/100) and readiness at ${readinessScore}/100. Execute performance-focused protocol with recovery guardrails.`;
};

const buildProtocol = (tier, sleepHours) => {
  const baseProtocol = [
    {
      id: 'sleep-anchor',
      window: 'Evening',
      title: 'Circadian Anchor',
      priority: 'high',
      objective: 'Preserve endocrine recovery quality.',
      prescription: 'Fix bedtime within a 30-minute window and remove screens 60 minutes pre-sleep.',
    },
    {
      id: 'hydration',
      window: 'Morning',
      title: 'Electrolyte Hydration',
      priority: 'medium',
      objective: 'Improve autonomic stability and cognitive output.',
      prescription: 'Drink 600-800ml water in first 90 minutes with sodium and potassium support.',
    },
  ];

  if (tier === 'Critical Reset') {
    return [
      {
        id: 'load-reduction',
        window: 'Morning',
        title: 'Load Reduction',
        priority: 'critical',
        objective: 'Lower sympathetic burden immediately.',
        prescription: 'Avoid high-intensity training. Keep movement low intensity (zone 1-2) for 30-40 minutes.',
      },
      {
        id: 'stress-downshift',
        window: 'Midday',
        title: 'Stress Downshift',
        priority: 'high',
        objective: 'Reduce stress biomarkers before evening.',
        prescription: 'Run 2 cycles of breath work (6 breaths/min, 5 minutes each) and one 15-minute walk outdoors.',
      },
      {
        id: 'sleep-extension',
        window: 'Evening',
        title: 'Sleep Extension',
        priority: 'critical',
        objective: 'Restore sleep debt and HRV trajectory.',
        prescription: 'Target 8.5+ hours in bed and avoid caffeine after 1 PM.',
      },
      ...baseProtocol,
    ];
  }

  if (tier === 'Stabilize') {
    return [
      {
        id: 'controlled-intensity',
        window: 'Morning',
        title: 'Controlled Intensity',
        priority: 'high',
        objective: 'Preserve adaptation without overreaching.',
        prescription: 'Use sub-threshold session (RPE 6-7 max) with strict warm-up and cooldown.',
      },
      {
        id: 'nutrition-timing',
        window: 'Midday',
        title: 'Recovery Nutrition Window',
        priority: 'high',
        objective: 'Improve readiness for next cycle.',
        prescription: 'Consume protein + complex carbs within 90 minutes post-training.',
      },
      {
        id: 'sleep-protection',
        window: 'Evening',
        title: 'Sleep Protection',
        priority: 'high',
        objective: 'Prevent readiness decline overnight.',
        prescription: 'Maintain dark/cool bedroom and pre-sleep wind-down routine.',
      },
      ...baseProtocol,
    ];
  }

  return [
    {
      id: 'peak-work',
      window: 'Morning',
      title: 'Peak Output Block',
      priority: 'high',
      objective: 'Capitalize on readiness window.',
      prescription: 'Schedule cognitively demanding work and training in first half of day.',
    },
    {
      id: 'progressive-training',
      window: 'Midday',
      title: 'Progressive Training',
      priority: 'medium',
      objective: 'Drive adaptation while maintaining recovery.',
      prescription: 'Execute planned intensity with post-session cooldown and hydration.',
    },
    {
      id: 'sleep-consistency',
      window: 'Evening',
      title: 'Sleep Consistency',
      priority: 'medium',
      objective: 'Protect next-day readiness and HRV.',
      prescription: `Target ${sleepHours < 7 ? '7.5+' : '7.0+'} hours and keep pre-sleep routine consistent.`,
    },
    ...baseProtocol,
  ];
};

const toUtcDateString = (date = new Date()) => date.toISOString().slice(0, 10);

const computeDeltaPct = (values = []) => {
  if (values.length < 2) return 0;
  const latest = values[0];
  const oldest = values[values.length - 1];
  if (!Number.isFinite(latest) || !Number.isFinite(oldest) || oldest === 0) {
    return 0;
  }
  return Number((((latest - oldest) / oldest) * 100).toFixed(1));
};

const pullMetricSeries = (entries, key) => entries
  .map((entry) => toNumber(entry[key], null))
  .filter((value) => Number.isFinite(value));

const buildTrendSnapshot = (recentEntries = []) => {
  const hrv = pullMetricSeries(recentEntries, 'hrvMs');
  const sleep = pullMetricSeries(recentEntries, 'sleepDurationMin').map((value) => value / 60);
  const rhr = pullMetricSeries(recentEntries, 'restingHrBpm');
  const readiness = pullMetricSeries(recentEntries, 'readinessScore');
  const stress = pullMetricSeries(recentEntries, 'stressScore');

  const deltas = {
    hrvDeltaPct: computeDeltaPct(hrv),
    sleepDeltaPct: computeDeltaPct(sleep),
    rhrDeltaPct: computeDeltaPct(rhr),
    readinessDeltaPct: computeDeltaPct(readiness),
    stressDeltaPct: computeDeltaPct(stress),
  };

  const anomalyCount = [
    deltas.hrvDeltaPct <= -8,
    deltas.sleepDeltaPct <= -10,
    deltas.rhrDeltaPct >= 8,
    deltas.readinessDeltaPct <= -8,
    deltas.stressDeltaPct >= 12,
  ].filter(Boolean).length;

  return {
    deltas,
    anomalyCount,
  };
};

const buildClinicalDailyPlan = ({ latest = null, recent = [], generatedAt } = {}) => {
  const trend = buildTrendSnapshot(recent);

  const readinessScore = clamp(
    Math.round(toNumber(latest?.readinessScore, toNumber(recent[0]?.readinessScore, 78))),
    0,
    100
  );
  const stressScore = clamp(
    Math.round(toNumber(latest?.stressScore, toNumber(recent[0]?.stressScore, 30))),
    0,
    100
  );
  const restingHr = clamp(
    Math.round(toNumber(latest?.restingHrBpm, toNumber(recent[0]?.restingHrBpm, 58))),
    35,
    120
  );
  const sleepHours = toNumber(
    typeof latest?.sleepDurationMin === 'number' ? latest.sleepDurationMin / 60 : null,
    toNumber(recent[0]?.sleepDurationMin, 420) / 60
  );
  const hrvDeltaPct = toNumber(trend.deltas.hrvDeltaPct, 0);
  const anomalyCount = trend.anomalyCount;

  const factors = [];
  if (readinessScore < 65) factors.push({ label: 'Low readiness', points: 24 });
  else if (readinessScore < 75) factors.push({ label: 'Suboptimal readiness', points: 12 });

  if (stressScore > 70) factors.push({ label: 'High stress index', points: 22 });
  else if (stressScore > 55) factors.push({ label: 'Moderate stress load', points: 12 });

  if (sleepHours < 6.5) factors.push({ label: 'Sleep deficit', points: 20 });
  else if (sleepHours < 7.2) factors.push({ label: 'Sleep below target', points: 10 });

  if (restingHr > 62) factors.push({ label: 'Elevated resting HR', points: 12 });
  if (hrvDeltaPct < -8) factors.push({ label: 'HRV trend decline', points: 14 });
  if (anomalyCount >= 3) factors.push({ label: 'Multiple anomaly signals', points: 14 });

  const riskScore = clamp(factors.reduce((sum, factor) => sum + factor.points, 10), 0, 100);
  const tier = deriveTier(riskScore);
  const protocol = buildProtocol(tier, sleepHours);
  const summary = deriveSummary(tier, riskScore, readinessScore);

  const coachContext = [
    `Clinical layer: risk ${riskScore}/100 (${tier}).`,
    `Readiness ${readinessScore}/100, stress ${stressScore}/100, RHR ${restingHr} bpm, sleep ${sleepHours.toFixed(1)}h, HRV delta ${toSigned(hrvDeltaPct)}%.`,
    `Top factors: ${factors.length > 0 ? factors.slice(0, 3).map((f) => f.label).join(', ') : 'none critical'}.`,
  ].join(' ');

  return {
    version: '1.0.0',
    generatedAt: generatedAt || new Date().toISOString(),
    riskScore,
    readinessScore,
    tier,
    summary,
    factors,
    metrics: {
      stressScore,
      restingHr,
      sleepHours: Number(sleepHours.toFixed(1)),
      hrvDeltaPct: Number(hrvDeltaPct.toFixed(1)),
      anomalyCount,
    },
    protocol,
    coachContext,
  };
};

const HIGH_INTENSITY_ACTION_IDS = new Set([
  'controlled-intensity',
  'progressive-training',
  'peak-work',
]);

const BREATHWORK_ACTION_IDS = new Set([
  'stress-downshift',
]);

const COLD_EXPOSURE_TOKENS = [
  'cold',
  'thermogenesis',
  'ice bath',
  'cold exposure',
];

const getActionText = (action = {}) => (
  `${action.id || ''} ${action.title || ''} ${action.objective || ''} ${action.prescription || ''}`
).toLowerCase();

const isHighIntensityAction = (action = {}) => {
  const id = String(action.id || '');
  if (HIGH_INTENSITY_ACTION_IDS.has(id)) {
    return true;
  }

  const text = getActionText(action);
  return text.includes('high-intensity')
    || text.includes('planned intensity')
    || text.includes('sub-threshold')
    || text.includes('rpe 6')
    || text.includes('rpe 7');
};

const isColdExposureAction = (action = {}) => {
  const text = getActionText(action);
  return COLD_EXPOSURE_TOKENS.some((token) => text.includes(token));
};

const isBreathworkAction = (action = {}) => {
  const id = String(action.id || '');
  if (BREATHWORK_ACTION_IDS.has(id)) {
    return true;
  }
  const text = getActionText(action);
  return text.includes('breath work') || text.includes('breathwork') || text.includes('breath hold');
};

const buildSafetySummary = ({ contraindications, events, planRiskScore }) => {
  const blockedCount = events.filter((event) => event.type === 'blocked').length;
  const downgradedCount = events.filter((event) => event.type === 'downgraded').length;
  const activeFlags = [];

  if (contraindications.avoidHighIntensity) activeFlags.push('avoidHighIntensity');
  if (contraindications.avoidColdExposure) activeFlags.push('avoidColdExposure');
  if (contraindications.avoidBreathwork) activeFlags.push('avoidBreathwork');
  if (contraindications.recentInjury) activeFlags.push('recentInjury');
  if (contraindications.clinicianOverride) activeFlags.push('clinicianOverride');

  return {
    blockedCount,
    downgradedCount,
    activeFlags,
    contraindications,
    planRiskScore,
    status: blockedCount > 0
      ? 'guarded'
      : downgradedCount > 0
        ? 'conservative'
        : 'clear',
  };
};

const applySafetyLayer = (plan, contraindications = {}) => {
  const events = [];
  const highRiskDowngrade = plan.riskScore >= 70 || contraindications.recentInjury;
  const clinicianOverride = contraindications.clinicianOverride === true;

  const safeProtocol = (Array.isArray(plan.protocol) ? plan.protocol : []).map((action) => {
    const nextAction = { ...action };
    const actionId = String(nextAction.id || 'custom');

    const maybeBlock = (rule) => {
      nextAction.blocked = true;
      nextAction.blockedReason = rule.message;
      nextAction.safetyAdjusted = true;
      nextAction.safetyReason = rule.reason;
      events.push({
        type: 'blocked',
        reason: rule.reason,
        actionId,
      });
    };

    if (!clinicianOverride && contraindications.avoidHighIntensity && isHighIntensityAction(nextAction)) {
      maybeBlock({
        reason: 'contra_high_intensity',
        message: 'Blocked by your contraindication profile: avoid high-intensity load.',
      });
    } else if (!clinicianOverride && contraindications.avoidColdExposure && isColdExposureAction(nextAction)) {
      maybeBlock({
        reason: 'contra_cold_exposure',
        message: 'Blocked by your contraindication profile: avoid cold exposure.',
      });
    } else if (!clinicianOverride && contraindications.avoidBreathwork && isBreathworkAction(nextAction)) {
      maybeBlock({
        reason: 'contra_breathwork',
        message: 'Blocked by your contraindication profile: avoid breathwork strain.',
      });
    } else if (!clinicianOverride && highRiskDowngrade && isHighIntensityAction(nextAction)) {
      nextAction.priority = nextAction.priority === 'critical' ? 'high' : 'medium';
      nextAction.safetyAdjusted = true;
      nextAction.safetyReason = 'high_risk_downgrade';
      nextAction.prescription = 'Downgraded to zone 1-2 controlled movement (20-30 minutes), mobility work, and extended cooldown.';
      events.push({
        type: 'downgraded',
        reason: 'high_risk_downgrade',
        actionId,
      });
    }

    return nextAction;
  });

  const safety = buildSafetySummary({
    contraindications,
    events,
    planRiskScore: plan.riskScore,
  });

  return {
    plan: {
      ...plan,
      protocol: safeProtocol,
      safety,
    },
    events,
  };
};

const insertAuditLogEntry = async ({
  userId,
  action,
  resource = 'daily_protocols',
  resourceId = null,
  userAgent = null,
}) => {
  let normalizedUserAgent = null;
  if (userAgent !== null && userAgent !== undefined) {
    if (typeof userAgent === 'string') {
      normalizedUserAgent = JSON.stringify({ value: userAgent });
    } else if (typeof userAgent === 'object') {
      normalizedUserAgent = JSON.stringify(userAgent);
    } else {
      normalizedUserAgent = JSON.stringify({ value: String(userAgent) });
    }
  }

  const query = `
    INSERT INTO audit_log (
      user_id,
      actor_id,
      action,
      resource,
      resource_id,
      user_agent
    )
    VALUES ($1, $2, $3, $4, $5, $6)
  `;

  await db.query(query, [userId, userId, action, resource, resourceId, normalizedUserAgent]);
};

const logSafetyAuditTrail = async ({ userId, protocolId, safety = {}, events = [] }) => {
  try {
    await insertAuditLogEntry({
      userId,
      action: 'protocol.safety.applied',
      resource: 'daily_protocols',
      resourceId: protocolId,
      userAgent: JSON.stringify({
        blockedCount: safety.blockedCount || 0,
        downgradedCount: safety.downgradedCount || 0,
        status: safety.status || 'clear',
      }),
    });

    for (const event of events) {
      await insertAuditLogEntry({
        userId,
        action: event.type === 'blocked' ? 'protocol.safety.blocked' : 'protocol.safety.downgraded',
        resource: `protocol_action:${event.actionId || 'unknown'}`.slice(0, 100),
        resourceId: protocolId,
        userAgent: event.reason || null,
      });
    }
  } catch (error) {
    logger.warn('protocol_safety_audit_failed', {
      userId,
      protocolId,
      error: error.message,
    });
  }
};

const toStoredInsights = (plan) => {
  const items = [
    {
      title: 'Clinical Summary',
      body: plan.summary,
      tone: plan.riskScore >= 45 ? 'risk' : 'positive',
    },
  ];

  if (Array.isArray(plan.factors) && plan.factors.length > 0) {
    items.push({
      title: 'Top Risk Factors',
      body: plan.factors.slice(0, 3).map((factor) => factor.label).join(', '),
      tone: 'risk',
    });
  }

  return items;
};

const toStoredNutritionMeta = (plan) => ({
  version: plan.version,
  riskScore: plan.riskScore,
  readinessScore: plan.readinessScore,
  tier: plan.tier,
  summary: plan.summary,
  factors: plan.factors,
  metrics: plan.metrics,
  coachContext: plan.coachContext,
  safety: plan.safety || null,
});

const toJsonString = (value, fallback) => {
  try {
    return JSON.stringify(value === undefined ? fallback : value);
  } catch (error) {
    return JSON.stringify(fallback);
  }
};

const ensureProtocolVersionsTable = async () => {
  if (protocolVersionsTableEnsured) {
    return;
  }

  const createTableQuery = `
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
    )
  `;

  const createIndexQuery = `
    CREATE INDEX IF NOT EXISTS idx_protocol_versions_protocol
      ON protocol_versions(protocol_id, version_number DESC)
  `;

  await db.query(createTableQuery);
  await db.query(createIndexQuery);
  protocolVersionsTableEnsured = true;
};

const toActionKey = (action = {}, index = 0) => (
  String(action.id || `${action.title || 'action'}:${action.window || 'window'}:${index}`)
);

const toActionMap = (actions = []) => {
  const map = new Map();
  actions.forEach((action, index) => {
    map.set(toActionKey(action, index), action || {});
  });
  return map;
};

const collectActionFieldChanges = (previous = {}, next = {}) => {
  const fields = ['title', 'window', 'priority', 'objective', 'prescription', 'blocked', 'blockedReason', 'safetyReason'];
  const changed = [];

  fields.forEach((field) => {
    const prevValue = previous[field] ?? null;
    const nextValue = next[field] ?? null;
    if (prevValue !== nextValue) {
      changed.push(field);
    }
  });

  return changed;
};

const buildProtocolDiff = ({ previousRow = null, nextPlan = {}, safetyEvents = [] } = {}) => {
  const previousActions = Array.isArray(previousRow?.actions) ? previousRow.actions : [];
  const nextActions = Array.isArray(nextPlan?.protocol) ? nextPlan.protocol : [];

  const previousMeta = previousRow?.nutrition && typeof previousRow.nutrition === 'object'
    ? previousRow.nutrition
    : {};

  const previousMap = toActionMap(previousActions);
  const nextMap = toActionMap(nextActions);
  const changedActions = [];
  let addedActions = 0;
  let removedActions = 0;
  let modifiedActions = 0;

  for (const [key, nextAction] of nextMap.entries()) {
    const previousAction = previousMap.get(key);
    if (!previousAction) {
      addedActions += 1;
      changedActions.push({
        actionId: nextAction.id || key,
        title: nextAction.title || 'Action',
        change: 'added',
        fields: ['title', 'window', 'priority', 'objective', 'prescription'],
      });
      continue;
    }

    const fields = collectActionFieldChanges(previousAction, nextAction);
    if (fields.length > 0) {
      modifiedActions += 1;
      changedActions.push({
        actionId: nextAction.id || key,
        title: nextAction.title || 'Action',
        change: 'updated',
        fields,
      });
    }
  }

  for (const [key, previousAction] of previousMap.entries()) {
    if (!nextMap.has(key)) {
      removedActions += 1;
      changedActions.push({
        actionId: previousAction.id || key,
        title: previousAction.title || 'Action',
        change: 'removed',
        fields: ['title', 'window', 'priority', 'objective', 'prescription'],
      });
    }
  }

  const nextRisk = toNumber(nextPlan.riskScore, 0);
  const previousRisk = toNumber(previousMeta.riskScore, 0);
  const nextReadiness = toNumber(nextPlan.readinessScore, 0);
  const previousReadiness = toNumber(previousMeta.readinessScore, 0);

  const riskDelta = Number((nextRisk - previousRisk).toFixed(1));
  const readinessDelta = Number((nextReadiness - previousReadiness).toFixed(1));

  const nextSafety = nextPlan.safety || {};
  const previousSafety = previousMeta.safety || {};

  const blockedDelta = toNumber(nextSafety.blockedCount, 0) - toNumber(previousSafety.blockedCount, 0);
  const downgradedDelta = toNumber(nextSafety.downgradedCount, 0) - toNumber(previousSafety.downgradedCount, 0);

  const changedMetrics = [];
  if (riskDelta !== 0) {
    changedMetrics.push({ metric: 'riskScore', previous: previousRisk, next: nextRisk, delta: riskDelta });
  }
  if (readinessDelta !== 0) {
    changedMetrics.push({
      metric: 'readinessScore',
      previous: previousReadiness,
      next: nextReadiness,
      delta: readinessDelta,
    });
  }
  if (blockedDelta !== 0) {
    changedMetrics.push({
      metric: 'blockedCount',
      previous: toNumber(previousSafety.blockedCount, 0),
      next: toNumber(nextSafety.blockedCount, 0),
      delta: blockedDelta,
    });
  }
  if (downgradedDelta !== 0) {
    changedMetrics.push({
      metric: 'downgradedCount',
      previous: toNumber(previousSafety.downgradedCount, 0),
      next: toNumber(nextSafety.downgradedCount, 0),
      delta: downgradedDelta,
    });
  }

  const summary = {
    changeType: !previousRow
      ? 'initial_generation'
      : (addedActions + removedActions + modifiedActions + changedMetrics.length) > 0
        ? 'regenerated'
        : 'no_material_change',
    addedActions,
    removedActions,
    modifiedActions,
    blockedDelta,
    downgradedDelta,
    riskDelta,
    readinessDelta,
    safetyEvents: Array.isArray(safetyEvents) ? safetyEvents.length : 0,
  };

  return {
    summary,
    changedActions,
    changedMetrics,
    generatedAt: nextPlan.generatedAt || new Date().toISOString(),
  };
};

const deriveVersionReason = ({ previousRow = null, diff = {}, safetyEvents = [] } = {}) => {
  if (!previousRow) return 'initial_generation';

  const summary = diff.summary || {};
  if (summary.addedActions > 0 || summary.removedActions > 0) {
    return 'protocol_structure_update';
  }
  if (summary.blockedDelta > 0) {
    return 'safety_block_added';
  }
  if (summary.downgradedDelta > 0) {
    return 'safety_downgrade_applied';
  }
  if (Math.abs(summary.riskDelta || 0) >= 5) {
    return 'biometric_risk_shift';
  }
  if (Array.isArray(safetyEvents) && safetyEvents.length > 0) {
    return 'safety_recalculation';
  }
  if ((summary.modifiedActions || 0) > 0 || (diff.changedMetrics || []).length > 0) {
    return 'biometric_update';
  }
  return 'manual_refresh_no_material_change';
};

const createProtocolVersionSnapshot = async ({
  userId,
  protocolRow,
  plan,
  previousRow = null,
  safetyEvents = [],
}) => {
  if (!protocolRow?.id || !plan) {
    return null;
  }

  await ensureProtocolVersionsTable();

  const diff = buildProtocolDiff({
    previousRow,
    nextPlan: plan,
    safetyEvents,
  });
  const reason = deriveVersionReason({ previousRow, diff, safetyEvents });

  const nextVersionQuery = `
    SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
    FROM protocol_versions
    WHERE protocol_id = $1
  `;
  const { rows: nextRows } = await db.query(nextVersionQuery, [protocolRow.id]);
  const versionNumber = Number(nextRows[0]?.next_version || 1);

  const insertQuery = `
    INSERT INTO protocol_versions (
      protocol_id,
      user_id,
      version_number,
      generated_at,
      tier,
      risk_score,
      readiness_score,
      actions_json,
      meta_json,
      diff_json,
      reason
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11)
    RETURNING id, version_number, generated_at, reason
  `;

  const values = [
    protocolRow.id,
    userId,
    versionNumber,
    plan.generatedAt || new Date().toISOString(),
    plan.tier || null,
    toNumber(plan.riskScore, null),
    toNumber(plan.readinessScore, null),
    toJsonString(plan.protocol, []),
    toJsonString({
      summary: plan.summary,
      factors: plan.factors || [],
      metrics: plan.metrics || {},
      safety: plan.safety || {},
      coachContext: plan.coachContext || '',
      version: plan.version || '1.0.0',
    }, {}),
    toJsonString(diff, {}),
    reason,
  ];

  const { rows } = await db.query(insertQuery, values);
  return rows[0] || null;
};

const mapProtocolVersionRow = (row) => {
  const diff = row.diff_json && typeof row.diff_json === 'object' ? row.diff_json : {};
  return {
    id: row.id,
    versionNumber: Number(row.version_number),
    generatedAt: row.generated_at,
    reason: row.reason || 'unknown',
    summary: diff.summary || {},
    changedActions: Array.isArray(diff.changedActions) ? diff.changedActions : [],
    changedMetrics: Array.isArray(diff.changedMetrics) ? diff.changedMetrics : [],
  };
};

const getProtocolVersionHistory = async (userId, protocolId, { limit = 8 } = {}) => {
  await ensureProtocolVersionsTable();

  const safeLimit = Math.max(1, Math.min(25, Number(limit) || 8));
  const query = `
    SELECT
      id,
      version_number,
      generated_at,
      reason,
      diff_json
    FROM protocol_versions
    WHERE user_id = $1
      AND protocol_id = $2
    ORDER BY version_number DESC
    LIMIT $3
  `;
  const { rows } = await db.query(query, [userId, protocolId, safeLimit]);
  return rows.map(mapProtocolVersionRow);
};

const attachVersioning = async (userId, responsePlan) => {
  if (!responsePlan?.id) {
    return responsePlan;
  }

  const versionHistory = await getProtocolVersionHistory(userId, responsePlan.id, { limit: 8 });
  const latest = versionHistory[0] || null;
  const previous = versionHistory[1] || null;

  return {
    ...responsePlan,
    versionHistory,
    changeIntelligence: {
      latestVersion: latest?.versionNumber || null,
      previousVersion: previous?.versionNumber || null,
      reason: latest?.reason || 'unknown',
      summary: latest?.summary || {},
      changedActions: latest?.changedActions || [],
      changedMetrics: latest?.changedMetrics || [],
    },
  };
};

const attachIntelligence = async (userId, responsePlan) => {
  const versioned = await attachVersioning(userId, responsePlan);
  return buildAdherenceIntelligence(userId, versioned);
};

const mapCompletions = (rows = []) => {
  const completionByIndex = new Map();
  rows.forEach((row) => {
    completionByIndex.set(Number(row.action_index), row.completed_at);
  });
  return completionByIndex;
};

const getPriorityRiskDelta = (priority) => {
  if (priority === 'critical') return 12;
  if (priority === 'high') return 8;
  if (priority === 'medium') return 4;
  return 2;
};

const getProtocolRowsForAdherence = async (userId, { limit = 14 } = {}) => {
  const safeLimit = Math.max(3, Math.min(30, Number(limit) || 14));
  const query = `
    SELECT
      id,
      protocol_date,
      actions
    FROM daily_protocols
    WHERE user_id = $1
    ORDER BY protocol_date DESC, generated_at DESC
    LIMIT $2
  `;
  const { rows } = await db.query(query, [userId, safeLimit]);
  return rows;
};

const getProtocolCompletionRows = async (userId, protocolIds = []) => {
  if (!Array.isArray(protocolIds) || protocolIds.length === 0) {
    return [];
  }

  const query = `
    SELECT protocol_id, action_index
    FROM protocol_completions
    WHERE user_id = $1
      AND protocol_id = ANY($2::uuid[])
  `;
  const { rows } = await db.query(query, [userId, protocolIds]);
  return rows;
};

const buildCompletionsMapByProtocol = (completionRows = []) => {
  const byProtocol = new Map();
  completionRows.forEach((row) => {
    const protocolId = row.protocol_id;
    if (!byProtocol.has(protocolId)) {
      byProtocol.set(protocolId, new Set());
    }
    byProtocol.get(protocolId).add(Number(row.action_index));
  });
  return byProtocol;
};

const buildAdherenceWarningForAction = ({ action, adherenceScore }) => {
  if (!action || action.blocked || action.done) {
    return null;
  }

  const baseDelta = getPriorityRiskDelta(action.priority);
  const multiplier = adherenceScore < 60 ? 1.35 : adherenceScore < 75 ? 1.15 : 1;
  const riskDelta = Math.round(baseDelta * multiplier);

  return {
    riskDelta,
    severity: riskDelta >= 10 ? 'high' : riskDelta >= 6 ? 'medium' : 'low',
    message: `Skipping this likely adds +${riskDelta} risk points to tomorrow's recovery cycle.`,
  };
};

const buildAdherenceIntelligence = async (userId, responsePlan) => {
  const protocolRows = await getProtocolRowsForAdherence(userId, { limit: 14 });
  const protocolIds = protocolRows.map((row) => row.id);
  const completionRows = await getProtocolCompletionRows(userId, protocolIds);
  const completionMap = buildCompletionsMapByProtocol(completionRows);
  const historicalRows = protocolRows
    .filter((row) => String(row.id) !== String(responsePlan?.id || ''))
    .slice(0, 7);

  const dayStats = historicalRows.map((row, dayIndex) => {
    const actions = Array.isArray(row.actions) ? row.actions : [];
    const completedIndexes = completionMap.get(row.id) || new Set();
    const actionable = actions
      .map((action, index) => ({ action: action || {}, index }))
      .filter(({ action }) => !action.blocked);

    const actionableCount = actionable.length;
    const completedCount = actionable.reduce(
      (count, item) => count + (completedIndexes.has(item.index) ? 1 : 0),
      0
    );
    const completionRate = actionableCount > 0
      ? Number(((completedCount / actionableCount) * 100).toFixed(1))
      : 100;

    const keyActionCount = actionable.filter(
      ({ action }) => action.priority === 'critical' || action.priority === 'high'
    ).length;
    const keyActionMisses = actionable.reduce((count, item) => {
      const isKey = item.action.priority === 'critical' || item.action.priority === 'high';
      if (!isKey) return count;
      return count + (completedIndexes.has(item.index) ? 0 : 1);
    }, 0);

    return {
      protocolId: row.id,
      protocolDate: row.protocol_date,
      dayIndex,
      actionableCount,
      completedCount,
      completionRate,
      keyActionCount,
      keyActionMisses,
      missedCount: Math.max(0, actionableCount - completedCount),
    };
  });

  const weighted = dayStats.reduce((acc, day) => {
    const weight = Math.max(1, 7 - day.dayIndex);
    acc.score += day.completionRate * weight;
    acc.weight += weight;
    return acc;
  }, { score: 0, weight: 0 });

  const adherenceScore = weighted.weight > 0
    ? Math.round(weighted.score / weighted.weight)
    : 82;

  const recent3 = dayStats.slice(0, 3);
  const previous3 = dayStats.slice(3, 6);
  const average = (list = []) => (list.length > 0
    ? list.reduce((sum, item) => sum + item.completionRate, 0) / list.length
    : 100);
  const trendDelta = Number((average(recent3) - average(previous3)).toFixed(1));

  const missedKeyTotal = dayStats.reduce((sum, day) => sum + day.keyActionMisses, 0);
  const missedAnyTotal = dayStats.reduce((sum, day) => sum + day.missedCount, 0);
  const recoveryDebt = clamp(Math.round((missedKeyTotal * 11) + (missedAnyTotal * 2.5)), 0, 100);

  const projectedRiskDelta = adherenceScore < 45
    ? 18
    : adherenceScore < 60
      ? 12
      : adherenceScore < 75
        ? 7
        : adherenceScore < 88
          ? 3
          : 0;

  const status = dayStats.length === 0
    ? 'warming_up'
    : adherenceScore >= 85
    ? 'optimized'
    : adherenceScore >= 70
      ? 'stable'
      : adherenceScore >= 55
        ? 'at_risk'
        : 'critical';

  const summary = dayStats.length === 0
    ? 'Adherence baseline is warming up. Complete key actions today to establish trend quality.'
    : adherenceScore >= 85
      ? 'Adherence is high and supporting protocol outcomes.'
      : adherenceScore >= 70
        ? 'Adherence is acceptable but missed key actions can compound fatigue.'
        : adherenceScore >= 55
          ? 'Adherence is slipping; projected risk is likely to rise without intervention.'
          : 'Adherence is critically low; immediate recovery-protective compliance is required.';

  const todayActions = Array.isArray(responsePlan?.protocol) ? responsePlan.protocol : [];
  const todayActionable = todayActions.filter((action) => !action?.blocked);
  const todayCompletedCount = todayActionable.reduce(
    (count, action) => count + (action?.done ? 1 : 0),
    0
  );
  const todayActionableCount = todayActionable.length;
  const todayKeyMisses = todayActionable.reduce((count, action) => {
    const isKey = action?.priority === 'critical' || action?.priority === 'high';
    if (!isKey) return count;
    return count + (action?.done ? 0 : 1);
  }, 0);
  const todayCompletionRate = todayActionableCount > 0
    ? Number(((todayCompletedCount / todayActionableCount) * 100).toFixed(1))
    : 100;
  const provisionalToday = {
    protocolId: responsePlan?.id || null,
    protocolDate: responsePlan?.protocolDate || toUtcDateString(),
    actionableCount: todayActionableCount,
    completedCount: todayCompletedCount,
    completionRate: todayCompletionRate,
    keyActionMisses: todayKeyMisses,
    missedCount: Math.max(0, todayActionableCount - todayCompletedCount),
  };

  const protocolWithWarnings = (Array.isArray(responsePlan.protocol) ? responsePlan.protocol : []).map((action) => {
    const warning = buildAdherenceWarningForAction({ action, adherenceScore });
    if (!warning) {
      return action;
    }
    return {
      ...action,
      adherenceRiskDelta: warning.riskDelta,
      adherenceWarning: warning.message,
      adherenceSeverity: warning.severity,
    };
  });

  return {
    ...responsePlan,
    protocol: protocolWithWarnings,
    adherence: {
      score: adherenceScore,
      status,
      trendDelta,
      recoveryDebt,
      projectedRiskDelta,
      summary,
      daysAnalyzed: dayStats.length,
      keyActionsMissed: missedKeyTotal,
      missedActionsTotal: missedAnyTotal,
      daily: dayStats.slice(0, 7),
      provisionalToday,
    },
  };
};

const toPlanResponse = (row, completionRows = []) => {
  const meta = row.nutrition && typeof row.nutrition === 'object' ? row.nutrition : {};
  const actions = Array.isArray(row.actions) ? row.actions : [];
  const completionByIndex = mapCompletions(completionRows);

  const protocol = actions.map((action, index) => ({
    ...action,
    actionIndex: index,
    done: action?.blocked ? false : completionByIndex.has(index),
    completedAt: action?.blocked ? null : (completionByIndex.get(index) || null),
  }));

  const safety = meta.safety && typeof meta.safety === 'object'
    ? meta.safety
    : {
      blockedCount: protocol.filter((item) => item?.blocked).length,
      downgradedCount: protocol.filter((item) => item?.safetyReason === 'high_risk_downgrade').length,
      activeFlags: [],
      contraindications: {},
      planRiskScore: toNumber(meta.riskScore, 0),
      status: 'clear',
    };

  return {
    id: row.id,
    protocolDate: row.protocol_date,
    generatedAt: row.generated_at,
    version: meta.version || '1.0.0',
    riskScore: toNumber(meta.riskScore, 0),
    readinessScore: toNumber(meta.readinessScore, toNumber(row.vital_score, 0)),
    tier: meta.tier || 'Performance',
    summary: meta.summary || '',
    factors: Array.isArray(meta.factors) ? meta.factors : [],
    metrics: meta.metrics || {},
    coachContext: meta.coachContext || '',
    safety,
    protocol,
    insights: Array.isArray(row.insights) ? row.insights : [],
  };
};

const toPlanFromStoredRow = (row) => {
  const meta = row?.nutrition && typeof row.nutrition === 'object' ? row.nutrition : {};
  return {
    version: meta.version || '1.0.0',
    generatedAt: row?.generated_at || new Date().toISOString(),
    riskScore: toNumber(meta.riskScore, 0),
    readinessScore: toNumber(meta.readinessScore, toNumber(row?.vital_score, 0)),
    tier: meta.tier || 'Performance',
    summary: meta.summary || '',
    factors: Array.isArray(meta.factors) ? meta.factors : [],
    metrics: meta.metrics || {},
    protocol: Array.isArray(row?.actions) ? row.actions : [],
    coachContext: meta.coachContext || '',
    safety: meta.safety || {
      blockedCount: 0,
      downgradedCount: 0,
      activeFlags: [],
      contraindications: {},
      planRiskScore: toNumber(meta.riskScore, 0),
      status: 'clear',
    },
  };
};

const getProtocolRowByUserDate = async (userId, protocolDate) => {
  const query = `
    SELECT *
    FROM daily_protocols
    WHERE user_id = $1
      AND protocol_date = $2
    LIMIT 1
  `;
  const { rows } = await db.query(query, [userId, protocolDate]);
  return rows[0] || null;
};

const getProtocolRowById = async (userId, protocolId) => {
  const query = `
    SELECT *
    FROM daily_protocols
    WHERE user_id = $1
      AND id = $2
    LIMIT 1
  `;
  const { rows } = await db.query(query, [userId, protocolId]);
  return rows[0] || null;
};

const getProtocolCompletions = async (userId, protocolId) => {
  const query = `
    SELECT action_index, completed_at
    FROM protocol_completions
    WHERE user_id = $1
      AND protocol_id = $2
    ORDER BY action_index ASC
  `;
  const { rows } = await db.query(query, [userId, protocolId]);
  return rows;
};

const createProtocolRow = async ({ userId, protocolDate, plan }) => {
  const query = `
    INSERT INTO daily_protocols (
      user_id,
      protocol_date,
      generated_at,
      vital_score,
      actions,
      insights,
      nutrition,
      supplements
    )
    VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb)
    RETURNING *
  `;

  const values = [
    userId,
    protocolDate,
    plan.generatedAt,
    plan.readinessScore,
    toJsonString(plan.protocol, []),
    toJsonString(toStoredInsights(plan), []),
    toJsonString(toStoredNutritionMeta(plan), {}),
    toJsonString([], []),
  ];

  const { rows } = await db.query(query, values);
  return rows[0];
};

const updateProtocolRow = async ({ protocolId, plan }) => {
  const query = `
    UPDATE daily_protocols
    SET
      generated_at = $2,
      vital_score = $3,
      actions = $4::jsonb,
      insights = $5::jsonb,
      nutrition = $6::jsonb,
      supplements = $7::jsonb
    WHERE id = $1
    RETURNING *
  `;

  const values = [
    protocolId,
    plan.generatedAt,
    plan.readinessScore,
    toJsonString(plan.protocol, []),
    toJsonString(toStoredInsights(plan), []),
    toJsonString(toStoredNutritionMeta(plan), {}),
    toJsonString([], []),
  ];

  const { rows } = await db.query(query, values);
  return rows[0];
};

const clearProtocolCompletions = async (userId, protocolId) => {
  const query = `
    DELETE FROM protocol_completions
    WHERE user_id = $1
      AND protocol_id = $2
  `;
  await db.query(query, [userId, protocolId]);
};

const hasActionShapeChanged = (oldActions = [], newActions = []) => {
  if (!Array.isArray(oldActions) || !Array.isArray(newActions)) return true;
  if (oldActions.length !== newActions.length) return true;

  for (let i = 0; i < oldActions.length; i += 1) {
    const prev = oldActions[i] || {};
    const next = newActions[i] || {};
    if (prev.id !== next.id || prev.title !== next.title || prev.window !== next.window) {
      return true;
    }
  }

  return false;
};

const buildOrRefreshPlan = async (userId, existingRow = null) => {
  const latest = await getLatestBiometricEntry(userId);
  const recent = await getRecentBiometricEntries(userId, 60);
  const contraindications = await getContraindicationProfile(userId);

  const basePlan = buildClinicalDailyPlan({
    latest,
    recent,
    generatedAt: new Date().toISOString(),
  });
  const safetyResult = applySafetyLayer(basePlan, contraindications);
  const generatedPlan = safetyResult.plan;

  if (!existingRow) {
    const protocolDate = toUtcDateString();
    const createdRow = await createProtocolRow({
      userId,
      protocolDate,
      plan: generatedPlan,
    });
    await createProtocolVersionSnapshot({
      userId,
      protocolRow: createdRow,
      plan: generatedPlan,
      previousRow: null,
      safetyEvents: safetyResult.events,
    });
    await logSafetyAuditTrail({
      userId,
      protocolId: createdRow.id,
      safety: generatedPlan.safety,
      events: safetyResult.events,
    });
    return { row: createdRow, completionsCleared: false };
  }

  const previousActions = Array.isArray(existingRow.actions) ? existingRow.actions : [];
  const actionsChanged = hasActionShapeChanged(previousActions, generatedPlan.protocol);
  const updatedRow = await updateProtocolRow({
    protocolId: existingRow.id,
    plan: generatedPlan,
  });

  await createProtocolVersionSnapshot({
    userId,
    protocolRow: updatedRow,
    plan: generatedPlan,
    previousRow: existingRow,
    safetyEvents: safetyResult.events,
  });

  if (actionsChanged) {
    await clearProtocolCompletions(userId, existingRow.id);
  }

  await logSafetyAuditTrail({
    userId,
    protocolId: updatedRow.id,
    safety: generatedPlan.safety,
    events: safetyResult.events,
  });

  return { row: updatedRow, completionsCleared: actionsChanged };
};

const getTodayClinicalPlan = async (userId, { refresh = false } = {}) => {
  const protocolDate = toUtcDateString();
  const existing = await getProtocolRowByUserDate(userId, protocolDate);

  if (existing && !refresh) {
    const completions = await getProtocolCompletions(userId, existing.id);
    const baseResponse = toPlanResponse(existing, completions);
    let enriched = await attachIntelligence(userId, baseResponse);

    if (!Array.isArray(enriched.versionHistory) || enriched.versionHistory.length === 0) {
      await createProtocolVersionSnapshot({
        userId,
        protocolRow: existing,
        plan: toPlanFromStoredRow(existing),
        previousRow: null,
        safetyEvents: [],
      });
      enriched = await attachIntelligence(userId, baseResponse);
    }

    return enriched;
  }

  const { row, completionsCleared } = await buildOrRefreshPlan(userId, existing);
  const completions = completionsCleared ? [] : await getProtocolCompletions(userId, row.id);
  const baseResponse = toPlanResponse(row, completions);
  return attachIntelligence(userId, baseResponse);
};

const getProtocolVersions = async (userId, protocolId, { limit = 8 } = {}) => {
  const protocol = await getProtocolRowById(userId, protocolId);
  if (!protocol) {
    throw ApiError.notFound('Protocol not found.');
  }

  let history = await getProtocolVersionHistory(userId, protocolId, { limit });
  if (history.length === 0) {
    await createProtocolVersionSnapshot({
      userId,
      protocolRow: protocol,
      plan: toPlanFromStoredRow(protocol),
      previousRow: null,
      safetyEvents: [],
    });
    history = await getProtocolVersionHistory(userId, protocolId, { limit });
  }

  return history;
};

const setProtocolActionCompletion = async ({
  userId,
  protocolId,
  actionIndex,
  completed = true,
}) => {
  const protocol = await getProtocolRowById(userId, protocolId);
  if (!protocol) {
    throw ApiError.notFound('Protocol not found.');
  }

  const actions = Array.isArray(protocol.actions) ? protocol.actions : [];
  if (!Number.isInteger(actionIndex) || actionIndex < 0 || actionIndex >= actions.length) {
    throw ApiError.badRequest('actionIndex is out of bounds for this protocol.');
  }

  const targetAction = actions[actionIndex] || {};
  if (completed && targetAction.blocked) {
    try {
      await insertAuditLogEntry({
        userId,
        action: 'protocol.safety.completion_blocked',
        resource: `protocol_action:${String(targetAction.id || actionIndex)}`.slice(0, 100),
        resourceId: protocolId,
        userAgent: targetAction.safetyReason || 'blocked_action',
      });
    } catch (error) {
      logger.warn('protocol_blocked_completion_audit_failed', {
        userId,
        protocolId,
        actionIndex,
        error: error.message,
      });
    }
    throw ApiError.badRequest('This action is blocked by your clinical safety profile.');
  }

  if (completed) {
    const query = `
      INSERT INTO protocol_completions (user_id, protocol_id, action_index)
      SELECT $1, $2, $3
      WHERE NOT EXISTS (
        SELECT 1
        FROM protocol_completions
        WHERE user_id = $1
          AND protocol_id = $2
          AND action_index = $3
      )
    `;
    await db.query(query, [userId, protocolId, actionIndex]);
  } else {
    const query = `
      DELETE FROM protocol_completions
      WHERE user_id = $1
        AND protocol_id = $2
        AND action_index = $3
    `;
    await db.query(query, [userId, protocolId, actionIndex]);
  }

  const completionRows = await getProtocolCompletions(userId, protocolId);
  const baseResponse = toPlanResponse(protocol, completionRows);
  return attachIntelligence(userId, baseResponse);
};

module.exports = {
  getTodayClinicalPlan,
  getProtocolVersions,
  setProtocolActionCompletion,
};
