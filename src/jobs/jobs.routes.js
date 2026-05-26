const router = require('express').Router();
const jobsController = require('./jobs.controller');

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     tags: [Jobs]
 *     summary: Search jobs
 *     parameters:
 *       - { name: q,        in: query, schema: { type: string }, description: Search title and description }
 *       - { name: country,  in: query, schema: { type: string } }
 *       - { name: state,    in: query, schema: { type: string } }
 *       - { name: city,     in: query, schema: { type: string } }
 *       - { name: job_type, in: query, schema: { type: string, enum: [full-time,part-time,contract,remote,internship] } }
 *       - { name: page,     in: query, schema: { type: integer, default: 1 } }
 *     responses:
 *       200:
 *         description: Jobs list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobs:  { type: array, items: { $ref: '#/components/schemas/Job' } }
 *                 page:  { type: integer }
 *                 count: { type: integer }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.get('/', jobsController.search);

/**
 * @swagger
 * /api/jobs/{id}:
 *   get:
 *     tags: [Jobs]
 *     summary: Get a single job by ID
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Job found, content: { application/json: { schema: { $ref: '#/components/schemas/Job' } } } }
 *       404: { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.get('/:id', jobsController.getOne);

module.exports = router;