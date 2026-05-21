const scraperService = require('./scraper.service');

// Manual trigger endpoint
async function triggerScraper(req, res, next) {
  try {
    
    res.json({ message: 'Scraper started in background' });
    const results = await scraperService.runScraper();
    console.log('Scraper finished:', results);
  } catch (err) {
    next(err);
  }
}

module.exports = { triggerScraper };