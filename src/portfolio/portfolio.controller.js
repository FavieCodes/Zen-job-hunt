const portfolioService = require('./portfolio.service');
const logger = require('../common/logger');

async function generatePortfolio(req, res, next) {
  try {
    const info = req.body;
    if (!info.fullName) {
      return res.status(400).json({ error: 'fullName is required' });
    }

    const limitCheck = await portfolioService.checkLimits(req.user.userId);
    if (!limitCheck.allowed) {
      if (limitCheck.reason === 'total_limit_reached') {
        return res.status(403).json({
          error: 'total_limit_reached',
          message: 'You have reached the maximum total portfolio generations (5). Upgrade to generate more.',
        });
      }
      return res.status(429).json({
        error: 'daily_limit_reached',
        message: 'You have used your free daily portfolio generation. Upgrade to generate more.',
      });
    }

    const result = await portfolioService.generatePortfolio(req.user.userId, info);
    res.status(200).json(result);
  } catch (err) {
    logger.error(`[PortfolioController] generatePortfolio error: ${err.message}`);
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const history = await portfolioService.getPortfolioHistory(req.user.userId);
    res.status(200).json(history);
  } catch (err) {
    logger.error(`[PortfolioController] getHistory error: ${err.message}`);
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const portfolio = await portfolioService.getPortfolioById(req.user.userId, req.params.id);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    res.status(200).json(portfolio);
  } catch (err) {
    logger.error(`[PortfolioController] getById error: ${err.message}`);
    next(err);
  }
}

async function deletePortfolio(req, res, next) {
  try {
    const result = await portfolioService.deletePortfolio(req.user.userId, req.params.id);
    res.status(200).json(result);
  } catch (err) {
    logger.error(`[PortfolioController] deletePortfolio error: ${err.message}`);
    next(err);
  }
}



async function parseCv(req, res, next) {
  try {
    const { cvText } = req.body;
    if (!cvText) return res.status(400).json({ error: 'cvText is required' });

    const result = await portfolioService.parseCvText(cvText);
    res.status(200).json(result);
  } catch (err) {
    logger.error(`[PortfolioController] parseCv error: ${err.message}`);
    next(err);
  }
}

module.exports = { generatePortfolio, getHistory, getById, deletePortfolio, parseCv };