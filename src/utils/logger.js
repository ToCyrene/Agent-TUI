const levels = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel = process.env.LOG_LEVEL || 'info';

function log(level, ...args) {
  if (levels[level] < levels[currentLevel]) return;
  const ts = new Date().toISOString();
  console.error(`[${ts}] [${level.toUpperCase()}]`, ...args);
}

const logger = {
  debug: (...args) => log('debug', ...args),
  info: (...args) => log('info', ...args),
  warn: (...args) => log('warn', ...args),
  error: (...args) => log('error', ...args),
};

export default logger;
