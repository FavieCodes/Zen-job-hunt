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
 *     responses:
 *       200:
 *         description: Scholarships list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 scholarships: { type: array, items: { $ref: '#/components/schemas/Scholarship' } }
 *                 page:  { type: integer }
 *                 count: { type: integer }
 *       500: { description: Server error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.get('/', scholarshipsController.search);

module.exports = router;