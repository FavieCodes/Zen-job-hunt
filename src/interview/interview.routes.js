const router = require('express').Router();
const interviewController = require('./interview.controller');
const requireAuth = require('../common/authMiddleware');

/**
 * @swagger
 * /api/interview/generate:
 *   post:
 *     tags: [Interview]
 *     summary: Generate interview prep questions and videos
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InterviewPrepInput'
 *     responses:
 *       200: { description: Generated interview prep, content: { application/json: { schema: { $ref: '#/components/schemas/InterviewPrep' } } } }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/generate', requireAuth, interviewController.generatePrep);

/**
 * @swagger
 * /api/interview/history:
 *   get:
 *     tags: [Interview]
 *     summary: Get user's interview prep history
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of generated prep materials, content: { application/json: { schema: { type: 'array', items: { $ref: '#/components/schemas/InterviewPrep' } } } } }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.get('/history', requireAuth, interviewController.getHistory);

module.exports = router;
