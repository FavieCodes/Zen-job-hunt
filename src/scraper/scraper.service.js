const axios = require('axios');
const cheerio = require('cheerio');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../config/db');
const { anthropicKey } = require('../config/env');

const client = new Anthropic({ apiKey: anthropicKey });

// The pages to scrape. Add more URLs here as you expand.
const SCRAPE_TARGETS = [
  { url: 'https://remotive.com/remote-jobs',           type: 'jobs' },
  { url: 'https://weworkremotely.com/remote-jobs',     type: 'jobs' },
  { url: 'https://jobberman.com/jobs',                 type: 'jobs' },
  { url: 'https://myjobmag.com/jobs',                  type: 'jobs' },
  { url: 'https://opportunitydesk.org/scholarships',   type: 'scholarships' },
];

// Fetch raw HTML from a URL
async function fetchHTML(url) {
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobHuntBot/1.0)' },
    timeout: 15000,
  });
  // Use cheerio to strip scripts/styles — reduces tokens sent to Claude
  const $ = cheerio.load(response.data);
  $('script, style, nav, footer, header').remove();
  return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000);
}

// Ask Claude to extract structured data from the page text
async function extractWithAI(text, type) {
  const schema = type === 'jobs'
    ? `[{ "title":"", "company":"", "country":"", "state":"", "city":"", "job_type":"", "salary":"", "posted_at":"ISO date or null", "source_url":"", "description":"" }]`
    : `[{ "title":"", "provider":"", "country":"", "field":"", "deadline":"YYYY-MM-DD or null", "amount":"", "posted_at":"ISO date or null", "source_url":"", "description":"" }]`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Extract all ${type} from this page text. Return ONLY a valid JSON array matching this schema:
${schema}

Use null for missing fields. Convert relative dates like "2 days ago" to ISO format using today's date (${new Date().toISOString().split('T')[0]}).
If no ${type} are found, return an empty array [].

Page text:
${text}`,
    }],
  });

  try {
    const raw = message.content[0].text.trim();
    // Strip any markdown code fences Claude might add
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return [];
  }
}

// Save jobs, skip duplicates by source_url
async function saveJobs(jobs) {
  let saved = 0;
  for (const job of jobs) {
    if (!job.title || !job.source_url) continue;
    try {
      await db.query(
        `INSERT INTO jobs (title, company, country, state, city, job_type, salary, source_url, description, posted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (source_url) DO NOTHING`,
        [job.title, job.company, job.country, job.state, job.city,
         job.job_type, job.salary, job.source_url, job.description, job.posted_at]
      );
      saved++;
    } catch (err) {
      console.error('Failed to save job:', job.title, err.message);
    }
  }
  return saved;
}

// Save scholarships, skip duplicates by source_url
async function saveScholarships(scholarships) {
  let saved = 0;
  for (const s of scholarships) {
    if (!s.title || !s.source_url) continue;
    try {
      await db.query(
        `INSERT INTO scholarships (title, provider, country, field, deadline, amount, source_url, description, posted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (source_url) DO NOTHING`,
        [s.title, s.provider, s.country, s.field, s.deadline,
         s.amount, s.source_url, s.description, s.posted_at]
      );
      saved++;
    } catch (err) {
      console.error('Failed to save scholarship:', s.title, err.message);
    }
  }
  return saved;
}

// Main runner — loops through all targets
async function runScraper() {
  const results = { jobs: 0, scholarships: 0, errors: [] };

  for (const target of SCRAPE_TARGETS) {
    try {
      console.log(`Scraping: ${target.url}`);
      const html = await fetchHTML(target.url);
      const items = await extractWithAI(html, target.type);

      if (target.type === 'jobs') {
        results.jobs += await saveJobs(items);
      } else {
        results.scholarships += await saveScholarships(items);
      }
    } catch (err) {
      console.error(`Failed to scrape ${target.url}:`, err.message);
      results.errors.push({ url: target.url, error: err.message });
    }
  }

  return results;
}

// Deactivate listings older than 30 days
async function deactivateOldListings() {
  await db.query(`UPDATE jobs         SET is_active = FALSE WHERE posted_at < NOW() - INTERVAL '30 days'`);
  await db.query(`UPDATE scholarships SET is_active = FALSE WHERE deadline  < CURRENT_DATE`);
  console.log('Old listings deactivated');
}

module.exports = { runScraper, deactivateOldListings };