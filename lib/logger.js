const noop = function() {}

const info = noop
const warn = noop
const debug = noop
const error = noop

class Logger {
  constructor() {
    this.logger = {
      info,
      warn,
      debug,
      error
    }
  }

  info(...args) {
    this.logger.info(...args)
  }

  warn(...args) {
    this.logger.warn(...args)
  }

  debug(...args) {
    this.logger.debug(...args)
  }

  error(...args) {
    this.logger.error(...args)
  }

  setCustomLogger(customLogger) {
    this.logger = customLogger
  }
}

module.exports = new Logger()

