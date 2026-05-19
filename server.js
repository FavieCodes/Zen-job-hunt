const app            = require('./src/app');
const { port }       = require('./src/config/env');
const startScheduler = require('./src/cron/scheduler');

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  startScheduler();
});