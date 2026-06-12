const pool   = require('../config/db');
const logger = require('../common/logger');

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPortfolioPrompt(info) {
  return `You are an expert web developer and designer. Build a fully responsive, modern, single-page portfolio website as a SINGLE self-contained HTML file (inline CSS + inline JS, no external dependencies except Google Fonts).

CANDIDATE INFORMATION:
- Name: ${info.fullName}
- Title / Role: ${info.title || 'Software Developer'}
- Email: ${info.email || ''}
- Phone: ${info.phone || ''}
- Location: ${info.location || ''}
- LinkedIn: ${info.linkedin || ''}
- GitHub: ${info.github || ''}
- Website / Portfolio URL: ${info.website || ''}
- Professional Summary / About: ${info.summary || ''}
- Skills: ${info.skills || ''}
- Experience: ${JSON.stringify(info.experience || [])}
- Projects: ${JSON.stringify(info.projects || [])}
- Education: ${JSON.stringify(info.education || [])}
- Certifications: ${info.certifications || ''}

DESIGN REQUIREMENTS:
1. Use a modern, professional colour palette (dark navy + accent colour of your choice).
2. Sections: Hero (name, title, CTA buttons), About, Skills, Experience, Projects, Education, Contact.
3. Fully responsive — mobile-first, works on all screen sizes.
4. Smooth scroll navigation with a sticky header.
5. Subtle animations (fade-in on scroll using Intersection Observer).
6. Skills displayed as styled badges/tags.
7. Project cards with hover effects.
8. Contact section with clickable email/social links.
9. Clean, readable typography using a Google Font (load via @import in <style>).
10. NO placeholder content — use ONLY the candidate data provided above.

OUTPUT: Return ONLY the complete HTML file content. No markdown fences, no explanation — just the raw HTML starting with <!DOCTYPE html>.`;
}

// ── HTML cleaner ──────────────────────────────────────────────────────────────

function cleanHtml(text) {
  if (!text) throw new Error('Empty response from AI');
  let html = text.trim();
  html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  if (!html.toLowerCase().includes('<!doctype') && !html.toLowerCase().includes('<html')) {
    throw new Error('Response does not appear to be HTML');
  }
  return html;
}

// ── JSON cleaner (for CV parsing) ─────────────────────────────────────────────

function parseJsonSafe(text) {
  if (!text) throw new Error('Empty response');
  let clean = text.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = clean.indexOf('{');
  const end   = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in response');
  return JSON.parse(clean.slice(start, end + 1));
}

// ── HTML provider wrappers (portfolio generation) ─────────────────────────────

async function callAnthropic(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model:      'claude-haiku-4-5',
    max_tokens: 8000,
    system:     'You are an expert web developer. Output only raw HTML — no markdown, no backticks, no explanation.',
    messages:   [{ role: 'user', content: prompt }],
  });
  return cleanHtml(response.content[0]?.text?.trim() || '');
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const { GoogleGenerativeAI } = await import('@google/generative-ai').catch(() => ({ GoogleGenerativeAI: null }));
  if (!GoogleGenerativeAI) throw new Error('@google/generative-ai not installed');

  const genAI = new GoogleGenerativeAI(apiKey);
  // gemini-1.5-flash supports large output — good for full HTML files
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
  let lastErr;
  for (const modelName of models) {
    try {
      const model  = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return cleanHtml(result.response.text());
    } catch (err) {
      logger.warn(`[Portfolio] Gemini model ${modelName} failed: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr || new Error('All Gemini models failed');
}

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const { default: Groq } = await import('groq-sdk').catch(() => ({ default: null }));
  if (!Groq) throw new Error('groq-sdk not installed');

  const groq = new Groq({ apiKey });
  // Use models with higher context windows; reduce max_tokens to avoid exceeding limits
  // llama-3.3-70b-versatile has a 128k context window
  const models = [
    { name: 'llama-3.3-70b-versatile', maxTokens: 4000 },
    { name: 'llama-3.1-8b-instant',    maxTokens: 3000 },
  ];
  let lastErr;
  for (const { name: model, maxTokens } of models) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are an expert web developer. Output only raw HTML, nothing else. No markdown fences.' },
          { role: 'user',   content: prompt },
        ],
        model,
        temperature: 0.4,
        max_tokens:  maxTokens,
      });
      const text = completion.choices[0]?.message?.content || '';
      return cleanHtml(text);
    } catch (err) {
      logger.warn(`[Portfolio] Groq model ${model} failed: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr || new Error('All Groq models failed');
}

// ── JSON provider wrappers (CV parsing) ──────────────────────────────────────

async function callAnthropicJson(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2000,
    system: 'You are a data extraction assistant. Output raw JSON only — no markdown, no backticks, no explanation.',
    messages: [{ role: 'user', content: prompt }],
  });
  return parseJsonSafe(response.content[0]?.text?.trim() || '');
}

async function callGeminiJson(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const { GoogleGenerativeAI } = await import('@google/generative-ai').catch(() => ({ GoogleGenerativeAI: null }));
  if (!GoogleGenerativeAI) throw new Error('@google/generative-ai not installed');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent(prompt);
  return parseJsonSafe(result.response.text());
}

async function callGroqJson(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');
  const { default: Groq } = await import('groq-sdk').catch(() => ({ default: null }));
  if (!Groq) throw new Error('groq-sdk not installed');
  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are a data extraction assistant. Output raw JSON only — no markdown, no extra text.' },
      { role: 'user',   content: prompt },
    ],
    model: 'llama-3.1-8b-instant',
    temperature: 0.2,
    max_tokens: 2000,
  });
  return parseJsonSafe(completion.choices[0]?.message?.content || '');
}

// ── Daily limit check ─────────────────────────────────────────────────────────

async function checkLimits(userId) {
  try {
    try {
      const userCheck = await pool.query('SELECT payment_status FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length > 0 && userCheck.rows[0].payment_status === 'paid') {
        return { allowed: true };
      }
    } catch (e) {
      // Column might not exist yet, ignore
    }

    const { rows: totalRows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM portfolios WHERE user_id = $1`,
      [userId]
    );
    if (parseInt(totalRows[0].cnt, 10) >= 5) {
      return { allowed: false, reason: 'total_limit_reached' };
    }

    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM portfolios
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
      [userId]
    );
    if (parseInt(rows[0].cnt, 10) >= 1) {
      return { allowed: false, reason: 'daily_limit_reached' };
    }

    return { allowed: true };
  } catch (err) {
    logger.warn('[Portfolio] Limit check failed, allowing request: ' + err.message);
    return { allowed: true };
  }
}

// ── Main service functions ────────────────────────────────────────────────────

async function generatePortfolio(userId, info) {
  const prompt = buildPortfolioPrompt(info);
  let html = null;
  const errors = [];

  // Anthropic first — best at long HTML generation; Gemini second; Groq as last resort
  const providers = [
    { name: 'Anthropic', fn: callAnthropic },
    { name: 'Gemini',    fn: callGemini },
    { name: 'Groq',      fn: callGroq },
  ];

  for (const { name, fn } of providers) {
    try {
      logger.info(`[Portfolio] Trying ${name}…`);
      html = await fn(prompt);
      logger.info(`[Portfolio] ${name} succeeded`);
      break;
    } catch (err) {
      const msg = err.message || String(err);
      logger.warn(`[Portfolio] ${name} failed: ${msg}`);
      errors.push(`${name}: ${msg}`);
    }
  }

  if (!html) {
    logger.error('[Portfolio] All providers failed:\n' + errors.join('\n'));
    throw new Error('Could not generate portfolio — all AI providers failed. Details: ' + errors.join(' | '));
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO portfolios (user_id, full_name, title, generated_html)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, info.fullName || '', info.title || '', html]
    );
    return rows[0];
  } catch (dbErr) {
    logger.error('[Portfolio] DB save error: ' + dbErr.message);
    return {
      id:             null,
      user_id:        userId,
      full_name:      info.fullName || '',
      title:          info.title || '',
      generated_html: html,
      created_at:     new Date().toISOString(),
    };
  }
}

async function getPortfolioHistory(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, full_name, title, created_at FROM portfolios
       WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  } catch (err) {
    if (err.code === '42P01') return [];
    throw err;
  }
}

async function getPortfolioById(userId, id) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM portfolios WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return rows[0] || null;
  } catch (err) {
    if (err.code === '42P01') return null;
    throw err;
  }
}

async function deletePortfolio(userId, id) {
  const { rows } = await pool.query(
    `DELETE FROM portfolios WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  if (!rows.length) throw new Error('Portfolio not found');
  return { deleted: true };
}

async function parseCvText(cvText) {
  const prompt = `Extract structured information from this CV/resume text and return ONLY valid JSON (no markdown fences):
{
  "fullName": "",
  "title": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedin": "",
  "github": "",
  "website": "",
  "summary": "",
  "skills": "",
  "experience": [{"company":"","role":"","period":"","description":""}],
  "projects": [{"name":"","description":"","technologies":"","url":""}],
  "education": [{"institution":"","degree":"","period":""}],
  "certifications": ""
}

CV TEXT:
${cvText.slice(0, 5000)}`;

  const providers = [
    { name: 'Anthropic', fn: callAnthropicJson },
    { name: 'Gemini',    fn: callGeminiJson },
    { name: 'Groq',      fn: callGroqJson },
  ];

  const errors = [];
  for (const { name, fn } of providers) {
    try {
      const result = await fn(prompt);
      logger.info('[Portfolio] parseCvText succeeded via ' + name);
      return result;
    } catch (err) {
      const msg = err.message || String(err);
      logger.warn('[Portfolio] parseCvText ' + name + ' failed: ' + msg);
      errors.push(name + ': ' + msg);
    }
  }
  logger.error('[Portfolio] All parseCvText providers failed:\n' + errors.join('\n'));
  throw new Error('CV parsing failed — all providers failed');
}

module.exports = {
  generatePortfolio, getPortfolioHistory, getPortfolioById,
  deletePortfolio, checkLimits, parseCvText,
};