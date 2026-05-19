const db = require('../config/db');
const redis = require('../config/redis');

async function searchJobs({ country, state, city, q, job_type, page = 1 }) {
  const limit = 20;
  const offset = (page - 1) * limit;

  // Build a cache key from the query params
  const cacheKey = `jobs:${country}:${state}:${city}:${q}:${job_type}:${page}`;
  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) return JSON.parse(cached);

  const conditions = [
    'is_active = TRUE',
    "posted_at >= NOW() - INTERVAL '30 days'",
  ];
  const params = [];
  let i = 1;

  if (country)  { conditions.push(`LOWER(country)  = LOWER($${i++})`); params.push(country);  }
  if (state)    { conditions.push(`LOWER(state)    = LOWER($${i++})`); params.push(state);    }
  if (city)     { conditions.push(`LOWER(city)     = LOWER($${i++})`); params.push(city);     }
  if (job_type) { conditions.push(`job_type        = $${i++}`);         params.push(job_type); }
  if (q)        { conditions.push(`(title ILIKE $${i} OR description ILIKE $${i++})`); params.push(`%${q}%`); }

  params.push(limit, offset);

  const sql = `
    SELECT id, title, company, country, state, city,
           job_type, salary, source_url, source_name, posted_at
    FROM   jobs
    WHERE  ${conditions.join(' AND ')}
    ORDER  BY posted_at DESC
    LIMIT  $${i++} OFFSET $${i}
  `;

  const result = await db.query(sql, params);

  // Cache for 1 hour
  await redis.setEx(cacheKey, 3600, JSON.stringify(result.rows)).catch(() => null);

  return result.rows;
}

async function getJobById(id) {
  const result = await db.query(
    'SELECT * FROM jobs WHERE id = $1 AND is_active = TRUE',
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { searchJobs, getJobById };