const scraperService = require('./scraper.service');

// Manual trigger endpoint — useful for testing and admin use
async function triggerScraper(req, res, next) {
  try {
    // Run in background, don't block the HTTP response
    res.json({ message: 'Scraper started in background' });
    const results = await scraperService.runScraper();
    console.log('Scraper finished:', results);
  } catch (err) {
    next(err);
  }
}

module.exports = { triggerScraper };