const router = require('express').Router();
const requireAuth = require('../common/authMiddleware');
const userController = require('./user.controller');

// ── Profile ───────────────────────────────────────────────────────────────────
router.get('/profile',  requireAuth, userController.getProfile);
router.patch('/profile', requireAuth, userController.updateProfile);

// ── Applications ──────────────────────────────────────────────────────────────
router.get('/applications',  requireAuth, userController.getApplications);
router.post('/applications', requireAuth, userController.applyForJob);

// ── Saved Jobs ────────────────────────────────────────────────────────────────
router.get('/saved/jobs',         requireAuth, userController.getSavedJobs);
router.post('/saved/jobs',        requireAuth, userController.saveJob);
router.delete('/saved/jobs/:jobId', requireAuth, userController.removeSavedJob);

// ── Saved Scholarships ────────────────────────────────────────────────────────
router.get('/saved/scholarships',                    requireAuth, userController.getSavedScholarships);
router.post('/saved/scholarships',                   requireAuth, userController.saveScholarship);
router.delete('/saved/scholarships/:scholarshipId',  requireAuth, userController.removeSavedScholarship);

// ── Combined saved feed (jobs + scholarships merged, sorted by saved_at) ──────
// Kept at /user/saved for backward compat with the dashboard stats call
router.get('/saved', requireAuth, userController.getAllSaved);

// ── Legacy: keep POST /user/saved pointing to saveJob so existing
//    job-detail "Save" buttons still work without a frontend change.
router.post('/saved', requireAuth, userController.saveJob);
router.delete('/saved/:jobId', requireAuth, userController.removeSavedJob);

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', requireAuth, userController.getStats);

module.exports = router;