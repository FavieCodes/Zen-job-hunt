const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;

// ─── Formatters ───────────────────────────────────────────────────────────────
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length
    ? ' ' + JSON.stringify(meta, null, 0)
    : '';
  return `${timestamp} [${level}]: ${message}${metaStr}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), consoleFormat),
  transports: [
    new transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss.SSS' }), consoleFormat),
    }),
  ],
});

// morgan HTTP stream
logger.stream = { write: (message) => logger.info(message.trim()) };

// ─── Scraper-specific helpers ─────────────────────────────────────────────────

logger.scraperLog = function (status, phase, name, detail = {}) {
  const icon = status === 'ok' ? '✔' : status === 'warn' ? '⚠' : '✘';
  const parts = [`[${phase}] ${icon} ${name}`];

  if (detail.fetched  !== undefined) parts.push(`fetched=${detail.fetched}`);
  if (detail.saved    !== undefined) parts.push(`saved=${detail.saved}`);
  if (detail.skipped  !== undefined) parts.push(`skipped=${detail.skipped}`);
  if (detail.ms       !== undefined) parts.push(`${detail.ms}ms`);
  if (detail.error)                  parts.push(`err="${detail.error}"`);
  if (detail.note)                   parts.push(`note="${detail.note}"`);

  const msg = parts.join(' | ');
  if (status === 'error')     logger.error(msg);
  else if (status === 'warn') logger.warn(msg);
  else                        logger.info(msg);
};


logger.scraperPhaseStart = function (phaseNum, phaseName, sourceCount) {
  logger.info(
    `${'─'.repeat(60)}\n` +
    `  PHASE ${phaseNum}: ${phaseName}  (${sourceCount} source${sourceCount !== 1 ? 's' : ''})\n` +
    `${'─'.repeat(60)}`
  );
};

// scraperPhaseSummary — totals after each phase.
 
logger.scraperPhaseSummary = function (phaseName, { jobs = 0, scholarships = 0, errors = 0, ms = 0 } = {}) {
  logger.info(
    `[${phaseName} DONE] jobs+=${jobs} | scholarships+=${scholarships} | ` +
    `errors=${errors} | elapsed=${ms}ms`
  );
};

// scraperFinalSummary — banner at end of full run.
 
logger.scraperFinalSummary = function ({ jobs = 0, scholarships = 0, errors = 0, startedAt }) {
  const elapsed = Date.now() - startedAt;
  const mins = Math.floor(elapsed / 60000);
  const secs = ((elapsed % 60000) / 1000).toFixed(1);

  const pad = (s) => String(s).padEnd(34);
  const banner = [
    '╔' + '═'.repeat(58) + '╗',
    '║  SCRAPER RUN COMPLETE' + ' '.repeat(36) + '║',
    `║  Total jobs saved  : ${pad(jobs)}║`,
    `║  Total scholarships: ${pad(scholarships)}║`,
    `║  Sources errored   : ${pad(errors)}║`,
    `║  Total elapsed     : ${pad(mins + 'm ' + secs + 's')}║`,
    '╚' + '═'.repeat(58) + '╝',
  ].join('\n');

  logger.info('\n' + banner);
};

module.exports = logger;