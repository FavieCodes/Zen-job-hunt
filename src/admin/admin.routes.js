const router = require('express').Router();
const requireAdmin = require('../common/adminMiddleware');
const adminController = require('./admin.controller');

// All routes require a valid JWT + role === 'admin'
router.use(requireAdmin);

// ── Users ─────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     tags: [Admin/Users]
 *     summary: List all registered users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *         description: Search by username or email
 *       - name: role
 *         in: query
 *         schema: { type: string, enum: [user, admin] }
 *     responses:
 *       200:
 *         description: Array of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/User' }
 *       401: { description: Unauthorized }
 *       403: { description: Admin access required }
 */
router.get('/users', adminController.getUsers);

/**
 * @swagger
 * /api/admin/users/{id}/role:
 *   patch:
 *     tags: [Admin/Users]
 *     summary: Update a user's role
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [user, admin] }
 *     responses:
 *       200:
 *         description: Updated user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       400: { description: Invalid role }
 *       404: { description: User not found }
 */
router.patch('/users/:id/role', adminController.updateUserRole);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     tags: [Admin/Users]
 *     summary: Delete a user permanently
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: User deleted }
 *       404: { description: User not found }
 */
router.delete('/users/:id', adminController.deleteUser);

// ── Jobs ──────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/jobs:
 *   post:
 *     tags: [Admin/Jobs]
 *     summary: Create one or multiple jobs
 *     description: Pass a single job object or an array of job objects.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/JobInput'
 *               - type: array
 *                 items:
 *                   $ref: '#/components/schemas/JobInput'
 *           examples:
 *             single:
 *               summary: Single job
 *               value:
 *                 title: "Backend Engineer"
 *                 company: "Acme Corp"
 *                 country: "Nigeria"
 *                 job_type: "full-time"
 *                 apply_url: "https://acme.com/apply"
 *             bulk:
 *               summary: Multiple jobs
 *               value:
 *                 - title: "Frontend Engineer"
 *                   company: "Acme"
 *                 - title: "DevOps Engineer"
 *                   company: "Beta Ltd"
 *     responses:
 *       201:
 *         description: Jobs created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/BulkCreateResponse' }
 *       400: { description: Empty body }
 *       401: { description: Unauthorized }
 *       403: { description: Admin access required }
 */
router.post('/jobs', adminController.createJobs);

/**
 * @swagger
 * /api/admin/jobs:
 *   get:
 *     tags: [Admin/Jobs]
 *     summary: List all jobs with pagination and filters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: page,     in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit,    in: query, schema: { type: integer, default: 20 } }
 *       - { name: country,  in: query, schema: { type: string } }
 *       - { name: job_type, in: query, schema: { type: string, enum: [full-time, part-time, contract, remote, internship] } }
 *       - { name: is_active, in: query, schema: { type: boolean } }
 *       - { name: search,   in: query, schema: { type: string }, description: Searches title, company and description }
 *     responses:
 *       200:
 *         description: Paginated jobs list
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaginatedJobs' }
 *       401: { description: Unauthorized }
 *       403: { description: Admin access required }
 */
router.get('/jobs', adminController.getJobs);

/**
 * @swagger
 * /api/admin/jobs/{id}:
 *   get:
 *     tags: [Admin/Jobs]
 *     summary: Get a single job by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Job found, content: { application/json: { schema: { $ref: '#/components/schemas/Job' } } } }
 *       404: { description: Not found }
 */
router.get('/jobs/:id', adminController.getJobById);

/**
 * @swagger
 * /api/admin/jobs/{id}:
 *   patch:
 *     tags: [Admin/Jobs]
 *     summary: Update a job (partial update)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/JobInput' }
 *     responses:
 *       200: { description: Updated job, content: { application/json: { schema: { $ref: '#/components/schemas/Job' } } } }
 *       400: { description: No valid fields provided }
 *       404: { description: Not found }
 */
router.patch('/jobs/:id', adminController.updateJob);

/**
 * @swagger
 * /api/admin/jobs/{id}:
 *   delete:
 *     tags: [Admin/Jobs]
 *     summary: Delete a job permanently
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Deleted, content: { application/json: { schema: { $ref: '#/components/schemas/MessageResponse' } } } }
 *       404: { description: Not found }
 */
router.delete('/jobs/:id', adminController.deleteJob);

// ── Scholarships ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/scholarships:
 *   post:
 *     tags: [Admin/Scholarships]
 *     summary: Create one or multiple scholarships
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/ScholarshipInput'
 *               - type: array
 *                 items:
 *                   $ref: '#/components/schemas/ScholarshipInput'
 *     responses:
 *       201: { description: Scholarships created, content: { application/json: { schema: { $ref: '#/components/schemas/BulkCreateResponse' } } } }
 *       401: { description: Unauthorized }
 *       403: { description: Admin access required }
 */
router.post('/scholarships', adminController.createScholarships);

/**
 * @swagger
 * /api/admin/scholarships:
 *   get:
 *     tags: [Admin/Scholarships]
 *     summary: List all scholarships with pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: page,      in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit,     in: query, schema: { type: integer, default: 20 } }
 *       - { name: country,   in: query, schema: { type: string } }
 *       - { name: field,     in: query, schema: { type: string } }
 *       - { name: is_active, in: query, schema: { type: boolean } }
 *       - { name: search,    in: query, schema: { type: string } }
 *     responses:
 *       200: { description: Paginated scholarships, content: { application/json: { schema: { $ref: '#/components/schemas/PaginatedScholarships' } } } }
 *       401: { description: Unauthorized }
 *       403: { description: Admin access required }
 */
router.get('/scholarships', adminController.getScholarships);

/**
 * @swagger
 * /api/admin/scholarships/{id}:
 *   get:
 *     tags: [Admin/Scholarships]
 *     summary: Get a single scholarship by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Scholarship found, content: { application/json: { schema: { $ref: '#/components/schemas/Scholarship' } } } }
 *       404: { description: Not found }
 */
router.get('/scholarships/:id', adminController.getScholarshipById);

/**
 * @swagger
 * /api/admin/scholarships/{id}:
 *   patch:
 *     tags: [Admin/Scholarships]
 *     summary: Update a scholarship (partial update)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ScholarshipInput' }
 *     responses:
 *       200: { description: Updated scholarship, content: { application/json: { schema: { $ref: '#/components/schemas/Scholarship' } } } }
 *       404: { description: Not found }
 */
router.patch('/scholarships/:id', adminController.updateScholarship);

/**
 * @swagger
 * /api/admin/scholarships/{id}:
 *   delete:
 *     tags: [Admin/Scholarships]
 *     summary: Delete a scholarship permanently
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Deleted, content: { application/json: { schema: { $ref: '#/components/schemas/MessageResponse' } } } }
 *       404: { description: Not found }
 */
router.delete('/scholarships/:id', adminController.deleteScholarship);

module.exports = router;