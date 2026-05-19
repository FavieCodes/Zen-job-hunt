const { createClient } = require('redis');
const { redisUrl } = require('./env');

const redis = createClient({ url: redisUrl });

redis.on('error', (err) => console.error('Redis error', err));

redis.connect().then(() => console.log('Redis connected'));

module.exports = redis;