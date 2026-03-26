const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const db = require('../db');
const { isRealUserEmail } = require('../utils/realUserFilter');

const PLAN_PRICE = {
  free: 0,
  premium: 29,
  enterprise: 99,
};

const parseArgs = (argv = []) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.replace(/^--/, '');
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    args[key] = value;
    if (value !== true) {
      i += 1;
    }
  }
  return args;
};

const toBool = (value, defaultValue = false) => {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase());
};

const normalizePlan = (value) => {
  const plan = String(value || '').toLowerCase();
  if (plan === 'premium' || plan === 'enterprise' || plan === 'free') {
    return plan;
  }
  return null;
};

const selectUser = async ({ email, userId }) => {
  if (email) {
    const { rows } = await db.query(`
      SELECT id, email, plan
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `, [String(email).trim()]);
    return rows[0] || null;
  }

  if (userId) {
    const { rows } = await db.query(`
      SELECT id, email, plan
      FROM users
      WHERE id = $1
      LIMIT 1
    `, [userId]);
    return rows[0] || null;
  }

  throw new Error('Provide --email or --userId for a real user conversion target.');
};

const convertPlan = async ({ user, targetPlan, reason }) => {
  const fromPlan = String(user.plan || 'free').toLowerCase();
  if (fromPlan === targetPlan) {
    return {
      changed: false,
      fromPlan,
      toPlan: targetPlan,
      deltaMrr: 0,
      reason,
    };
  }

  const deltaMrr = (PLAN_PRICE[targetPlan] || 0) - (PLAN_PRICE[fromPlan] || 0);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      UPDATE users
      SET plan = $2, updated_at = NOW()
      WHERE id = $1
    `, [user.id, targetPlan]);
    await client.query(`
      INSERT INTO billing_plan_events (user_id, from_plan, to_plan, delta_mrr, changed_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [user.id, fromPlan, targetPlan, deltaMrr]);
    await client.query(`
      INSERT INTO audit_log (
        user_id,
        actor_id,
        action,
        resource,
        resource_id,
        ip_address,
        user_agent
      )
      VALUES ($1, NULL, 'billing.plan.converted', 'billing_plan_events', NULL, NULL, $2)
    `, [user.id, `script:convertUserToPaid reason="${String(reason || '').trim()}"`]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    changed: true,
    fromPlan,
    toPlan: targetPlan,
    deltaMrr,
  };
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  const targetPlan = normalizePlan(args.plan || 'premium');
  const apply = toBool(args.apply, false);
  const reason = String(args.reason || '').trim();
  if (!targetPlan || targetPlan === 'free') {
    throw new Error('Use --plan premium or --plan enterprise.');
  }
  if (!args.email && !args.userId) {
    throw new Error('Missing target user. Provide --email <user@email> or --userId <uuid>.');
  }
  if (apply && reason.length < 8) {
    throw new Error('Provide --reason with at least 8 characters for apply mode.');
  }

  const user = await selectUser({
    email: args.email,
    userId: args.userId,
  });

  if (!user) {
    throw new Error('No eligible user found for conversion.');
  }
  if (!isRealUserEmail(user.email)) {
    throw new Error('Refusing conversion for demo/test email. Use a real customer account.');
  }

  if (!apply) {
    const fromPlan = String(user.plan || 'free').toLowerCase();
    const projectedDeltaMrr = (PLAN_PRICE[targetPlan] || 0) - (PLAN_PRICE[fromPlan] || 0);
    console.log(`[paid] dry-run only. Re-run with --apply true to execute. ${JSON.stringify({
      mode: 'dry-run',
      userId: user.id,
      email: user.email,
      fromPlan,
      toPlan: targetPlan,
      projectedDeltaMrr,
      reason: reason || null,
    })}`);
    return;
  }

  const result = await convertPlan({ user, targetPlan, reason });
  const payload = {
    convertedAt: new Date().toISOString(),
    mode: 'apply',
    userId: user.id,
    email: user.email,
    reason,
    ...result,
  };
  console.log(`[paid] conversion result: ${JSON.stringify(payload)}`);
};

run()
  .catch((error) => {
    console.error('[paid] conversion failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.pool.end();
    } catch (error) {
      console.error('[paid] failed to close DB pool:', error.message);
    }
  });
