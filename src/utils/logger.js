/**
 * Logger with different log levels and namespacing
 */
class Logger {
  /**
   * Create a new Logger instance
   * @param {string} [namespace=''] - Namespace for the logger
   */
  constructor(namespace = '') {
    this.namespace = namespace ? `[${namespace}]` : '';
  }

  /**
   * Log a debug message if debug level is enabled
   * @param {...any} args - Arguments to log
   */
  debug(...args) {
    if (process.env.DEBUG_LEVEL === 'debug') {
      console.debug(`[DEBUG]${this.namespace}`, ...args);
    }
  }

  /**
   * Log an info message
   * @param {...any} args - Arguments to log
   */
  info(...args) {
    console.info(`[INFO]${this.namespace}`, ...args);
  }

  /**
   * Log a warning message
   * @param {...any} args - Arguments to log
   */
  warn(...args) {
    console.warn(`[WARN]${this.namespace}`, ...args);
  }

  /**
   * Log an error message
   * @param {...any} args - Arguments to log
   */
  error(...args) {
    console.error(`[ERROR]${this.namespace}`, ...args);
  }

  /**
   * Create a namespaced logger
   * @param {string} namespace - Namespace to append
   * @returns {Logger} - New Logger instance with combined namespace
   */
  withNamespace(namespace) {
    const newNamespace = this.namespace 
      ? `${this.namespace}:${namespace}`
      : `[${namespace}]`;
    return new Logger(newNamespace);
  }

  /**
   * Create a new Logger with the given namespace
   * @param {string} namespace - Namespace for the logger
   * @returns {Logger} - New Logger instance
   */
  static create(namespace) {
    return new Logger(namespace);
  }
}

export { Logger };
