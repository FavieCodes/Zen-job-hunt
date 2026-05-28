const db = require('../config/db');

// ═══════════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════════

// Get all users with optional search/role filter
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

// Update a user's role
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

// Delete a user by ID
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
// JOBS
// ═══════════════════════════════════════════════════════════════════════════════

// Create one or many jobs.
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
          job.title,
          job.company       || null,
          job.description   || null,
          job.country       || null,
          job.state         || null,
          job.city          || null,
          job.job_type      || null,
          job.salary        || null,
          job.apply_url     || null,
          job.source_url    || null,
          job.source_name   || 'admin',
          job.posted_at     || null,
          job.is_active     !== undefined ? job.is_active : null,
        ]
      );
      if (res.rows.length > 0) {
        result.created++;
      } else {
        result.skipped++;
      }
    } catch (err) {
      result.errors.push({ item: job, error: err.message });
    }
  }

  return result;
}

// Get all jobs with optional filters and pagination.
async function getJobs({ page = 1, limit = 20, country, job_type, is_active, search } = {}) {
  const offset = (Math.max(1, page) - 1) * Math.min(100, limit);
  const params = [];
  const conditions = [];

  if (country) {
    params.push(`%${country}%`);
    conditions.push(`country ILIKE $${params.length}`);
  }
  if (job_type) {
    params.push(job_type);
    conditions.push(`job_type = $${params.length}`);
  }
  if (is_active !== undefined) {
    params.push(is_active === 'true' || is_active === true);
    conditions.push(`is_active = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(title ILIKE $${params.length} OR company ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await db.query(`SELECT COUNT(*) FROM jobs ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(Math.min(100, limit), offset);
  const dataRes = await db.query(
    `SELECT * FROM jobs ${where}
     ORDER BY scraped_at DESC
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

// Get a single job by ID.
async function getJobById(id) {
  const res = await db.query('SELECT * FROM jobs WHERE id = $1', [id]);
  const job = res.rows[0];
  if (!job) {
    const err = new Error('Job not found');
    err.status = 404;
    throw err;
  }
  return job;
}

// Update a job. Only supplied fields are changed.
async function updateJob(id, updates) {
  const allowed = [
    'title', 'company', 'description', 'country', 'state', 'city',
    'job_type', 'salary', 'apply_url', 'source_url', 'source_name',
    'posted_at', 'is_active',
  ];

  const fields = Object.keys(updates).filter((k) => allowed.includes(k));
  if (fields.length === 0) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }

  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map((f) => updates[f]);
  values.push(id);

  const res = await db.query(
    `UPDATE jobs SET ${setClauses} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (res.rows.length === 0) {
    const err = new Error('Job not found');
    err.status = 404;
    throw err;
  }
  return res.rows[0];
}

// Delete a job by ID.
async function deleteJob(id) {
  const res = await db.query('DELETE FROM jobs WHERE id = $1 RETURNING id', [id]);
  if (res.rows.length === 0) {
    const err = new Error('Job not found');
    err.status = 404;
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHOLARSHIPS
// ═══════════════════════════════════════════════════════════════════════════════

// Create one or many scholarships.
async function createScholarships(payload) {
  const items = Array.isArray(payload) ? payload : [payload];
  const result = { created: 0, skipped: 0, errors: [] };

  for (const s of items) {
    if (!s.title) {
      result.errors.push({ item: s, error: 'title is required' });
      continue;
    }

    try {
      const res = await db.query(
        `INSERT INTO scholarships
           (title, provider, description, country, field, deadline,
            amount, apply_url, source_url, posted_at, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
                 COALESCE($10, NOW()), COALESCE($11, TRUE))
         ON CONFLICT (source_url) DO NOTHING
         RETURNING id`,
        [
          s.title,
          s.provider    || null,
          s.description || null,
          s.country     || null,
          s.field       || null,
          s.deadline    || null,
          s.amount      || null,
          s.apply_url   || null,
          s.source_url  || null,
          s.posted_at   || null,
          s.is_active   !== undefined ? s.is_active : null,
        ]
      );
      if (res.rows.length > 0) {
        result.created++;
      } else {
        result.skipped++;
      }
    } catch (err) {
      result.errors.push({ item: s, error: err.message });
    }
  }

  return result;
}

// Get all scholarships with optional filters and pagination.
async function getScholarships({ page = 1, limit = 20, country, field, is_active, search } = {}) {
  const offset = (Math.max(1, page) - 1) * Math.min(100, limit);
  const params = [];
  const conditions = [];

  if (country) {
    params.push(`%${country}%`);
    conditions.push(`country ILIKE $${params.length}`);
  }
  if (field) {
    params.push(`%${field}%`);
    conditions.push(`field ILIKE $${params.length}`);
  }
  if (is_active !== undefined) {
    params.push(is_active === 'true' || is_active === true);
    conditions.push(`is_active = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(title ILIKE $${params.length} OR provider ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await db.query(`SELECT COUNT(*) FROM scholarships ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(Math.min(100, limit), offset);
  const dataRes = await db.query(
    `SELECT * FROM scholarships ${where}
     ORDER BY scraped_at DESC
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

// Get a single scholarship by ID.
async function getScholarshipById(id) {
  const res = await db.query('SELECT * FROM scholarships WHERE id = $1', [id]);
  const scholarship = res.rows[0];
  if (!scholarship) {
    const err = new Error('Scholarship not found');
    err.status = 404;
    throw err;
  }
  return scholarship;
}

// Update a scholarship. Only supplied fields are changed.
async function updateScholarship(id, updates) {
  const allowed = [
    'title', 'provider', 'description', 'country', 'field',
    'deadline', 'amount', 'apply_url', 'source_url', 'posted_at', 'is_active',
  ];

  const fields = Object.keys(updates).filter((k) => allowed.includes(k));
  if (fields.length === 0) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }

  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map((f) => updates[f]);
  values.push(id);

  const res = await db.query(
    `UPDATE scholarships SET ${setClauses} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (res.rows.length === 0) {
    const err = new Error('Scholarship not found');
    err.status = 404;
    throw err;
  }
  return res.rows[0];
}

// Delete a scholarship by ID.
async function deleteScholarship(id) {
  const res = await db.query('DELETE FROM scholarships WHERE id = $1 RETURNING id', [id]);
  if (res.rows.length === 0) {
    const err = new Error('Scholarship not found');
    err.status = 404;
    throw err;
  }
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