-- !! DESTRUCTIVE — drops everything and recreates from scratch !!
-- Run with: psql $DATABASE_URL -f scripts/reset_db.sql

-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS token_blacklist  CASCADE;
DROP TABLE IF EXISTS password_resets  CASCADE;
DROP TABLE IF EXISTS confirmations    CASCADE;
DROP TABLE IF EXISTS scholarships     CASCADE;
DROP TABLE IF EXISTS jobs             CASCADE;
DROP TABLE IF EXISTS users            CASCADE;

-- Re-run migrations inline (same as migrations.sql)
\i src/database/migrations.sql