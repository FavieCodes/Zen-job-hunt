const scholarshipsService = require('./scholarships.service');

async function search(req, res, next) {
  try {
    const { country, field, page } = req.query;
    const scholarships = await scholarshipsService.searchScholarships({ country, field, page });
    res.json({ scholarships, page: Number(page) || 1, count: scholarships.length });
  } catch (err) {
    next(err);
  }
}

module.exports = { search };