const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { jwtSecret } = require('../config/env');

async function signup(email, username, password) {
  // Check if email or username already exists
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
  const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '7d' });

  return { token, user };
}

async function login(email, password) {
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

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

  const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '7d' });

  return {
    token,
    user: { id: user.id, email: user.email, username: user.username },
  };
}

module.exports = { signup, login };