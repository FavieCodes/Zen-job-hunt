const db = require('../config/db');
const logger = require('../common/logger');

// ═══════════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════════

async function getUsers({ search, role } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(username ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }
  if (role && ['user', 'admin'].includes(role)) {
    params.push(role);
    conditions.push(`role = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.query(
    `SELECT id, email, username, role, is_confirmed, created_at,
            avatar, COALESCE(is_google_user, FALSE) AS is_google_user
     FROM users
     ${where}
     ORDER BY created_at DESC`,
    params
  );

  return result.rows;
}

async function updateUserRole(userId, role) {
  const result = await db.query(
    `UPDATE users SET role = $1 WHERE id = $2
     RETURNING id, email, username, role, is_confirmed, created_at, avatar`,
    [role, userId]
  );

  if (result.rows.length === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  return result.rows[0];
}

async function deleteUser(userId) {
  const result = await db.query(
    'DELETE FROM users WHERE id = $1 RETURNING id',
    [userId]
  );

  if (result.rows.length === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE HELPERS  (idempotent — safe to call on every request)
// ═══════════════════════════════════════════════════════════════════════════════

async function ensureJobApplicationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS job_applications (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
      job_id     UUID REFERENCES jobs(id)  ON DELETE CASCADE,
      status     VARCHAR(50) DEFAULT 'pending',
      notes      TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, job_id)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_job_applications_user   ON job_applications(user_id);
    CREATE INDEX IF NOT EXISTS idx_job_applications_job    ON job_applications(job_id);
    CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
  `);
}

async function ensureSavedJobsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS saved_jobs (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
      job_id     UUID REFERENCES jobs(id)  ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, job_id)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_saved_jobs_user ON saved_jobs(user_id);
    CREATE INDEX IF NOT EXISTS idx_saved_jobs_job  ON saved_jobs(job_id);
  `);
}

async function ensureScholarshipApplicationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS scholarship_applications (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID REFERENCES users(id)        ON DELETE CASCADE,
      scholarship_id  UUID REFERENCES scholarships(id) ON DELETE CASCADE,
      status          VARCHAR(50) DEFAULT 'pending',
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, scholarship_id)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_sch_apps_user ON scholarship_applications(user_id);
    CREATE INDEX IF NOT EXISTS idx_sch_apps_sch  ON scholarship_applications(scholarship_id);
  `);
  logger.info('[admin.service] Ensured scholarship_applications table exists');
}

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
    CREATE INDEX IF NOT EXISTS idx_saved_sch_sch  ON saved_scholarships(scholarship_id);
  `);
  logger.info('[admin.service] Ensured saved_scholarships table exists');
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOBS
// ═══════════════════════════════════════════════════════════════════════════════

async function createJobs(payload) {
  const items = Array.isArray(payload) ? payload : [payload];
  const result = { created: 0, skipped: 0, errors: [] };

  for (const job of items) {
    if (!job.title) {
      result.errors.push({ item: job, error: 'title is required' });
      continue;
    }
    try {
      const res = await db.query(
        `INSERT INTO jobs
           (title, company, description, country, state, city,
            job_type, salary, apply_url, source_url, source_name, posted_at, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
                 COALESCE($12, NOW()), COALESCE($13, TRUE))
         ON CONFLICT (source_url) DO NOTHING
         RETURNING id`,
        [
          job.title,     job.company      || null, job.description || null,
          job.country    || null, job.state || null, job.city       || null,
          job.job_type   || null, job.salary || null, job.apply_url  || null,
          job.source_url || null, job.source_name || 'admin',
          job.posted_at  || null,
          job.is_active !== undefined ? job.is_active : null,
        ]
      );
      res.rows.length > 0 ? result.created++ : result.skipped++;
    } catch (err) {
      result.errors.push({ item: job, error: err.message });
    }
  }
  return result;
}

async function getJobs({ page = 1, limit = 20, country, job_type, is_active, search } = {}) {
  // Make sure the engagement tables exist so the LEFT JOINs never throw
  await ensureJobApplicationsTable();
  await ensureSavedJobsTable();

  const offset = (Math.max(1, page) - 1) * Math.min(100, limit);
  const params = [];
  const conditions = [];

  if (country)   { params.push(`%${country}%`);  conditions.push(`j.country ILIKE $${params.length}`); }
  if (job_type)  { params.push(job_type);         conditions.push(`j.job_type = $${params.length}`); }
  if (is_active !== undefined) {
    params.push(is_active === 'true' || is_active === true);
    conditions.push(`j.is_active = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(j.title ILIKE $${params.length} OR j.company ILIKE $${params.length} OR j.description ILIKE $${params.length})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await db.query(`SELECT COUNT(*) FROM jobs j ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(Math.min(100, limit), offset);

  const dataRes = await db.query(
    `SELECT
       j.*,
       COALESCE(app_counts.applicant_count, 0)::int AS applicant_count,
       COALESCE(save_counts.saved_count, 0)::int     AS saved_count
     FROM jobs j
     LEFT JOIN (
       SELECT job_id, COUNT(*) AS applicant_count
       FROM job_applications
       GROUP BY job_id
     ) app_counts ON app_counts.job_id = j.id
     LEFT JOIN (
       SELECT job_id, COUNT(*) AS saved_count
       FROM saved_jobs
       GROUP BY job_id
     ) save_counts ON save_counts.job_id = j.id
     ${where}
     ORDER BY j.scraped_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    total,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / limit),
    jobs: dataRes.rows,
  };
}

async function getJobById(id) {
  const res = await db.query('SELECT * FROM jobs WHERE id = $1', [id]);
  if (!res.rows[0]) { const e = new Error('Job not found'); e.status = 404; throw e; }
  return res.rows[0];
}

async function updateJob(id, updates) {
  const allowed = ['title','company','description','country','state','city',
                   'job_type','salary','apply_url','source_url','source_name','posted_at','is_active'];
  const fields = Object.keys(updates).filter(k => allowed.includes(k));
  if (!fields.length) { const e = new Error('No valid fields to update'); e.status = 400; throw e; }

  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = [...fields.map(f => updates[f]), id];
  const res = await db.query(
    `UPDATE jobs SET ${setClauses} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (!res.rows[0]) { const e = new Error('Job not found'); e.status = 404; throw e; }
  return res.rows[0];
}

async function deleteJob(id) {
  const res = await db.query('DELETE FROM jobs WHERE id = $1 RETURNING id', [id]);
  if (!res.rows[0]) { const e = new Error('Job not found'); e.status = 404; throw e; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHOLARSHIPS
// ═══════════════════════════════════════════════════════════════════════════════

async function createScholarships(payload) {
  const items = Array.isArray(payload) ? payload : [payload];
  const result = { created: 0, skipped: 0, errors: [] };

  for (const s of items) {
    if (!s.title) { result.errors.push({ item: s, error: 'title is required' }); continue; }
    try {
      const res = await db.query(
        `INSERT INTO scholarships
           (title, provider, description, country, field, deadline,
            amount, apply_url, source_url, posted_at, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, COALESCE($10, NOW()), COALESCE($11, TRUE))
         ON CONFLICT (source_url) DO NOTHING RETURNING id`,
        [
          s.title, s.provider||null, s.description||null, s.country||null, s.field||null,
          s.deadline||null, s.amount||null, s.apply_url||null, s.source_url||null,
          s.posted_at||null, s.is_active !== undefined ? s.is_active : null,
        ]
      );
      res.rows.length > 0 ? result.created++ : result.skipped++;
    } catch (err) {
      result.errors.push({ item: s, error: err.message });
    }
  }
  return result;
}

async function getScholarships({ page = 1, limit = 20, country, field, is_active, search } = {}) {
  // Ensure the scholarship engagement tables exist before querying them
  await ensureScholarshipApplicationsTable();
  await ensureSavedScholarshipsTable();

  const offset = (Math.max(1, page) - 1) * Math.min(100, limit);
  const params = [];
  const conditions = [];

  if (country)  { params.push(`%${country}%`); conditions.push(`s.country ILIKE $${params.length}`); }
  if (field)    { params.push(`%${field}%`);   conditions.push(`s.field ILIKE $${params.length}`); }
  if (is_active !== undefined) {
    params.push(is_active === 'true' || is_active === true);
    conditions.push(`s.is_active = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(s.title ILIKE $${params.length} OR s.provider ILIKE $${params.length} OR s.description ILIKE $${params.length})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await db.query(`SELECT COUNT(*) FROM scholarships s ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(Math.min(100, limit), offset);

  const dataRes = await db.query(
    `SELECT
       s.*,
       COALESCE(app_counts.applicant_count, 0)::int AS applicant_count,
       COALESCE(save_counts.saved_count, 0)::int     AS saved_count
     FROM scholarships s
     LEFT JOIN (
       SELECT scholarship_id, COUNT(*) AS applicant_count
       FROM scholarship_applications
       GROUP BY scholarship_id
     ) app_counts ON app_counts.scholarship_id = s.id
     LEFT JOIN (
       SELECT scholarship_id, COUNT(*) AS saved_count
       FROM saved_scholarships
       GROUP BY scholarship_id
     ) save_counts ON save_counts.scholarship_id = s.id
     ${where}
     ORDER BY s.scraped_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    total,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / limit),
    scholarships: dataRes.rows,
  };
}

async function getScholarshipById(id) {
  const res = await db.query('SELECT * FROM scholarships WHERE id = $1', [id]);
  if (!res.rows[0]) { const e = new Error('Scholarship not found'); e.status = 404; throw e; }
  return res.rows[0];
}

async function updateScholarship(id, updates) {
  const allowed = ['title','provider','description','country','field','deadline','amount',
                   'apply_url','source_url','posted_at','is_active'];
  const fields = Object.keys(updates).filter(k => allowed.includes(k));
  if (!fields.length) { const e = new Error('No valid fields to update'); e.status = 400; throw e; }

  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = [...fields.map(f => updates[f]), id];
  const res = await db.query(
    `UPDATE scholarships SET ${setClauses} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (!res.rows[0]) { const e = new Error('Scholarship not found'); e.status = 404; throw e; }
  return res.rows[0];
}

async function deleteScholarship(id) {
  const res = await db.query('DELETE FROM scholarships WHERE id = $1 RETURNING id', [id]);
  if (!res.rows[0]) { const e = new Error('Scholarship not found'); e.status = 404; throw e; }
}

module.exports = {
  getUsers,
  updateUserRole,
  deleteUser,
  createJobs,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
  createScholarships,
  getScholarships,
  getScholarshipById,
  updateScholarship,
  deleteScholarship,
};