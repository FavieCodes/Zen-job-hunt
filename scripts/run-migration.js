const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  // Try multiple possible paths (for both local and Docker environments)
  const possiblePaths = [
    path.join(__dirname, '../src/database/migrations.sql'),  // Local development
    path.join(__dirname, '../migrations.sql'),               // Root directory
    '/usr/src/app/src/database/migrations.sql',              // Docker path with src
    '/usr/src/app/migrations.sql',                           // Docker path root
  ];
  
  let migrationPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      migrationPath = p;
      break;
    }
  }
  
  if (!migrationPath) {
    console.error('❌ Migration file not found. Tried:');
    possiblePaths.forEach(p => console.error(`   - ${p}`));
    process.exit(1);
  }
  
  try {
    console.log(`📁 Using migration file: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('📝 Running migrations...');
    await pool.query(sql);
    console.log('✅ Migrations completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();