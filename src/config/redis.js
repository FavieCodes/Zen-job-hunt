const { createClient } = require('redis');
const { redisUrl } = require('./env');
const logger = require('../common/logger');

function buildRedisConfig(urlString) {
  const baseConfig = {
    disableOfflineQueue: true,
    offlineQueue: false,
    socket: {
      connectTimeout: 2000,
      reconnectStrategy: (retries) => {
        if (retries >= 2) return new Error('Redis connection limit reached');
        return 300;
      },
    },
  };

  if (!urlString) return baseConfig;

  try {
    const parsed = new URL(urlString);
    const config = {
      ...baseConfig,
      socket: {
        ...baseConfig.socket,
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
    return { ...baseConfig, url: urlString };
  }
}

const redis = createClient(buildRedisConfig(redisUrl));

redis.on('error', (err) => logger.warn('[redis] Redis error: ' + err.message));

redis
  .connect()
  .then(() => logger.info('[redis] Redis connected'))
  .catch((err) => logger.warn('[redis] Redis connection failed: ' + err.message));

module.exports = redis;