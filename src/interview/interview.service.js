const Anthropic = require('@anthropic-ai/sdk');
const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../config/db');
const logger = require('../common/logger');

// Generate the universal prompt
function buildPrompt(jobRole, interviewType) {
  return `
    Act as an expert technical recruiter and interview coach. 
    A candidate is preparing for a "${interviewType}" interview for a "${jobRole}" role.
    
    Please provide:
    1. A list of 5-7 highly relevant practice questions for this exact role and interview type. For each question, include a brief "tip" on how to answer it effectively.
    2. A list of 3 recommended YouTube search queries they can use to find the best prep videos. Format the video recommendations as objects with "title" (what they are learning) and "url" (a YouTube search URL, e.g., https://www.youtube.com/results?search_query=...).
    
    Respond STRICTLY in valid JSON format matching this schema:
    {
      "questions": [
        { "question": "string", "tip": "string" }
      ],
      "videos": [
        { "title": "string", "url": "string" }
      ]
    }
    Do not include any markdown formatting around the JSON.
  `;
}

// Clean JSON response utility
function parseJsonResponse(resultText) {
  if (resultText.startsWith('```json')) {
    resultText = resultText.replace(/^```json\n?/, '').replace(/```$/, '').trim();
  } else if (resultText.startsWith('```')) {
    resultText = resultText.replace(/^```\n?/, '').replace(/```$/, '').trim();
  }
  return JSON.parse(resultText);
}

// AI Providers logic
async function callGroq(prompt) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not configured');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are an expert interview coach. Always output raw JSON only.' },
      { role: 'user', content: prompt }
    ],
    model: 'mixtral-8x7b-32768',
    temperature: 0.7,
    max_tokens: 1500,
  });
  return parseJsonResponse(chatCompletion.choices[0]?.message?.content || '');
}

async function callGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-1.5-flash',
    generationConfig: { responseMimeType: "application/json" }
  });
  const result = await model.generateContent(prompt);
  return parseJsonResponse(result.response.text());
}

async function callAnthropic(prompt) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 1500,
    temperature: 0.7,
    system: "You are an expert interview coach. Always output raw JSON only.",
    messages: [{ role: 'user', content: prompt }]
  });
  return parseJsonResponse(response.content[0].text.trim());
}

async function generateInterviewPrep(userId, jobRole, interviewType) {
  const prompt = buildPrompt(jobRole, interviewType);
  let parsedData = null;

  // AI Cascade: Groq -> Gemini -> Anthropic
  try {
    logger.info('[InterviewService] Attempting to use Groq...');
    parsedData = await callGroq(prompt);
    logger.info('[InterviewService] Groq succeeded.');
  } catch (groqErr) {
    logger.warn(`[InterviewService] Groq failed: ${groqErr.message}. Falling back to Gemini...`);
    try {
      parsedData = await callGemini(prompt);
      logger.info('[InterviewService] Gemini succeeded.');
    } catch (geminiErr) {
      logger.warn(`[InterviewService] Gemini failed: ${geminiErr.message}. Falling back to Anthropic...`);
      try {
        parsedData = await callAnthropic(prompt);
        logger.info('[InterviewService] Anthropic succeeded.');
      } catch (anthropicErr) {
        logger.error(`[InterviewService] Anthropic failed: ${anthropicErr.message}. All providers exhausted.`);
        throw new Error('All AI providers failed to generate interview prep. Please try again later.');
      }
    }
  }

  // Save to Database
  try {
    const insertQuery = `
      INSERT INTO interview_prep (user_id, job_role, interview_type, questions, videos)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      userId,
      jobRole,
      interviewType,
      JSON.stringify(parsedData.questions),
      JSON.stringify(parsedData.videos)
    ];

    const { rows } = await pool.query(insertQuery, values);
    return rows[0];
  } catch (error) {
    logger.error(`[InterviewService] Error saving prep to DB: ${error.message}`);
    throw new Error('Generated prep successfully but failed to save to database.');
  }
}

async function getUserHistory(userId) {
  const query = `
    SELECT id, user_id, job_role, interview_type, questions, videos, created_at
    FROM interview_prep
    WHERE user_id = $1
    ORDER BY created_at DESC
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows;
}

module.exports = {
  generateInterviewPrep,
  getUserHistory
};
