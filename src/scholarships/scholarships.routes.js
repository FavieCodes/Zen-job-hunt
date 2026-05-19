const router = require('express').Router();
const scholarshipsController = require('./scholarships.controller');

router.get('/', scholarshipsController.search);

module.exports = router;