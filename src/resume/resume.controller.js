const resumeService = require('./resume.service');
const pool = require('../config/db');
const logger = require('../common/logger');

// ── Daily limit helper ────────────────────────────────────────────────────────

async function checkResumeDailyLimit(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM resumes
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
      [userId]
    );
    return parseInt(rows[0].cnt, 10) < 1;
  } catch (err) {
    logger.warn('[Resume] Daily limit check failed, allowing request: ' + err.message);
    return true;
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function generateResume(req, res, next) {
  try {
    const form = req.body;
    if (!form.fullName || !form.email) {
      return res.status(400).json({ error: 'fullName and email are required' });
    }

    const withinLimit = await checkResumeDailyLimit(req.user.userId);
    if (!withinLimit) {
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

    const withinLimit = await checkResumeDailyLimit(req.user.userId);
    if (!withinLimit) {
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

module.exports = { generateResume, getHistory, tailorResume, deleteResume };