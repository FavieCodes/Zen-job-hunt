require('dotenv').config({ path: '../.env' });
const db = require('./config/db');

(async () => {
  try {
    const res = await db.query('SELECT count(*) FROM scholarships');
    console.log('Scholarships count:', res.rows[0].count);
    const res2 = await db.query('SELECT count(*) FROM jobs');
    console.log('Jobs count:', res2.rows[0].count);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
