const { Pool } = require('pg');

const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase());
};

const normalizeEnv = (value, fallback = '') => {
  if (value === undefined || value === null) return fallback;
  const trimmed = String(value).trim();
  if (!trimmed) return fallback;

  // Handles values copied with wrapping quotes in dashboard UIs.
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
};

const getSslConfig = () => {
  const isProduction = (process.env.NODE_ENV || 'development') === 'production';
  if (!isProduction) {
    return false;
  }

  // Some managed Postgres providers (for example, poolers) require SSL but present
  // a cert chain that fails strict verification from hosted runtimes.
  const rejectUnauthorized = parseBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, true);
  return { rejectUnauthorized };
};

const buildPoolConfig = () => {
  const connectionString = normalizeEnv(process.env.DATABASE_URL, '');

  if (connectionString) {
    return {
      connectionString,
      ssl: getSslConfig(),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
  }

  return {
    host: normalizeEnv(process.env.DB_HOST, 'localhost'),
    port: Number(normalizeEnv(process.env.DB_PORT, '5432')),
    database: normalizeEnv(process.env.DB_NAME, 'aevum'),
    user: normalizeEnv(process.env.DB_USER, 'postgres'),
    password: normalizeEnv(process.env.DB_PASSWORD, ''),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: getSslConfig(),
  };
};

// Pool maintains a set of reusable database connections.
// Creating a new connection per request is expensive (~50ms each).
// A pool keeps connections alive and hands them out on demand —
// dramatically faster under any real user load.
const pool = new Pool(buildPoolConfig());

// Test the connection on startup — fail loudly rather than silently
pool.connect((err, client, release) => {
  if (err) {
    console.error('[DB] Connection failed:', err.message);
    console.error('[DB] Check your .env database credentials.');
    return;
  }
  release();
  console.log('[DB] PostgreSQL connected successfully.');
});

// Expose a clean query interface used by all route handlers
// Usage in routes: const { rows } = await db.query('SELECT ...', [params])
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
