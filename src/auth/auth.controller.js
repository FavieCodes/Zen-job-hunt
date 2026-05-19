const authService = require('./auth.service');

async function signup(req, res, next) {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'email, username and password are required' });
    }

    const data = await authService.signup(email, username, password);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const data = await authService.login(email, password);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login };