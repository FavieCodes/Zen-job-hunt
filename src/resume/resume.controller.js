const resumeService = require('./resume.service');

async function generateResume(req, res, next) {
  try {
    const form = req.body;
    if (!form.fullName || !form.email) {
      return res.status(400).json({ error: 'fullName and email are required' });
    }
    const result = await resumeService.generateResume(req.user.userId, form);
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

module.exports = { generateResume, getHistory };