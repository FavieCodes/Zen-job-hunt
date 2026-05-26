const app = require('../src/app');
const logger = require('../src/common/logger');

const { databaseUrl } = require('../src/config/env');

if (!databaseUrl) {
  logger.error('[Vercel] DATABASE_URL environment variable is missing!');
  logger.error('[Vercel] Please add it in your Vercel project settings');
}

app.get('/api/vercel-health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    hasDbUrl: !!databaseUrl
  });
});

module.exports = app;