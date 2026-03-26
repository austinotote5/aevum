const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const db = require('../db');
const { buildRealUserEmailFilterSql, getExcludedEmailDomains } = require('../utils/realUserFilter');

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const average = (values = []) => {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
};

const round = (value, places = 1) => {
  const factor = 10 ** places;
  return Math.round((toNumber(value, 0) + Number.EPSILON) * factor) / factor;
};

const getWindow = () => {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 27);

  return {
    startDateIso: startDate.toISOString().slice(0, 10),
    endDateIso: endDate.toISOString().slice(0, 10),
  };
};

const parseArgs = (argv = []) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.replace(/^--/, '');
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    args[key] = value;
    if (value !== true) i += 1;
  }
  return args;
};

const buildSourceFilter = ({ includeSynthetic = false } = {}) => {
  if (includeSynthetic) {
    return 'TRUE';
  }
  return "source IS NULL OR source NOT LIKE 'synthetic%'";
};

const fetchDataIntegrity = async ({ startDateIso, endDateIso }) => {
  const realUserFilter = buildRealUserEmailFilterSql('u.email');
  const { rows } = await db.query(`
    SELECT
      COUNT(*)::int AS total_entries,
      COUNT(*) FILTER (
        WHERE b.source LIKE 'synthetic%'
      )::int AS synthetic_entries
    FROM biometric_entries b
    JOIN users u ON u.id = b.user_id
    WHERE b.recorded_at::date BETWEEN $1::date AND $2::date
      AND u.is_active = true
      AND (${realUserFilter})
  `, [startDateIso, endDateIso]);

  const totalEntries = toNumber(rows[0]?.total_entries, 0);
  const syntheticEntries = toNumber(rows[0]?.synthetic_entries, 0);

  return {
    totalBiometricEntries: totalEntries,
    syntheticBiometricEntries: syntheticEntries,
    syntheticBiometricPct: totalEntries > 0 ? round((syntheticEntries / totalEntries) * 100, 2) : 0,
  };
};

const fetchCohort = async ({ startDateIso, endDateIso, includeSynthetic = false }) => {
  const sourceFilter = buildSourceFilter({ includeSynthetic });
  const realUserFilter = buildRealUserEmailFilterSql('u.email');
  const [activeUsers, paidUsers, activatedUsers] = await Promise.all([
    db.query(`
      SELECT u.id, u.email, u.created_at
      FROM users u
      WHERE u.is_active = true
        AND (${realUserFilter})
    `),
    db.query(`
      SELECT COUNT(*)::int AS count
      FROM users u
      WHERE u.is_active = true
        AND (${realUserFilter})
        AND u.plan IN ('premium', 'enterprise')
    `),
    db.query(`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT b.user_id
        FROM biometric_entries b
        JOIN users u ON u.id = b.user_id
        WHERE b.recorded_at::date BETWEEN $1::date AND $2::date
          AND u.is_active = true
          AND (${realUserFilter})
          AND (${sourceFilter})
        GROUP BY b.user_id
        HAVING COUNT(*) >= 3
      ) t
    `, [startDateIso, endDateIso]),
  ]);

  const totalActive = activeUsers.rows.length;
  const totalPaid = toNumber(paidUsers.rows[0]?.count, 0);
  const activated = toNumber(activatedUsers.rows[0]?.count, 0);

  return {
    totalActive,
    totalPaid,
    activated,
    activationRatePct: totalActive > 0 ? round((activated / totalActive) * 100, 1) : 0,
    conversionPct: totalActive > 0 ? round((totalPaid / totalActive) * 100, 1) : 0,
    userIds: activeUsers.rows.map((row) => row.id),
  };
};

const fetchAdherence = async ({ startDateIso, endDateIso }) => {
  const realUserFilter = buildRealUserEmailFilterSql('u.email');
  const protocols = await db.query(`
    SELECT dp.id, dp.actions
    FROM daily_protocols dp
    JOIN users u ON u.id = dp.user_id
    WHERE dp.protocol_date BETWEEN $1::date AND $2::date
      AND u.is_active = true
      AND (${realUserFilter})
  `, [startDateIso, endDateIso]);

  if (protocols.rows.length === 0) {
    return {
      protocolCount: 0,
      actionableCount: 0,
      completedCount: 0,
      completionRatePct: 0,
    };
  }

  const protocolIds = protocols.rows.map((row) => row.id);
  const completionResult = await db.query(`
    SELECT protocol_id, COUNT(*)::int AS completed
    FROM protocol_completions
    WHERE protocol_id = ANY($1::uuid[])
    GROUP BY protocol_id
  `, [protocolIds]);

  const completionMap = new Map();
  completionResult.rows.forEach((row) => {
    completionMap.set(row.protocol_id, toNumber(row.completed, 0));
  });

  let actionableCount = 0;
  let completedCount = 0;

  protocols.rows.forEach((row) => {
    const actions = Array.isArray(row.actions) ? row.actions : [];
    const actionable = actions.filter((action) => !action?.blocked).length;
    actionableCount += actionable;
    completedCount += Math.min(actionable, completionMap.get(row.id) || 0);
  });

  return {
    protocolCount: protocols.rows.length,
    actionableCount,
    completedCount,
    completionRatePct: actionableCount > 0 ? round((completedCount / actionableCount) * 100, 1) : 0,
  };
};

const fetchOutcomes = async ({ startDateIso, endDateIso, includeSynthetic = false }) => {
  const sourceFilter = buildSourceFilter({ includeSynthetic });
  const realUserFilter = buildRealUserEmailFilterSql('u.email');
  const [biometrics, risks] = await Promise.all([
    db.query(`
      SELECT b.recorded_at, b.readiness_score, b.hrv_ms, b.sleep_duration_min
      FROM biometric_entries b
      JOIN users u ON u.id = b.user_id
      WHERE b.recorded_at::date BETWEEN $1::date AND $2::date
        AND u.is_active = true
        AND (${realUserFilter})
        AND (${sourceFilter})
      ORDER BY b.recorded_at ASC
    `, [startDateIso, endDateIso]),
    db.query(`
      SELECT dp.protocol_date, (dp.nutrition ->> 'riskScore')::numeric AS risk_score
      FROM daily_protocols dp
      JOIN users u ON u.id = dp.user_id
      WHERE dp.protocol_date BETWEEN $1::date AND $2::date
        AND u.is_active = true
        AND (${realUserFilter})
      ORDER BY dp.protocol_date ASC
    `, [startDateIso, endDateIso]),
  ]);

  const readinessValues = biometrics.rows
    .map((row) => toNumber(row.readiness_score, null))
    .filter((value) => Number.isFinite(value));
  const hrvValues = biometrics.rows
    .map((row) => toNumber(row.hrv_ms, null))
    .filter((value) => Number.isFinite(value));
  const sleepValues = biometrics.rows
    .map((row) => toNumber(row.sleep_duration_min, null))
    .filter((value) => Number.isFinite(value));
  const riskValues = risks.rows
    .map((row) => toNumber(row.risk_score, null))
    .filter((value) => Number.isFinite(value));

  const split = (values = []) => {
    if (values.length < 6) {
      return { baseline: null, current: null };
    }
    const windowSize = Math.min(7, Math.floor(values.length / 2));
    if (windowSize < 3) {
      return { baseline: null, current: null };
    }
    const baseline = average(values.slice(0, windowSize));
    const current = average(values.slice(values.length - windowSize));
    return {
      baseline: Number.isFinite(baseline) ? baseline : null,
      current: Number.isFinite(current) ? current : null,
    };
  };

  const readinessSplit = split(readinessValues);
  const hrvSplit = split(hrvValues);
  const sleepSplit = split(sleepValues);
  const riskSplit = split(riskValues);

  const deltaPct = (baseline, current) => {
    if (!Number.isFinite(baseline) || !Number.isFinite(current) || baseline === 0) {
      return 0;
    }
    return round(((current - baseline) / Math.abs(baseline)) * 100, 1);
  };

  const riskReductionPct = (() => {
    if (!Number.isFinite(riskSplit.baseline) || !Number.isFinite(riskSplit.current) || riskSplit.baseline === 0) {
      return 0;
    }
    return round(((riskSplit.baseline - riskSplit.current) / riskSplit.baseline) * 100, 1);
  })();

  return {
    dataPoints: biometrics.rows.length,
    readiness: {
      baseline: round(readinessSplit.baseline, 1),
      current: round(readinessSplit.current, 1),
      deltaPct: deltaPct(readinessSplit.baseline, readinessSplit.current),
    },
    hrv: {
      baseline: round(hrvSplit.baseline, 1),
      current: round(hrvSplit.current, 1),
      deltaPct: deltaPct(hrvSplit.baseline, hrvSplit.current),
    },
    sleepMinutes: {
      baseline: round(sleepSplit.baseline, 1),
      current: round(sleepSplit.current, 1),
      deltaPct: deltaPct(sleepSplit.baseline, sleepSplit.current),
    },
    risk: {
      baseline: round(riskSplit.baseline, 1),
      current: round(riskSplit.current, 1),
      reductionPct: riskReductionPct,
    },
  };
};

const fetchRetention = async ({ startDateIso }) => {
  const realUserFilter = buildRealUserEmailFilterSql('u.email');
  const { rows } = await db.query(`
    WITH eligible AS (
      SELECT id
      FROM users u
      WHERE u.is_active = true
        AND (${realUserFilter})
        AND u.created_at::date <= $1::date
    ),
    retained AS (
      SELECT COUNT(DISTINCT pc.user_id)::int AS retained_count
      FROM protocol_completions pc
      JOIN eligible e ON e.id = pc.user_id
      WHERE pc.completed_at >= NOW() - INTERVAL '28 days'
    )
    SELECT
      (SELECT COUNT(*)::int FROM eligible) AS eligible_count,
      (SELECT retained_count FROM retained) AS retained_count
  `, [startDateIso]);

  const eligible = toNumber(rows[0]?.eligible_count, 0);
  const retained = toNumber(rows[0]?.retained_count, 0);
  return {
    eligibleUsers: eligible,
    retainedUsers: retained,
    retentionPct: eligible > 0 ? round((retained / eligible) * 100, 1) : 0,
  };
};

const fetchMonetization = async ({ startDateIso, endDateIso }) => {
  const realUserFilter = buildRealUserEmailFilterSql('u.email');
  const { rows } = await db.query(`
    SELECT
      COALESCE(SUM(delta_mrr) FILTER (WHERE delta_mrr > 0), 0)::int AS expansion_mrr,
      COALESCE(SUM(ABS(delta_mrr)) FILTER (WHERE delta_mrr < 0), 0)::int AS contraction_mrr
    FROM billing_plan_events bpe
    JOIN users u ON u.id = bpe.user_id
    WHERE bpe.changed_at::date BETWEEN $1::date AND $2::date
      AND u.is_active = true
      AND (${realUserFilter})
  `, [startDateIso, endDateIso]);

  return {
    expansionMrr: toNumber(rows[0]?.expansion_mrr, 0),
    contractionMrr: toNumber(rows[0]?.contraction_mrr, 0),
    netExpansionMrr: toNumber(rows[0]?.expansion_mrr, 0) - toNumber(rows[0]?.contraction_mrr, 0),
  };
};

const buildNarrative = ({ cohort, adherence, outcomes, retention, monetization }) => {
  const lines = [];
  lines.push(`Activation ${cohort.activationRatePct}% across active users.`);
  lines.push(`Adherence completion ${adherence.completionRatePct}% over ${adherence.protocolCount} protocols.`);
  lines.push(`Readiness delta ${outcomes.readiness.deltaPct}% and risk reduction ${outcomes.risk.reductionPct}% in 28-day window.`);
  lines.push(`28-day retention ${retention.retentionPct}% among eligible users.`);
  lines.push(`Net expansion MRR ${monetization.netExpansionMrr} in the same window.`);
  return lines;
};

const generate28DayProofReport = async ({ includeSynthetic = false } = {}) => {
  const window = getWindow();
  const [cohort, adherence, outcomes, retention, monetization, integrity] = await Promise.all([
    fetchCohort({ ...window, includeSynthetic }),
    fetchAdherence(window),
    fetchOutcomes({ ...window, includeSynthetic }),
    fetchRetention(window),
    fetchMonetization(window),
    fetchDataIntegrity(window),
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    window,
    integrity: {
      includeSyntheticInBiometricMetrics: includeSynthetic === true,
      excludedEmailDomains: getExcludedEmailDomains(),
      ...integrity,
    },
    kpis: {
      cohort,
      adherence,
      outcomes,
      retention,
      monetization,
    },
    narrative: buildNarrative({ cohort, adherence, outcomes, retention, monetization }),
  };

  const outputDir = path.resolve(__dirname, '..', '..', 'docs', 'reports');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.resolve(outputDir, `aevum-28day-proof-${window.endDateIso}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return {
    report,
    outputPath,
  };
};

const run = async ({ includeSynthetic = false } = {}) => {
  const { outputPath } = await generate28DayProofReport({ includeSynthetic });
  console.log(`[proof] 28-day report written: ${outputPath}`);
};

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const includeSynthetic = String(args['include-synthetic'] || 'false').toLowerCase() === 'true';

  run({ includeSynthetic })
    .catch((error) => {
      console.error('[proof] failed to export 28-day report:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      try {
        await db.pool.end();
      } catch (error) {
        console.error('[proof] failed to close DB pool:', error.message);
      }
    });
}

module.exports = {
  generate28DayProofReport,
};
