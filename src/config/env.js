require('dotenv').config();

const required = ['DATABASE_URL', 'JWT_SECRET', 'ANTHROPIC_API_KEY'];
required.forEach((key) => {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
});

module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
  anthropicKey: process.env.ANTHROPIC_API_KEY,
};