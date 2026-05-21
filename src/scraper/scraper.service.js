const axios = require('axios');
const cheerio = require('cheerio');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../config/db');
const logger = require('../common/logger');
const { anthropicKey } = require('../config/env');

// ─── AI clients ──────────────────────────────────────────────────────────────

const anthropicClient = new Anthropic({ apiKey: anthropicKey });

/**
 * AI provider chain — tried in order until one succeeds.
 * Add your free API keys to .env; any provider without a key is skipped.
 *
 *  GROQ_API_KEY   — free at console.groq.com  (llama-3.3-70b-versatile)
 *  GEMINI_API_KEY — free at aistudio.google.com (gemini-1.5-flash)
 *  ANTHROPIC_API_KEY — your existing key (claude-sonnet)
 */
const AI_PROVIDERS = [
  {
    name: 'Anthropic',
    available: () => !!anthropicKey,
    extract: async (prompt) => {
      const msg = await anthropicClient.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });
      return msg.content[0].text.trim();
    },
  },
  {
    name: 'Groq (llama-3.3-70b)',
    available: () => !!process.env.GROQ_API_KEY,
    extract: async (prompt) => {
      const res = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
          temperature: 0,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
      return res.data.choices[0].message.content.trim();
    },
  },
  {
    name: 'Gemini (gemini-1.5-flash)',
    available: () => !!process.env.GEMINI_API_KEY,
    extract: async (prompt) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const res = await axios.post(
        url,
        { contents: [{ parts: [{ text: prompt }] }] },
        { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
      );
      return res.data.candidates[0].content.parts[0].text.trim();
    },
  },
];

// ─── Scrape targets ───────────────────────────────────────────────────────────

const SCRAPE_TARGETS = [
  { url: 'https://remotive.com/remote-jobs',         type: 'jobs' },
  { url: 'https://weworkremotely.com/remote-jobs',   type: 'jobs' },
  { url: 'https://jobberman.com/jobs',               type: 'jobs' },
  { url: 'https://myjobmag.com/jobs',                type: 'jobs' },
  { url: 'https://opportunitydesk.org/scholarships', type: 'scholarships' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchHTML(url) {
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobHuntBot/1.0)' },
    timeout: 15000,
  });
  const $ = cheerio.load(response.data);
  $('script, style, nav, footer, header').remove();
  return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000);
}

function buildPrompt(text, type) {
  const schema =
    type === 'jobs'
      ? `[{ "title":"", "company":"", "country":"", "state":"", "city":"", "job_type":"", "salary":"", "posted_at":"ISO date or null", "source_url":"", "description":"" }]`
      : `[{ "title":"", "provider":"", "country":"", "field":"", "deadline":"YYYY-MM-DD or null", "amount":"", "posted_at":"ISO date or null", "source_url":"", "description":"" }]`;

  return `Extract all ${type} from this page text. Return ONLY a valid JSON array matching this schema:
${schema}

Use null for missing fields. Convert relative dates like "2 days ago" to ISO format using today's date (${new Date().toISOString().split('T')[0]}).
If no ${type} are found, return an empty array [].

Page text:
${text}`;
}

function parseJSON(raw) {
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return [];
  }
}

/**
 * Try each AI provider in order. Returns parsed array from first success.
 * Falls back to [] only if every provider fails.
 */
async function extractWithAI(text, type) {
  const prompt = buildPrompt(text, type);
  const available = AI_PROVIDERS.filter((p) => p.available());

  if (available.length === 0) {
    logger.warn('No AI providers configured — skipping extraction');
    return [];
  }

  for (const provider of available) {
    try {
      logger.debug(`Trying AI provider: ${provider.name}`);
      const raw = await provider.extract(prompt);
      const items = parseJSON(raw);
      logger.info(`AI extraction succeeded via ${provider.name}`, { count: items.length, type });
      return items;
    } catch (err) {
      logger.warn(`AI provider ${provider.name} failed — trying next`, {
        error: err.message,
      });
    }
  }

  logger.error('All AI providers failed for this page', { type });
  return [];
}

// ─── Database helpers ─────────────────────────────────────────────────────────

async function saveJobs(jobs) {
  let saved = 0;
  for (const job of jobs) {
    if (!job.title || !job.source_url) continue;
    try {
      await db.query(
        `INSERT INTO jobs
           (title, company, country, state, city, job_type, salary, source_url, description, posted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (source_url) DO NOTHING`,
        [
          job.title, job.company, job.country, job.state, job.city,
          job.job_type, job.salary, job.source_url, job.description, job.posted_at,
        ]
      );
      saved++;
    } catch (err) {
      logger.warn('Failed to save job', { title: job.title, error: err.message });
    }
  }
  return saved;
}

async function saveScholarships(scholarships) {
  let saved = 0;
  for (const s of scholarships) {
    if (!s.title || !s.source_url) continue;
    try {
      await db.query(
        `INSERT INTO scholarships
           (title, provider, country, field, deadline, amount, source_url, description, posted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (source_url) DO NOTHING`,
        [s.title, s.provider, s.country, s.field, s.deadline, s.amount, s.source_url, s.description, s.posted_at]
      );
      saved++;
    } catch (err) {
      logger.warn('Failed to save scholarship', { title: s.title, error: err.message });
    }
  }
  return saved;
}

// ─── Main runner ──────────────────────────────────────────────────────────────

async function runScraper() {
  const results = { jobs: 0, scholarships: 0, errors: [] };

  for (const target of SCRAPE_TARGETS) {
    try {
      logger.info('Scraping target', { url: target.url, type: target.type });
      const html = await fetchHTML(target.url);
      const items = await extractWithAI(html, target.type);

      if (target.type === 'jobs') {
        results.jobs += await saveJobs(items);
      } else {
        results.scholarships += await saveScholarships(items);
      }
    } catch (err) {
      logger.error('Failed to scrape target', { url: target.url, error: err.message });
      results.errors.push({ url: target.url, error: err.message });
    }
  }

  logger.info('Scraper run complete', results);
  return results;
}

async function deactivateOldListings() {
  await db.query(`UPDATE jobs         SET is_active = FALSE WHERE posted_at < NOW() - INTERVAL '30 days'`);
  await db.query(`UPDATE scholarships SET is_active = FALSE WHERE deadline  < CURRENT_DATE`);
  logger.info('Old listings deactivated');
}

module.exports = { runScraper, deactivateOldListings };