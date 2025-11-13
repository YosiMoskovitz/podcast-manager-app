import winston from 'winston';
import path from 'path';

const logDir = './logs';

// Configure general log level via LOG_LEVEL env (affects console); keep file logs quieter by default
const consoleLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info');
const fileCombinedLevel = process.env.FILE_LOG_LEVEL || 'warn';

export const logger = winston.createLogger({
  level: consoleLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'podcast-manager' },
  transports: [
    // Errors always go to error.log
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    }),
    // Combined file contains warnings and above by default to reduce noisy info/debug entries
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      level: fileCombinedLevel
    })
  ]
});

// Add console transport; level is configurable and defaults to 'info' during development
logger.add(new winston.transports.Console({
  level: consoleLevel,
  format: winston.format.combine(
    winston.format.colorize(),
    // Keep console human-readable
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
      const time = timestamp || new Date().toISOString();
      const base = `${time} ${level}: ${message}`;
      if (stack) return `${base}\n${stack}`;
      // If there are other metadata fields, show a compact JSON preview
      const metaKeys = Object.keys(meta || {});
      if (metaKeys.length) return `${base} ${JSON.stringify(meta)}`;
      return base;
    })
  )
}));
