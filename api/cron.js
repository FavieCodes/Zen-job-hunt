const db = require('../src/config/db');
const { runScraper, deactivateOldListings } = require('../src/scraper/scraper.service');
const logger = require('../src/common/logger');

const CRON_SECRET = process.env.CRON_SECRET;

module.exports = async (req, res) => {
  // 🔒 Security check
  if (CRON_SECRET && req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    logger.warn('[Cron] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get which task to run from the query parameter
  const task = req.query.task || 'scrape';
  
  logger.info(`[Cron] Starting task: ${task}`);
  const startTime = Date.now();

  try {
    let result;
    
    switch (task) {
      case 'scrape':
        // Every 6 hours - scrape jobs and scholarships
        logger.info('[Cron] Running scraper...');
        result = await runScraper();
        logger.info('[Cron] Scraper completed:', result);
        break;
        
      case 'deactivate':
        // Daily at midnight - deactivate old listings
        logger.info('[Cron] Deactivating old listings...');
        result = await deactivateOldListings();
        logger.info('[Cron] Deactivation completed');
        break;
        
      case 'cleanup':
        // Daily at 1 AM - clean token blacklist
        logger.info('[Cron] Cleaning token blacklist...');
        const cleanupResult = await db.query('DELETE FROM token_blacklist WHERE expires_at <= NOW()');
        result = { deleted: cleanupResult.rowCount };
        logger.info(`[Cron] Cleaned ${cleanupResult.rowCount} expired tokens`);
        break;
        
      default:
        logger.warn(`[Cron] Unknown task: ${task}`);
        return res.status(400).json({ error: `Unknown task: ${task}` });
    }
    
    const duration = Date.now() - startTime;
    logger.info(`[Cron] Task "${task}" completed in ${duration}ms`);
    
    res.status(200).json({
      success: true,
      task,
      result,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`[Cron] Task "${task}" failed: ${error.message}`);
    logger.error(error.stack);
    
    res.status(500).json({
      success: false,
      task,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};