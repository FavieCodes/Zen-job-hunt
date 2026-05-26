const router = require('express').Router();
const requireAuth = require('../common/authMiddleware');
const scraperController = require('./scraper.controller');

/**
 * @swagger
 * /api/scraper/trigger:
 *   post:
 *     tags: [Scraper]
 *     summary: Manually trigger the scraper
 *     description: Starts the scraper in the background and returns immediately. Requires authentication.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Scraper started, content: { application/json: { schema: { $ref: '#/components/schemas/MessageResponse' } } } }
 *       401: { description: Unauthorized, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 */
router.post('/trigger', requireAuth, scraperController.triggerScraper);

module.exports = router;