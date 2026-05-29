const interviewService = require('./interview.service');
const logger = require('../common/logger');

async function generatePrep(req, res, next) {
  try {
    const { job_role, interview_type } = req.body;
    
    if (!job_role || !interview_type) {
      return res.status(400).json({ error: 'job_role and interview_type are required' });
    }

    const userId = req.user.id;
    const result = await interviewService.generateInterviewPrep(userId, job_role, interview_type);
    
    res.status(200).json(result);
  } catch (err) {
    logger.error(`[InterviewController] generatePrep error: ${err.message}`);
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const userId = req.user.id;
    const history = await interviewService.getUserHistory(userId);
    res.status(200).json(history);
  } catch (err) {
    logger.error(`[InterviewController] getHistory error: ${err.message}`);
    next(err);
  }
}

module.exports = {
  generatePrep,
  getHistory,
};
