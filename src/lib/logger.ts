interface LogContext {
  [key: string]: any
}

class Logger {
  info(message: string, context?: LogContext) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...context
    }))
  }

  error(message: string, context?: LogContext & { error?: string }) {
    console.error(JSON.stringify({
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      ...context
    }))
  }

  warn(message: string, context?: LogContext) {
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      ...context
    }))
  }

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify({
        level: 'debug',
        message,
        timestamp: new Date().toISOString(),
        ...context
      }))
    }
  }
}

export const logger = new Logger()