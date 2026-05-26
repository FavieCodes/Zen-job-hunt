#!/usr/bin/env node
/**
 * scripts/reset_db.js
 *
 * Drops ALL tables and recreates them from migrations.sql
 *
 * Local:  node scripts/reset_db.js
 * Docker: docker-compose exec app node scripts/reset_db.js
 *
 * !! ALL DATA WILL BE PERMANENTLY DELETED !!
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function confirm() {
  if (process.env.FORCE_RESET === 'true' || !process.stdin.isTTY) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(
      '\n⚠️  This will DELETE ALL DATA and recreate tables. Type "yes" to continue: ',
      (answer) => { rl.close(); resolve(answer.trim().toLowerCase() === 'yes'); }
    );
  });
}

(async () => {
  try {
    const ok = await confirm();
    if (!ok) { console.log('Aborted.'); process.exit(0); }

    console.log('\n🗑️  Dropping all tables...');
    await pool.query(`
      DROP TABLE IF EXISTS token_blacklist  CASCADE;
      DROP TABLE IF EXISTS password_resets  CASCADE;
      DROP TABLE IF EXISTS confirmations    CASCADE;
      DROP TABLE IF EXISTS scholarships     CASCADE;
      DROP TABLE IF EXISTS jobs             CASCADE;
      DROP TABLE IF EXISTS users            CASCADE;
    `);
    console.log('✅  All tables dropped.');

    console.log('\n📋  Running migrations...');
    const migrationPath = path.join(__dirname, '..', 'src', 'database', 'migrations.sql');
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`migrations.sql not found at: ${migrationPath}`);
    }
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log('✅  Migrations complete.');

    console.log('\n✨  Database reset successfully.\n');
  } catch (err) {
    console.error('\n❌  Reset failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();