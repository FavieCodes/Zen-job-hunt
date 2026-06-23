const scraperService = require('./scraper.service');
const logger = require('../common/logger');

// In-memory progress state (resets each run; fine for single-instance)
let scraperState = {
  running:   false,
  startedAt: null,
  finishedAt: null,
  jobs:      0,
  scholarships: 0,
  errors:    [],
  lastLog:   null,
};

// Manual trigger endpoint — responds immediately, runs scraper in background
async function triggerScraper(req, res, next) {
  if (scraperState.running) {
    return res.status(409).json({
      message: 'Scraper is already running',
      startedAt: scraperState.startedAt,
    });
  }

  scraperState = {
    running:      true,
    startedAt:    new Date().toISOString(),
    finishedAt:   null,
    jobs:         0,
    scholarships: 0,
    errors:       [],
    lastLog:      'Scraper started',
  };

  res.json({ message: 'Scraper started in background', startedAt: scraperState.startedAt });

  // Run in background (don't await)
  scraperService.runScraper()
    .then((results) => {
      scraperState.running      = false;
      scraperState.finishedAt   = new Date().toISOString();
      scraperState.jobs         = results.jobs;
      scraperState.scholarships = results.scholarships;
      scraperState.errors       = results.errors;
      scraperState.lastLog      = `Done — ${results.jobs} jobs, ${results.scholarships} scholarships`;
      logger.info('Scraper completed', results);
    })
    .catch((err) => {
      scraperState.running    = false;
      scraperState.finishedAt = new Date().toISOString();
      scraperState.lastLog    = `Fatal error: ${err.message}`;
      scraperState.errors.push({ error: err.message });
      logger.error('Scraper fatal error', { error: err.message });
    });
}

// Progress/status endpoint — poll this from the frontend
function scraperStatus(req, res) {
  res.json({
    running:      scraperState.running,
    startedAt:    scraperState.startedAt,
    finishedAt:   scraperState.finishedAt,
    jobs:         scraperState.jobs,
    scholarships: scraperState.scholarships,
    errors:       scraperState.errors.length,
    lastLog:      scraperState.lastLog,
  });
}

module.exports = { triggerScraper, scraperStatus };