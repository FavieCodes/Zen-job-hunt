const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../config/db');
const logger = require('../common/logger');
const { anthropicKey, groqKey, geminiKey } = require('../config/env');

// ─── AI providers ──────────────────────────────────────────────────────────────
const AI_PROVIDERS = [
  {
    name: 'Groq (llama-3.3-70b)',
    available: () => !!groqKey,
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
            Authorization: `Bearer ${groqKey}`,
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
    available: () => !!geminiKey,
    extract: async (prompt) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const res = await axios.post(
        url,
        { contents: [{ parts: [{ text: prompt }] }] },
        { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
      );
      return res.data.candidates[0].content.parts[0].text.trim();
    },
  },
  {
    name: 'Anthropic (claude-sonnet-4-6)',
    available: () => !!anthropicKey,
    extract: async (prompt) => {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: anthropicKey });
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',  
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });
      return msg.content[0].text.trim();
    },
  },
];

// ─── Scrape targets ────────────────────────────────────────────────────────────
const SCRAPE_TARGETS = [
  // ── Reliable remote/global job boards ─────────────────────────────────────
  { url: 'https://remotive.com/remote-jobs',                    type: 'jobs', name: 'Remotive' },
  { url: 'https://weworkremotely.com/remote-jobs',              type: 'jobs', name: 'We Work Remotely' },
  { url: 'https://startup.jobs',                                type: 'jobs', name: 'Startup Jobs' },
  { url: 'https://www.ycombinator.com/jobs',                    type: 'jobs', name: 'Y Combinator' },

  // ── Nigeria / Africa job boards ────────────────────────────────────────────
  { url: 'https://jobberman.com/jobs',                          type: 'jobs', name: 'Jobberman' },
  { url: 'https://myjobmag.com/jobs',                           type: 'jobs', name: 'MyJobMag' },
  { url: 'https://www.ngcareers.com/jobs',                      type: 'jobs', name: 'NGCareers' },
  { url: 'https://www.hotnigerianjobs.com',                     type: 'jobs', name: 'Hot Nigerian Jobs' },
  { url: 'https://www.jobgurus.com.ng',                         type: 'jobs', name: 'JobGurus Nigeria' },
  { url: 'https://www.fuzu.com/nigeria/jobs',                   type: 'jobs', name: 'Fuzu Nigeria' },
  { url: 'https://www.brightermonday.com/jobs',                 type: 'jobs', name: 'Brighter Monday' },
  { url: 'https://africaopportunities.com/jobs/',               type: 'jobs', name: 'Africa Opportunities' },
  { url: 'https://www.ethiojobs.net',                           type: 'jobs', name: 'EthioJobs' },

  // ── Tech-specific boards ───────────────────────────────────────────────────
  { url: 'https://www.techinafrica.com/jobs/',                  type: 'jobs', name: 'Tech in Africa' },
  { url: 'https://jobs.lever.co',                               type: 'jobs', name: 'Lever' },

  // ── Scholarships ───────────────────────────────────────────────────────────
  { url: 'https://opportunitydesk.org/scholarships',            type: 'scholarships', name: 'Opportunity Desk' },
  { url: 'https://www.scholars4dev.com',                        type: 'scholarships', name: 'Scholars4Dev' },
  { url: 'https://www.afterschoolafrica.com/scholarships',      type: 'scholarships', name: 'Afterschool Africa' },
  { url: 'https://scholarshipscorner.website',                  type: 'scholarships', name: 'Scholarships Corner' },
];

// ─── Fetch helpers ─────────────────────────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

function randomAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchHTML(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': randomAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    timeout: 20000,
    maxRedirects: 5,
  });

  // Reject non-HTML responses 
  const contentType = response.headers['content-type'] || '';
  if (!contentType.includes('text/html')) {
    throw new Error(`Unexpected content-type: ${contentType}`);
  }

  const $ = cheerio.load(response.data);
  $('script, style, nav, footer, header, iframe, noscript, .ads, .advertisement, [class*="cookie"], [id*="cookie"]').remove();

  const text = $('body').text().replace(/\s+/g, ' ').trim();

  // Bail out early if the page is clearly a captcha / login wall
  if (text.length < 200) {
    throw new Error(`Page returned too little content (${text.length} chars) — likely blocked or redirected to login`);
  }

  return text.slice(0, 14000);
}

// ─── AI extraction ─────────────────────────────────────────────────────────────
function buildPrompt(text, type, sourceName) {
  const today = new Date().toISOString().split('T')[0];

  const schema =
    type === 'jobs'
      ? `[{ "title":"", "company":"", "country":"", "state":"", "city":"", "job_type":"full-time|part-time|contract|remote|internship", "salary":"", "posted_at":"YYYY-MM-DDTHH:mm:ssZ or null", "source_url":"full URL or null", "description":"2-3 sentence summary" }]`
      : `[{ "title":"", "provider":"", "country":"", "field":"", "deadline":"YYYY-MM-DD or null", "amount":"", "posted_at":"YYYY-MM-DDTHH:mm:ssZ or null", "source_url":"full URL or null", "description":"2-3 sentence summary" }]`;

  return `You are a data extraction bot. Extract all ${type} from the page text below (source: ${sourceName}).

Return ONLY a valid JSON array. No markdown, no explanation, no code fences — just the raw JSON array.
Schema: ${schema}

Rules:
- Use null for any missing field
- Convert relative dates ("2 days ago", "posted yesterday") to ISO format using today: ${today}
- job_type must be one of: full-time, part-time, contract, remote, internship (guess from context if not stated)
- If no ${type} are found at all, return []
- Extract as many listings as visible, up to 30

Page text:
${text}`;
}

function parseJSON(raw) {
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : (parsed.jobs || parsed.scholarships || parsed.data || []);
  } catch {
    return [];
  }
}

async function extractWithAI(text, type, sourceName) {
  const prompt = buildPrompt(text, type, sourceName);
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
      logger.info(`Extraction OK via ${provider.name}`, { count: items.length, type, source: sourceName });
      return items;
    } catch (err) {
      // Log error message 
      logger.warn(`Provider ${provider.name} failed — trying next`, {
        error: err.response?.data?.error?.message || err.message,
        status: err.response?.status,
      });
    }
  }

  logger.error('All AI providers failed', { type, source: sourceName });
  return [];
}

// ─── Database saves ────────────────────────────────────────────────────────────
async function saveJobs(jobs, sourceName) {
  let saved = 0;
  for (const job of jobs) {
    if (!job.title) continue;

    const sourceUrl = job.source_url || `scraped:${sourceName}:${job.title.slice(0, 60)}`;

    try {
      await db.query(
        `INSERT INTO jobs
           (title, company, country, state, city, job_type, salary,
            source_url, source_name, description, posted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (source_url) DO NOTHING`,
        [
          job.title, job.company, job.country, job.state, job.city,
          job.job_type, job.salary, sourceUrl, sourceName,
          job.description, job.posted_at,
        ]
      );
      saved++;
    } catch (err) {
      logger.warn('Failed to save job', { title: job.title, error: err.message });
    }
  }
  return saved;
}

async function saveScholarships(scholarships, sourceName) {
  let saved = 0;
  for (const s of scholarships) {
    if (!s.title) continue;

    const sourceUrl = s.source_url || `scraped:${sourceName}:${s.title.slice(0, 60)}`;

    try {
      await db.query(
        `INSERT INTO scholarships
           (title, provider, country, field, deadline, amount,
            source_url, description, posted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (source_url) DO NOTHING`,
        [s.title, s.provider, s.country, s.field, s.deadline,
         s.amount, sourceUrl, s.description, s.posted_at]
      );
      saved++;
    } catch (err) {
      logger.warn('Failed to save scholarship', { title: s.title, error: err.message });
    }
  }
  return saved;
}

// ─── Main runner ───────────────────────────────────────────────────────────────
async function runScraper() {
  const results = { jobs: 0, scholarships: 0, errors: [] };

  for (const target of SCRAPE_TARGETS) {
    try {
      logger.info(`Scraping: ${target.name}`, { url: target.url });
      const text = await fetchHTML(target.url);
      const items = await extractWithAI(text, target.type, target.name);

      if (target.type === 'jobs') {
        results.jobs += await saveJobs(items, target.name);
      } else {
        results.scholarships += await saveScholarships(items, target.name);
      }

      //  delay between requests
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      logger.error(`Failed to scrape: ${target.name}`, { url: target.url, error: err.message });
      results.errors.push({ url: target.url, name: target.name, error: err.message });
    }
  }

  logger.info('Scraper run complete', results);
  return results;
}

async function deactivateOldListings() {
  await db.query(`UPDATE jobs SET is_active = FALSE WHERE posted_at < NOW() - INTERVAL '30 days' AND posted_at IS NOT NULL`);
  await db.query(`UPDATE scholarships SET is_active = FALSE WHERE deadline < CURRENT_DATE`);
  logger.info('Old listings deactivated');
}

module.exports = { runScraper, deactivateOldListings };