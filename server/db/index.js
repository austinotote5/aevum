const { Pool } = require('pg');

// Pool maintains a set of reusable database connections.
// Creating a new connection per request is expensive (~50ms each).
// A pool keeps connections alive and hands them out on demand —
// dramatically faster under any real user load.
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'aevum',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
  max:      20,   // maximum simultaneous connections in the pool
  idleTimeoutMillis:    30000, // close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // fail fast if DB is unreachable (2 seconds)
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }  // enforce SSL certificate in production
    : false,                        // no SSL needed locally
});

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