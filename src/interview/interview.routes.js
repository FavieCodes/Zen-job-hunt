const router = require('express').Router();
const interviewController = require('./interview.controller');
const requireAuth = require('../common/authMiddleware');

router.post('/generate',        requireAuth, interviewController.generatePrep);
router.post('/generate-answer', requireAuth, interviewController.generateAnswer);
router.get('/history',   requireAuth, interviewController.getHistory);
router.get('/:id',       requireAuth, interviewController.getById);   // ← FIX #1

module.exports = router;