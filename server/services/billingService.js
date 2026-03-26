const db = require('../db');
const ApiError = require('../utils/apiError');
const { findUserById, updateUserPlan, mapUser } = require('./userService');
const {
  normalizePlan,
  getEntitlementsForPlan,
  PLAN_RANK,
} = require('./entitlementService');

let billingSchemaEnsured = false;

const ensureBillingSchema = async () => {
  if (billingSchemaEnsured) {
    return;
  }

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
    CREATE INDEX IF NOT EXISTS idx_billing_plan_events_user_changed
      ON billing_plan_events(user_id, changed_at DESC)
  `);

  billingSchemaEnsured = true;
};

const getImportsUsedToday = async (userId) => {
  await ensureBillingSchema();
  const { rows } = await db.query(`
    SELECT imports_count
    FROM wearable_import_usage
    WHERE user_id = $1
      AND usage_date = CURRENT_DATE
    LIMIT 1
  `, [userId]);

  return Number(rows[0]?.imports_count || 0);
};

const getBillingOverview = async (userId, tokenPlan) => {
  const user = await findUserById(userId);
  if (!user) {
    throw ApiError.notFound('User not found.');
  }

  const effectivePlan = normalizePlan(user.plan || tokenPlan || 'free');
  const entitlements = getEntitlementsForPlan(effectivePlan);
  const importsUsedToday = await getImportsUsedToday(userId);

  return {
    user: mapUser(user),
    plan: effectivePlan,
    entitlements,
    usage: {
      importsUsedToday,
      importsRemainingToday: Math.max(0, entitlements.wearableImportsPerDay - importsUsedToday),
      wearableImportsPerDay: entitlements.wearableImportsPerDay,
    },
  };
};

const changePlan = async (userId, targetPlan) => {
  await ensureBillingSchema();
  const normalizedTarget = normalizePlan(targetPlan);
  if (PLAN_RANK[normalizedTarget] === undefined) {
    throw ApiError.badRequest('targetPlan must be one of: free, premium, enterprise.');
  }

  const existingUser = await findUserById(userId);
  if (!existingUser) {
    throw ApiError.notFound('User not found.');
  }

  const currentPlan = normalizePlan(existingUser.plan || 'free');
  if (currentPlan === normalizedTarget) {
    return mapUser(existingUser);
  }

  const updated = await updateUserPlan(userId, normalizedTarget);
  if (!updated) {
    throw ApiError.notFound('User not found.');
  }

  const planMrr = {
    free: 0,
    premium: 29,
    enterprise: 99,
  };
  const deltaMrr = (planMrr[normalizedTarget] ?? 0) - (planMrr[currentPlan] ?? 0);

  await db.query(`
    INSERT INTO billing_plan_events (
      user_id,
      from_plan,
      to_plan,
      delta_mrr
    )
    VALUES ($1, $2, $3, $4)
  `, [userId, currentPlan, normalizedTarget, deltaMrr]);

  return mapUser(updated);
};

module.exports = {
  getBillingOverview,
  changePlan,
};
