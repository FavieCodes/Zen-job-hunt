const resumeService = require('./resume.service');
const pool = require('../config/db');
const logger = require('../common/logger');

// ── Daily limit helper ────────────────────────────────────────────────────────

async function checkLimits(userId) {
  try {
    try {
      const userCheck = await pool.query('SELECT payment_status FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length > 0 && userCheck.rows[0].payment_status === 'paid') {
        return { allowed: true };
      }
    } catch (e) {
      // Ignore missing column
    }

    const { rows: totalRows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM resumes WHERE user_id = $1`,
      [userId]
    );
    if (parseInt(totalRows[0].cnt, 10) >= 5) {
      return { allowed: false, reason: 'total_limit_reached' };
    }

    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM resumes
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
      [userId]
    );
    if (parseInt(rows[0].cnt, 10) >= 1) {
      return { allowed: false, reason: 'daily_limit_reached' };
    }

    return { allowed: true };
  } catch (err) {
    logger.warn('[Resume] Limit check failed, allowing request: ' + err.message);
    return { allowed: true };
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function generateResume(req, res, next) {
  try {
    const form = req.body;
    if (!form.fullName || !form.email) {
      return res.status(400).json({ error: 'fullName and email are required' });
    }

    const limitCheck = await checkLimits(req.user.userId);
    if (!limitCheck.allowed) {
      if (limitCheck.reason === 'total_limit_reached') {
        return res.status(403).json({
          error: 'total_limit_reached',
          message: 'You have reached the maximum total resume generations (5). Upgrade to generate more.',
        });
      }
      return res.status(429).json({
        error: 'daily_limit_reached',
        message: 'You have used your free daily resume generation. Upgrade to generate more.',
      });
    }

    const result = await resumeService.generateResume(req.user.userId, form);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function tailorResume(req, res, next) {
  try {
    const { resumeText, targetRole } = req.body;
    if (!resumeText || !targetRole) {
      return res.status(400).json({ error: 'resumeText and targetRole are required' });
    }

    const limitCheck = await checkLimits(req.user.userId);
    if (!limitCheck.allowed) {
      if (limitCheck.reason === 'total_limit_reached') {
        return res.status(403).json({
          error: 'total_limit_reached',
          message: 'You have reached the maximum total resume generations (5). Upgrade to generate more.',
        });
      }
      return res.status(429).json({
        error: 'daily_limit_reached',
        message: 'You have used your free daily resume generation. Upgrade to generate more.',
      });
    }

    const userName = req.user.username || req.user.email || '';
    const result = await resumeService.tailorUploadedResume(
      req.user.userId,
      resumeText,
      targetRole,
      userName
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const history = await resumeService.getResumeHistory(req.user.userId);
    res.json(history);
  } catch (err) {
    next(err);
  }
}

async function deleteResume(req, res, next) {
  try {
    const result = await resumeService.deleteResume(req.user.userId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const resume = await resumeService.getResumeById(req.user.userId, req.params.id);
    if (!resume) return res.status(404).json({ error: 'Resume not found' });
    res.json(resume);
  } catch (err) {
    next(err);
  }
}

module.exports = { generateResume, getHistory, tailorResume, deleteResume, getById };