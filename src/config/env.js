require('dotenv').config();

// Required env vars for basic operation. Google client ID is optional (only
// required if you enable Google social login).
const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'ANTHROPIC_API_KEY'];
required.forEach((key) => {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
});

module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  anthropicKey: process.env.ANTHROPIC_API_KEY,
};