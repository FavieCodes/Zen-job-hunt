const router = require('express').Router();
const scholarshipsController = require('./scholarships.controller');

/**
 * @swagger
 * /api/scholarships:
 *   get:
 *     tags: [Scholarships]
 *     summary: Search scholarships
 *     parameters:
 *       - { name: country, in: query, schema: { type: string } }
 *       - { name: field,   in: query, schema: { type: string }, description: Field of study }
 *       - { name: page,    in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit,   in: query, schema: { type: integer, default: 20 } }
 *     responses:
 *       200:
 *         description: Paginated scholarships list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedScholarships'
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.get('/', scholarshipsController.search);

/**
 * @swagger
 * /api/scholarships/{id}:
 *   get:
 *     tags: [Scholarships]
 *     summary: Get a single scholarship by ID
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Scholarship found, content: { application/json: { schema: { $ref: '#/components/schemas/Scholarship' } } } }
 *       404: { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.get('/:id', scholarshipsController.getOne);

module.exports = router;