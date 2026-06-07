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

// ── Provider wrappers ─────────────────────────────────────────────────────────

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const { default: Groq } = await import('groq-sdk').catch(() => ({ default: null }));
  if (!Groq) throw new Error('groq-sdk not installed');

  const groq = new Groq({ apiKey });
  const models = ['llama3-8b-8192', 'llama-3.1-8b-instant'];
  let lastErr;
  for (const model of models) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are an expert web developer. Output only raw HTML, nothing else.' },
          { role: 'user',   content: prompt },
        ],
        model,
        temperature: 0.4,
        max_tokens:  8000,
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

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const { GoogleGenerativeAI } = await import('@google/generative-ai').catch(() => ({ GoogleGenerativeAI: null }));
  if (!GoogleGenerativeAI) throw new Error('@google/generative-ai not installed');

  const genAI = new GoogleGenerativeAI(apiKey);
  const models = ['gemini-1.5-flash', 'gemini-1.5-pro'];
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

function cleanHtml(text) {
  if (!text) throw new Error('Empty response from AI');
  let html = text.trim();
  // Strip markdown fences if model wrapped it anyway
  html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  if (!html.toLowerCase().includes('<!doctype') && !html.toLowerCase().includes('<html')) {
    throw new Error('Response does not appear to be HTML');
  }
  return html;
}

// ── Daily limit check ─────────────────────────────────────────────────────────

async function checkDailyLimit(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM portfolios
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
      [userId]
    );
    return parseInt(rows[0].cnt, 10) < 1;
  } catch (err) {
    logger.warn('[Portfolio] Daily limit check failed, allowing request: ' + err.message);
    return true;
  }
}

// ── Main service functions ────────────────────────────────────────────────────

async function generatePortfolio(userId, info) {
  const prompt = buildPortfolioPrompt(info);
  let html = null;
  const errors = [];

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
    throw new Error('Could not generate portfolio — all AI providers failed.');
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
    { name: 'Anthropic', fn: callAnthropic },
    { name: 'Gemini',    fn: callGemini },
    { name: 'Groq',      fn: callGroq },
  ];

  for (const { name, fn } of providers) {
    try {
      // Reuse providers but with a parse prompt — wrap them to return JSON
      const result = await fn(prompt);
      // If the provider returns HTML-like (for generate), skip; we need JSON
      if (typeof result === 'object') return result;
      const parsed = JSON.parse(result);
      return parsed;
    } catch { /* try next */ }
  }
  throw new Error('CV parsing failed');
}

module.exports = {
  generatePortfolio, getPortfolioHistory, getPortfolioById,
  deletePortfolio, checkDailyLimit, parseCvText,
};