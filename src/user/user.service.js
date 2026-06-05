const db     = require('../config/db');
const logger = require('../common/logger');

// ── Profile ───────────────────────────────────────────────────────────────────

async function getUserProfile(userId) {
  const result = await db.query(
    `SELECT id, email, username, created_at, avatar, is_confirmed, role,
            COALESCE(is_google_user, FALSE) AS is_google_user
     FROM users WHERE id = $1`,
    [userId]
  );
  if (result.rows.length === 0) {
    const err = new Error('User not found'); err.status = 404; throw err;
  }
  return result.rows[0];
}

async function updateUserProfile(userId, updates) {
  if (updates.avatar && updates.avatar.length > 8 * 1024 * 1024) {
    const err = new Error('Avatar image is too large. Maximum allowed size is 5 MB.');
    err.status = 400; throw err;
  }
  const allowed = ['username', 'avatar'];
  const fields  = [];
  const values  = [];
  let   i       = 1;
  for (const field of allowed) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = $${i++}`);
      values.push(updates[field]);
    }
  }
  if (fields.length === 0) {
    const err = new Error('No valid fields to update'); err.status = 400; throw err;
  }
  values.push(userId);
  const result = await db.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}
     RETURNING id, email, username, avatar, created_at,
               COALESCE(is_google_user, FALSE) AS is_google_user`,
    values
  );
  if (result.rows.length === 0) {
    const err = new Error('User not found'); err.status = 404; throw err;
  }
  return result.rows[0];
}

// ── Ensure extended applications table ────────────────────────────────────────

async function ensureApplicationsTable() {
  // Create table if it doesn't exist (full schema)
  await db.query(`
    CREATE TABLE IF NOT EXISTS job_applications (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
      job_id           UUID REFERENCES jobs(id)  ON DELETE SET NULL,
      scholarship_id   UUID,
      application_type TEXT    NOT NULL DEFAULT 'job',
      status           TEXT    NOT NULL DEFAULT 'pending',
      -- manual application fields
      manual_title     TEXT,
      manual_company   TEXT,
      manual_location  TEXT,
      manual_job_type  TEXT,
      manual_apply_url TEXT,
      manual_notes     TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Add columns that may be missing in older tables (safe to run repeatedly)
  const alterColumns = [
    `ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS scholarship_id UUID`,
    `ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS application_type TEXT NOT NULL DEFAULT 'job'`,
    `ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS manual_title     TEXT`,
    `ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS manual_company   TEXT`,
    `ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS manual_location  TEXT`,
    `ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS manual_job_type  TEXT`,
    `ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS manual_apply_url TEXT`,
    `ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS manual_notes     TEXT`,
    `ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW()`,
  ];
  for (const sql of alterColumns) {
    await db.query(sql).catch(() => {});
  }
}

// ── Applications ──────────────────────────────────────────────────────────────

async function getUserApplications(userId) {
  await ensureApplicationsTable();
  try {
    const result = await db.query(
      `SELECT
         a.id,
         a.job_id,
         a.scholarship_id,
         a.application_type,
         a.status,
         a.manual_title,
         a.manual_company,
         a.manual_location,
         a.manual_job_type,
         a.manual_apply_url,
         a.manual_notes,
         a.created_at,
         a.updated_at,
         -- job fields
         j.title        AS job_title,
         j.company      AS job_company,
         j.country      AS job_country,
         j.state        AS job_state,
         j.city         AS job_city,
         j.job_type     AS job_job_type,
         j.salary       AS job_salary,
         j.apply_url    AS job_apply_url,
         j.posted_at    AS job_posted_at,
         -- scholarship fields
         s.title        AS sch_title,
         s.provider     AS sch_provider,
         s.country      AS sch_country,
         s.deadline     AS sch_deadline,
         s.amount       AS sch_amount,
         s.apply_url    AS sch_apply_url
       FROM job_applications a
       LEFT JOIN jobs         j ON a.job_id         = j.id
       LEFT JOIN scholarships s ON a.scholarship_id  = s.id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC`,
      [userId]
    );

    // Normalise into a flat shape the frontend can consume easily
    return result.rows.map((r) => ({
      id:               r.id,
      job_id:           r.job_id,
      scholarship_id:   r.scholarship_id,
      application_type: r.application_type || 'job',
      status:           r.status,
      created_at:       r.created_at,
      updated_at:       r.updated_at,
      // resolved display fields
      title:    r.manual_title   || r.job_title  || r.sch_title   || 'Unknown',
      company:  r.manual_company || r.job_company || r.sch_provider || '',
      location: r.manual_location|| r.job_city   || r.job_state   || r.job_country || r.sch_country || '',
      job_type: r.manual_job_type|| r.job_job_type || '',
      salary:   r.job_salary     || '',
      apply_url: r.manual_apply_url || r.job_apply_url || r.sch_apply_url || '',
      deadline: r.sch_deadline   || null,
      amount:   r.sch_amount     || null,
      notes:    r.manual_notes   || null,
    }));
  } catch (err) {
    if (err.code === '42P01') return [];
    throw err;
  }
}

async function applyForJob(userId, jobId) {
  await ensureApplicationsTable();
  const jobCheck = await db.query(
    'SELECT id FROM jobs WHERE id = $1 AND is_active = true', [jobId]
  );
  if (jobCheck.rows.length === 0) {
    const err = new Error('Job not found or no longer active'); err.status = 404; throw err;
  }
  const existing = await db.query(
    'SELECT id FROM job_applications WHERE user_id = $1 AND job_id = $2', [userId, jobId]
  );
  if (existing.rows.length > 0) {
    const err = new Error('Already applied for this job'); err.status = 400; throw err;
  }
  const result = await db.query(
    `INSERT INTO job_applications (user_id, job_id, application_type, status, created_at, updated_at)
     VALUES ($1, $2, 'job', 'pending', NOW(), NOW()) RETURNING *`,
    [userId, jobId]
  );
  logger.info(`User ${userId} applied for job ${jobId}`);
  return result.rows[0];
}

async function applyForScholarship(userId, scholarshipId) {
  await ensureApplicationsTable();
  const check = await db.query('SELECT id FROM scholarships WHERE id = $1', [scholarshipId]);
  if (check.rows.length === 0) {
    const err = new Error('Scholarship not found'); err.status = 404; throw err;
  }
  const existing = await db.query(
    'SELECT id FROM job_applications WHERE user_id = $1 AND scholarship_id = $2',
    [userId, scholarshipId]
  );
  if (existing.rows.length > 0) {
    const err = new Error('Already applied for this scholarship'); err.status = 400; throw err;
  }
  const result = await db.query(
    `INSERT INTO job_applications
       (user_id, scholarship_id, application_type, status, created_at, updated_at)
     VALUES ($1, $2, 'scholarship', 'pending', NOW(), NOW()) RETURNING *`,
    [userId, scholarshipId]
  );
  logger.info(`User ${userId} applied for scholarship ${scholarshipId}`);
  return result.rows[0];
}

async function addManualApplication(userId, payload) {
  await ensureApplicationsTable();
  const { title, company, apply_url, location, job_type, notes } = payload;
  if (!title || !title.trim()) {
    const err = new Error('title is required'); err.status = 400; throw err;
  }
  const result = await db.query(
    `INSERT INTO job_applications
       (user_id, application_type, status,
        manual_title, manual_company, manual_apply_url,
        manual_location, manual_job_type, manual_notes,
        created_at, updated_at)
     VALUES ($1, 'manual', 'pending', $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING *`,
    [userId, title.trim(), company || '', apply_url || '', location || '', job_type || '', notes || '']
  );
  logger.info(`User ${userId} added manual application: ${title}`);
  return result.rows[0];
}

async function updateApplicationStatus(userId, applicationId, status) {
  await ensureApplicationsTable();
  const allowed = ['pending', 'reviewed', 'accepted', 'rejected', 'withdrawn'];
  if (!allowed.includes(status)) {
    const err = new Error(`Invalid status. Must be one of: ${allowed.join(', ')}`);
    err.status = 400; throw err;
  }
  const result = await db.query(
    `UPDATE job_applications
        SET status = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING *`,
    [status, applicationId, userId]
  );
  if (result.rows.length === 0) {
    const err = new Error('Application not found'); err.status = 404; throw err;
  }
  return result.rows[0];
}

// ── Saved Jobs ────────────────────────────────────────────────────────────────

async function getSavedJobs(userId) {
  try {
    const result = await db.query(
      `SELECT j.id, j.title, j.company, j.country, j.state, j.city,
              j.job_type, j.salary, j.apply_url, j.description, j.posted_at,
              sj.created_at AS saved_at, 'job' AS item_type
         FROM saved_jobs sj
         JOIN jobs j ON sj.job_id = j.id
        WHERE sj.user_id = $1
        ORDER BY sj.created_at DESC`,
      [userId]
    );
    return result.rows;
  } catch (err) {
    if (err.code === '42P01') return [];
    throw err;
  }
}

async function saveJob(userId, jobId) {
  const jobCheck = await db.query('SELECT id FROM jobs WHERE id = $1', [jobId]);
  if (jobCheck.rows.length === 0) {
    const err = new Error('Job not found'); err.status = 404; throw err;
  }
  const result = await db.query(
    `INSERT INTO saved_jobs (user_id, job_id, created_at) VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, job_id) DO NOTHING RETURNING *`,
    [userId, jobId]
  );
  return result.rows[0] || { message: 'Job already saved' };
}

async function removeSavedJob(userId, jobId) {
  const result = await db.query(
    'DELETE FROM saved_jobs WHERE user_id = $1 AND job_id = $2 RETURNING id',
    [userId, jobId]
  );
  if (result.rows.length === 0) {
    const err = new Error('Saved job not found'); err.status = 404; throw err;
  }
  return { message: 'Job removed from saved' };
}

// ── Saved Scholarships ────────────────────────────────────────────────────────

async function ensureSavedScholarshipsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS saved_scholarships (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID REFERENCES users(id)        ON DELETE CASCADE,
      scholarship_id  UUID REFERENCES scholarships(id) ON DELETE CASCADE,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, scholarship_id)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_saved_sch_user ON saved_scholarships(user_id);
  `).catch(() => {});
}

async function getSavedScholarships(userId) {
  await ensureSavedScholarshipsTable();
  try {
    const result = await db.query(
      `SELECT s.id, s.title, s.provider, s.country, s.field,
              s.deadline, s.amount, s.apply_url, s.description, s.posted_at,
              ss.created_at AS saved_at, 'scholarship' AS item_type
         FROM saved_scholarships ss
         JOIN scholarships s ON ss.scholarship_id = s.id
        WHERE ss.user_id = $1
        ORDER BY ss.created_at DESC`,
      [userId]
    );
    return result.rows;
  } catch (err) {
    if (err.code === '42P01') return [];
    throw err;
  }
}

async function saveScholarship(userId, scholarshipId) {
  await ensureSavedScholarshipsTable();
  const check = await db.query('SELECT id FROM scholarships WHERE id = $1', [scholarshipId]);
  if (check.rows.length === 0) {
    const err = new Error('Scholarship not found'); err.status = 404; throw err;
  }
  const result = await db.query(
    `INSERT INTO saved_scholarships (user_id, scholarship_id, created_at) VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, scholarship_id) DO NOTHING RETURNING *`,
    [userId, scholarshipId]
  );
  return result.rows[0] || { message: 'Scholarship already saved' };
}

async function removeSavedScholarship(userId, scholarshipId) {
  await ensureSavedScholarshipsTable();
  const result = await db.query(
    'DELETE FROM saved_scholarships WHERE user_id = $1 AND scholarship_id = $2 RETURNING id',
    [userId, scholarshipId]
  );
  if (result.rows.length === 0) {
    const err = new Error('Saved scholarship not found'); err.status = 404; throw err;
  }
  return { message: 'Scholarship removed from saved' };
}

async function getAllSavedItems(userId) {
  const [jobs, scholarships] = await Promise.all([
    getSavedJobs(userId),
    getSavedScholarships(userId),
  ]);
  return [...jobs, ...scholarships].sort(
    (a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function getApplicationStats(userId) {
  await ensureApplicationsTable();
  try {
    const result = await db.query(
      `SELECT COUNT(*) AS total,
              COUNT(CASE WHEN status = 'pending'    THEN 1 END) AS pending,
              COUNT(CASE WHEN status = 'reviewed'   THEN 1 END) AS reviewed,
              COUNT(CASE WHEN status = 'accepted'   THEN 1 END) AS accepted,
              COUNT(CASE WHEN status = 'rejected'   THEN 1 END) AS rejected,
              COUNT(CASE WHEN status = 'withdrawn'  THEN 1 END) AS withdrawn
         FROM job_applications WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || { total: 0, pending: 0, reviewed: 0, accepted: 0, rejected: 0, withdrawn: 0 };
  } catch (err) {
    if (err.code === '42P01') return { total: 0, pending: 0, reviewed: 0, accepted: 0, rejected: 0, withdrawn: 0 };
    throw err;
  }
}

module.exports = {
  getUserProfile,
  updateUserProfile,
  getUserApplications,
  applyForJob,
  applyForScholarship,
  addManualApplication,
  updateApplicationStatus,
  getSavedJobs,
  saveJob,
  removeSavedJob,
  getSavedScholarships,
  saveScholarship,
  removeSavedScholarship,
  getAllSavedItems,
  getApplicationStats,
};