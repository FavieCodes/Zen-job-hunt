const cron = require('node-cron');
const { runScraper, deactivateOldListings } = require('../scraper/scraper.service');

function startScheduler() {
  // Scrape every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('[CRON] Running scraper...');
    const results = await runScraper();
    console.log('[CRON] Scraper done:', results);
  });

  // Clean up old listings every day at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Deactivating old listings...');
    await deactivateOldListings();
  });

  console.log('[CRON] Scheduler started');
}

module.exports = startScheduler;