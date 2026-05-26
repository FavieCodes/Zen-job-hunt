const { port } = require('./src/config/env');
const app = require('./src/app');
const startScheduler = require('./src/cron/scheduler');
const logger = require('./src/common/logger');

const isVercel = process.env.VERCEL === '1';

if (isVercel) {
  logger.info('Running on Vercel (serverless mode)');
  logger.info('Scheduler is disabled - use cron-job.org for scheduled tasks');
  module.exports = app;
} else {
  app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
    startScheduler(); // This will work locally with node-cron
  });
}