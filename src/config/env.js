require('dotenv').config();

const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
required.forEach((key) => {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
});

const aiKeys = ['GROQ_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY'];
const hasAI = aiKeys.some((k) => !!process.env[k]);
if (!hasAI) {
  console.warn('[WARN] No AI key found. Set GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY in .env');
}

module.exports = {
  port:           process.env.PORT          || 3000,
  databaseUrl:    process.env.DATABASE_URL,
  redisUrl:       process.env.REDIS_URL,
  jwtSecret:      process.env.JWT_SECRET,
  refreshSecret:  process.env.JWT_REFRESH_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,

  // AI providers
  anthropicKey:   process.env.ANTHROPIC_API_KEY  || null,
  groqKey:        process.env.GROQ_API_KEY        || null,
  geminiKey:      process.env.GEMINI_API_KEY      || null,

  // Free job/scholarship APIs (add keys to .env to enable)
  adzunaAppId:    process.env.ADZUNA_APP_ID       || null,  
  adzunaAppKey:   process.env.ADZUNA_APP_KEY      || null,
};