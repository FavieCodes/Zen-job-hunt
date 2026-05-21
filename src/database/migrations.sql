CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  username    TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  company     TEXT,
  description TEXT,
  country     TEXT,
  state       TEXT,
  city        TEXT,
  job_type    TEXT,
  salary      TEXT,
  source_url  TEXT UNIQUE,
  source_name TEXT,
  posted_at   TIMESTAMPTZ,
  scraped_at  TIMESTAMPTZ DEFAULT NOW(),
  is_active   BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS scholarships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  provider    TEXT,
  description TEXT,
  country     TEXT,
  field       TEXT,
  deadline    DATE,
  amount      TEXT,
  source_url  TEXT UNIQUE,
  posted_at   TIMESTAMPTZ,
  scraped_at  TIMESTAMPTZ DEFAULT NOW(),
  is_active   BOOLEAN DEFAULT TRUE
);


CREATE INDEX IF NOT EXISTS idx_jobs_country   ON jobs(country);
CREATE INDEX IF NOT EXISTS idx_jobs_state     ON jobs(state);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sch_country    ON scholarships(country);
CREATE INDEX IF NOT EXISTS idx_sch_deadline   ON scholarships(deadline);

-- Add confirmation and password reset tables and is_confirmed flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_confirmations_user ON confirmations(user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);