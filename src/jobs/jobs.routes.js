const router = require('express').Router();
const jobsController = require('./jobs.controller');

router.get('/',    jobsController.search);
router.get('/:id', jobsController.getOne);

module.exports = router;