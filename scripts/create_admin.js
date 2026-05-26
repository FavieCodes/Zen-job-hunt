#!/usr/bin/env node
/**
 * scripts/create_admin.js
 *
 * Creates one or more admin accounts directly in the database.
 * Admins bypass the normal registration flow and are confirmed by default.
 *
 * Usage (single admin — interactive prompts):
 *   node scripts/create_admin.js
 *
 * Usage (non-interactive / CI):
 *   ADMIN_EMAIL=admin@example.com \
 *   ADMIN_USERNAME=admin \
 *   ADMIN_PASSWORD=SuperSecret123! \
 *   node scripts/create_admin.js
 *
 * Usage (bulk — JSON file):
 *   node scripts/create_admin.js --file admins.json
 *
 *   admins.json format:
 *   [
 *     { "email": "alice@example.com", "username": "alice", "password": "Secret1!" },
 *     { "email": "bob@example.com",   "username": "bob",   "password": "Secret2!" }
 *   ]
 */

require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// ── DB connection ─────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Helpers ───────────────────────────────────────────────────────────────────
function ask(rl, question, hidden = false) {
  return new Promise((resolve) => {
    if (hidden && process.stdout.isTTY) {
      // Hide password input on TTY
      process.stdout.write(question);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      let input = '';
      process.stdin.on('data', function handler(char) {
        char = char.toString();
        if (char === '\r' || char === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', handler);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(input);
        } else if (char === '\u0003') {
          process.exit();
        } else if (char === '\u007f') {
          input = input.slice(0, -1);
        } else {
          input += char;
        }
      });
    } else {
      rl.question(question, resolve);
    }
  });
}

function validatePassword(password) {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
}

async function createAdmin({ email, username, password }) {
  // Check for existing user
  const existing = await pool.query(
    'SELECT id, role FROM users WHERE email = $1 OR username = $2',
    [email, username]
  );

  if (existing.rows.length > 0) {
    const user = existing.rows[0];
    if (user.role === 'admin') {
      console.log(`  ⚠️  Skipped — admin already exists (email or username taken)`);
      return false;
    }
    // Upgrade existing user to admin
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', user.id]);
    console.log(`  ✅  Upgraded existing user to admin`);
    return true;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (email, username, password_hash, role, is_confirmed)
     VALUES ($1, $2, $3, 'admin', TRUE)`,
    [email, username, passwordHash]
  );
  console.log(`  ✅  Admin created successfully`);
  return true;
}

// ── Modes ─────────────────────────────────────────────────────────────────────
async function runInteractive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n── Create Admin Account ──────────────────────────────────────');

  const email    = await ask(rl, 'Email:    ');
  const username = await ask(rl, 'Username: ');
  const password = await ask(rl, 'Password: ', true);

  const pwError = validatePassword(password);
  if (pwError) {
    console.error(`\n❌  ${pwError}`);
    rl.close();
    await pool.end();
    process.exit(1);
  }

  console.log(`\nCreating admin "${username}" <${email}>...`);
  await createAdmin({ email, username, password });

  rl.close();
}

async function runEnvVars() {
  const { ADMIN_EMAIL: email, ADMIN_USERNAME: username, ADMIN_PASSWORD: password } = process.env;
  if (!email || !username || !password) {
    console.error('❌  ADMIN_EMAIL, ADMIN_USERNAME and ADMIN_PASSWORD must all be set');
    process.exit(1);
  }
  const pwError = validatePassword(password);
  if (pwError) { console.error(`❌  ${pwError}`); process.exit(1); }

  console.log(`Creating admin "${username}" <${email}>...`);
  await createAdmin({ email, username, password });
}

async function runFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`❌  File not found: ${resolved}`);
    process.exit(1);
  }
  const admins = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (!Array.isArray(admins) || admins.length === 0) {
    console.error('❌  JSON file must be a non-empty array of { email, username, password }');
    process.exit(1);
  }

  console.log(`\nCreating ${admins.length} admin(s) from ${path.basename(resolved)}...\n`);
  for (const admin of admins) {
    const { email, username, password } = admin;
    if (!email || !username || !password) {
      console.log(`  ⚠️  Skipping invalid entry:`, admin);
      continue;
    }
    const pwError = validatePassword(password);
    if (pwError) {
      console.log(`  ⚠️  Skipping ${email}: ${pwError}`);
      continue;
    }
    process.stdout.write(`  ${username} <${email}>: `);
    await createAdmin({ email, username, password });
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
(async () => {
  try {
    const args = process.argv.slice(2);
    const fileIdx = args.indexOf('--file');

    if (fileIdx !== -1) {
      await runFile(args[fileIdx + 1]);
    } else if (process.env.ADMIN_EMAIL) {
      await runEnvVars();
    } else {
      await runInteractive();
    }

    console.log('\nDone.\n');
  } catch (err) {
    console.error('\n❌  Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();