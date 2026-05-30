const { Pool } = require('pg');
const { databaseUrl } = require('./env');

let logger;
try {
  logger = require('../common/logger');
} catch {
  logger = {
    error: (...a) => console.error('[db]', ...a),
    warn:  (...a) => console.warn('[db]',  ...a),
    info:  (...a) => console.log('[db]',   ...a),
  };
}

if (!databaseUrl) {
  const msg = process.env.VERCEL === '1'
    ? 'DATABASE_URL not configured — add it in Vercel → Settings → Environment Variables'
    : 'DATABASE_URL is not set. Check your .env file.';
  logger.error('[db] ' + msg);
  throw new Error(msg);
}

const isServerless = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_RUNTIME_API;

const pool = new Pool({
  connectionString: databaseUrl,
  max:                      isServerless ? 1  : 10,
  idleTimeoutMillis:        isServerless ? 10_000 : 30_000,
  connectionTimeoutMillis:  isServerless ? 3_000  : 5_000,
  ...(isServerless && { statement_timeout: 15_000 }),
});

pool.on('error', (err) => logger.error('[db] Unexpected pool error: ' + err.message));

// Safe startup migrations.
 
async function runMigrations(client) {
  const steps = [
    // ── Users: add missing columns ──────────────────────────────────────────
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_google_user BOOLEAN DEFAULT FALSE`,

    // ── Job applications ─────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS job_applications (
       id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
       job_id     UUID        REFERENCES jobs(id)  ON DELETE CASCADE,
       status     TEXT        NOT NULL DEFAULT 'pending',
       notes      TEXT,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       updated_at TIMESTAMPTZ DEFAULT NOW(),
       UNIQUE (user_id, job_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_job_applications_user   ON job_applications(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_job_applications_job    ON job_applications(job_id)`,
    `CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status)`,

    // ── Saved jobs ────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS saved_jobs (
       id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
       job_id     UUID        REFERENCES jobs(id)  ON DELETE CASCADE,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       UNIQUE (user_id, job_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_saved_jobs_user ON saved_jobs(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_saved_jobs_job  ON saved_jobs(job_id)`,

    // ── Interview prep ────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS interview_prep (
       id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id        UUID        REFERENCES users(id) ON DELETE CASCADE,
       job_role       TEXT        NOT NULL,
       interview_type TEXT        NOT NULL,
       questions      JSONB       NOT NULL DEFAULT '[]',
       videos         JSONB       NOT NULL DEFAULT '[]',
       created_at     TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_interview_prep_user ON interview_prep(user_id)`,

    // ── Resumes ───────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS resumes (
       id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id        UUID        REFERENCES users(id) ON DELETE CASCADE,
       title          TEXT        NOT NULL DEFAULT 'My Resume',
       full_name      TEXT        NOT NULL DEFAULT '',
       email          TEXT        NOT NULL DEFAULT '',
       phone          TEXT,
       location       TEXT,
       linkedin       TEXT,
       website        TEXT,
       summary        TEXT,
       experience     JSONB       NOT NULL DEFAULT '[]',
       education      JSONB       NOT NULL DEFAULT '[]',
       skills         JSONB       NOT NULL DEFAULT '[]',
       certifications JSONB       NOT NULL DEFAULT '[]',
       languages      JSONB       NOT NULL DEFAULT '[]',
       generated_html TEXT,
       created_at     TIMESTAMPTZ DEFAULT NOW(),
       updated_at     TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id)`,
  ];

  for (const sql of steps) {
    try {
      await client.query(sql);
    } catch (err) {
      logger.warn('[db] Migration step skipped: ' + err.message.split('\n')[0]);
    }
  }
}

// ── Query wrapper ────────────────────
let migrationsRan = false;
const _query = pool.query.bind(pool);

pool.query = async function (...args) {
  if (!migrationsRan) {
    migrationsRan = true;
    const client = await pool.connect();
    try {
      await runMigrations(client);
      logger.info('[db] Startup migrations complete');
    } catch (err) {
      logger.error('[db] Startup migration error: ' + err.message);
    } finally {
      client.release();
    }
  }
  return _query(...args);
};

if (!isServerless) {
  pool.connect()
    .then(async (client) => {
      logger.info('[db] PostgreSQL connected successfully');
      await runMigrations(client);
      logger.info('[db] Startup migrations complete');
      client.release();
    })
    .catch((err) => {
      logger.error('[db] Initial connection failed: ' + err.message);
    });
} else {
  logger.info('[db] Serverless mode — connections established per request');
}

module.exports = pool;