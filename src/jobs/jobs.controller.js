const jobsService = require('./jobs.service');

async function search(req, res, next) {
  try {
    const { country, state, city, q, job_type, page } = req.query;
    const jobs = await jobsService.searchJobs({ country, state, city, q, job_type, page });
    res.json({ jobs, page: Number(page) || 1, count: jobs.length });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const job = await jobsService.getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    next(err);
  }
}

module.exports = { search, getOne };