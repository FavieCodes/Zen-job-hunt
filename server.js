const app = require('./src/app');
const { port } = require('./src/config/env');
const startScheduler = require('./src/cron/scheduler');
const logger = require('./src/common/logger');

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  startScheduler();
});