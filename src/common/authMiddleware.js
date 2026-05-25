const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { jwtSecret } = require('../config/env');
const logger = require('../common/logger');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.split(' ')[1];

  // ── 1. Verify JWT signature & expiry ──────────────────────────────────────
  let decoded;
  try {
    decoded = jwt.verify(token, jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // ── 2. Check token blacklist (revoked via logout) ─────────────────────────
  try {
    const blacklisted = await db.query(
      'SELECT id FROM token_blacklist WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (blacklisted.rows.length > 0) {
      return res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
    }
  } catch (err) {
    // Log the REAL error 
    logger.error('[authMiddleware] Blacklist DB check failed: ' + err.message, {
      stack: err.stack,
    });

   return res.status(503).json({
      error: 'Auth service temporarily unavailable. Please try again shortly.',
    });
  }

  req.user = decoded;
  next();
}

module.exports = requireAuth;