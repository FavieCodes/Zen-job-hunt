const router = require('express').Router();
const requireAuth = require('../common/authMiddleware');
const userController = require('./user.controller');

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     tags: [User]
 *     summary: Get current user's profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: User profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 email: { type: string }
 *                 username: { type: string }
 *                 created_at: { type: string, format: date-time }
 *                 avatar: { type: string }
 *                 is_confirmed: { type: boolean }
 *                 role: { type: string }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/profile', requireAuth, userController.getProfile);

/**
 * @swagger
 * /api/user/profile:
 *   patch:
 *     tags: [User]
 *     summary: Update user profile
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string, description: "New username" }
 *               avatar: { type: string, description: "Avatar URL" }
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 */
router.patch('/profile', requireAuth, userController.updateProfile);

/**
 * @swagger
 * /api/user/applications:
 *   get:
 *     tags: [User]
 *     summary: Get all job applications by current user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of applications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   job_id: { type: string, format: uuid }
 *                   status: { type: string, enum: [pending, reviewed, accepted, rejected] }
 *                   created_at: { type: string, format: date-time }
 *                   title: { type: string }
 *                   company: { type: string }
 *                   country: { type: string }
 *                   job_type: { type: string }
 *       401:
 *         description: Unauthorized
 */
router.get('/applications', requireAuth, userController.getApplications);

/**
 * @swagger
 * /api/user/applications:
 *   post:
 *     tags: [User]
 *     summary: Apply for a job
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [job_id]
 *             properties:
 *               job_id: { type: string, format: uuid, description: "ID of the job to apply for" }
 *     responses:
 *       201:
 *         description: Application submitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 user_id: { type: string, format: uuid }
 *                 job_id: { type: string, format: uuid }
 *                 status: { type: string }
 *                 created_at: { type: string, format: date-time }
 *       400:
 *         description: Already applied or job not found
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Job not found
 */
router.post('/applications', requireAuth, userController.applyForJob);

/**
 * @swagger
 * /api/user/saved:
 *   get:
 *     tags: [User]
 *     summary: Get all saved jobs
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of saved jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Job'
 *       401:
 *         description: Unauthorized
 */
router.get('/saved', requireAuth, userController.getSavedJobs);

/**
 * @swagger
 * /api/user/saved:
 *   post:
 *     tags: [User]
 *     summary: Save a job for later
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [job_id]
 *             properties:
 *               job_id: { type: string, format: uuid, description: "ID of the job to save" }
 *     responses:
 *       201:
 *         description: Job saved
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Job not found
 */
router.post('/saved', requireAuth, userController.saveJob);

/**
 * @swagger
 * /api/user/saved/{jobId}:
 *   delete:
 *     tags: [User]
 *     summary: Remove a saved job
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: jobId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the saved job to remove
 *     responses:
 *       200:
 *         description: Job removed from saved
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Saved job not found
 */
router.delete('/saved/:jobId', requireAuth, userController.removeSavedJob);

/**
 * @swagger
 * /api/user/stats:
 *   get:
 *     tags: [User]
 *     summary: Get user application statistics
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Application statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total: { type: integer }
 *                 pending: { type: integer }
 *                 reviewed: { type: integer }
 *                 accepted: { type: integer }
 *                 rejected: { type: integer }
 *       401:
 *         description: Unauthorized
 */
router.get('/stats', requireAuth, userController.getStats);

module.exports = router;