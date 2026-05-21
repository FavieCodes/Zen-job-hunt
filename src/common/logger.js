const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;

const myFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), myFormat),
  transports: [new transports.Console({ format: combine(colorize(), timestamp(), myFormat) })],
});

// morgan stream
logger.stream = {
  write: (message) => logger.info(message.trim()),
};

module.exports = logger;
