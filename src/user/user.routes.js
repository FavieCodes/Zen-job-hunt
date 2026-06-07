const router         = require('express').Router();
const requireAuth    = require('../common/authMiddleware');
const userController = require('./user.controller');

// ── Profile ───────────────────────────────────────────────────────────────────
router.get('/profile',   requireAuth, userController.getProfile);
router.patch('/profile', requireAuth, userController.updateProfile);

// ── Applications ──────────────────────────────────────────────────────────────
router.get('/applications',                    requireAuth, userController.getApplications);
router.post('/applications',                   requireAuth, userController.applyForJob);          // job_id or scholarship_id in body
router.post('/applications/manual',            requireAuth, userController.addManualApplication); // manual entry
router.patch('/applications/:id/status',       requireAuth, userController.updateApplicationStatus);
router.delete('/applications/:id',             requireAuth, userController.deleteApplication);    // delete application

// ── Saved Jobs ────────────────────────────────────────────────────────────────
router.get('/saved/jobs',              requireAuth, userController.getSavedJobs);
router.post('/saved/jobs',             requireAuth, userController.saveJob);
router.delete('/saved/jobs/:jobId',    requireAuth, userController.removeSavedJob);

// ── Saved Scholarships ────────────────────────────────────────────────────────
router.get('/saved/scholarships',                       requireAuth, userController.getSavedScholarships);
router.post('/saved/scholarships',                      requireAuth, userController.saveScholarship);
router.delete('/saved/scholarships/:scholarshipId',     requireAuth, userController.removeSavedScholarship);

// ── Combined saved feed ───────────────────────────────────────────────────────
router.get('/saved',          requireAuth, userController.getAllSaved);
router.post('/saved',         requireAuth, userController.saveJob);
router.delete('/saved/:jobId',requireAuth, userController.removeSavedJob);

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', requireAuth, userController.getStats);

module.exports = router;