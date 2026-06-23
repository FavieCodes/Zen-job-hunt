const axios = require('axios');
const cheerio = require('cheerio');
const xml2js = require('xml2js');
const db = require('../config/db');
const redis = require('../config/redis');
const logger = require('../common/logger');
const { anthropicKey, groqKey, geminiKey, adzunaAppId, adzunaAppKey } = require('../config/env');

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function normalizeJobType(raw) {
  if (!raw) return null;
  const v = String(raw).toLowerCase();
  if (v.includes('part'))     return 'part-time';
  if (v.includes('contract')) return 'contract';
  if (v.includes('intern'))   return 'internship';
  if (v.includes('remote'))   return 'remote';
  if (v.includes('full'))     return 'full-time';
  if (v.includes('freelan'))  return 'contract';
  return 'full-time';
}

function stripHtml(html = '') {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
];
const randomAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

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
        { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: 4000, temperature: 0 },
        { headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' }, timeout: 45000 }
      );
      return res.data.choices[0].message.content.trim();
    },
  },
  {
    name: 'Gemini (gemini-1.5-flash)',
    available: () => !!geminiKey,
    extract: async (prompt) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const res = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }] }, { headers: { 'Content-Type': 'application/json' }, timeout: 45000 });
      return res.data.candidates[0].content.parts[0].text.trim();
    },
  },
  {
    name: 'Anthropic (claude-sonnet-4-6)',
    available: () => !!anthropicKey,
    extract: async (prompt) => {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: anthropicKey });
      const msg = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] });
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
  { url: 'https://www.afterschoolafrica.com/scholarships', type: 'scholarships', name: 'Afterschool Africa' },
  { url: 'https://www.opportunitiesforafricans.com',       type: 'scholarships', name: 'Opportunities For Africans' },
  { url: 'https://www.scholarshipsads.com',                type: 'scholarships', name: 'ScholarshipsAds' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// RSS FEED TARGETS  (structured — no AI needed)
// ═══════════════════════════════════════════════════════════════════════════════
const RSS_TARGETS = [
  // ── Jobs ──────────────────────────────────────────────────────────────────
  { url: 'https://remotive.com/remote-jobs/feed',                               type: 'jobs',         name: 'Remotive RSS' },
  { url: 'https://weworkremotely.com/remote-jobs.rss',                          type: 'jobs',         name: 'WWR RSS' },
  { url: 'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss', type: 'jobs', name: 'WWR Full-Stack RSS' },
  { url: 'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss',  type: 'jobs', name: 'WWR Frontend RSS' },
  { url: 'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss',   type: 'jobs', name: 'WWR Backend RSS' },
  { url: 'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss',        type: 'jobs', name: 'WWR DevOps RSS' },
  { url: 'https://weworkremotely.com/categories/remote-design-jobs.rss',                 type: 'jobs', name: 'WWR Design RSS' },
  { url: 'https://weworkremotely.com/categories/remote-management-jobs.rss',             type: 'jobs', name: 'WWR Management RSS' },
  { url: 'https://jobicy.com/?feed=job_feed',                                   type: 'jobs',         name: 'Jobicy RSS' },
  { url: 'https://jobicy.com/?feed=job_feed&job_region=nigeria',                type: 'jobs',         name: 'Jobicy Nigeria RSS' },
  { url: 'https://jobicy.com/?feed=job_feed&job_region=africa',                 type: 'jobs',         name: 'Jobicy Africa RSS' },
  { url: 'https://jobicy.com/?feed=job_feed&job_region=emea',                   type: 'jobs',         name: 'Jobicy EMEA RSS' },
  { url: 'https://jobicy.com/?feed=job_feed&job_region=apac',                   type: 'jobs',         name: 'Jobicy APAC RSS' },
  { url: 'https://jobicy.com/?feed=job_feed&job_region=uk',                     type: 'jobs',         name: 'Jobicy UK RSS' },
  { url: 'https://jobicy.com/?feed=job_feed&job_category=engineering',          type: 'jobs',         name: 'Jobicy Engineering RSS' },
  { url: 'https://jobicy.com/?feed=job_feed&job_category=design',               type: 'jobs',         name: 'Jobicy Design RSS' },
  { url: 'https://jobicy.com/?feed=job_feed&job_category=marketing',            type: 'jobs',         name: 'Jobicy Marketing RSS' },
  { url: 'https://www.ngcareers.com/feed',                                      type: 'jobs',         name: 'NGCareers RSS' },
  { url: 'https://www.hotnigerianjobs.com/feed/',                               type: 'jobs',         name: 'Hot Nigerian Jobs RSS' },
  { url: 'https://www.jobberman.com/feeds/jobs.rss',                            type: 'jobs',         name: 'Jobberman RSS' },
  { url: 'https://www.authenticjobs.com/feed/',                                 type: 'jobs',         name: 'Authentic Jobs RSS' },
  { url: 'https://nodesk.co/remote-work/feed.rss',                              type: 'jobs',         name: 'Nodesk Remote RSS' },
  { url: 'https://jobspresso.co/feed/',                                         type: 'jobs',         name: 'Jobspresso RSS' },
  { url: 'https://europeremotely.com/feed.rss',                                 type: 'jobs',         name: 'Europe Remotely RSS' },
  { url: 'https://remoteleaf.com/feed.xml',                                     type: 'jobs',         name: 'Remote Leaf RSS' },
  { url: 'https://www.workingnomads.com/feed',                                  type: 'jobs',         name: 'Working Nomads RSS' },
  { url: 'https://larajobs.com/feed',                                           type: 'jobs',         name: 'LaraJobs RSS' },
  { url: 'https://www.flexjobs.com/rss',                                        type: 'jobs',         name: 'FlexJobs RSS' },
  // ── Scholarships ──────────────────────────────────────────────────────────
  { url: 'https://opportunitydesk.org/feed/',                                   type: 'scholarships', name: 'Opportunity Desk RSS' },
  { url: 'https://www.scholars4dev.com/feed/',                                  type: 'scholarships', name: 'Scholars4Dev RSS' },
  { url: 'https://www.afterschoolafrica.com/feed/',                             type: 'scholarships', name: 'Afterschool Africa RSS' },
  { url: 'https://scholarshipscorner.website/feed/',                            type: 'scholarships', name: 'Scholarships Corner RSS' },
  { url: 'https://www.scholarshipsads.com/feed/',                               type: 'scholarships', name: 'ScholarshipsAds RSS' },
  { url: 'https://www.scholars4dev.com/category/scholarships-for-africans/feed/', type: 'scholarships', name: 'Scholars4Dev Africa RSS' },
  { url: 'https://scholarship-positions.com/feed/',                             type: 'scholarships', name: 'Scholarship Positions RSS' },
  { url: 'https://www.opportunitiesforafricans.com/feed/',                      type: 'scholarships', name: 'Opportunities For Africans RSS' },
  { url: 'https://www.youthop.com/feed',                                        type: 'scholarships', name: 'Youth Opportunities RSS' },
  { url: 'https://www.bipscholarships.com/feed/',                               type: 'scholarships', name: 'BIP Scholarships RSS' },
  { url: 'https://www.scholarshipportal.com/rss/scholarships.rss',              type: 'scholarships', name: 'ScholarshipPortal RSS' },
  { url: 'https://www.bachelorsportal.com/rss/scholarships.rss',                type: 'scholarships', name: 'BachelorsPortal Scholarships RSS' },
  { url: 'https://www.mastersportal.eu/rss/scholarships.rss',                   type: 'scholarships', name: 'MastersPortal Scholarships RSS' },
  { url: 'https://www.opportunitydesk.org/category/scholarships/feed/',         type: 'scholarships', name: 'Opportunity Desk Scholarships Feed RSS' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// FREE API — Remotive  (no key)
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchRemotiveAPI() {
  const t0 = Date.now();
  const categories = [
    'software-dev', 'customer-support', 'design', 'marketing', 'sales',
    'product', 'business', 'data', 'devops-sysadmin', 'finance-legal',
    'hr', 'qa', 'writing', 'all',
  ];
  const allJobs = [];
  for (const cat of categories) {
    try {
      const url = cat === 'all'
        ? 'https://remotive.com/api/remote-jobs?limit=100'
        : `https://remotive.com/api/remote-jobs?category=${cat}&limit=100`;
      const res = await axios.get(url, { timeout: 15000 });
      allJobs.push(...(res.data.jobs || []));
      await delay(300);
    } catch { /* individual category fail is OK */ }
  }
  const unique = Array.from(new Map(allJobs.map((j) => [j.url || j.id, j])).values());
  logger.scraperLog('ok', 'API', 'Remotive API', { fetched: unique.length, ms: Date.now() - t0 });
  return unique.map((j) => ({
    title:       j.title,
    company:     j.company_name,
    description: stripHtml(j.description).slice(0, 500) || null,
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// FREE API — Jobicy  (no key)
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchJobicyAPI() {
  const t0 = Date.now();
  const regions = ['nigeria', 'latam', 'emea', 'apac', 'uk', 'canada', 'usa', 'africa', 'europe', 'worldwide'];
  const tags = ['javascript', 'python', 'react', 'node', 'design', 'marketing', 'sales', 'data', 'devops', 'finance'];
  const allJobs = [];

  // By region
  for (const geo of regions) {
    try {
      const res = await axios.get(`https://jobicy.com/api/v2/remote-jobs?count=50&geo=${geo}`, { timeout: 15000 });
      allJobs.push(...(res.data.jobs || []));
      await delay(400);
    } catch { /* skip */ }
  }
  // By tag
  for (const tag of tags) {
    try {
      const res = await axios.get(`https://jobicy.com/api/v2/remote-jobs?count=50&tag=${tag}`, { timeout: 15000 });
      allJobs.push(...(res.data.jobs || []));
      await delay(400);
    } catch { /* skip */ }
  }
  // Global
  try {
    const res = await axios.get('https://jobicy.com/api/v2/remote-jobs?count=100', { timeout: 15000 });
    allJobs.push(...(res.data.jobs || []));
  } catch { /* skip */ }

  const unique = Array.from(new Map(allJobs.map((j) => [j.url || j.jobTitle + j.companyName, j])).values());
  logger.scraperLog('ok', 'API', 'Jobicy API', { fetched: unique.length, ms: Date.now() - t0 });
  return unique.map((j) => ({
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// FREE API — The Muse  (no key for basic)
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchTheMuseAPI() {
  const t0 = Date.now();
  const allJobs = [];
  for (let page = 0; page <= 19; page++) {  // 20 pages × 20 = 400 jobs
    try {
      const res = await axios.get(`https://www.themuse.com/api/public/jobs?page=${page}&descending=true`, { timeout: 15000 });
      const results = res.data.results || [];
      if (results.length === 0) break;
      allJobs.push(...results);
      await delay(400);
    } catch { break; }
  }
  logger.scraperLog('ok', 'API', 'The Muse API', { fetched: allJobs.length, ms: Date.now() - t0 });
  return allJobs.map((j) => {
    const loc = j.locations?.[0]?.name || null;
    return {
      title:       j.name,
      company:     j.company?.name || null,
      description: stripHtml(j.contents).slice(0, 500) || null,
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// FREE API — Adzuna  (free tier — 250 req/day)
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchAdzunaAPI() {
  if (!adzunaAppId || !adzunaAppKey) {
    logger.scraperLog('warn', 'API', 'Adzuna API', { note: 'ADZUNA_APP_ID/ADZUNA_APP_KEY not set — skipped' });
    return [];
  }
  const t0 = Date.now();
  const searches = [
    // Nigeria — roles
    { country: 'ng', what: 'developer',       where: 'nigeria' },
    { country: 'ng', what: 'engineer',        where: 'nigeria' },
    { country: 'ng', what: 'designer',        where: 'nigeria' },
    { country: 'ng', what: 'manager',         where: 'nigeria' },
    { country: 'ng', what: 'data analyst',    where: 'nigeria' },
    { country: 'ng', what: 'marketing',       where: 'nigeria' },
    { country: 'ng', what: 'product manager', where: 'nigeria' },
    { country: 'ng', what: 'accountant',      where: 'nigeria' },
    // Global tech hubs
    { country: 'gb', what: 'developer' }, { country: 'gb', what: 'engineer' }, { country: 'gb', what: 'data' },
    { country: 'us', what: 'developer' }, { country: 'us', what: 'engineer' }, { country: 'us', what: 'data' },
    { country: 'ca', what: 'developer' }, { country: 'ca', what: 'engineer' },
    { country: 'au', what: 'developer' },
    { country: 'in', what: 'developer' },
    { country: 'sg', what: 'developer' },
    { country: 'de', what: 'developer' },
    { country: 'fr', what: 'developer' },
    { country: 'za', what: 'developer' },
    { country: 'nl', what: 'developer' },
    { country: 'nz', what: 'developer' },
  ];
  const allJobs = [];
  let errors = 0;
  for (const s of searches) {
    try {
      const params = new URLSearchParams({
        app_id: adzunaAppId, app_key: adzunaAppKey,
        results_per_page: 50, what: s.what,
        ...(s.where ? { where: s.where } : {}),
        sort_by: 'date',
      });
      const res = await axios.get(`https://api.adzuna.com/v1/api/jobs/${s.country}/search/1?${params}`, { timeout: 15000 });
      allJobs.push(...(res.data.results || []));
      await delay(300);
    } catch (err) {
      errors++;
      logger.scraperLog('warn', 'API', `Adzuna (${s.country}/${s.what})`, { error: err.message });
    }
  }
  logger.scraperLog('ok', 'API', 'Adzuna API', { fetched: allJobs.length, errors, ms: Date.now() - t0 });
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

// ═══════════════════════════════════════════════════════════════════════════════
// FREE API — DevITJobs  (no key)
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchDevITJobsAPI() {
  const t0 = Date.now();
  try {
    const res = await axios.get('https://www.devitjobs.uk/api/jobsLight', { timeout: 15000 });
    const jobs = Array.isArray(res.data) ? res.data : [];
    logger.scraperLog('ok', 'API', 'DevITJobs API', { fetched: jobs.length, ms: Date.now() - t0 });
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
    logger.scraperLog('error', 'API', 'DevITJobs API', { error: err.message, ms: Date.now() - t0 });
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FREE API — Arbeitnow  (no key, remote + international)
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchArbeitnowAPI() {
  const t0 = Date.now();
  try {
    const allJobs = [];
    for (let page = 1; page <= 20; page++) {
      const res = await axios.get(`https://arbeitnow.com/api/job-board-api?page=${page}`, { timeout: 15000 });
      const jobs = res.data.data || [];
      if (jobs.length === 0) break;
      allJobs.push(...jobs);
      await delay(300);
    }
    logger.scraperLog('ok', 'API', 'Arbeitnow API', { fetched: allJobs.length, ms: Date.now() - t0 });
    return allJobs.map((j) => ({
      title:       j.title,
      company:     j.company_name,
      description: stripHtml(j.description).slice(0, 500) || null,
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
    logger.scraperLog('error', 'API', 'Arbeitnow API', { error: err.message, ms: Date.now() - t0 });
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FREE API — Himalayas  (no key, remote jobs)
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchHimalayasAPI() {
  const t0 = Date.now();
  try {
    const allJobs = [];
    for (let page = 1; page <= 10; page++) {
      const res = await axios.get(`https://himalayas.app/jobs/api?limit=50&offset=${(page - 1) * 50}`, {
        timeout: 15000,
        headers: { 'User-Agent': randomAgent() },
      });
      const jobs = res.data.jobs || [];
      if (jobs.length === 0) break;
      allJobs.push(...jobs);
      await delay(400);
    }
    logger.scraperLog('ok', 'API', 'Himalayas API', { fetched: allJobs.length, ms: Date.now() - t0 });
    return allJobs.map((j) => ({
      title:       j.title,
      company:     j.companyName || null,
      description: stripHtml(j.description || j.shortDescription).slice(0, 500) || null,
      country:     j.locationRestrictions?.join(', ') || null,
      state:       null,
      city:        null,
      job_type:    j.remoteok ? 'remote' : normalizeJobType(j.type),
      salary:      j.salaryRange || null,
      apply_url:   j.applicationLink || j.url || null,
      source_url:  j.url || null,
      source_name: 'Himalayas',
      posted_at:   j.publishedAt || null,
    }));
  } catch (err) {
    logger.scraperLog('error', 'API', 'Himalayas API', { error: err.message, ms: Date.now() - t0 });
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FREE API — RemoteOK  (no key)
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchRemoteOKAPI() {
  const t0 = Date.now();
  try {
    const res = await axios.get('https://remoteok.com/api', {
      timeout: 15000,
      headers: { 'User-Agent': randomAgent() },
    });
    const jobs = Array.isArray(res.data) ? res.data.filter((j) => j.id && j.position) : [];
    logger.scraperLog('ok', 'API', 'RemoteOK API', { fetched: jobs.length, ms: Date.now() - t0 });
    return jobs.map((j) => ({
      title:       j.position,
      company:     j.company || null,
      description: stripHtml(j.description).slice(0, 500) || null,
      country:     j.location || null,
      state:       null,
      city:        null,
      job_type:    'remote',
      salary:      j.salary || null,
      apply_url:   j.url || `https://remoteok.com/remote-jobs/${j.id}`,
      source_url:  `https://remoteok.com/remote-jobs/${j.id}`,
      source_name: 'RemoteOK',
      posted_at:   j.date || null,
    }));
  } catch (err) {
    logger.scraperLog('error', 'API', 'RemoteOK API', { error: err.message, ms: Date.now() - t0 });
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FREE API — FindWork  (no key)
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchFindWorkAPI() {
  const t0 = Date.now();
  try {
    const allJobs = [];
    for (let page = 1; page <= 10; page++) {
      const res = await axios.get(`https://findwork.dev/api/jobs/?page=${page}`, {
        timeout: 15000,
        headers: { 'User-Agent': randomAgent() },
      });
      const jobs = res.data.results || [];
      if (jobs.length === 0) break;
      allJobs.push(...jobs);
      if (!res.data.next) break;
      await delay(400);
    }
    logger.scraperLog('ok', 'API', 'FindWork API', { fetched: allJobs.length, ms: Date.now() - t0 });
    return allJobs.map((j) => ({
      title:       j.role,
      company:     j.company_name || null,
      description: j.text?.slice(0, 500) || null,
      country:     j.location || null,
      state:       null,
      city:        j.location || null,
      job_type:    j.remote ? 'remote' : normalizeJobType(j.employment_type),
      salary:      null,
      apply_url:   j.url || null,
      source_url:  j.url || null,
      source_name: 'FindWork',
      posted_at:   j.date_posted || null,
    }));
  } catch (err) {
    logger.scraperLog('error', 'API', 'FindWork API', { error: err.message, ms: Date.now() - t0 });
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FREE API — Greenhouse (aggregated board list — sample companies)
// ═══════════════════════════════════════════════════════════════════════════════
const GREENHOUSE_BOARDS = [
  'airbase', 'airtable', 'algolia', 'brex', 'canva', 'cloudflare',
  'coinbase', 'confluent', 'databricks', 'datadog', 'discord', 'dropbox',
  'duolingo', 'elastic', 'figma', 'gitlab', 'grammarly', 'hashicorp',
  'hubspot', 'intercom', 'khan-academy', 'lattice', 'linear', 'mixpanel',
  'mongodb', 'netlify', 'notion', 'okta', 'pagerduty', 'pinterest',
  'plaid', 'pulumi', 'reddit', 'rippling', 'robinhood', 'scale-ai',
  'segment', 'sendbird', 'shopify', 'slack', 'snowflake', 'sourcegraph',
  'stripe', 'supabase', 'tailscale', 'twilio', 'vercel', 'zapier', 'zoom',
];

async function fetchGreenhouseBoard(board) {
  const res = await axios.get(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, { timeout: 15000 });
  return (res.data.jobs || []).map((j) => ({
    title:       j.title,
    company:     board.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: stripHtml(j.content || '').slice(0, 500) || null,
    country:     j.location?.name || null,
    state:       null,
    city:        j.location?.name || null,
    job_type:    'full-time',
    salary:      null,
    apply_url:   j.absolute_url || null,
    source_url:  j.absolute_url || null,
    source_name: 'Greenhouse',
    posted_at:   j.updated_at || null,
  }));
}

async function fetchGreenhouseAPI() {
  const t0 = Date.now();
  const allJobs = [];
  let errors = 0;
  for (const board of GREENHOUSE_BOARDS) {
    try {
      const jobs = await fetchGreenhouseBoard(board);
      allJobs.push(...jobs);
      await delay(200);
    } catch {
      errors++;
    }
  }
  logger.scraperLog('ok', 'API', 'Greenhouse API', { fetched: allJobs.length, errors, ms: Date.now() - t0 });
  return allJobs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FREE API — Lever (aggregated board list)
// ═══════════════════════════════════════════════════════════════════════════════
const LEVER_BOARDS = [
  'airbnb', 'airtable', 'amplitude', 'anduril', 'angellist', 'asana',
  'benchling', 'braintrust', 'calm', 'canva', 'carta', 'chime',
  'circle', 'cloudflare', 'cohesity', 'cometeer', 'coursera',
  'cruise', 'deepmind', 'digital-ocean', 'discord', 'doordash',
  'dropbox', 'duolingo', 'epic-games', 'exa-networks',
  'figma', 'flexport', 'forma', 'gem', 'glean', 'gusto',
  'headspace', 'hopper', 'huggingface', 'instacart', 'iter8',
  'lime', 'linear', 'lyft', 'momentive', 'mozilla',
  'nerdio', 'notion', 'nuna', 'observe', 'openai', 'opendoor',
  'palantir', 'patreon', 'peloton', 'postmates', 'primer',
  'rec-room', 'reddit', 'redfin', 'remix', 'retool',
  'rigup', 'robinhood', 'roblox', 'scale', 'scribd',
  'segment', 'sendbird', 'sentry', 'shopify', 'simple-life',
  'snyk', 'sofar-sounds', 'sofi', 'sourcegraph', 'squarespace',
  'superhuman', 'talend', 'taskus', 'tonal', 'tremendous',
  'twitch', 'uipath', 'uplevel', 'waymo', 'yelp', 'zendesk',
];

async function fetchLeverBoard(board) {
  const res = await axios.get(`https://api.lever.co/v0/postings/${board}?mode=json`, { timeout: 15000 });
  return (Array.isArray(res.data) ? res.data : []).map((j) => ({
    title:       j.text,
    company:     board.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: stripHtml(j.description || j.descriptionPlain || '').slice(0, 500) || null,
    country:     j.categories?.location || null,
    state:       null,
    city:        j.categories?.location || null,
    job_type:    normalizeJobType(j.categories?.commitment),
    salary:      null,
    apply_url:   j.hostedUrl || j.applyUrl || null,
    source_url:  j.hostedUrl || null,
    source_name: 'Lever',
    posted_at:   j.createdAt ? new Date(j.createdAt).toISOString() : null,
  }));
}

async function fetchLeverAPI() {
  const t0 = Date.now();
  const allJobs = [];
  let errors = 0;
  for (const board of LEVER_BOARDS) {
    try {
      const jobs = await fetchLeverBoard(board);
      allJobs.push(...jobs);
      await delay(200);
    } catch {
      errors++;
    }
  }
  logger.scraperLog('ok', 'API', 'Lever API', { fetched: allJobs.length, errors, ms: Date.now() - t0 });
  return allJobs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RSS PARSER  (shared)
// ═══════════════════════════════════════════════════════════════════════════════
function safeStr(val) {
  if (!val) return '';
  if (typeof val === 'object' && val._) return String(val._);
  if (Array.isArray(val)) return String(val[0]);
  return String(val);
}

function safeISO(val) {
  const str = safeStr(val);
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d) ? null : d.toISOString();
}

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
  const title   = safeStr(item.title);
  const link    = safeStr(item.link || item.guid) || null;
  const pubDate = item.pubDate || item.published || item['dc:date'] || null;
  const desc    = safeStr(item.description || item.summary || item.content)
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
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
    posted_at:   safeISO(pubDate),
  };
}

function rssItemToScholarship(item, sourceName) {
  const title   = safeStr(item.title);
  const link    = safeStr(item.link || item.guid) || null;
  const pubDate = item.pubDate || item.published || null;
  const desc    = safeStr(item.description || item.summary)
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
  const deadlineMatch = desc.match(/deadline[:\s]+([A-Za-z]+ \d{1,2},?\s*\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  let deadline = null;
  if (deadlineMatch) {
    const d = new Date(deadlineMatch[1]);
    if (!isNaN(d)) deadline = d.toISOString().split('T')[0];
  }
  // Try to detect amount from description
  const amountMatch = desc.match(/\$[\d,]+|\€[\d,]+|USD?\s*[\d,]+|stipend/i);
  const amount = amountMatch ? amountMatch[0].trim() : null;

  return {
    title,
    provider:    null,
    description: desc || null,
    country:     null,
    field:       null,
    deadline,
    amount,
    apply_url:   link,
    source_url:  link,
    source_name: sourceName,
    posted_at:   safeISO(pubDate),
  };
}

async function runRSSTarget(target) {
  const t0 = Date.now();
  try {
    const items = await fetchRSS(target.url);
    const mapped = items.map((item) => {
      try {
        return target.type === 'jobs'
          ? rssItemToJob(item, target.name)
          : rssItemToScholarship(item, target.name);
      } catch { return null; }
    }).filter(Boolean);
    logger.scraperLog('ok', 'RSS', target.name, { fetched: mapped.length, ms: Date.now() - t0 });
    return mapped;
  } catch (err) {
    logger.scraperLog('warn', 'RSS', target.name, { error: err.message, ms: Date.now() - t0 });
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTML SCRAPE + AI EXTRACTION
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
Rules: use null for missing fields. Convert relative dates to ISO using today=${today}. job_type must be one of: full-time|part-time|contract|remote|internship. Return [] if none found. Extract up to 50.
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
      return items;
    } catch (err) {
      logger.scraperLog('warn', 'HTML', `${sourceName} via ${provider.name}`, {
        error: err.response?.data?.error?.message || err.message,
      });
    }
  }
  logger.scraperLog('error', 'HTML', sourceName, { error: 'All AI providers failed' });
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE SAVES
// ═══════════════════════════════════════════════════════════════════════════════
async function saveJobs(jobs, sourceName) {
  let saved = 0, skipped = 0;
  for (const job of jobs) {
    if (!job.title?.trim()) { skipped++; continue; }
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
      if (res.rows.length > 0) saved++; else skipped++;
    } catch (err) {
      logger.warn('Failed to save job', { title: job.title, error: err.message });
      skipped++;
    }
  }
  return { saved, skipped };
}

async function saveScholarships(scholarships, sourceName) {
  let saved = 0, skipped = 0;
  for (const s of scholarships) {
    if (!s.title?.trim()) { skipped++; continue; }
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
      if (res.rows.length > 0) saved++; else skipped++;
    } catch (err) {
      logger.warn('Failed to save scholarship', { title: s.title, error: err.message });
      skipped++;
    }
  }
  return { saved, skipped };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN RUNNER
// ═══════════════════════════════════════════════════════════════════════════════
async function runScraper() {
  const startedAt = Date.now();
  const results = { jobs: 0, scholarships: 0, errors: [] };

  logger.info('');
  logger.info('╔' + '═'.repeat(58) + '╗');
  logger.info('║  SCRAPER RUN STARTED' + ' '.repeat(37) + '║');
  logger.info('║  ' + new Date().toISOString() + ' '.repeat(18) + '║');
  logger.info('╚' + '═'.repeat(58) + '╝');
  logger.info('');

  // ────────────────────────────────────────────────────────────────────────────
  // PHASE 1: Free Structured APIs
  // ────────────────────────────────────────────────────────────────────────────
  const apiSources = [
    fetchRemotiveAPI,
    fetchJobicyAPI,
    fetchTheMuseAPI,
    fetchAdzunaAPI,
    fetchDevITJobsAPI,
    fetchArbeitnowAPI,
    fetchHimalayasAPI,
    fetchRemoteOKAPI,
    fetchFindWorkAPI,
    fetchGreenhouseAPI,
    fetchLeverAPI,
  ];
  logger.scraperPhaseStart(1, 'Free Structured APIs', apiSources.length);
  const p1Start = Date.now();
  let p1Jobs = 0;

  const apiResults = await Promise.allSettled(apiSources.map((fn) => fn()));
  for (const r of apiResults) {
    if (r.status === 'fulfilled' && r.value.length > 0) {
      const { saved } = await saveJobs(r.value, r.value[0]?.source_name || 'API');
      p1Jobs += saved;
      results.jobs += saved;
    } else if (r.status === 'rejected') {
      results.errors.push({ phase: 'API', error: r.reason?.message });
    }
  }

  logger.scraperPhaseSummary('PHASE 1 — APIs', { jobs: p1Jobs, scholarships: 0, errors: results.errors.length, ms: Date.now() - p1Start });

  // ────────────────────────────────────────────────────────────────────────────
  // PHASE 2: RSS Feeds
  // ────────────────────────────────────────────────────────────────────────────
  logger.scraperPhaseStart(2, 'RSS Feeds', RSS_TARGETS.length);
  const p2Start = Date.now();
  let p2Jobs = 0, p2Scholarships = 0, p2Errors = 0;

  for (const target of RSS_TARGETS) {
    const items = await runRSSTarget(target);
    if (target.type === 'jobs') {
      const { saved } = await saveJobs(items, target.name);
      p2Jobs += saved;
      results.jobs += saved;
    } else {
      const { saved } = await saveScholarships(items, target.name);
      p2Scholarships += saved;
      results.scholarships += saved;
    }
    await delay(600);
  }

  logger.scraperPhaseSummary('PHASE 2 — RSS', { jobs: p2Jobs, scholarships: p2Scholarships, errors: p2Errors, ms: Date.now() - p2Start });

  // ────────────────────────────────────────────────────────────────────────────
  // PHASE 3: HTML + AI Extraction
  // ────────────────────────────────────────────────────────────────────────────
  logger.scraperPhaseStart(3, 'HTML + AI Extraction', HTML_TARGETS.length);
  const p3Start = Date.now();
  let p3Jobs = 0, p3Scholarships = 0, p3Errors = 0;

  for (const target of HTML_TARGETS) {
    const t0 = Date.now();
    try {
      logger.info(`[HTML] Fetching: ${target.name} (${target.url})`);
      const text  = await fetchHTML(target.url);
      const items = await extractWithAI(text, target.type, target.name);

      if (target.type === 'jobs') {
        const { saved, skipped } = await saveJobs(items, target.name);
        p3Jobs += saved;
        results.jobs += saved;
        logger.scraperLog('ok', 'HTML', target.name, { fetched: items.length, saved, skipped, ms: Date.now() - t0 });
      } else {
        const { saved, skipped } = await saveScholarships(items, target.name);
        p3Scholarships += saved;
        results.scholarships += saved;
        logger.scraperLog('ok', 'HTML', target.name, { fetched: items.length, saved, skipped, ms: Date.now() - t0 });
      }
    } catch (err) {
      p3Errors++;
      logger.scraperLog('error', 'HTML', target.name, { error: err.message, ms: Date.now() - t0 });
      results.errors.push({ name: target.name, url: target.url, error: err.message });
    }
    await delay(1500);
  }

  logger.scraperPhaseSummary('PHASE 3 — HTML', { jobs: p3Jobs, scholarships: p3Scholarships, errors: p3Errors, ms: Date.now() - p3Start });

  // ────────────────────────────────────────────────────────────────────────────
  // Final Summary
  // ────────────────────────────────────────────────────────────────────────────
  logger.scraperFinalSummary({ jobs: results.jobs, scholarships: results.scholarships, errors: results.errors.length, startedAt });

  // Flush Redis cache so the frontend reflects new data immediately
  try {
    const keys = await redis.keys('jobs:*');
    if (keys.length > 0) {
      await redis.del(keys);
      logger.info(`Redis: cleared ${keys.length} cached job query keys`);
    }
    const skeys = await redis.keys('scholarships:*');
    if (skeys.length > 0) {
      await redis.del(skeys);
      logger.info(`Redis: cleared ${skeys.length} cached scholarship query keys`);
    }
  } catch (err) {
    logger.warn('Failed to clear redis cache', { error: err.message });
  }

  return results;
}

async function deactivateOldListings() {
  await db.query(`UPDATE jobs SET is_active = FALSE WHERE posted_at < NOW() - INTERVAL '60 days' AND posted_at IS NOT NULL`);
  await db.query(`UPDATE scholarships SET is_active = FALSE WHERE deadline < CURRENT_DATE`);
  logger.info('Old listings deactivated (jobs >60d, scholarships past deadline)');
}

module.exports = { runScraper, deactivateOldListings };