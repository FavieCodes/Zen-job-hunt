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
 *       200: { description: Scraper started }
 *       409: { description: Already running }
 *       401: { description: Unauthorized }
 */
router.post('/trigger', requireAuth, scraperController.triggerScraper);

/**
 * @swagger
 * /api/scraper/status:
 *   get:
 *     tags: [Scraper]
 *     summary: Get scraper run status
 *     description: Returns the current or last-completed scraper run status. Requires authentication.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Status object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 running:      { type: boolean }
 *                 startedAt:   { type: string }
 *                 finishedAt:  { type: string }
 *                 jobs:        { type: integer }
 *                 scholarships:{ type: integer }
 *                 errors:      { type: integer }
 *                 lastLog:     { type: string }
 */
router.get('/status', requireAuth, scraperController.scraperStatus);

module.exports = router;