const { Pool } = require('pg');
const { databaseUrl } = require('./env');


let logger;
try {
  logger = require('../common/logger');
} catch {
  logger = {
    error: (...args) => console.error('[db]', ...args),
    warn:  (...args) => console.warn('[db]',  ...args),
    info:  (...args) => console.log('[db]',   ...args),
  };
}

if (!databaseUrl) {
  // Crash early with a clear message rather than a cryptic ECONNREFUSED later
  throw new Error('[db] DATABASE_URL is not set. Check your .env / Docker environment.');
}

const pool = new Pool({
  connectionString: databaseUrl,
  // Sensible defaults — tune if you have many concurrent scrapers
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000, // surface "can't connect" errors faster
});

pool.on('error', (err) => {
  logger.error('[db] Unexpected pool error: ' + err.message);
});

// ── Startup connectivity check ────────────────────────────────────────────────
// Runs once when the module first loads. Prints a clear error if the DB
// is unreachable (e.g. wrong Docker service name in DATABASE_URL).
pool.connect()
  .then((client) => {
    logger.info('[db] PostgreSQL connected successfully');
    client.release();
  })
  .catch((err) => {
    // Don't crash the process — let individual queries surface errors naturally.
    // But DO print the full message so you can debug Docker networking issues.
    logger.error(
      '[db] Could not establish initial DB connection: ' + err.message +
      '\n  → Check that DATABASE_URL is correct and the DB container is healthy.' +
      '\n  → In Docker Compose the host should be the service name, e.g. "postgres", not "localhost".'
    );
  });

module.exports = pool;