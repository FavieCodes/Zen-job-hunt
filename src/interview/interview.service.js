const pool   = require('../config/db');
const logger = require('../common/logger');

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(jobRole, interviewType) {
  return `You are an expert interview coach. A candidate is preparing for a "${interviewType}" interview for a "${jobRole}" role.

Provide:
1. 5 to 7 highly relevant practice questions with a brief "tip" for each.
2. 3 YouTube search URLs the candidate can use for video prep.

Respond with ONLY valid JSON — no markdown fences, no preamble:
{
  "questions": [
    { "question": "string", "tip": "string" }
  ],
  "videos": [
    { "title": "string", "url": "string" }
  ]
}`;
}

// ── JSON cleaner ──────────────────────────────────────────────────────────────

function parseJsonSafe(text) {
  if (!text) throw new Error('Empty response from AI');
  let clean = text.trim();
  clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = clean.indexOf('{');
  const end   = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in response');
  return JSON.parse(clean.slice(start, end + 1));
}

// ── JSON provider wrappers (for interview prep generation) ────────────────────

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const { default: Groq } = await import('groq-sdk').catch(() => ({ default: null }));
  if (!Groq) throw new Error('groq-sdk not installed');

  const groq = new Groq({ apiKey });
  // Updated model list — llama3-8b-8192 is deprecated, use current models
  const models = [
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'llama3-70b-8192',
  ];
  let lastErr;
  for (const model of models) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are an expert interview coach. Output raw JSON only — no markdown, no extra text.' },
          { role: 'user',   content: prompt },
        ],
        model,
        temperature: 0.6,
        max_tokens:  1800,
      });
      const text = completion.choices[0]?.message?.content || '';
      return parseJsonSafe(text);
    } catch (err) {
      logger.warn(`[Interview] Groq model ${model} failed: ${err.message}`);
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
  const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];
  let lastErr;
  for (const modelName of models) {
    try {
      const model  = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return parseJsonSafe(result.response.text());
    } catch (err) {
      logger.warn(`[Interview] Gemini model ${modelName} failed: ${err.message}`);
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
    max_tokens: 1800,
    system:     'You are an expert interview coach. Output raw JSON only — no markdown, no extra text.',
    messages:   [{ role: 'user', content: prompt }],
  });
  return parseJsonSafe(response.content[0]?.text?.trim() || '');
}

// ── Plain-text provider wrappers (for answer generation) ─────────────────────

async function callGroqText(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const { default: Groq } = await import('groq-sdk').catch(() => ({ default: null }));
  if (!Groq) throw new Error('groq-sdk not installed');

  const groq = new Groq({ apiKey });
  // Updated model list — llama3-8b-8192 deprecated
  const models = [
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'llama3-70b-8192',
  ];
  let lastErr;
  for (const model of models) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are an expert interview coach. Respond with plain text only — no markdown, no bullet points, no headers.' },
          { role: 'user',   content: prompt },
        ],
        model,
        temperature: 0.7,
        max_tokens: 600,
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (!text) throw new Error('Empty response from Groq');
      return text;
    } catch (err) {
      logger.warn(`[Interview] callGroqText model ${model} failed: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr || new Error('All Groq models failed for text generation');
}

async function callGeminiText(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const { GoogleGenerativeAI } = await import('@google/generative-ai').catch(() => ({ GoogleGenerativeAI: null }));
  if (!GoogleGenerativeAI) throw new Error('@google/generative-ai not installed');

  const genAI = new GoogleGenerativeAI(apiKey);
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
  let lastErr;
  for (const modelName of models) {
    try {
      const model  = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text   = result.response.text()?.trim();
      if (!text) throw new Error('Empty response from Gemini');
      return text;
    } catch (err) {
      logger.warn(`[Interview] callGeminiText model ${modelName} failed: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr || new Error('All Gemini models failed for text generation');
}

async function callAnthropicText(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 600,
    system: 'You are an expert interview coach. Respond with plain text only — no markdown, no bullet points, no headers.',
    messages: [{ role: 'user', content: prompt }],
  });
  const text = response.content[0]?.text?.trim();
  if (!text) throw new Error('Empty response from Anthropic');
  return text;
}

// ── Daily limit check ─────────────────────────────────────────────────────────

async function checkDailyLimit(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM interview_prep
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
      [userId]
    );
    return parseInt(rows[0].cnt, 10) < 1;
  } catch (err) {
    logger.warn('[Interview] Daily limit check failed, allowing request: ' + err.message);
    return true;
  }
}

// ── Main service functions ────────────────────────────────────────────────────

async function generateInterviewPrep(userId, jobRole, interviewType) {
  const prompt = buildPrompt(jobRole, interviewType);
  let parsedData = null;
  const errors   = [];

  const providers = [
    { name: 'Groq',      fn: callGroq },
    { name: 'Gemini',    fn: callGemini },
    { name: 'Anthropic', fn: callAnthropic },
  ];

  for (const { name, fn } of providers) {
    try {
      logger.info(`[Interview] Trying ${name}…`);
      parsedData = await fn(prompt);
      logger.info(`[Interview] ${name} succeeded`);
      break;
    } catch (err) {
      const msg = err.message || String(err);
      logger.warn(`[Interview] ${name} failed: ${msg}`);
      errors.push(`${name}: ${msg}`);
    }
  }

  if (!parsedData) {
    logger.error('[Interview] All providers failed:\n' + errors.join('\n'));
    throw new Error(
      'Could not generate interview prep — all AI providers failed. ' +
      'Please check your GROQ_API_KEY / GEMINI_API_KEY / ANTHROPIC_API_KEY environment variables.'
    );
  }

  if (!Array.isArray(parsedData.questions)) parsedData.questions = [];
  if (!Array.isArray(parsedData.videos))    parsedData.videos    = [];

  try {
    const { rows } = await pool.query(
      `INSERT INTO interview_prep (user_id, job_role, interview_type, questions, videos)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, jobRole, interviewType,
       JSON.stringify(parsedData.questions),
       JSON.stringify(parsedData.videos)]
    );
    return rows[0];
  } catch (dbErr) {
    logger.error('[Interview] DB save error: ' + dbErr.message);
    return {
      id:             null,
      user_id:        userId,
      job_role:       jobRole,
      interview_type: interviewType,
      questions:      JSON.stringify(parsedData.questions),
      videos:         JSON.stringify(parsedData.videos),
      created_at:     new Date().toISOString(),
    };
  }
}

async function getUserHistory(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, job_role, interview_type, questions, videos, created_at
         FROM interview_prep WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  } catch (err) {
    if (err.code === '42P01') return [];
    throw err;
  }
}

async function getPrepById(userId, id) {
  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, job_role, interview_type, questions, videos, created_at
         FROM interview_prep WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return rows[0] || null;
  } catch (err) {
    if (err.code === '42P01') return null;
    throw err;
  }
}

async function generateSingleAnswer({ question, tip, job_role, interview_type }) {
  const prompt = `You are an expert interview coach. A candidate is interviewing for a "${job_role || 'professional'}" role (${interview_type || 'General'} interview).

Question: "${question}"
Coaching tip: "${tip}"

Write a strong, concise sample answer (150-250 words) that:
1. Directly addresses the question
2. Uses the STAR method where applicable (Situation, Task, Action, Result)
3. Sounds natural and confident, not robotic
4. Incorporates the coaching tip

Respond with ONLY the answer text — no preamble, no labels, no markdown, no bullet points.`;

  const providers = [
    { name: 'Groq',      fn: callGroqText },
    { name: 'Gemini',    fn: callGeminiText },
    { name: 'Anthropic', fn: callAnthropicText },
  ];

  const errors = [];
  for (const { name, fn } of providers) {
    try {
      const answer = await fn(prompt);
      logger.info('[Interview] generateSingleAnswer succeeded via ' + name);
      return answer;
    } catch (err) {
      const msg = err.message || String(err);
      logger.warn('[Interview] generateSingleAnswer ' + name + ' failed: ' + msg);
      errors.push(`${name}: ${msg}`);
    }
  }
  logger.error('[Interview] generateSingleAnswer — all providers failed:\n' + errors.join('\n'));
  throw new Error('All providers failed for answer generation');
}

module.exports = { generateInterviewPrep, getUserHistory, getPrepById, checkDailyLimit, generateSingleAnswer };