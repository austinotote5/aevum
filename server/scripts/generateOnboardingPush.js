const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const db = require('../db');
const { buildRealUserEmailFilterSql, getExcludedEmailDomains } = require('../utils/realUserFilter');

const ACTIVATION_THRESHOLD = 3;
const TARGET_ACTIVATION_PCT = 70;

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const round = (value, places = 1) => {
  const factor = 10 ** places;
  return Math.round((toNumber(value, 0) + Number.EPSILON) * factor) / factor;
};

const getOnboardingData = async () => {
  const realUserFilter = buildRealUserEmailFilterSql('u.email');
  const { rows } = await db.query(`
    WITH biom AS (
      SELECT user_id, COUNT(*)::int AS entries_28d
      FROM biometric_entries
      WHERE recorded_at >= NOW() - INTERVAL '28 days'
      GROUP BY user_id
    ),
    comp AS (
      SELECT user_id, COUNT(*)::int AS completions_28d
      FROM protocol_completions
      WHERE completed_at >= NOW() - INTERVAL '28 days'
      GROUP BY user_id
    ),
    prot AS (
      SELECT user_id, COUNT(*)::int AS protocols_28d
      FROM daily_protocols
      WHERE protocol_date >= CURRENT_DATE - INTERVAL '28 days'
      GROUP BY user_id
    )
    SELECT
      u.id,
      u.email,
      u.plan,
      u.created_at,
      COALESCE(b.entries_28d, 0) AS entries_28d,
      COALESCE(c.completions_28d, 0) AS completions_28d,
      COALESCE(p.protocols_28d, 0) AS protocols_28d
    FROM users u
    LEFT JOIN biom b ON b.user_id = u.id
    LEFT JOIN comp c ON c.user_id = u.id
    LEFT JOIN prot p ON p.user_id = u.id
    WHERE u.is_active = true
      AND (${realUserFilter})
    ORDER BY u.created_at ASC
  `);

  return rows.map((row) => {
    const entries = toNumber(row.entries_28d, 0);
    const completions = toNumber(row.completions_28d, 0);
    const protocols = toNumber(row.protocols_28d, 0);
    const activated = entries >= ACTIVATION_THRESHOLD;

    const actions = [];
    if (entries < ACTIVATION_THRESHOLD) {
      actions.push(`Import at least ${ACTIVATION_THRESHOLD - entries} more biometric readings.`);
    }
    if (protocols === 0) {
      actions.push('Generate first daily protocol.');
    }
    if (completions === 0) {
      actions.push('Complete at least one protocol action.');
    }

    return {
      userId: row.id,
      email: row.email,
      plan: String(row.plan || 'free').toLowerCase(),
      entries28d: entries,
      protocols28d: protocols,
      completions28d: completions,
      activated,
      priorityScore: (activated ? 0 : 40) + (entries === 0 ? 30 : 0) + (completions === 0 ? 20 : 0),
      recommendedActions: actions,
    };
  });
};

const buildOnboardingPushReport = (users = []) => {
  const totalActive = users.length;
  const activatedUsers = users.filter((item) => item.activated).length;
  const activationRatePct = totalActive > 0 ? round((activatedUsers / totalActive) * 100, 1) : 0;
  const targetActivated = Math.ceil((TARGET_ACTIVATION_PCT / 100) * totalActive);
  const usersNeeded = Math.max(0, targetActivated - activatedUsers);

  const candidates = users
    .filter((item) => !item.activated)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, Math.max(usersNeeded, 3));

  return {
    generatedAt: new Date().toISOString(),
    integrity: {
      excludedEmailDomains: getExcludedEmailDomains(),
      mode: 'real-user-only',
    },
    activationModel: {
      thresholdReadings28d: ACTIVATION_THRESHOLD,
      targetActivationPct: TARGET_ACTIVATION_PCT,
      totalActive,
      activatedUsers,
      activationRatePct,
      targetActivatedUsers: targetActivated,
      usersNeededForTarget: usersNeeded,
    },
    candidates,
  };
};

const writeReport = (report) => {
  const today = new Date().toISOString().slice(0, 10);
  const outputDir = path.resolve(__dirname, '..', '..', 'docs', 'reports');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.resolve(outputDir, `aevum-onboarding-push-${today}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return outputPath;
};

const run = async () => {
  const users = await getOnboardingData();
  const report = buildOnboardingPushReport(users);
  const outputPath = writeReport(report);
  console.log(`[onboarding] growth push report written: ${outputPath}`);
};

run()
  .catch((error) => {
    console.error('[onboarding] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.pool.end();
    } catch (error) {
      console.error('[onboarding] failed to close DB pool:', error.message);
    }
  });
