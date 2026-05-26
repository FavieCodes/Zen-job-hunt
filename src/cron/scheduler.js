const cron = require('node-cron');
const db = require('../config/db');
const { runScraper, deactivateOldListings } = require('../scraper/scraper.service');
const logger = require('../common/logger');

function startScheduler() {
  const isVercel = process.env.VERCEL === '1';
  
  if (isVercel) {
    logger.info('[CRON] Running on Vercel - scheduler disabled. Use cron-job.org instead.');
    return;
  }
  
  logger.info('[CRON] Starting local scheduler...');
  
  // Every 6 hours - scrape jobs and scholarships
  cron.schedule('0 */6 * * *', async () => {
    logger.info('[CRON] Running scraper...');
    const results = await runScraper();
    logger.info('[CRON] Scraper done:', results);
  });

  // Deactivate old listings every day at midnight
  cron.schedule('0 0 * * *', async () => {
    logger.info('[CRON] Deactivating old listings...');
    await deactivateOldListings();
  });

  // Clean up expired blacklisted tokens at 1 AM
  cron.schedule('0 1 * * *', async () => {
    logger.info('[CRON] Cleaning token blacklist...');
    await db.query('DELETE FROM token_blacklist WHERE expires_at <= NOW()');
  });

  logger.info('[CRON] Local scheduler started successfully');
}

module.exports = startScheduler;