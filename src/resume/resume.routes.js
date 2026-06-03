const router             = require('express').Router();
const requireAuth        = require('../common/authMiddleware');
const resumeController   = require('./resume.controller');

router.post('/generate', requireAuth, resumeController.generateResume);
router.post('/tailor',   requireAuth, resumeController.tailorResume);
router.get('/history',   requireAuth, resumeController.getHistory);
router.delete('/:id',    requireAuth, resumeController.deleteResume);

module.exports = router;