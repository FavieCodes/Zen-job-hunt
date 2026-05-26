const db = require('../config/db');

async function searchScholarships({ country, field, page = 1 }) {
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions = [
    'is_active = TRUE',
    '(deadline IS NULL OR deadline >= CURRENT_DATE)',
  ];
  const params = [];
  let i = 1;

  if (country) { conditions.push(`LOWER(country) = LOWER($${i++})`); params.push(country); }
  if (field)   { conditions.push(`field ILIKE $${i++}`);             params.push(`%${field}%`); }

  params.push(limit, offset);
  const limitIdx  = i;
  const offsetIdx = i + 1;

  const sql = `
    SELECT id, title, provider, country, field, deadline,
           amount, apply_url, source_url, posted_at, scraped_at
    FROM   scholarships
    WHERE  ${conditions.join(' AND ')}
    ORDER  BY deadline ASC NULLS LAST, posted_at DESC
    LIMIT  $${limitIdx} OFFSET $${offsetIdx}
  `;

  const result = await db.query(sql, params);
  return result.rows;
}

module.exports = { searchScholarships };