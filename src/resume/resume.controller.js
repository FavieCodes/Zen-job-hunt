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

// Accepts plain text extracted from an uploaded resume, tailors it with AI.

async function tailorResume(req, res, next) {
  try {
    const { resumeText, targetRole } = req.body;
    if (!resumeText || !targetRole) {
      return res.status(400).json({ error: 'resumeText and targetRole are required' });
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
// Permanently remove a saved resume from the user's history.
async function deleteResume(req, res, next) {
  try {
    const result = await resumeService.deleteResume(req.user.userId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { generateResume, getHistory, tailorResume, deleteResume };