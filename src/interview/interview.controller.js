const interviewService = require('./interview.service');
const logger = require('../common/logger');

// Generate interview prep (with daily limit check)
async function generatePrep(req, res, next) {
  try {
    const { job_role, interview_type } = req.body;
    if (!job_role || !interview_type) {
      return res.status(400).json({ error: 'job_role and interview_type are required' });
    }
    const userId = req.user.userId;

    // Daily limit: max 1 per day
    const withinLimit = await interviewService.checkDailyLimit(userId);
    if (!withinLimit) {
      return res.status(429).json({
        error: 'daily_limit_reached',
        message: 'You have used your free daily interview prep. Upgrade to generate more.',
      });
    }

    const result = await interviewService.generateInterviewPrep(userId, job_role, interview_type);
    res.status(200).json(result);
  } catch (err) {
    logger.error(`[InterviewController] generatePrep error: ${err.message}`);
    next(err);
  }
}

// Get prep history
async function getHistory(req, res, next) {
  try {
    const userId = req.user.userId;
    const history = await interviewService.getUserHistory(userId);
    res.status(200).json(history);
  } catch (err) {
    logger.error(`[InterviewController] getHistory error: ${err.message}`);
    next(err);
  }
}

// Get single prep by ID  ← FIX #1
async function getById(req, res, next) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const prep = await interviewService.getPrepById(userId, id);
    if (!prep) {
      return res.status(404).json({ error: 'Interview prep not found' });
    }
    res.status(200).json(prep);
  } catch (err) {
    logger.error(`[InterviewController] getById error: ${err.message}`);
    next(err);
  }
}

// Generate AI answer for a single question
async function generateAnswer(req, res, next) {
  try {
    const { question, tip, job_role, interview_type } = req.body;
    if (!question) return res.status(400).json({ error: 'question is required' });

    const answer = await interviewService.generateSingleAnswer({ question, tip, job_role, interview_type });
    res.status(200).json({ answer });
  } catch (err) {
    logger.error(`[InterviewController] generateAnswer error: ${err.message}`);
    next(err);
  }
}

module.exports = { generatePrep, getHistory, getById, generateAnswer };