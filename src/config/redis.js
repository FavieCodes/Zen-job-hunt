const { createClient } = require('redis');
const { redisUrl } = require('./env');
const logger = require('../common/logger');

const redis = createClient({ url: redisUrl });

redis.on('error', (err) => logger.error('Redis error ' + err.message));

redis.connect().then(() => logger.info('Redis connected')).catch((err) => logger.error('Redis connection failed: ' + err.message));

module.exports = redis;