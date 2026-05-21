const cron = require('node-cron');
const { runScraper, deactivateOldListings } = require('../scraper/scraper.service');
const logger = require('../common/logger');

function startScheduler() {
  // Scrape every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    logger.info('[CRON] Running scraper...');
    try {
      const results = await runScraper();
      logger.info('[CRON] Scraper done', { results });
    } catch (err) {
      logger.error('[CRON] Scraper failed', { error: err.message, stack: err.stack });
    }
  });

  // Clean up old listings every day at midnight
  cron.schedule('0 0 * * *', async () => {
    logger.info('[CRON] Deactivating old listings...');
    try {
      await deactivateOldListings();
      logger.info('[CRON] Old listings deactivated');
    } catch (err) {
      logger.error('[CRON] Deactivation failed', { error: err.message });
    }
  });

  logger.info('[CRON] Scheduler started');
}

module.exports = startScheduler;