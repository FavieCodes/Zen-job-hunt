const jobsService = require('./jobs.service');

async function search(req, res, next) {
  try {
    const { country, state, city, q, job_type, page, limit } = req.query;
    const result = await jobsService.searchJobs({ country, state, city, q, job_type, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(404).json({ error: 'Job not found' });
    }
    const job = await jobsService.getJobById(id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    next(err);
  }
}

module.exports = { search, getOne };