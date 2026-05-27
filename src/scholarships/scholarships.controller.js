const scholarshipsService = require('./scholarships.service');

async function search(req, res, next) {
  try {
    const { country, field, page, limit } = req.query;
    const result = await scholarshipsService.searchScholarships({ country, field, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const scholarship = await scholarshipsService.getScholarshipById(req.params.id);
    if (!scholarship) return res.status(404).json({ error: 'Scholarship not found' });
    res.json(scholarship);
  } catch (err) {
    next(err);
  }
}

module.exports = { search, getOne };