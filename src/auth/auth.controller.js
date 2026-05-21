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

async function googleLogin(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    const data = await authService.loginWithGoogle(idToken);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    await authService.issuePasswordReset(email);
    // Always return success to avoid leaking user existence
    res.json({ message: 'If an account exists an email has been sent' });
  } catch (err) {
    next(err);
  }
}

async function resetPasswordAuthenticated(req, res, next) {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { oldPassword, newPassword, confirmNewPassword } = req.body;
    if (!oldPassword || !newPassword || !confirmNewPassword) return res.status(400).json({ error: 'oldPassword, newPassword and confirmNewPassword are required' });
    if (newPassword !== confirmNewPassword) return res.status(400).json({ error: 'new passwords do not match' });
    if (oldPassword === newPassword) return res.status(400).json({ error: 'new password must be different from old password' });

    await authService.changePassword(userId, oldPassword, newPassword);
    res.json({ message: 'Password changed' });
  } catch (err) {
    next(err);
  }
}

async function resetPasswordWithToken(req, res, next) {
  try {
    const { token, newPassword, confirmNewPassword } = req.body;
    if (!token || !newPassword || !confirmNewPassword) return res.status(400).json({ error: 'token, newPassword and confirmNewPassword are required' });
    if (newPassword !== confirmNewPassword) return res.status(400).json({ error: 'new passwords do not match' });

    await authService.resetPasswordWithToken(token, newPassword);
    res.json({ message: 'Password reset' });
  } catch (err) {
    next(err);
  }
}

async function confirmRegistration(req, res, next) {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).json({ error: 'token is required' });

    const data = await authService.confirmRegistration(token);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, googleLogin, forgotPassword, resetPasswordAuthenticated, resetPasswordWithToken, confirmRegistration };