const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  // Check if we're on Vercel
  const isVercel = process.env.VERCEL === '1';
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Skipping migrations.');
    if (isVercel) {
      console.log('⚠️  Running on Vercel but DATABASE_URL not found. Make sure it\'s set in environment variables.');
    }
    return;
  }

  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: isVercel ? { rejectUnauthorized: false } : false
  });
  
  // Migration SQL paths
  const possiblePaths = [
    path.join(__dirname, '../src/database/migrations.sql'),
    path.join(__dirname, '../src/database/add_user_tables.sql'),
    path.join(__dirname, '../migrations.sql'),
  ];
  
  let migrationPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      migrationPath = p;
      break;
    }
  }
  
  if (!migrationPath) {
    console.error('❌ Migration file not found. Tried:', possiblePaths);
    process.exit(1);
  }
  
  try {
    console.log(`📁 Using migration file: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    console.log(`📝 Running ${statements.length} migration statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (stmt && !stmt.startsWith('--')) {
        try {
          await pool.query(stmt);
          console.log(`✅ Executed statement ${i + 1}/${statements.length}`);
        } catch (err) {
          // Ignore "already exists" errors
          if (!err.message.includes('already exists') && 
              !err.message.includes('already defined') &&
              !err.message.includes('duplicate')) {
            console.warn(`⚠️  Statement ${i + 1} warning: ${err.message}`);
          }
        }
      }
    }
    
    console.log('✅ Migrations completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (!isVercel) process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;