const router = require('express').Router();
const portfolioController = require('./portfolio.controller');
const requireAuth = require('../common/authMiddleware');

router.post('/generate',  requireAuth, portfolioController.generatePortfolio);
router.post('/parse-cv',  requireAuth, portfolioController.parseCv);
router.get('/history',    requireAuth, portfolioController.getHistory);
router.get('/:id',        requireAuth, portfolioController.getById);
router.delete('/:id',     requireAuth, portfolioController.deletePortfolio);

module.exports = router;