const db = require('../config/db');
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
  // base64 for a 5 MB image ≈ 6.8 MB string — reject anything obviously huge
  if (updates.avatar && updates.avatar.length > 8 * 1024 * 1024) {
    const err = new Error('Avatar image is too large. Maximum allowed size is 5 MB.');
    err.status = 400;
    throw err;
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

// ── Applications ──────────────────────────────────────────────────────────────

async function getUserApplications(userId) {
  try {
    const result = await db.query(
      `SELECT a.id, a.job_id, a.status, a.created_at,
              j.title, j.company, j.country, j.state, j.city,
              j.job_type, j.salary, j.apply_url, j.posted_at
         FROM job_applications a
         JOIN jobs j ON a.job_id = j.id
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC`,
      [userId]
    );
    return result.rows;
  } catch (err) {
    if (err.code === '42P01') return [];
    throw err;
  }
}

async function applyForJob(userId, jobId) {
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
    `INSERT INTO job_applications (user_id, job_id, status, created_at)
     VALUES ($1, $2, 'pending', NOW()) RETURNING *`,
    [userId, jobId]
  );
  logger.info(`User ${userId} applied for job ${jobId}`);
  return result.rows[0];
}

// ── Saved Jobs ────────────────────────────────────────────────────────────────

async function getSavedJobs(userId) {
  try {
    const result = await db.query(
      `SELECT j.id, j.title, j.company, j.country, j.state, j.city,
              j.job_type, j.salary, j.apply_url, j.description, j.posted_at,
              sj.created_at AS saved_at,
              'job' AS item_type
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
    CREATE INDEX IF NOT EXISTS idx_saved_sch_sch  ON saved_scholarships(scholarship_id);
  `);
}

async function getSavedScholarships(userId) {
  await ensureSavedScholarshipsTable();
  try {
    const result = await db.query(
      `SELECT s.id, s.title, s.provider, s.country, s.field,
              s.deadline, s.amount, s.apply_url, s.description, s.posted_at,
              ss.created_at AS saved_at,
              'scholarship' AS item_type
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

// ── Combined saved items (jobs + scholarships) ────────────────────────────────

async function getAllSavedItems(userId) {
  const [jobs, scholarships] = await Promise.all([
    getSavedJobs(userId),
    getSavedScholarships(userId),
  ]);
  // Merge and sort by saved_at descending
  return [...jobs, ...scholarships].sort(
    (a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function getApplicationStats(userId) {
  try {
    const result = await db.query(
      `SELECT COUNT(*) AS total,
              COUNT(CASE WHEN status = 'pending'  THEN 1 END) AS pending,
              COUNT(CASE WHEN status = 'reviewed' THEN 1 END) AS reviewed,
              COUNT(CASE WHEN status = 'accepted' THEN 1 END) AS accepted,
              COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS rejected
         FROM job_applications WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || { total: 0, pending: 0, reviewed: 0, accepted: 0, rejected: 0 };
  } catch (err) {
    if (err.code === '42P01') return { total: 0, pending: 0, reviewed: 0, accepted: 0, rejected: 0 };
    throw err;
  }
}

module.exports = {
  getUserProfile,
  updateUserProfile,
  getUserApplications,
  applyForJob,
  getSavedJobs,
  saveJob,
  removeSavedJob,
  getSavedScholarships,
  saveScholarship,
  removeSavedScholarship,
  getAllSavedItems,
  getApplicationStats,
};