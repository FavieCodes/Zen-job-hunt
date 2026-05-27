const db = require('../config/db');

async function searchScholarships({ country, field, page = 1, limit = 20 }) {
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 20;
  const offset = (pageNum - 1) * limitNum;

  const conditions = [
    'is_active = TRUE',
    '(deadline IS NULL OR deadline >= CURRENT_DATE)',
  ];
  const params = [];
  let i = 1;

  if (country) { conditions.push(`LOWER(country) = LOWER($${i++})`); params.push(country); }
  if (field)   { conditions.push(`field ILIKE $${i++}`);             params.push(`%${field}%`); }

  const whereClause = conditions.join(' AND ');

  // Count query for pagination
  const countResult = await db.query(
    `SELECT COUNT(*) FROM scholarships WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limitNum, offset);
  const limitIdx  = i;
  const offsetIdx = i + 1;

  const sql = `
    SELECT id, title, provider, description, country, field, deadline,
           amount, apply_url, source_url, posted_at, scraped_at
    FROM   scholarships
    WHERE  ${whereClause}
    ORDER  BY deadline ASC NULLS LAST, posted_at DESC
    LIMIT  $${limitIdx} OFFSET $${offsetIdx}
  `;

  const result = await db.query(sql, params);

  return {
    scholarships: result.rows,
    total,
    page: pageNum,
    limit: limitNum,
    pages: Math.ceil(total / limitNum),
  };
}

async function getScholarshipById(id) {
  const result = await db.query(
    'SELECT * FROM scholarships WHERE id = $1 AND is_active = TRUE',
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { searchScholarships, getScholarshipById };