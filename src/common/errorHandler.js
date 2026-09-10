const logger = require('./logger');

function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';

  if (err.code === '22P02') {
    status = 404;
    message = 'Resource not found';
  }

  logger.error(`[${status}] ${message}`);
  res.status(status).json({ error: message });
}

module.exports = errorHandler;