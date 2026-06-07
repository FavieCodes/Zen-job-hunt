const userService = require('./user.service');
const logger      = require('../common/logger');

// ── Profile ───────────────────────────────────────────────────────────────────

async function getProfile(req, res, next) {
  try {
    const user = await userService.getUserProfile(req.user.userId);
    res.json(user);
  } catch (err) { next(err); }
}

async function updateProfile(req, res, next) {
  try {
    const { username, avatar } = req.body;
    const updated = await userService.updateUserProfile(req.user.userId, { username, avatar });
    res.json(updated);
  } catch (err) { next(err); }
}

// ── Applications ──────────────────────────────────────────────────────────────

async function getApplications(req, res, next) {
  try {
    const applications = await userService.getUserApplications(req.user.userId);
    res.json(applications);
  } catch (err) { next(err); }
}

// Body can contain job_id OR scholarship_id (not both)
async function applyForJob(req, res, next) {
  try {
    const { job_id, scholarship_id } = req.body;

    if (scholarship_id) {
      const application = await userService.applyForScholarship(req.user.userId, scholarship_id);
      return res.status(201).json(application);
    }

    if (!job_id) return res.status(400).json({ error: 'job_id or scholarship_id is required' });
    const application = await userService.applyForJob(req.user.userId, job_id);
    res.status(201).json(application);
  } catch (err) { next(err); }
}

// POST /api/user/applications/manual
async function addManualApplication(req, res, next) {
  try {
    const result = await userService.addManualApplication(req.user.userId, req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

// PATCH /api/user/applications/:id/status
async function updateApplicationStatus(req, res, next) {
  try {
    const { id }     = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    const result = await userService.updateApplicationStatus(req.user.userId, id, status);
    res.json(result);
  } catch (err) { next(err); }
}

// DELETE /api/user/applications/:id
async function deleteApplication(req, res, next) {
  try {
    const { id } = req.params;
    const result = await userService.deleteApplication(req.user.userId, id);
    res.json(result);
  } catch (err) { next(err); }
}

// ── Saved Jobs ────────────────────────────────────────────────────────────────

async function getSavedJobs(req, res, next) {
  try {
    const savedJobs = await userService.getSavedJobs(req.user.userId);
    res.json(savedJobs);
  } catch (err) { next(err); }
}

async function saveJob(req, res, next) {
  try {
    const { job_id } = req.body;
    if (!job_id) return res.status(400).json({ error: 'job_id is required' });
    const result = await userService.saveJob(req.user.userId, job_id);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function removeSavedJob(req, res, next) {
  try {
    const { jobId } = req.params;
    const result = await userService.removeSavedJob(req.user.userId, jobId);
    res.json(result);
  } catch (err) { next(err); }
}

// ── Saved Scholarships ────────────────────────────────────────────────────────

async function getSavedScholarships(req, res, next) {
  try {
    const items = await userService.getSavedScholarships(req.user.userId);
    res.json(items);
  } catch (err) { next(err); }
}

async function saveScholarship(req, res, next) {
  try {
    const { scholarship_id } = req.body;
    if (!scholarship_id) return res.status(400).json({ error: 'scholarship_id is required' });
    const result = await userService.saveScholarship(req.user.userId, scholarship_id);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function removeSavedScholarship(req, res, next) {
  try {
    const { scholarshipId } = req.params;
    const result = await userService.removeSavedScholarship(req.user.userId, scholarshipId);
    res.json(result);
  } catch (err) { next(err); }
}

// ── Combined saved ────────────────────────────────────────────────────────────

async function getAllSaved(req, res, next) {
  try {
    const items = await userService.getAllSavedItems(req.user.userId);
    res.json(items);
  } catch (err) { next(err); }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function getStats(req, res, next) {
  try {
    const stats = await userService.getApplicationStats(req.user.userId);
    res.json(stats);
  } catch (err) { next(err); }
}

module.exports = {
  getProfile,
  updateProfile,
  getApplications,
  applyForJob,
  addManualApplication,
  updateApplicationStatus,
  deleteApplication,
  getSavedJobs,
  saveJob,
  removeSavedJob,
  getSavedScholarships,
  saveScholarship,
  removeSavedScholarship,
  getAllSaved,
  getStats,
};