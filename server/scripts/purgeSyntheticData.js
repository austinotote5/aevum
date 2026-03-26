const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const db = require('../db');

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

const toBool = (value, defaultValue = false) => {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase());
};

const parseEmailList = (value) => {
  return Array.from(
    new Set(
      String(value || '')
        .split(',')
        .map((email) => String(email).trim().toLowerCase())
        .filter(Boolean)
    )
  );
};

const getSyntheticBiometricSummary = async () => {
  const { rows } = await db.query(`
    SELECT
      COUNT(*)::int AS entries,
      COUNT(DISTINCT user_id)::int AS users
    FROM biometric_entries
    WHERE source LIKE 'synthetic%'
  `);
  return {
    entries: Number(rows[0]?.entries || 0),
    users: Number(rows[0]?.users || 0),
  };
};

const getDemoUsers = async (demoEmails) => {
  if (!demoEmails.length) return [];
  const { rows } = await db.query(`
    SELECT id, email, first_name, last_name, plan, created_at
    FROM users
    WHERE LOWER(email) = ANY($1::text[])
    ORDER BY created_at ASC
  `, [demoEmails]);
  return rows;
};

const applyPurge = async ({ includeSyntheticBiometrics, includeDemoUsers, demoEmails }) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    let deletedSyntheticBiometricEntries = 0;
    if (includeSyntheticBiometrics) {
      const { rows } = await client.query(`
        WITH deleted AS (
          DELETE FROM biometric_entries
          WHERE source LIKE 'synthetic%'
          RETURNING id
        )
        SELECT COUNT(*)::int AS count
        FROM deleted
      `);
      deletedSyntheticBiometricEntries = Number(rows[0]?.count || 0);
    }

    let clearedAuditUserRefs = 0;
    let clearedAuditActorRefs = 0;
    let deletedDemoUsers = 0;
    if (includeDemoUsers && demoEmails.length) {
      const demoUsersResult = await client.query(`
        SELECT id
        FROM users
        WHERE LOWER(email) = ANY($1::text[])
      `, [demoEmails]);
      const demoUserIds = demoUsersResult.rows.map((row) => row.id).filter(Boolean);

      if (demoUserIds.length) {
        const clearUserRefs = await client.query(`
          WITH updated AS (
            UPDATE audit_log
            SET user_id = NULL
            WHERE user_id = ANY($1::uuid[])
            RETURNING id
          )
          SELECT COUNT(*)::int AS count
          FROM updated
        `, [demoUserIds]);
        clearedAuditUserRefs = Number(clearUserRefs.rows[0]?.count || 0);

        const clearActorRefs = await client.query(`
          WITH updated AS (
            UPDATE audit_log
            SET actor_id = NULL
            WHERE actor_id = ANY($1::uuid[])
            RETURNING id
          )
          SELECT COUNT(*)::int AS count
          FROM updated
        `, [demoUserIds]);
        clearedAuditActorRefs = Number(clearActorRefs.rows[0]?.count || 0);
      }

      const { rows } = await client.query(`
        WITH deleted AS (
          DELETE FROM users
          WHERE LOWER(email) = ANY($1::text[])
          RETURNING id
        )
        SELECT COUNT(*)::int AS count
        FROM deleted
      `, [demoEmails]);
      deletedDemoUsers = Number(rows[0]?.count || 0);
    }

    await client.query('COMMIT');
    return {
      deletedSyntheticBiometricEntries,
      clearedAuditUserRefs,
      clearedAuditActorRefs,
      deletedDemoUsers,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  const apply = toBool(args.apply, false);
  const includeSyntheticBiometrics = toBool(args['include-synthetic-biometrics'], true);
  const includeDemoUsers = toBool(args['include-demo-users'], true);
  const demoEmails = parseEmailList(args['demo-emails'] || process.env.DEMO_EMAIL || 'demo@aevum.app');

  const [syntheticSummary, demoUsers] = await Promise.all([
    getSyntheticBiometricSummary(),
    getDemoUsers(demoEmails),
  ]);

  if (!apply) {
    console.log(`[purge] dry-run only. Re-run with --apply true to execute. ${JSON.stringify({
      mode: 'dry-run',
      includeSyntheticBiometrics,
      includeDemoUsers,
      demoEmails,
      syntheticBiometricEntriesFound: syntheticSummary.entries,
      syntheticBiometricUsersFound: syntheticSummary.users,
      demoUsersFound: demoUsers.length,
      demoUserEmailsFound: demoUsers.map((user) => user.email),
    })}`);
    return;
  }

  const result = await applyPurge({
    includeSyntheticBiometrics,
    includeDemoUsers,
    demoEmails,
  });

  console.log(`[purge] completed. ${JSON.stringify({
    mode: 'apply',
    includeSyntheticBiometrics,
    includeDemoUsers,
    demoEmails,
    ...result,
  })}`);
};

run()
  .catch((error) => {
    console.error('[purge] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.pool.end();
    } catch (error) {
      console.error('[purge] failed to close DB pool:', error.message);
    }
  });
