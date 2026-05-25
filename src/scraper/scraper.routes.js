const router = require('express').Router();
const requireAuth = require('../common/authMiddleware');
const scraperController = require('./scraper.controller');

// Protected 
router.post('/trigger', requireAuth, scraperController.triggerScraper);

module.exports = router;