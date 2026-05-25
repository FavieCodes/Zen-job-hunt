const cron = require('node-cron');
const db = require('../config/db');
const { runScraper, deactivateOldListings } = require('../scraper/scraper.service');

function startScheduler() {
  cron.schedule('0 */6 * * *', async () => {
    console.log('[CRON] Running scraper...');
    const results = await runScraper();
    console.log('[CRON] Scraper done:', results);
  });

  // Deactivate old listings every day at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Deactivating old listings...');
    await deactivateOldListings();
  });

  // Clean up expired blacklisted 
  cron.schedule('0 1 * * *', async () => {
    console.log('[CRON] Cleaning token blacklist...');
    await db.query('DELETE FROM token_blacklist WHERE expires_at <= NOW()');
  });

  console.log('[CRON] Scheduler started');
}

module.exports = startScheduler;