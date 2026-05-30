CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT        UNIQUE NOT NULL,
  username       TEXT        UNIQUE NOT NULL,
  password_hash  TEXT        NOT NULL,
  is_confirmed   BOOLEAN     DEFAULT FALSE,
  role           TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  avatar         TEXT,                          
  is_google_user BOOLEAN     DEFAULT FALSE,   
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Jobs ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  company     TEXT,
  description TEXT,
  country     TEXT,
  state       TEXT,
  city        TEXT,
  job_type    TEXT,
  salary      TEXT,
  apply_url   TEXT,
  source_url  TEXT        UNIQUE,
  source_name TEXT,
  posted_at   TIMESTAMPTZ,
  scraped_at  TIMESTAMPTZ DEFAULT NOW(),
  is_active   BOOLEAN     DEFAULT TRUE
);

-- ── Scholarships ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scholarships (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  provider    TEXT,
  description TEXT,
  country     TEXT,
  field       TEXT,
  deadline    DATE,
  amount      TEXT,
  apply_url   TEXT,
  source_url  TEXT        UNIQUE,
  posted_at   TIMESTAMPTZ,
  scraped_at  TIMESTAMPTZ DEFAULT NOW(),
  is_active   BOOLEAN     DEFAULT TRUE
);

-- ── Email confirmations ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS confirmations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- ── Password resets ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- ── Token blacklist (revoked JWTs) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_blacklist (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT        UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Job applications ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_applications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
  job_id     UUID        REFERENCES jobs(id)  ON DELETE CASCADE,
  status     TEXT        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','reviewed','accepted','rejected')),
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, job_id)
);

-- ── Saved jobs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_jobs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
  job_id     UUID        REFERENCES jobs(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, job_id)
);

-- ── Interview prep ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interview_prep (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES users(id) ON DELETE CASCADE,
  job_role       TEXT        NOT NULL,
  interview_type TEXT        NOT NULL,
  questions      JSONB       NOT NULL DEFAULT '[]',
  videos         JSONB       NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Resume / CV ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resumes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL DEFAULT 'My Resume',
  full_name      TEXT        NOT NULL,
  email          TEXT        NOT NULL,
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
);

-- ═══════════════════════════════════════════════════════════════════════════
--  Indexes
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_users_role               ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email              ON users(email);
CREATE INDEX IF NOT EXISTS idx_jobs_country             ON jobs(country);
CREATE INDEX IF NOT EXISTS idx_jobs_state               ON jobs(state);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at           ON jobs(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active           ON jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_sch_country              ON scholarships(country);
CREATE INDEX IF NOT EXISTS idx_sch_deadline             ON scholarships(deadline);
CREATE INDEX IF NOT EXISTS idx_sch_is_active            ON scholarships(is_active);
CREATE INDEX IF NOT EXISTS idx_confirmations_user       ON confirmations(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_user     ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_token          ON token_blacklist(token);
CREATE INDEX IF NOT EXISTS idx_blacklist_expires        ON token_blacklist(expires_at);
CREATE INDEX IF NOT EXISTS idx_job_applications_user    ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job     ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status  ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_user          ON saved_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_job           ON saved_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_interview_prep_user      ON interview_prep(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user             ON resumes(user_id);