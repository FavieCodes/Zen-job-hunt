#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Accept self-signed certs from Neon / Supabase / Railway
  ssl: { rejectUnauthorized: false },
});

async function confirm() {
  if (process.env.FORCE_RESET === 'true' || !process.stdin.isTTY) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(
      '\n⚠️  This will DELETE ALL DATA and recreate all tables.\n   Type "yes" to continue: ',
      (answer) => { rl.close(); resolve(answer.trim().toLowerCase() === 'yes'); }
    );
  });
}

(async () => {
  const client = await pool.connect();
  try {
    const ok = await confirm();
    if (!ok) { console.log('Aborted.'); process.exit(0); }

    console.log('\n🗑️  Dropping all application tables (CASCADE)…');
    await client.query(`
      DROP TABLE IF EXISTS resumes              CASCADE;
      DROP TABLE IF EXISTS interview_prep       CASCADE;
      DROP TABLE IF EXISTS saved_jobs           CASCADE;
      DROP TABLE IF EXISTS job_applications     CASCADE;
      DROP TABLE IF EXISTS token_blacklist      CASCADE;
      DROP TABLE IF EXISTS password_resets      CASCADE;
      DROP TABLE IF EXISTS confirmations        CASCADE;
      DROP TABLE IF EXISTS scholarships         CASCADE;
      DROP TABLE IF EXISTS jobs                 CASCADE;
      DROP TABLE IF EXISTS users                CASCADE;
    `);
    console.log('✅  All tables dropped.');

    const migrationPath = path.join(__dirname, '..', 'src', 'database', 'migrations.sql');
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`migrations.sql not found at: ${migrationPath}`);
    }

    console.log('\n📋  Running migrations from:', migrationPath);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('✅  Migrations complete.');

    console.log('\n✨  Database reset successfully.\n');
  } catch (err) {
    console.error('\n❌  Reset failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();