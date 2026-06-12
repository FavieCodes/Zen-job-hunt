const db     = require('../config/db');
const logger = require('../common/logger');

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildResumePrompt(form) {
  const needsSummary   = !form.summary || !form.summary.trim();
  const experienceList = (form.experience || [])
    .filter((e) => e.title || e.company)
    .map((e, i) => {
      const needsBullets = !e.bullets || !e.bullets.trim();
      return {
        index: i + 1, title: e.title || '', company: e.company || '',
        location: e.location || '', startDate: e.startDate || '',
        endDate: e.current ? 'Present' : (e.endDate || ''),
        bullets: e.bullets || '', needsBullets,
      };
    });

  const instructionsJson = {
    needsSummary,
    experienceWithMissingBullets: experienceList.filter((e) => e.needsBullets).map((e) => e.index),
  };

  return `You are a professional resume writer. Your job is to fill in ONLY the missing parts of a resume.

CANDIDATE DATA:
- Name: ${form.fullName}
- Email: ${form.email}
- Phone: ${form.phone || ''}
- Location: ${form.location || ''}
- Target role / Resume title: ${form.title || ''}
- Skills: ${form.skills || ''}
- Summary provided by user: ${form.summary || '(none — you must generate this)'}

EXPERIENCE ENTRIES:
${experienceList.map((e) => `
Entry #${e.index}: ${e.title} at ${e.company} | ${e.startDate} – ${e.endDate}
User-provided bullets: ${e.bullets || '(none — you must generate bullets for this entry)'}
`).join('\n')}

INSTRUCTIONS: ${JSON.stringify(instructionsJson)}

Respond ONLY with valid JSON (no markdown fences, no preamble):
{
  "summary": "<generated summary if needed, else empty string>",
  "experienceBullets": {
    "1": "<newline-separated bullets for entry 1 if needed, else empty string>",
    "2": "<bullets for entry 2 if needed, else empty string>"
  }
}`;
}

// ── Tailor-uploaded-resume prompt ─────────────────────────────────────────────

function buildTailorPrompt(resumeText, targetRole) {
  return `You are an expert resume coach and ATS optimisation specialist.

A candidate wants to tailor their existing resume for the role: "${targetRole}".

EXISTING RESUME TEXT:
---
${resumeText.slice(0, 6000)}
---

YOUR TASK:
1. Extract the candidate's contact information (email, phone, linkedin, github, portfolio/website) from the text, if available.
2. Rewrite the professional summary so it is laser-focused on "${targetRole}".
3. For each work experience entry, rewrite / enhance the bullet points to emphasise skills and achievements most relevant to "${targetRole}". Use strong action verbs and quantify where possible.
4. Suggest any additional skills the candidate should highlight for this role.
5. Keep all factual details (dates, company names, job titles, education) exactly as given.
6. Provide a sample relevant project tailored for this role, even if the candidate didn't include one in their uploaded resume. This project should demonstrate skills applicable to the "${targetRole}".

Respond ONLY with valid JSON (no markdown fences):
{
  "fullName": "<extracted full name of candidate, or empty string>",
  "contacts": {
    "email": "<extracted email or empty>",
    "phone": "<extracted phone or empty>",
    "linkedin": "<extracted linkedin URL or empty>",
    "github": "<extracted github URL or empty>",
    "website": "<extracted portfolio/website URL or empty>"
  },
  "tailoredSummary": "<rewritten professional summary>",
  "tailoredExperience": [
    {
      "originalTitle": "<job title as found in resume>",
      "company": "<company as found in resume>",
      "improvedBullets": ["bullet 1", "bullet 2", "bullet 3"]
    }
  ],
  "suggestedSkills": ["skill1", "skill2", "skill3"],
  "education": [
    {
      "degree": "<degree or certificate name>",
      "institution": "<institution name>",
      "date": "<dates attended or graduation date>"
    }
  ],
  "sampleProject": {
    "title": "<creative project name relevant to the role>",
    "description": "<short description of the project and its impact>",
    "bullets": ["bullet 1", "bullet 2"]
  }
}`;
}

// ── JSON cleaner ──────────────────────────────────────────────────────────────

function parseJsonSafe(text) {
  if (!text) throw new Error('Empty response from AI');
  let clean = text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = clean.indexOf('{');
  const end   = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in AI response');
  return JSON.parse(clean.slice(start, end + 1));
}

// ── AI provider cascade ───────────────────────────────────────────────────────

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');
  const { default: Groq } = await import('groq-sdk').catch(() => ({ default: null }));
  if (!Groq) throw new Error('groq-sdk not installed');
  const groq   = new Groq({ apiKey });
  const models = ['llama3-8b-8192', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
  let lastErr;
  for (const model of models) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a professional resume writer. Output raw JSON only — no markdown, no extra text.' },
          { role: 'user',   content: prompt },
        ],
        model, temperature: 0.5, max_tokens: 2500,
      });
      return parseJsonSafe(completion.choices[0]?.message?.content || '');
    } catch (err) {
      logger.warn(`[Resume] Groq model ${model} failed: ${err.message}`);
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
  const genAI  = new GoogleGenerativeAI(apiKey);
  const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  let lastErr;
  for (const modelName of models) {
    try {
      const model  = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return parseJsonSafe(result.response.text());
    } catch (err) {
      logger.warn(`[Resume] Gemini model ${modelName} failed: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr || new Error('All Gemini models failed');
}

async function callAnthropic(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const Anthropic = require('@anthropic-ai/sdk');
  const client    = new Anthropic({ apiKey });
  const response  = await client.messages.create({
    model: 'claude-haiku-4-5', max_tokens: 2500,
    system: 'You are a professional resume writer. Output raw JSON only — no markdown, no extra text.',
    messages: [{ role: 'user', content: prompt }],
  });
  return parseJsonSafe(response.content[0]?.text?.trim() || '');
}

async function runAI(prompt) {
  const providers = [
    { name: 'Groq',      fn: callGroq },
    { name: 'Gemini',    fn: callGemini },
    { name: 'Anthropic', fn: callAnthropic },
  ];
  const errors = [];
  for (const { name, fn } of providers) {
    try {
      logger.info(`[Resume] Trying ${name}…`);
      const result = await fn(prompt);
      logger.info(`[Resume] ${name} succeeded`);
      return result;
    } catch (err) {
      logger.warn(`[Resume] ${name} failed: ${err.message}`);
      errors.push(`${name}: ${err.message}`);
    }
  }
  logger.error('[Resume] All AI providers failed:\n' + errors.join('\n'));
  return null; 
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildResumeHtml(form, aiData) {
  const summary    = form.summary?.trim() || aiData?.summary || '';
  const expBullets = aiData?.experienceBullets || {};

  const experience = (form.experience || []).filter((e) => e.title || e.company).map((e, i) => {
    const userBullets = e.bullets?.trim();
    const aiBullets   = expBullets[String(i + 1)] || '';
    const bulletsRaw  = userBullets || aiBullets || '';
    const bulletLines = bulletsRaw.split('\n').map((b) => b.trim()).filter(Boolean);
    return `
    <div class="exp-entry" style="margin-bottom:1rem;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div>
          <strong style="font-size:1rem;">${e.title || ''}</strong>
          ${e.company  ? `<span style="color:#555;"> — ${e.company}</span>` : ''}
          ${e.location ? `<span style="color:#777;font-size:0.85rem;"> · ${e.location}</span>` : ''}
        </div>
        <span style="font-size:0.82rem;color:#777;white-space:nowrap;">
          ${e.startDate || ''}${e.startDate ? ' – ' : ''}${e.current ? 'Present' : (e.endDate || '')}
        </span>
      </div>
      ${bulletLines.length > 0 ? `
      <ul style="margin:0.4rem 0 0 1.2rem;padding:0;">
        ${bulletLines.map((b) => `<li style="margin-bottom:0.2rem;line-height:1.5;">${b.replace(/^[-•*]\s*/, '')}</li>`).join('')}
      </ul>` : ''}
    </div>`;
  }).join('');

  const education = (form.education || []).filter((e) => e.degree || e.institution).map((e) => `
    <div style="margin-bottom:0.75rem;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div>
          <strong>${e.degree || ''}</strong>
          ${e.institution ? `<span style="color:#555;"> — ${e.institution}</span>` : ''}
          ${e.location    ? `<span style="color:#777;font-size:0.85rem;"> · ${e.location}</span>` : ''}
        </div>
        <span style="font-size:0.82rem;color:#777;">
          ${e.startDate || ''}${e.startDate && e.endDate ? ' – ' : ''}${e.endDate || ''}
          ${e.gpa ? ` · GPA: ${e.gpa}` : ''}
        </span>
      </div>
    </div>`).join('');

  const skills       = form.skills ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const certs        = (form.certifications || '').split('\n').map((c) => c.trim()).filter(Boolean).map((c) => `<li>${c}</li>`).join('');
  const contactParts = [
    form.email    ? `<a href="mailto:${form.email}" style="color:#1e3a8a;">${form.email}</a>` : '',
    form.phone    ? `<span>${form.phone}</span>` : '',
    form.location ? `<span>${form.location}</span>` : '',
    form.linkedin ? `<a href="${form.linkedin}" style="color:#1e3a8a;">LinkedIn</a>` : '',
    form.website  ? `<a href="${form.website}"  style="color:#1e3a8a;">Portfolio</a>` : '',
  ].filter(Boolean);

  return `
<div style="max-width:800px;margin:0 auto;padding:2rem;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;line-height:1.6;">
  <div style="text-align:center;margin-bottom:1.5rem;border-bottom:2px solid #1e3a8a;padding-bottom:1rem;">
    <h1 style="margin:0;font-size:1.8rem;color:#1e3a8a;">${form.fullName || ''}</h1>
    ${form.title ? `<p style="margin:0.25rem 0;font-size:1rem;color:#555;font-style:italic;">${form.title}</p>` : ''}
    <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:0.75rem;margin-top:0.5rem;font-size:0.85rem;">
      ${contactParts.join(' <span style="color:#ccc;">|</span> ')}
    </div>
  </div>
  ${summary ? `<div style="margin-bottom:1.5rem;"><h2 style="font-size:1rem;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;border-bottom:1px solid #e5e7eb;padding-bottom:0.25rem;margin-bottom:0.75rem;">Professional Summary</h2><p style="margin:0;color:#374151;">${summary}</p></div>` : ''}
  ${skills.length > 0 ? `<div style="margin-bottom:1.5rem;"><h2 style="font-size:1rem;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;border-bottom:1px solid #e5e7eb;padding-bottom:0.25rem;margin-bottom:0.75rem;">Skills</h2><div style="display:flex;flex-wrap:wrap;gap:0.4rem;">${skills.map((s) => `<span style="background:#dbeafe;color:#1e40af;padding:0.2rem 0.6rem;border-radius:0.75rem;font-size:0.82rem;font-weight:500;">${s}</span>`).join('')}</div></div>` : ''}
  ${experience ? `<div style="margin-bottom:1.5rem;"><h2 style="font-size:1rem;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;border-bottom:1px solid #e5e7eb;padding-bottom:0.25rem;margin-bottom:0.75rem;">Work Experience</h2>${experience}</div>` : ''}
  ${education  ? `<div style="margin-bottom:1.5rem;"><h2 style="font-size:1rem;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;border-bottom:1px solid #e5e7eb;padding-bottom:0.25rem;margin-bottom:0.75rem;">Education</h2>${education}</div>` : ''}
  ${certs      ? `<div style="margin-bottom:1.5rem;"><h2 style="font-size:1rem;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;border-bottom:1px solid #e5e7eb;padding-bottom:0.25rem;margin-bottom:0.75rem;">Certifications</h2><ul style="margin:0;padding-left:1.2rem;">${certs}</ul></div>` : ''}
  ${form.languages ? `<div style="margin-bottom:1rem;"><h2 style="font-size:1rem;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;border-bottom:1px solid #e5e7eb;padding-bottom:0.25rem;margin-bottom:0.75rem;">Languages</h2><p style="margin:0;">${form.languages}</p></div>` : ''}
</div>`;
}

// ── Build tailored HTML from uploaded resume ──────────────────────────────────

function buildTailoredHtml(originalText, aiData, targetRole, userName) {
  const summary  = aiData.tailoredSummary || '';
  const expList  = Array.isArray(aiData.tailoredExperience) ? aiData.tailoredExperience : [];
  const skills   = Array.isArray(aiData.suggestedSkills)    ? aiData.suggestedSkills    : [];
  const contacts = aiData.contacts || {};
  const project  = aiData.sampleProject || null;

  const expHtml = expList.map((exp) => {
    const bullets = (exp.improvedBullets || []).map((b) => `<li style="margin-bottom:0.2rem;line-height:1.5;">${b}</li>`).join('');
    return `
    <div style="margin-bottom:1rem;">
      <div><strong>${exp.originalTitle || ''}</strong>${exp.company ? ` <span style="color:#555;">— ${exp.company}</span>` : ''}</div>
      ${bullets ? `<ul style="margin:0.4rem 0 0 1.2rem;padding:0;">${bullets}</ul>` : ''}
    </div>`;
  }).join('');

  const skillTags = skills.map((s) =>
    `<span style="background:#dbeafe;color:#1e40af;padding:0.2rem 0.6rem;border-radius:0.75rem;font-size:0.82rem;font-weight:500;">${s}</span>`
  ).join(' ');

  const contactParts = [
    contacts.email    ? `<a href="mailto:${contacts.email}" style="color:#1e3a8a;">${contacts.email}</a>` : '',
    contacts.phone    ? `<span>${contacts.phone}</span>` : '',
    contacts.linkedin ? `<a href="${contacts.linkedin}" style="color:#1e3a8a;">LinkedIn</a>` : '',
    contacts.github   ? `<a href="${contacts.github}" style="color:#1e3a8a;">GitHub</a>` : '',
    contacts.website  ? `<a href="${contacts.website}"  style="color:#1e3a8a;">Portfolio</a>` : '',
  ].filter(Boolean);

  const eduList = Array.isArray(aiData.education) ? aiData.education : [];
  const eduHtml = eduList.map((edu) => `
    <div style="margin-bottom:0.75rem;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div>
          <strong>${edu.degree || ''}</strong>
          ${edu.institution ? `<span style="color:#555;"> — ${edu.institution}</span>` : ''}
        </div>
        <span style="font-size:0.82rem;color:#777;">${edu.date || ''}</span>
      </div>
    </div>`).join('');

  let projectHtml = '';
  if (project && project.title) {
    const projBullets = (project.bullets || []).map((b) => `<li style="margin-bottom:0.2rem;line-height:1.5;">${b}</li>`).join('');
    projectHtml = `
    <div style="margin-bottom:1.5rem;">
      <h2 style="font-size:1rem;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;border-bottom:1px solid #e5e7eb;padding-bottom:0.25rem;margin-bottom:0.75rem;">Sample Project (Role-Relevant)</h2>
      <div style="margin-bottom:1rem;">
        <div><strong>${project.title}</strong></div>
        ${project.description ? `<p style="margin:0.2rem 0;color:#374151;">${project.description}</p>` : ''}
        ${projBullets ? `<ul style="margin:0.4rem 0 0 1.2rem;padding:0;">${projBullets}</ul>` : ''}
      </div>
    </div>`;
  }

  return `
<div style="max-width:800px;margin:0 auto;padding:2rem;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;line-height:1.6;">
  <div style="text-align:center;margin-bottom:1.5rem;border-bottom:2px solid #1e3a8a;padding-bottom:1rem;">
    <h1 style="margin:0;font-size:1.8rem;color:#1e3a8a;">${aiData.fullName || userName || 'Resume'}</h1>
    <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:0.75rem;margin-top:0.5rem;font-size:0.85rem;">
      ${contactParts.join(' <span style="color:#ccc;">|</span> ')}
    </div>
  </div>

  ${summary ? `
  <div style="margin-bottom:1.5rem;">
    <h2 style="font-size:1rem;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;border-bottom:1px solid #e5e7eb;padding-bottom:0.25rem;margin-bottom:0.75rem;">Professional Summary</h2>
    <p style="margin:0;color:#374151;">${summary}</p>
  </div>` : ''}

  ${skillTags ? `
  <div style="margin-bottom:1.5rem;">
    <h2 style="font-size:1rem;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;border-bottom:1px solid #e5e7eb;padding-bottom:0.25rem;margin-bottom:0.75rem;">Key Skills for This Role</h2>
    <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">${skillTags}</div>
  </div>` : ''}

  ${expHtml ? `
  <div style="margin-bottom:1.5rem;">
    <h2 style="font-size:1rem;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;border-bottom:1px solid #e5e7eb;padding-bottom:0.25rem;margin-bottom:0.75rem;">Work Experience (Tailored)</h2>
    ${expHtml}
  </div>` : ''}

  ${eduHtml ? `
  <div style="margin-bottom:1.5rem;">
    <h2 style="font-size:1rem;text-transform:uppercase;letter-spacing:1px;color:#1e3a8a;border-bottom:1px solid #e5e7eb;padding-bottom:0.25rem;margin-bottom:0.75rem;">Education</h2>
    ${eduHtml}
  </div>` : ''}

  ${projectHtml}
</div>`;
}

// ── Ensure table ──────────────────────────────────────────────────────────────

async function ensureResumeTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS resume_history (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
      title          TEXT,
      resume_type    TEXT DEFAULT 'generated',
      form_data      JSONB,
      generated_html TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_resume_history_user ON resume_history(user_id);
  `);
  await db.query(`
    ALTER TABLE resume_history ADD COLUMN IF NOT EXISTS resume_type TEXT DEFAULT 'generated';
  `).catch(() => {});
}

// ── Public service functions ──────────────────────────────────────────────────

async function generateResume(userId, form) {
  await ensureResumeTable();

  const needsAI =
    !form.summary?.trim() ||
    (form.experience || []).some((e) => !e.bullets?.trim());

  let aiData = null;
  if (needsAI) {
    aiData = await runAI(buildResumePrompt(form));
    if (!aiData) logger.warn('[Resume] Generating from user data only (AI unavailable)');
  }

  const generatedHtml = buildResumeHtml(form, aiData || {});

  try {
    const { rows } = await db.query(
      `INSERT INTO resume_history (user_id, title, resume_type, form_data, generated_html)
       VALUES ($1, $2, 'generated', $3, $4) RETURNING id, title, resume_type, created_at`,
      [userId, form.title || 'Resume', JSON.stringify(form), generatedHtml]
    );
    return { ...rows[0], generated_html: generatedHtml };
  } catch (dbErr) {
    logger.error('[Resume] DB save error: ' + dbErr.message);
    return { id: null, title: form.title, resume_type: 'generated', generated_html: generatedHtml, created_at: new Date().toISOString() };
  }
}

// Tailor an uploaded resume 
async function tailorUploadedResume(userId, resumeText, targetRole, userName) {
  await ensureResumeTable();

  if (!resumeText || resumeText.trim().length < 50) {
    const err = new Error('Resume text is too short to tailor'); err.status = 400; throw err;
  }
  if (!targetRole || !targetRole.trim()) {
    const err = new Error('targetRole is required'); err.status = 400; throw err;
  }

  const aiData = await runAI(buildTailorPrompt(resumeText, targetRole));
  if (!aiData) {
    const err = new Error('AI tailoring failed — check your AI API keys in Vercel environment variables'); err.status = 503; throw err;
  }

  const generatedHtml = buildTailoredHtml(resumeText, aiData, targetRole, userName);
  const title = `${targetRole} — Tailored Resume`;

  try {
    const { rows } = await db.query(
      `INSERT INTO resume_history (user_id, title, resume_type, form_data, generated_html)
       VALUES ($1, $2, 'tailored', $3, $4) RETURNING id, title, resume_type, created_at`,
      [userId, title, JSON.stringify({ targetRole, resumeTextLength: resumeText.length }), generatedHtml]
    );
    return { ...rows[0], generated_html: generatedHtml };
  } catch (dbErr) {
    logger.error('[Resume] DB save error (tailor): ' + dbErr.message);
    return { id: null, title, resume_type: 'tailored', generated_html: generatedHtml, created_at: new Date().toISOString() };
  }
}

async function getResumeHistory(userId) {
  await ensureResumeTable();
  try {
    const { rows } = await db.query(
      `SELECT id, title, resume_type, created_at, generated_html
         FROM resume_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 20`,
      [userId]
    );
    return rows;
  } catch (err) {
    if (err.code === '42P01') return [];
    throw err;
  }
}

async function deleteResume(userId, resumeId) {
  await ensureResumeTable();
  const { rows } = await db.query(
    'DELETE FROM resume_history WHERE id = $1 AND user_id = $2 RETURNING id',
    [resumeId, userId]
  );
  if (rows.length === 0) {
    const err = new Error('Resume not found'); err.status = 404; throw err;
  }
  return { message: 'Resume deleted' };
}

async function getResumeById(userId, id) {
  await ensureResumeTable();
  try {
    const { rows } = await db.query(
      `SELECT id, title, resume_type, form_data, generated_html, created_at
         FROM resume_history WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return rows[0] || null;
  } catch (err) {
    if (err.code === '42P01') return null;
    throw err;
  }
}

module.exports = { generateResume, tailorUploadedResume, getResumeHistory, getResumeById, deleteResume };