const adminService = require('./admin.service');

// ── Users ─────────────────────────────────────────────────────────────────────

// GET /api/admin/users
async function getUsers(req, res, next) {
  try {
    const users = await adminService.getUsers(req.query);
    res.json(users);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/users/:id/role
async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'role must be "user" or "admin"' });
    }
    const user = await adminService.updateUserRole(req.params.id, role);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/users/:id
async function deleteUser(req, res, next) {
  try {
    // Prevent admin from deleting themselves
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    await adminService.deleteUser(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

// POST /api/admin/jobs
async function createJobs(req, res, next) {
  try {
    const payload = req.body;
    if (!payload || (Array.isArray(payload) && payload.length === 0)) {
      return res.status(400).json({ error: 'Request body must be a job object or a non-empty array' });
    }
    const result = await adminService.createJobs(payload);
    const status = result.errors.length > 0 && result.created === 0 ? 422 : 201;
    res.status(status).json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/jobs
async function getJobs(req, res, next) {
  try {
    const data = await adminService.getJobs(req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/jobs/:id
async function getJobById(req, res, next) {
  try {
    const job = await adminService.getJobById(req.params.id);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/jobs/:id
async function updateJob(req, res, next) {
  try {
    const job = await adminService.updateJob(req.params.id, req.body);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/jobs/:id
async function deleteJob(req, res, next) {
  try {
    await adminService.deleteJob(req.params.id);
    res.json({ message: 'Job deleted' });
  } catch (err) {
    next(err);
  }
}

// ── Scholarships ──────────────────────────────────────────────────────────────

// POST /api/admin/scholarships
async function createScholarships(req, res, next) {
  try {
    const payload = req.body;
    if (!payload || (Array.isArray(payload) && payload.length === 0)) {
      return res.status(400).json({ error: 'Request body must be a scholarship object or a non-empty array' });
    }
    const result = await adminService.createScholarships(payload);
    const status = result.errors.length > 0 && result.created === 0 ? 422 : 201;
    res.status(status).json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/scholarships
async function getScholarships(req, res, next) {
  try {
    const data = await adminService.getScholarships(req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/scholarships/:id
async function getScholarshipById(req, res, next) {
  try {
    const scholarship = await adminService.getScholarshipById(req.params.id);
    res.json(scholarship);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/scholarships/:id
async function updateScholarship(req, res, next) {
  try {
    const scholarship = await adminService.updateScholarship(req.params.id, req.body);
    res.json(scholarship);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/scholarships/:id
async function deleteScholarship(req, res, next) {
  try {
    await adminService.deleteScholarship(req.params.id);
    res.json({ message: 'Scholarship deleted' });
  } catch (err) {
    next(err);
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