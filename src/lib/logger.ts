/**
 * Legacy Logger Interface - Backwards Compatibility Wrapper
 *
 * This file maintains backwards compatibility with existing code
 * while using the new Pino-based logger under the hood.
 *
 * For new code, prefer importing from './logger-pino'
 */

import { logger as pinoLogger, type LogContext } from './logger-pino'

class Logger {
  info(message: string, context?: LogContext) {
    pinoLogger.info(message, context)
  }

  error(message: string, context?: LogContext & { error?: string | Error }) {
    pinoLogger.error(message, context).catch(err => {
      // Fallback to console if async error logging fails
      console.error('Logger error:', err)
    })
  }

  warn(message: string, context?: LogContext) {
    pinoLogger.warn(message, context)
  }

  debug(message: string, context?: LogContext) {
    pinoLogger.debug(message, context)
  }
}

// Export legacy logger instance for backwards compatibility
export const logger = new Logger()

// Re-export types for convenience
export type { LogContext }