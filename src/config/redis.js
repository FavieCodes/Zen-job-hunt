const { createClient } = require('redis');
const { redisUrl } = require('./env');
const logger = require('../common/logger');

function buildRedisConfig(urlString) {
  if (!urlString) return {};

  try {
    const parsed = new URL(urlString);
    const config = {
      socket: {
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : 6379,
        tls: parsed.protocol === 'rediss:',
      },
    };
    if (parsed.username) config.username = decodeURIComponent(parsed.username);
    if (parsed.password) config.password = decodeURIComponent(parsed.password);
    if (parsed.pathname && parsed.pathname.length > 1) {
      config.database = parseInt(parsed.pathname.slice(1), 10) || 0;
    }
    return config;
  } catch {
    logger.warn('[redis] Could not parse REDIS_URL; falling back to raw URL string');
    return { url: urlString };
  }
}

const redis = createClient(buildRedisConfig(redisUrl));

redis.on('error', (err) => logger.error('Redis error ' + err.message));

redis
  .connect()
  .then(() => logger.info('Redis connected'))
  .catch((err) => logger.error('Redis connection failed: ' + err.message));

module.exports = redis;