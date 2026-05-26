const db = require('../config/db');
const redis = require('../config/redis');

async function searchJobs({ country, state, city, q, job_type, page = 1 }) {
  const limit = 20;
  const offset = (page - 1) * limit;

  const cacheKey = `jobs:${country}:${state}:${city}:${q}:${job_type}:${page}`;
  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) return JSON.parse(cached);

  const conditions = [
    'is_active = TRUE',
    "(posted_at IS NULL OR posted_at >= NOW() - INTERVAL '30 days')",
  ];
  const params = [];
  let i = 1;

  if (country)  { conditions.push(`LOWER(country)  = LOWER($${i++})`); params.push(country);  }
  if (state)    { conditions.push(`LOWER(state)    = LOWER($${i++})`); params.push(state);    }
  if (city)     { conditions.push(`LOWER(city)     = LOWER($${i++})`); params.push(city);     }
  if (job_type) { conditions.push(`job_type        = $${i++}`);        params.push(job_type); }
  if (q) {
    conditions.push(`(title ILIKE $${i} OR description ILIKE $${i})`);
    params.push(`%${q}%`);
    i++;
  }

  params.push(limit, offset);
  const limitIdx  = i;
  const offsetIdx = i + 1;

  const sql = `
    SELECT id, title, company, country, state, city,
           job_type, salary, apply_url, source_url, source_name, posted_at, scraped_at
    FROM   jobs
    WHERE  ${conditions.join(' AND ')}
    ORDER  BY COALESCE(posted_at, scraped_at) DESC
    LIMIT  $${limitIdx} OFFSET $${offsetIdx}
  `;

  const result = await db.query(sql, params);
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