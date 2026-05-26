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
  const isVercel = process.env.VERCEL === '1';
  if (isVercel) {
    logger.error('[db] DATABASE_URL is not set in Vercel environment variables!');
    logger.error('[db] Please add DATABASE_URL in your Vercel project settings → Environment Variables');
    throw new Error('DATABASE_URL not configured on Vercel');
  } else {
    throw new Error('[db] DATABASE_URL is not set. Check your .env / Docker environment.');
  }
}

const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_RUNTIME_API;

const pool = new Pool({
  connectionString: databaseUrl,
  // For serverless, use smaller pool and shorter timeouts
  max: isServerless ? 1 : 10,  
  idleTimeoutMillis: isServerless ? 10_000 : 30_000,
  connectionTimeoutMillis: isServerless ? 3_000 : 5_000,
  // For serverless, add pgBouncer mode if supported
  ...(isServerless && { statement_timeout: 10000 }), 
});

pool.on('error', (err) => {
  logger.error('[db] Unexpected pool error: ' + err.message);
});

if (!isServerless) {
  pool.connect()
    .then((client) => {
      logger.info('[db] PostgreSQL connected successfully');
      client.release();
    })
    .catch((err) => {
      logger.error(
        '[db] Could not establish initial DB connection: ' + err.message +
        '\n  → Check that DATABASE_URL is correct and the DB container is healthy.' +
        '\n  → In Docker Compose the host should be the service name, e.g. "postgres", not "localhost".'
      );
    });
} else {
  logger.info('[db] Running in serverless mode - connections will be established per request');
}

module.exports = pool;