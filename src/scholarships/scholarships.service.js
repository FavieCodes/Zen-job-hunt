const db = require('../config/db');

async function searchScholarships({ country, field, page = 1 }) {
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions = ['is_active = TRUE'];
  const params = [];
  let i = 1;

  if (country) { conditions.push(`LOWER(country) = LOWER($${i++})`); params.push(country); }
  if (field)   { conditions.push(`LOWER(field)   ILIKE $${i++}`);    params.push(`%${field}%`); }

  // Only scholarships with a future deadline or no deadline set
  conditions.push(`(deadline IS NULL OR deadline >= CURRENT_DATE)`);

  params.push(limit, offset);

  const sql = `
    SELECT id, title, provider, country, field, deadline, amount, source_url, posted_at
    FROM   scholarships
    WHERE  ${conditions.join(' AND ')}
    ORDER  BY deadline ASC NULLS LAST, posted_at DESC
    LIMIT  $${i++} OFFSET $${i}
  `;

  const result = await db.query(sql, params);
  return result.rows;
}

module.exports = { searchScholarships };