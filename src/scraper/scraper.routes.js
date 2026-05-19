const router = require('express').Router();
const requireAuth = require('../common/authMiddleware');
const scraperController = require('./scraper.controller');

// Protected — only authenticated users (or admins) can trigger manually
router.post('/trigger', requireAuth, scraperController.triggerScraper);

module.exports = router;