const { Pool } = require('pg');
const { databaseUrl } = require('./env');

const pool = new Pool({ connectionString: databaseUrl });

pool.on('error', (err) => {
  console.error('Unexpected DB error', err);
});

module.exports = pool;