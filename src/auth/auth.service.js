const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const db = require('../config/db');
const mailer = require('../common/mailer');
const { jwtSecret, refreshSecret, googleClientId } = require('../config/env');

async function signup(email, username, password) {
  const existing = await db.query(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [email, username]
  );
  if (existing.rows.length > 0) {
    const err = new Error('Email or username already taken');
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await db.query(
    `INSERT INTO users (email, username, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, username, created_at`,
    [email, username, passwordHash]
  );
  const user = result.rows[0];

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.query(
    'INSERT INTO confirmations (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [user.id, token, expiresAt]
  );
  mailer.sendConfirmationEmail(user.email, token).catch(() => {});

  return { message: 'A confirmation email has been sent to your address.' };
}

async function login(email, password) {
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];

  if (!user) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const accessToken = jwt.sign({ userId: user.id, type: 'access' }, jwtSecret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, refreshSecret, { expiresIn: '30d' });

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, username: user.username, is_confirmed: user.is_confirmed },
  };
}

async function logout(accessToken, refreshToken) {
  const blacklistToken = async (token, secret) => {
    try {
      const decoded = jwt.verify(token, secret, { ignoreExpiration: false });
      const expiresAt = new Date(decoded.exp * 1000);
      await db.query(
        `INSERT INTO token_blacklist (token, expires_at)
         VALUES ($1, $2)
         ON CONFLICT (token) DO NOTHING`,
        [token, expiresAt]
      );
    } catch {
    }
  };

  await blacklistToken(accessToken, jwtSecret);
  if (refreshToken) {
    await blacklistToken(refreshToken, refreshSecret);
  }
}

async function loginWithGoogle(token) {
  let payload;
  try {
    const client = new OAuth2Client(googleClientId);
    const ticket = await client.verifyIdToken({ idToken: token, audience: googleClientId });
    payload = ticket.getPayload();
  } catch {
    try {
      const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      payload = response.data;
    } catch {
      const err = new Error('Invalid Google token');
      err.status = 401;
      throw err;
    }
  }

  if (!payload || !payload.email) {
    const err = new Error('Invalid Google token payload');
    err.status = 401;
    throw err;
  }

  const email = payload.email;
  const name = payload.name || email.split('@')[0];
  const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  let user = existing.rows[0];

  if (!user) {
    let username = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
    if (!username) username = `user_${Date.now()}`;

    const conflicts = await db.query(
      'SELECT username FROM users WHERE username LIKE $1',
      [`${username}%`]
    );
    const taken = new Set(conflicts.rows.map((r) => r.username));
    let candidate = username;
    let suffix = 1;
    while (taken.has(candidate)) candidate = `${username}_${suffix++}`;

    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    const res = await db.query(
      `INSERT INTO users (email, username, password_hash, is_confirmed)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, email, username, is_confirmed`,
      [email, candidate, passwordHash]
    );
    user = res.rows[0];
  }

  const accessToken = jwt.sign({ userId: user.id, type: 'access' }, jwtSecret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, refreshSecret, { expiresIn: '30d' });
  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, username: user.username, is_confirmed: user.is_confirmed },
  };
}

async function issuePasswordReset(email) {
  const userRes = await db.query('SELECT id, email FROM users WHERE email = $1', [email]);
  const user = userRes.rows[0];
  if (!user) return;

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 5000);
  await db.query(
    'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [user.id, token, expiresAt]
  );
  await mailer.sendResetEmail(user.email, token).catch(() => {});
}

async function resetPasswordWithToken(token, newPassword) {
  const row = await db.query(
    'SELECT user_id FROM password_resets WHERE token = $1 AND expires_at > NOW()',
    [token]
  );
  const r = row.rows[0];
  if (!r) {
    const err = new Error('Invalid or expired token');
    err.status = 400;
    throw err;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, r.user_id]);
  await db.query('DELETE FROM password_resets WHERE user_id = $1', [r.user_id]);
}

async function changePassword(userId, oldPassword, newPassword) {
  const row = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const user = row.rows[0];
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  const match = await bcrypt.compare(oldPassword, user.password_hash);
  if (!match) {
    const err = new Error('Invalid old password');
    err.status = 401;
    throw err;
  }
  if (oldPassword === newPassword) {
    const err = new Error('New password must differ from old password');
    err.status = 400;
    throw err;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
}

async function confirmRegistration(token) {
  const row = await db.query(
    'SELECT user_id FROM confirmations WHERE token = $1 AND expires_at > NOW()',
    [token]
  );
  const r = row.rows[0];
  if (!r) {
    const err = new Error('Invalid or expired confirmation token');
    err.status = 400;
    throw err;
  }
  const userRow = await db.query(
    'UPDATE users SET is_confirmed = TRUE WHERE id = $1 RETURNING id, email, username',
    [r.user_id]
  );
  const user = userRow.rows[0];
  await db.query('DELETE FROM confirmations WHERE user_id = $1', [r.user_id]);

  const accessToken = jwt.sign({ userId: user.id, type: 'access' }, jwtSecret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, refreshSecret, { expiresIn: '30d' });

  return { message: 'Account confirmed', accessToken, refreshToken, user: { ...user, is_confirmed: true } };
}

async function resendConfirmation(email) {
  const result = await db.query('SELECT id, email, is_confirmed FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  if (user.is_confirmed) {
    const err = new Error('Account is already confirmed');
    err.status = 400;
    throw err;
  }

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.query('DELETE FROM confirmations WHERE user_id = $1', [user.id]);
  await db.query(
    'INSERT INTO confirmations (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [user.id, token, expiresAt]
  );
  mailer.sendConfirmationEmail(user.email, token).catch(() => {});
  return { message: 'Confirmation email resent' };
}

async function getMe(userId) {
  const result = await db.query(
    'SELECT id, email, username, is_confirmed FROM users WHERE id = $1',
    [userId]
  );
  const user = result.rows[0];
  if (!user) {
    const err = new Error('User not found');
    err.status = 401;
    throw err;
  }
  return { user };
}

module.exports = {
  signup,
  login,
  logout,
  loginWithGoogle,
  issuePasswordReset,
  resetPasswordWithToken,
  changePassword,
  confirmRegistration,
  resendConfirmation,
  getMe,
};