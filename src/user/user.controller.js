const userService = require('./user.service');
const logger = require('../common/logger');

/**
 * Get current user profile
 * GET /api/user/profile
 */
async function getProfile(req, res, next) {
  try {
    const user = await userService.getUserProfile(req.user.userId);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

/**
 * Update user profile
 * PATCH /api/user/profile
 */
async function updateProfile(req, res, next) {
  try {
    const { username, avatar } = req.body;
    const updated = await userService.updateUserProfile(req.user.userId, { username, avatar });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/**
 * Get user's job applications
 * GET /api/user/applications
 */
async function getApplications(req, res, next) {
  try {
    const applications = await userService.getUserApplications(req.user.userId);
    res.json(applications);
  } catch (err) {
    next(err);
  }
}

/**
 * Apply for a job
 * POST /api/user/applications
 */
async function applyForJob(req, res, next) {
  try {
    const { job_id } = req.body;
    if (!job_id) {
      return res.status(400).json({ error: 'job_id is required' });
    }
    const application = await userService.applyForJob(req.user.userId, job_id);
    res.status(201).json(application);
  } catch (err) {
    next(err);
  }
}

/**
 * Get saved jobs
 * GET /api/user/saved
 */
async function getSavedJobs(req, res, next) {
  try {
    const savedJobs = await userService.getSavedJobs(req.user.userId);
    res.json(savedJobs);
  } catch (err) {
    next(err);
  }
}

/**
 * Save a job
 * POST /api/user/saved
 */
async function saveJob(req, res, next) {
  try {
    const { job_id } = req.body;
    if (!job_id) {
      return res.status(400).json({ error: 'job_id is required' });
    }
    const result = await userService.saveJob(req.user.userId, job_id);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Remove a saved job
 * DELETE /api/user/saved/:jobId
 */
async function removeSavedJob(req, res, next) {
  try {
    const { jobId } = req.params;
    const result = await userService.removeSavedJob(req.user.userId, jobId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get application statistics
 * GET /api/user/stats
 */
async function getStats(req, res, next) {
  try {
    const stats = await userService.getApplicationStats(req.user.userId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  getApplications,
  applyForJob,
  getSavedJobs,
  saveJob,
  removeSavedJob,
  getStats,
};