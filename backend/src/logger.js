// Structured JSON logger — swap for pino/winston in production
const logger = {
  info: (obj) => console.log(JSON.stringify({ level: 'info', ts: new Date().toISOString(), ...obj })),
  warn: (obj) => console.warn(JSON.stringify({ level: 'warn', ts: new Date().toISOString(), ...obj })),
  error: (obj) => console.error(JSON.stringify({ level: 'error', ts: new Date().toISOString(), ...obj })),
};

module.exports = logger;
