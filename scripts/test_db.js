require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async function(){
  try {
    const res = await pool.query('SELECT NOW() as now');
    console.log('DB OK:', res.rows[0]);
  } catch (err) {
    console.error('DB ERROR:', err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack);
    if (err && err.code) console.error('code:', err.code);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(()=>{});
  }
})();
