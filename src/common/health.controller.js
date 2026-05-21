const { databaseUrl } = require('../config/env');
const pool = require('../config/db');
const redis = require('../config/redis');
const logger = require('./logger');

async function health(req, res) {
  const start = Date.now();
  const result = { status: 'ok', checks: {}, uptime: process.uptime(), timestamp: new Date().toISOString() };

  // DB check
  try {
    await pool.query('SELECT 1');
    result.checks.database = { connected: true, url: databaseUrl };
  } catch (err) {
    // Log full error for easier debugging (include code and stack when available)
    const errMsg = err && (err.message || err.toString()) || 'unknown error';
    const errCode = err && err.code ? err.code : undefined;
    logger.error(`Database health check failed: ${errMsg}${errCode ? ` (code=${errCode})` : ''}`);
    if (err && err.stack) logger.error(err.stack);
    result.checks.database = { connected: false, error: errMsg, code: errCode };
    result.status = 'degraded';
  }

  // Redis check
  try {
    // redis.ping() may be available; fallback to isOpen
    let redisOk = false;
    if (typeof redis.ping === 'function') {
      const pong = await redis.ping();
      redisOk = pong && (pong === 'PONG' || pong === 'OK');
    } else if (redis.isOpen !== undefined) {
      redisOk = !!redis.isOpen;
    } else if (redis.connected !== undefined) {
      redisOk = !!redis.connected;
    }

    if (redisOk) result.checks.redis = { connected: true };
    else throw new Error('Redis not connected');
  } catch (err) {
    logger.error('Redis health check failed: ' + err.message);
    result.checks.redis = { connected: false, error: err.message };
    result.status = 'degraded';
  }

  result.responseTimeMs = Date.now() - start;
  res.json(result);
}

module.exports = { health };
