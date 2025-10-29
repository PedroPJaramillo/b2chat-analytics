import { prisma } from './prisma'
import { logger } from './logger'

// Audit event types
export enum AuditEventType {
  // Authentication events
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_LOGIN_FAILED = 'user_login_failed',

  // Data access events
  DATA_VIEWED = 'data_viewed',
  DATA_EXPORTED = 'data_exported',
  DATA_SEARCHED = 'data_searched',

  // Sync operations
  SYNC_STARTED = 'sync_started',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_FAILED = 'sync_failed',
  SYNC_CANCELLED = 'sync_cancelled',
  SYNC_CONFIG_CHANGED = 'sync_config_changed',

  // Administrative actions
  SETTINGS_CHANGED = 'settings_changed',
  USER_ROLE_CHANGED = 'user_role_changed',
  SYSTEM_CONFIG_CHANGED = 'system_config_changed',

  // Security events
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  INPUT_VALIDATION_FAILED = 'input_validation_failed',

  // API events
  API_ERROR = 'api_error',
  API_SLOW_RESPONSE = 'api_slow_response',
  B2CHAT_API_ERROR = 'b2chat_api_error',

  // System events
  SYSTEM_STARTUP = 'system_startup',
  SYSTEM_SHUTDOWN = 'system_shutdown',
  DATABASE_CONNECTION_FAILED = 'database_connection_failed',
  CACHE_CLEARED = 'cache_cleared',
}

// Audit event severity levels
export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Audit event interface
export interface AuditEvent {
  userId?: string
  userEmail?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  eventType: AuditEventType
  severity: AuditSeverity
  resource?: string
  action?: string
  details?: Record<string, any>
  metadata?: Record<string, any>
  success: boolean
  errorMessage?: string
  timestamp?: Date
  requestId?: string
}

// Audit logging class
export class AuditLogger {
  private static instance: AuditLogger
  private buffer: AuditEvent[] = []
  private flushInterval: NodeJS.Timeout | null = null

  private constructor() {
    this.setupPeriodicFlush()
  }

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger()
    }
    return AuditLogger.instance
  }

  // Log an audit event
  public async log(event: AuditEvent): Promise<void> {
    const auditEntry: AuditEvent = {
      ...event,
      timestamp: event.timestamp || new Date(),
      requestId: event.requestId || this.generateRequestId(),
    }

    // Add to buffer for batch processing
    this.buffer.push(auditEntry)

    // Log to structured logger immediately for real-time monitoring
    logger.info('Audit Event', {
      eventType: auditEntry.eventType,
      severity: auditEntry.severity,
      userId: auditEntry.userId,
      resource: auditEntry.resource,
      action: auditEntry.action,
      success: auditEntry.success,
      ipAddress: auditEntry.ipAddress,
      details: auditEntry.details,
      timestamp: auditEntry.timestamp,
      requestId: auditEntry.requestId,
    })

    // Immediately persist critical events
    if (auditEntry.severity === AuditSeverity.CRITICAL) {
      await this.persistEvent(auditEntry)
      this.removeFromBuffer(auditEntry)
    }

    // Flush buffer if it gets too large
    if (this.buffer.length >= 100) {
      await this.flushBuffer()
    }
  }

  // Convenience methods for different event types
  public async logUserAction(
    userId: string,
    action: string,
    resource: string,
    details?: Record<string, any>,
    request?: { ip?: string; userAgent?: string }
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.DATA_VIEWED,
      severity: AuditSeverity.LOW,
      resource,
      action,
      details,
      success: true,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
    })
  }

  public async logSecurityEvent(
    eventType: AuditEventType,
    details: Record<string, any>,
    request?: { ip?: string; userAgent?: string; userId?: string }
  ): Promise<void> {
    await this.log({
      userId: request?.userId,
      eventType,
      severity: AuditSeverity.HIGH,
      resource: 'security',
      action: 'security_violation',
      details,
      success: false,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
    })
  }

  public async logSystemEvent(
    eventType: AuditEventType,
    details: Record<string, any>,
    severity: AuditSeverity = AuditSeverity.MEDIUM
  ): Promise<void> {
    await this.log({
      eventType,
      severity,
      resource: 'system',
      action: 'system_event',
      details,
      success: true,
    })
  }

  public async logSyncEvent(
    userId: string,
    eventType: AuditEventType,
    details: Record<string, any>,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      userId,
      eventType,
      severity: success ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
      resource: 'sync',
      action: 'data_sync',
      details,
      success,
      errorMessage,
    })
  }

  public async logAPIError(
    endpoint: string,
    error: Error,
    userId?: string,
    request?: { ip?: string; userAgent?: string }
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.API_ERROR,
      severity: AuditSeverity.MEDIUM,
      resource: endpoint,
      action: 'api_call',
      details: {
        endpoint,
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack?.split('\n').slice(0, 5), // Limit stack trace
      },
      success: false,
      errorMessage: error.message,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
    })
  }

  // Flush buffer to database
  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return

    const events = [...this.buffer]
    this.buffer = []

    try {
      await this.persistEvents(events)
      // Wrap debug call in try-catch to handle worker exit gracefully
      try {
        logger.debug('Audit buffer flushed', { count: events.length })
      } catch (logError) {
        // Silent fail - worker may have exited during shutdown
      }
    } catch (error) {
      // If persistence fails, add back to buffer and log error
      this.buffer.unshift(...events)
      // Wrap error call in try-catch to handle worker exit gracefully
      try {
        logger.error('Failed to flush audit buffer', {
          error: error instanceof Error ? error.message : 'Unknown error',
          eventCount: events.length
        })
      } catch (logError) {
        // Fallback to console.error if logger fails
        console.error('Failed to flush audit buffer:', error)
      }
    }
  }

  // Persist single event to database
  private async persistEvent(event: AuditEvent): Promise<void> {
    try {
      // Skip audit logging if user doesn't exist yet (FK constraint issue)
      // This is acceptable for non-compliance scenarios
      if (event.userId) {
        const userExists = await prisma.user.findUnique({
          where: { id: event.userId },
          select: { id: true }
        })

        if (!userExists) {
          logger.debug('Skipping audit log - user not synced yet', {
            userId: event.userId,
            eventType: event.eventType
          })
          return
        }
      }

      await prisma.auditLog.create({
        data: {
          timestamp: event.timestamp || new Date(),
          userId: event.userId,
          userEmail: event.userEmail,
          sessionId: event.sessionId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          eventType: event.eventType,
          severity: event.severity,
          resource: event.resource,
          action: event.action,
          details: event.details || {},
          metadata: event.metadata || {},
          success: event.success,
          errorMessage: event.errorMessage,
          requestId: event.requestId,
          correlationId: event.metadata?.correlationId as string | undefined,
        }
      })
    } catch (error) {
      // Silently fail - audit logging should never break the app
      logger.debug('Failed to persist audit event (non-critical)', {
        eventType: event.eventType,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Persist multiple events to database
  private async persistEvents(events: AuditEvent[]): Promise<void> {
    try {
      // Filter out events for users that don't exist yet (FK constraint issue)
      const userIds = [...new Set(events.map(e => e.userId).filter(Boolean))] as string[]

      let existingUserIds = new Set<string>()
      if (userIds.length > 0) {
        const existingUsers = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true }
        })
        existingUserIds = new Set(existingUsers.map(u => u.id))
      }

      // Only persist events for users that exist, or events without userId
      const validEvents = events.filter(event =>
        !event.userId || existingUserIds.has(event.userId)
      )

      if (validEvents.length === 0) {
        logger.debug('No valid audit events to persist (all users not synced yet)', {
          totalEvents: events.length
        })
        return
      }

      if (validEvents.length < events.length) {
        logger.debug('Skipping some audit logs - users not synced yet', {
          total: events.length,
          valid: validEvents.length,
          skipped: events.length - validEvents.length
        })
      }

      const auditRecords = validEvents.map(event => ({
        timestamp: event.timestamp || new Date(),
        userId: event.userId,
        userEmail: event.userEmail,
        sessionId: event.sessionId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        eventType: event.eventType,
        severity: event.severity,
        resource: event.resource,
        action: event.action,
        details: event.details || {},
        metadata: event.metadata || {},
        success: event.success,
        errorMessage: event.errorMessage,
        requestId: event.requestId,
        correlationId: event.metadata?.correlationId as string | undefined,
      }))

      await prisma.auditLog.createMany({
        data: auditRecords,
        skipDuplicates: true,
      })
    } catch (error) {
      // Silently fail - audit logging should never break the app
      logger.debug('Failed to persist audit events (non-critical)', {
        eventCount: events.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Set up periodic buffer flushing
  private setupPeriodicFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushBuffer().catch(error => {
        logger.error('Periodic audit flush failed', {
          error: error instanceof Error ? error : new Error(String(error)),
        })
      })
    }, 30000) // Flush every 30 seconds
  }

  // Remove specific event from buffer
  private removeFromBuffer(eventToRemove: AuditEvent): void {
    this.buffer = this.buffer.filter(event => event.requestId !== eventToRemove.requestId)
  }

  // Generate unique request ID
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  // Get audit statistics
  public async getAuditStats(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<{
    totalEvents: number
    eventsByType: Record<string, number>
    eventsBySeverity: Record<string, number>
    securityEvents: number
    errorRate: number
  }> {
    const now = new Date()
    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }

    const since = new Date(now.getTime() - timeRangeMs[timeRange])

    try {
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          createdAt: { gte: since }
        },
        select: {
          eventType: true,
          severity: true,
          success: true,
        }
      })

      const eventsByType: Record<string, number> = {}
      const eventsBySeverity: Record<string, number> = {}
      let securityEvents = 0
      let errorEvents = 0

      auditLogs.forEach(event => {
        eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1
        eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1

        if (event.eventType.includes('security') || event.eventType.includes('unauthorized')) {
          securityEvents++
        }

        if (!event.success) {
          errorEvents++
        }
      })

      return {
        totalEvents: auditLogs.length,
        eventsByType,
        eventsBySeverity,
        securityEvents,
        errorRate: auditLogs.length > 0 ? (errorEvents / auditLogs.length) * 100 : 0,
      }
    } catch (error) {
      logger.error('Failed to get audit stats', { error: error instanceof Error ? error.message : String(error) })
      return {
        totalEvents: 0,
        eventsByType: {},
        eventsBySeverity: {},
        securityEvents: 0,
        errorRate: 0,
      }
    }
  }

  // Cleanup old audit logs
  public async cleanupOldLogs(olderThan: Date): Promise<number> {
    try {
      const result = await prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: olderThan }
        }
      })

      logger.info('Audit logs cleanup completed', {
        deletedCount: result.count,
        olderThan: olderThan.toISOString()
      })

      return result.count
    } catch (error) {
      logger.error('Failed to cleanup audit logs', { error: error instanceof Error ? error.message : String(error) })
      return 0
    }
  }

  // Graceful shutdown
  public async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    await this.flushBuffer()
    logger.info('Audit logger shutdown complete')
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance()

// Convenience functions for common audit events
export const audit = {
  userAction: (userId: string, action: string, resource: string, details?: any, request?: any) =>
    auditLogger.logUserAction(userId, action, resource, details, request),

  securityEvent: (eventType: AuditEventType, details: any, request?: any) =>
    auditLogger.logSecurityEvent(eventType, details, request),

  systemEvent: (eventType: AuditEventType, details: any, severity?: AuditSeverity) =>
    auditLogger.logSystemEvent(eventType, details, severity),

  syncEvent: (userId: string, eventType: AuditEventType, details: any, success?: boolean, error?: string) =>
    auditLogger.logSyncEvent(userId, eventType, details, success, error),

  apiError: (endpoint: string, error: Error, userId?: string, request?: any) =>
    auditLogger.logAPIError(endpoint, error, userId, request),
}
