const logger = require('./logger');

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Something went wrong';
  logger.error(`[${status}] ${message}`);
  res.status(status).json({ error: message });
}

module.exports = errorHandler;