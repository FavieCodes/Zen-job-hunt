const axios = require('axios');
const cheerio = require('cheerio');
const xml2js = require('xml2js');
const db = require('../config/db');
const logger = require('../common/logger');
const { anthropicKey, groqKey, geminiKey, adzunaAppId, adzunaAppKey } = require('../config/env');

// ═══════════════════════════════════════════════════════════════════════════════
// AI PROVIDERS  (used only for HTML scrape targets)
// ═══════════════════════════════════════════════════════════════════════════════
const AI_PROVIDERS = [
  {
    name: 'Groq (llama-3.3-70b)',
    available: () => !!groqKey,
    extract: async (prompt) => {
      const res = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: 2000, temperature: 0 },
        { headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' }, timeout: 30000 }
      );
      return res.data.choices[0].message.content.trim();
    },
  },
  {
    name: 'Gemini (gemini-1.5-flash)',
    available: () => !!geminiKey,
    extract: async (prompt) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const res = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }] }, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
      return res.data.candidates[0].content.parts[0].text.trim();
    },
  },
  {
    name: 'Anthropic (claude-sonnet-4-6)',
    available: () => !!anthropicKey,
    extract: async (prompt) => {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: anthropicKey });
      const msg = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] });
      return msg.content[0].text.trim();
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HTML SCRAPE TARGETS  (AI-extracted)
// ═══════════════════════════════════════════════════════════════════════════════
const HTML_TARGETS = [
  { url: 'https://remotive.com/remote-jobs',               type: 'jobs',         name: 'Remotive' },
  { url: 'https://weworkremotely.com/remote-jobs',         type: 'jobs',         name: 'We Work Remotely' },
  { url: 'https://www.ngcareers.com/jobs',                 type: 'jobs',         name: 'NGCareers' },
  { url: 'https://www.hotnigerianjobs.com',                type: 'jobs',         name: 'Hot Nigerian Jobs' },
  { url: 'https://www.jobgurus.com.ng',                    type: 'jobs',         name: 'JobGurus Nigeria' },
  { url: 'https://www.fuzu.com/nigeria/jobs',              type: 'jobs',         name: 'Fuzu Nigeria' },
  { url: 'https://www.brightermonday.com/jobs',            type: 'jobs',         name: 'Brighter Monday' },
  { url: 'https://jobberman.com/jobs',                     type: 'jobs',         name: 'Jobberman' },
  { url: 'https://myjobmag.com/jobs',                      type: 'jobs',         name: 'MyJobMag' },
  { url: 'https://jobs.lever.co',                          type: 'jobs',         name: 'Lever' },
  { url: 'https://www.ycombinator.com/jobs',               type: 'jobs',         name: 'Y Combinator' },
  { url: 'https://opportunitydesk.org/scholarships',       type: 'scholarships', name: 'Opportunity Desk' },
  { url: 'https://www.scholars4dev.com',                   type: 'scholarships', name: 'Scholars4Dev' },
  { url: 'https://scholarshipscorner.website',             type: 'scholarships', name: 'Scholarships Corner' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// RSS FEED TARGETS  (structured — no AI needed)
// ═══════════════════════════════════════════════════════════════════════════════
const RSS_TARGETS = [
  // Jobs
  { url: 'https://remotive.com/remote-jobs/feed',                     type: 'jobs',         name: 'Remotive RSS' },
  { url: 'https://weworkremotely.com/remote-jobs.rss',                type: 'jobs',         name: 'WWR RSS' },
  { url: 'https://jobicy.com/?feed=job_feed',                         type: 'jobs',         name: 'Jobicy RSS' },
  { url: 'https://jobicy.com/?feed=job_feed&job_region=nigeria',      type: 'jobs',         name: 'Jobicy Nigeria RSS' },
  { url: 'https://jobicy.com/?feed=job_feed&job_region=africa',       type: 'jobs',         name: 'Jobicy Africa RSS' },
  { url: 'https://www.ngcareers.com/feed',                            type: 'jobs',         name: 'NGCareers RSS' },
  { url: 'https://www.hotnigerianjobs.com/feed/',                     type: 'jobs',         name: 'Hot Nigerian Jobs RSS' },
  { url: 'https://www.jobberman.com/feeds/jobs.rss',                  type: 'jobs',         name: 'Jobberman RSS' },
  { url: 'https://stackoverflow.com/jobs/feed',                       type: 'jobs',         name: 'Stack Overflow Jobs RSS' },
  { url: 'https://www.authenticjobs.com/feed/',                       type: 'jobs',         name: 'Authentic Jobs RSS' },
  { url: 'https://www.thetechladder.com/rss',                         type: 'jobs',         name: 'Tech Ladder RSS' },
  // Scholarships
  { url: 'https://opportunitydesk.org/feed/',                         type: 'scholarships', name: 'Opportunity Desk RSS' },
  { url: 'https://www.scholars4dev.com/feed/',                        type: 'scholarships', name: 'Scholars4Dev RSS' },
  { url: 'https://www.afterschoolafrica.com/feed/',                   type: 'scholarships', name: 'Afterschool Africa RSS' },
  { url: 'https://scholarshipscorner.website/feed/',                  type: 'scholarships', name: 'Scholarships Corner RSS' },
  { url: 'https://www.scholarshipsads.com/feed/',                     type: 'scholarships', name: 'ScholarshipsAds RSS' },
  { url: 'https://www.scholars4dev.com/category/scholarships-for-africans/feed/', type: 'scholarships', name: 'Scholars4Dev Africa RSS' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// FREE API TARGETS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Remotive public API (no key) ──────────────────────────────────────────────
async function fetchRemotiveAPI() {
  try {
    const res = await axios.get('https://remotive.com/api/remote-jobs?limit=100', { timeout: 15000 });
    const jobs = res.data.jobs || [];
    logger.info(`Remotive API: ${jobs.length} jobs`);
    return jobs.map((j) => ({
      title:       j.title,
      company:     j.company_name,
      description: j.description?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 500) || null,
      country:     null,
      state:       null,
      city:        null,
      job_type:    normalizeJobType(j.job_type),
      salary:      j.salary || null,
      apply_url:   j.url || null,
      source_url:  j.url || null,
      source_name: 'Remotive API',
      posted_at:   j.publication_date || null,
    }));
  } catch (err) {
    logger.warn('Remotive API failed', { error: err.message });
    return [];
  }
}

// ── Jobicy public API (no key) ────────────────────────────────────────────────
async function fetchJobicyAPI() {
  try {
    const res = await axios.get('https://jobicy.com/api/v2/remote-jobs?count=50&geo=nigeria', { timeout: 15000 });
    const jobs = res.data.jobs || [];
    // Also fetch global
    const res2 = await axios.get('https://jobicy.com/api/v2/remote-jobs?count=50', { timeout: 15000 });
    const allJobs = [...jobs, ...(res2.data.jobs || [])];
    logger.info(`Jobicy API: ${allJobs.length} jobs`);
    return allJobs.map((j) => ({
      title:       j.jobTitle,
      company:     j.companyName,
      description: j.jobExcerpt?.slice(0, 500) || null,
      country:     j.jobGeo || null,
      state:       null,
      city:        null,
      job_type:    normalizeJobType(j.jobType),
      salary:      j.annualSalaryMin ? `${j.annualSalaryMin}–${j.annualSalaryMax} ${j.salaryCurrency}` : null,
      apply_url:   j.url || null,
      source_url:  j.url || null,
      source_name: 'Jobicy API',
      posted_at:   j.pubDate || null,
    }));
  } catch (err) {
    logger.warn('Jobicy API failed', { error: err.message });
    return [];
  }
}

// ── The Muse API (no key needed for basic usage) ──────────────────────────────
async function fetchTheMuseAPI() {
  try {
    const pages = [1, 2, 3];
    const allJobs = [];
    for (const page of pages) {
      const res = await axios.get(`https://www.themuse.com/api/public/jobs?page=${page}&descending=true`, { timeout: 15000 });
      allJobs.push(...(res.data.results || []));
      await delay(500);
    }
    logger.info(`The Muse API: ${allJobs.length} jobs`);
    return allJobs.map((j) => {
      const loc = j.locations?.[0]?.name || null;
      return {
        title:       j.name,
        company:     j.company?.name || null,
        description: j.contents?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 500) || null,
        country:     loc,
        state:       null,
        city:        loc,
        job_type:    normalizeJobType(j.type),
        salary:      null,
        apply_url:   j.refs?.landing_page || null,
        source_url:  j.refs?.landing_page || null,
        source_name: 'The Muse API',
        posted_at:   j.publication_date || null,
      };
    });
  } catch (err) {
    logger.warn('The Muse API failed', { error: err.message });
    return [];
  }
}

// ── Adzuna API (free tier — 250 req/day — sign up at developer.adzuna.com) ────
async function fetchAdzunaAPI() {
  if (!adzunaAppId || !adzunaAppKey) {
    logger.debug('Adzuna API skipped — ADZUNA_APP_ID / ADZUNA_APP_KEY not set');
    return [];
  }
  const searches = [
    { country: 'ng', what: 'developer', where: 'nigeria' },
    { country: 'ng', what: 'engineer',  where: 'nigeria' },
    { country: 'ng', what: 'designer',  where: 'nigeria' },
    { country: 'gb', what: 'developer remote' },
    { country: 'us', what: 'developer remote' },
  ];
  const allJobs = [];
  for (const s of searches) {
    try {
      const params = new URLSearchParams({
        app_id:        adzunaAppId,
        app_key:       adzunaAppKey,
        results_per_page: 50,
        what:          s.what,
        ...(s.where ? { where: s.where } : {}),
        sort_by:       'date',
      });
      const url = `https://api.adzuna.com/v1/api/jobs/${s.country}/search/1?${params}`;
      const res = await axios.get(url, { timeout: 15000 });
      allJobs.push(...(res.data.results || []));
      await delay(300);
    } catch (err) {
      logger.warn(`Adzuna search failed (${s.country}/${s.what})`, { error: err.message });
    }
  }
  logger.info(`Adzuna API: ${allJobs.length} jobs`);
  return allJobs.map((j) => ({
    title:       j.title,
    company:     j.company?.display_name || null,
    description: j.description?.slice(0, 500) || null,
    country:     j.location?.area?.[0] || null,
    state:       j.location?.area?.[1] || null,
    city:        j.location?.display_name || null,
    job_type:    normalizeJobType(j.contract_time),
    salary:      j.salary_min ? `${j.salary_min}–${j.salary_max}` : null,
    apply_url:   j.redirect_url || null,
    source_url:  j.redirect_url || null,
    source_name: 'Adzuna',
    posted_at:   j.created || null,
  }));
}

// ── DevITjobs API (no key, Europe + remote) ───────────────────────────────────
async function fetchDevITJobsAPI() {
  try {
    const res = await axios.get('https://www.devitjobs.uk/api/jobsLight', { timeout: 15000 });
    const jobs = Array.isArray(res.data) ? res.data.slice(0, 100) : [];
    logger.info(`DevITJobs API: ${jobs.length} jobs`);
    return jobs.map((j) => ({
      title:       j.title,
      company:     j.company || null,
      description: j.excerpt?.slice(0, 500) || null,
      country:     j.location || null,
      state:       null,
      city:        j.location || null,
      job_type:    normalizeJobType(j.type),
      salary:      j.salary || null,
      apply_url:   j.url || null,
      source_url:  j.url || null,
      source_name: 'DevITJobs',
      posted_at:   j.date || null,
    }));
  } catch (err) {
    logger.warn('DevITJobs API failed', { error: err.message });
    return [];
  }
}

// ── Arbeitnow API (no key, remote + international) ────────────────────────────
async function fetchArbeitnowAPI() {
  try {
    const allJobs = [];
    for (let page = 1; page <= 3; page++) {
      const res = await axios.get(`https://arbeitnow.com/api/job-board-api?page=${page}`, { timeout: 15000 });
      allJobs.push(...(res.data.data || []));
      await delay(300);
    }
    logger.info(`Arbeitnow API: ${allJobs.length} jobs`);
    return allJobs.map((j) => ({
      title:       j.title,
      company:     j.company_name,
      description: j.description?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 500) || null,
      country:     j.location || null,
      state:       null,
      city:        j.location || null,
      job_type:    j.remote ? 'remote' : normalizeJobType(j.job_types?.[0]),
      salary:      null,
      apply_url:   j.url || null,
      source_url:  j.url || null,
      source_name: 'Arbeitnow',
      posted_at:   j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
    }));
  } catch (err) {
    logger.warn('Arbeitnow API failed', { error: err.message });
    return [];
  }
}

// ── JSearch via RapidAPI — skipped (paid). Use Adzuna free instead ─────────────

// ═══════════════════════════════════════════════════════════════════════════════
// RSS PARSER
// ═══════════════════════════════════════════════════════════════════════════════
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
];
const randomAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

async function fetchRSS(url) {
  const res = await axios.get(url, {
    headers: { 'User-Agent': randomAgent(), Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    timeout: 15000,
  });
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
  const result = await parser.parseStringPromise(res.data);
  const items = result?.rss?.channel?.item || result?.feed?.entry || [];
  return Array.isArray(items) ? items : [items];
}

function rssItemToJob(item, sourceName) {
  const title   = item.title?._ || item.title || '';
  const link    = item.link?._ || item.link || item.guid?._ || item.guid || null;
  const pubDate = item.pubDate || item.published || item['dc:date'] || null;
  const desc    = (item.description || item.summary || item.content || '')
    .toString().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

  // Try to guess company from title "Role at Company"
  const atMatch = title.match(/\bat\s+(.+)$/i);
  const company = atMatch ? atMatch[1].trim() : null;

  return {
    title:       title.replace(/\s+at\s+.+$/i, '').trim() || title,
    company,
    description: desc || null,
    country:     null,
    state:       null,
    city:        null,
    job_type:    'remote',
    salary:      null,
    apply_url:   link,
    source_url:  link,
    source_name: sourceName,
    posted_at:   pubDate ? new Date(pubDate).toISOString() : null,
  };
}

function rssItemToScholarship(item, sourceName) {
  const title   = item.title?._ || item.title || '';
  const link    = item.link?._ || item.link || item.guid?._ || item.guid || null;
  const pubDate = item.pubDate || item.published || null;
  const desc    = (item.description || item.summary || '')
    .toString().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

  // Try to detect deadline from description
  const deadlineMatch = desc.match(/deadline[:\s]+([A-Za-z]+ \d{1,2},?\s*\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  let deadline = null;
  if (deadlineMatch) {
    const d = new Date(deadlineMatch[1]);
    if (!isNaN(d)) deadline = d.toISOString().split('T')[0];
  }

  return {
    title:       title,
    provider:    null,
    description: desc || null,
    country:     null,
    field:       null,
    deadline,
    amount:      null,
    apply_url:   link,
    source_url:  link,
    source_name: sourceName,
    posted_at:   pubDate ? new Date(pubDate).toISOString() : null,
  };
}

async function runRSSTarget(target) {
  try {
    const items = await fetchRSS(target.url);
    logger.info(`RSS OK: ${target.name} — ${items.length} items`);
    return items.map((item) =>
      target.type === 'jobs'
        ? rssItemToJob(item, target.name)
        : rssItemToScholarship(item, target.name)
    );
  } catch (err) {
    logger.warn(`RSS failed: ${target.name}`, { error: err.message });
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTML SCRAPE + AI EXTRACTION  (unchanged logic, kept for sites with no API/RSS)
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchHTML(url) {
  const response = await axios.get(url, {
    headers: { 'User-Agent': randomAgent(), Accept: 'text/html,application/xhtml+xml,*/*', 'Accept-Language': 'en-US,en;q=0.5' },
    timeout: 20000,
    maxRedirects: 5,
  });
  const contentType = response.headers['content-type'] || '';
  if (!contentType.includes('text/html')) throw new Error(`Unexpected content-type: ${contentType}`);
  const $ = cheerio.load(response.data);
  $('script, style, nav, footer, header, iframe, noscript, .ads, .advertisement, [class*="cookie"], [id*="cookie"]').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  if (text.length < 200) throw new Error(`Page too short (${text.length} chars) — likely blocked`);
  return text.slice(0, 14000);
}

function buildPrompt(text, type, sourceName) {
  const today = new Date().toISOString().split('T')[0];
  const schema = type === 'jobs'
    ? `[{"title":"","company":"","country":"","state":"","city":"","job_type":"full-time|part-time|contract|remote|internship","salary":"","apply_url":"direct application URL or null","posted_at":"YYYY-MM-DDTHH:mm:ssZ or null","source_url":"full URL or null","description":"2-3 sentence summary"}]`
    : `[{"title":"","provider":"","country":"","field":"","deadline":"YYYY-MM-DD or null","amount":"","apply_url":"direct application URL or null","posted_at":"YYYY-MM-DDTHH:mm:ssZ or null","source_url":"full URL or null","description":"2-3 sentence summary"}]`;
  return `Extract all ${type} from the page text below (source: ${sourceName}).
Return ONLY a valid JSON array, no markdown, no explanation.
Schema: ${schema}
Rules: use null for missing fields. Convert relative dates to ISO using today=${today}. job_type must be one of: full-time|part-time|contract|remote|internship. Return [] if none found. Extract up to 30.
Page text:
${text}`;
}

function parseJSON(raw) {
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : (parsed.jobs || parsed.scholarships || parsed.data || []);
  } catch { return []; }
}

async function extractWithAI(text, type, sourceName) {
  const prompt = buildPrompt(text, type, sourceName);
  const available = AI_PROVIDERS.filter((p) => p.available());
  if (available.length === 0) { logger.warn('No AI providers configured'); return []; }
  for (const provider of available) {
    try {
      const raw = await provider.extract(prompt);
      const items = parseJSON(raw);
      logger.info(`Extraction OK via ${provider.name}`, { count: items.length, type, source: sourceName });
      return items;
    } catch (err) {
      logger.warn(`Provider ${provider.name} failed`, { error: err.response?.data?.error?.message || err.message, status: err.response?.status });
    }
  }
  logger.error('All AI providers failed', { type, source: sourceName });
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE SAVES
// ═══════════════════════════════════════════════════════════════════════════════
async function saveJobs(jobs, sourceName) {
  let saved = 0;
  for (const job of jobs) {
    if (!job.title?.trim()) continue;
    const sourceUrl = job.source_url || `scraped:${sourceName}:${job.title.slice(0, 60)}`;
    try {
      const res = await db.query(
        `INSERT INTO jobs (title,company,description,country,state,city,job_type,salary,apply_url,source_url,source_name,posted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (source_url) DO NOTHING
         RETURNING id`,
        [job.title, job.company||null, job.description||null, job.country||null, job.state||null,
         job.city||null, job.job_type||null, job.salary||null, job.apply_url||null,
         sourceUrl, job.source_name||sourceName, job.posted_at||null]
      );
      if (res.rows.length > 0) saved++;
    } catch (err) {
      logger.warn('Failed to save job', { title: job.title, error: err.message });
    }
  }
  return saved;
}

async function saveScholarships(scholarships, sourceName) {
  let saved = 0;
  for (const s of scholarships) {
    if (!s.title?.trim()) continue;
    const sourceUrl = s.source_url || `scraped:${sourceName}:${s.title.slice(0, 60)}`;
    try {
      const res = await db.query(
        `INSERT INTO scholarships (title,provider,description,country,field,deadline,amount,apply_url,source_url,posted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (source_url) DO NOTHING
         RETURNING id`,
        [s.title, s.provider||null, s.description||null, s.country||null, s.field||null,
         s.deadline||null, s.amount||null, s.apply_url||null, sourceUrl, s.posted_at||null]
      );
      if (res.rows.length > 0) saved++;
    } catch (err) {
      logger.warn('Failed to save scholarship', { title: s.title, error: err.message });
    }
  }
  return saved;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function normalizeJobType(raw) {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v.includes('part'))       return 'part-time';
  if (v.includes('contract'))   return 'contract';
  if (v.includes('intern'))     return 'internship';
  if (v.includes('remote'))     return 'remote';
  if (v.includes('full'))       return 'full-time';
  return 'full-time';
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN RUNNER
// ═══════════════════════════════════════════════════════════════════════════════
async function runScraper() {
  const results = { jobs: 0, scholarships: 0, errors: [] };

  // ── 1. Free structured APIs (fastest, most reliable) ──────────────────────
  logger.info('── Phase 1: Free APIs ──────────────────────');
  const apiJobs = await Promise.allSettled([
    fetchRemotiveAPI(),
    fetchJobicyAPI(),
    fetchTheMuseAPI(),
    fetchAdzunaAPI(),
    fetchDevITJobsAPI(),
    fetchArbeitnowAPI(),
  ]);
  for (const r of apiJobs) {
    if (r.status === 'fulfilled' && r.value.length > 0) {
      results.jobs += await saveJobs(r.value, r.value[0]?.source_name || 'API');
    }
  }

  // ── 2. RSS feeds (structured, no AI needed) ────────────────────────────────
  logger.info('── Phase 2: RSS Feeds ──────────────────────');
  for (const target of RSS_TARGETS) {
    const items = await runRSSTarget(target);
    if (target.type === 'jobs') {
      results.jobs += await saveJobs(items, target.name);
    } else {
      results.scholarships += await saveScholarships(items, target.name);
    }
    await delay(800);
  }

  // ── 3. HTML scrape + AI (for sites with no API or RSS) ────────────────────
  logger.info('── Phase 3: HTML + AI scrape ───────────────');
  for (const target of HTML_TARGETS) {
    try {
      logger.info(`Scraping: ${target.name}`);
      const text = await fetchHTML(target.url);
      const items = await extractWithAI(text, target.type, target.name);
      if (target.type === 'jobs') {
        results.jobs += await saveJobs(items, target.name);
      } else {
        results.scholarships += await saveScholarships(items, target.name);
      }
    } catch (err) {
      logger.error(`Failed to scrape: ${target.name}`, { error: err.message });
      results.errors.push({ name: target.name, url: target.url, error: err.message });
    }
    await delay(1500);
  }

  logger.info('Scraper run complete', { jobs: results.jobs, scholarships: results.scholarships, errors: results.errors.length });
  return results;
}

async function deactivateOldListings() {
  await db.query(`UPDATE jobs SET is_active = FALSE WHERE posted_at < NOW() - INTERVAL '30 days' AND posted_at IS NOT NULL`);
  await db.query(`UPDATE scholarships SET is_active = FALSE WHERE deadline < CURRENT_DATE`);
  logger.info('Old listings deactivated');
}

module.exports = { runScraper, deactivateOldListings };