import pino, { type LoggerOptions } from 'pino'
import * as Sentry from '@sentry/nextjs'
import { prisma } from './prisma'

// Log levels
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

// Log context interface
export interface LogContext {
  [key: string]: any
  correlationId?: string
  requestId?: string
  userId?: string
  source?: string
  error?: Error | string
}

// Pino configuration based on environment
const isServerlessRuntime = typeof process !== 'undefined' && !!process.env.NEXT_RUNTIME

const pinoConfig: LoggerOptions = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: {
    env: process.env.NODE_ENV,
  },
  redact: {
    paths: [
      'password',
      'token',
      'apiKey',
      'secret',
      'authorization',
      '*.password',
      '*.token',
      '*.apiKey',
      '*.secret',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    remove: true,
  },
}

// Pretty transport uses worker threads; avoid it when running inside Next.js route workers
if (!isServerlessRuntime && process.env.NODE_ENV === 'development') {
  pinoConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  }
}

if (process.env.NODE_ENV === 'production') {
  pinoConfig.formatters = {
    level: (label: string) => {
      return { level: label }
    },
  }
}

// Create base Pino logger
const baseLogger = pino(pinoConfig)

// Enhanced logger class with Sentry and database integration
class ProductionLogger {
  private pino: pino.Logger

  constructor() {
    this.pino = baseLogger
  }

  // Get child logger with context
  child(context: LogContext) {
    return this.pino.child(context)
  }

  // Trace level logging
  trace(message: string, context?: LogContext) {
    this.pino.trace({ ...context }, message)
  }

  // Debug level logging
  debug(message: string, context?: LogContext) {
    this.pino.debug({ ...context }, message)
  }

  // Info level logging
  info(message: string, context?: LogContext) {
    this.pino.info({ ...context }, message)
  }

  // Warning level logging
  warn(message: string, context?: LogContext) {
    this.pino.warn({ ...context }, message)
  }

  // Error level logging with Sentry and database
  async error(message: string, context?: LogContext & { error?: Error | string }) {
    const enrichedContext = {
      ...context,
      timestamp: new Date().toISOString(),
    }

    // Log to Pino
    this.pino.error(enrichedContext, message)

    // Send to Sentry for critical errors
    if (context?.error) {
      const error = context.error instanceof Error ? context.error : new Error(context.error)

      Sentry.captureException(error, {
        tags: {
          source: context.source || 'unknown',
          level: 'error',
        },
        extra: {
          message,
          ...context,
        },
        user: context.userId ? { id: context.userId } : undefined,
      })
    }

    // Persist to database (async, non-blocking)
    this.persistError('error', message, enrichedContext).catch((err) => {
      // Fallback: log to console if DB persistence fails
      console.error('Failed to persist error to database:', err)
    })
  }

  // Fatal level logging with Sentry and database
  async fatal(message: string, context?: LogContext & { error?: Error | string }) {
    const enrichedContext = {
      ...context,
      timestamp: new Date().toISOString(),
    }

    // Log to Pino
    this.pino.fatal(enrichedContext, message)

    // Always send fatal errors to Sentry
    const error = context?.error instanceof Error ? context.error : new Error(message)

    Sentry.captureException(error, {
      level: 'fatal',
      tags: {
        source: context?.source || 'unknown',
        level: 'fatal',
      },
      extra: {
        message,
        ...context,
      },
      user: context?.userId ? { id: context.userId } : undefined,
    })

    // Persist to database (async, non-blocking)
    this.persistError('fatal', message, enrichedContext).catch((err) => {
      console.error('Failed to persist fatal error to database:', err)
    })
  }

  // Persist error to database
  private async persistError(
    level: string,
    message: string,
    context: LogContext & { error?: Error | string }
  ): Promise<void> {
    try {
      // Skip if ErrorLog model doesn't exist (not yet migrated)
      if (!(prisma as any).errorLog) {
        return
      }

      const stackTrace = context.error instanceof Error ? context.error.stack : undefined
      const errorCode = context.error instanceof Error ? context.error.name : undefined

      await (prisma as any).errorLog.create({
        data: {
          level,
          message,
          errorCode,
          stackTrace,
          userId: context.userId,
          requestId: context.requestId,
          correlationId: context.correlationId,
          source: context.source || 'unknown',
          metadata: context,
          timestamp: new Date(),
        },
      })
    } catch (err) {
      // Silently fail - we don't want logging errors to crash the app
      console.error('Error persisting to database:', err)
    }
  }

  // Add breadcrumb for Sentry debugging context
  addBreadcrumb(message: string, data?: Record<string, any>) {
    Sentry.addBreadcrumb({
      message,
      data,
      timestamp: Date.now() / 1000,
    })
  }

  // Set user context for Sentry
  setUser(userId: string, email?: string, username?: string) {
    Sentry.setUser({
      id: userId,
      email,
      username,
    })
  }

  // Clear user context
  clearUser() {
    Sentry.setUser(null)
  }

  // Flush logs (useful for graceful shutdown)
  async flush(): Promise<void> {
    await Sentry.flush(2000)
  }
}

// Export singleton instance
export const logger = new ProductionLogger()

// Export convenience functions
export const log = {
  trace: (message: string, context?: LogContext) => logger.trace(message, context),
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  warn: (message: string, context?: LogContext) => logger.warn(message, context),
  error: (message: string, context?: LogContext & { error?: Error | string }) => logger.error(message, context),
  fatal: (message: string, context?: LogContext & { error?: Error | string }) => logger.fatal(message, context),
}

// Export types
export type { ProductionLogger }
