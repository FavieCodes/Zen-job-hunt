const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { jwtSecret } = require('../config/env');
const logger = require('../common/logger');

/**
 * requireAdmin
 *
 * Extends the standard auth check with a role === 'admin' guard.
 * Must be used AFTER (or instead of) requireAuth on admin routes.
 *
 * Pipeline:
 *   1. Verify Bearer token signature + expiry
 *   2. Check token is not blacklisted (revoked via logout)
 *   3. Re-fetch user from DB to confirm role is still 'admin'
 *      (handles the case where a user was demoted after their token was issued)
 */
async function requireAdmin(req, res, next) {
  // ── 1. Verify JWT ──────────────────────────────────────────────────────────
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // ── 2. Blacklist check ─────────────────────────────────────────────────────
  try {
    const blacklisted = await db.query(
      'SELECT id FROM token_blacklist WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (blacklisted.rows.length > 0) {
      return res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
    }
  } catch (err) {
    logger.error('[requireAdmin] Blacklist check failed: ' + err.message);
    return res.status(503).json({ error: 'Auth service temporarily unavailable.' });
  }

  // ── 3. Role check (live DB read — not just the JWT payload) ───────────────
  try {
    const result = await db.query(
      'SELECT id, role FROM users WHERE id = $1',
      [decoded.userId]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admin access required' });
    }
  } catch (err) {
    logger.error('[requireAdmin] Role check failed: ' + err.message);
    return res.status(503).json({ error: 'Auth service temporarily unavailable.' });
  }

  req.user = decoded;
  next();
}

module.exports = requireAdmin;