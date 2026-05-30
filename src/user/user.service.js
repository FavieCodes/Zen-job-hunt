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
              sj.created_at AS saved_at
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
  getApplicationStats,
};