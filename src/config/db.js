const { Pool } = require('pg');
const { databaseUrl } = require('./env');
const logger = require('../common/logger');

const pool = new Pool({ connectionString: databaseUrl });

pool.on('error', (err) => {
  logger.error('Unexpected DB error ' + err.message);
});

module.exports = pool;