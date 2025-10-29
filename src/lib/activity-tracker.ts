import { NextRequest } from 'next/server'
import { prisma } from './prisma'
import { logger } from './logger'
import { audit, AuditEventType } from './audit'

// Activity tracking interface
export interface UserActivity {
  userId: string
  sessionId?: string
  action: string
  resource: string
  details?: Record<string, any>
  metadata?: {
    userAgent?: string
    ipAddress?: string
    referer?: string
    timestamp?: Date
    duration?: number
    success?: boolean
    errorMessage?: string
  }
}

// Session management
export class SessionTracker {
  private static activeSessions: Map<string, {
    userId: string
    startTime: Date
    lastActivity: Date
    ipAddress?: string
    userAgent?: string
    activityCount: number
  }> = new Map()

  // Start a new session
  public static startSession(
    userId: string,
    sessionId: string,
    request?: NextRequest
  ): void {
    const now = new Date()

    this.activeSessions.set(sessionId, {
      userId,
      startTime: now,
      lastActivity: now,
      ipAddress: this.extractIP(request),
      userAgent: request?.headers.get('user-agent') || undefined,
      activityCount: 0,
    })

    logger.info('User session started', {
      userId,
      sessionId,
      timestamp: now,
    })

    // Audit the login
    audit.userAction(
      userId,
      'login',
      'authentication',
      {
        sessionId,
        loginMethod: 'clerk',
      },
      {
        ip: this.extractIP(request),
        userAgent: request?.headers.get('user-agent'),
      }
    )
  }

  // Update session activity
  public static updateActivity(sessionId: string, action?: string): void {
    const session = this.activeSessions.get(sessionId)
    if (session) {
      session.lastActivity = new Date()
      session.activityCount++

      if (action) {
        logger.debug('User activity', {
          userId: session.userId,
          sessionId,
          action,
          activityCount: session.activityCount,
        })
      }
    }
  }

  // End a session
  public static endSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId)
    if (session) {
      const duration = new Date().getTime() - session.startTime.getTime()

      logger.info('User session ended', {
        userId: session.userId,
        sessionId,
        duration: Math.round(duration / 1000), // seconds
        activityCount: session.activityCount,
      })

      // Audit the logout
      audit.userAction(
        session.userId,
        'logout',
        'authentication',
        {
          sessionId,
          sessionDuration: Math.round(duration / 1000),
          activityCount: session.activityCount,
        }
      )

      this.activeSessions.delete(sessionId)
    }
  }

  // Get session info
  public static getSession(sessionId: string) {
    return this.activeSessions.get(sessionId)
  }

  // Get all active sessions
  public static getActiveSessions(): Array<{
    sessionId: string
    userId: string
    startTime: Date
    lastActivity: Date
    duration: number
    activityCount: number
  }> {
    const now = new Date()
    return Array.from(this.activeSessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      userId: session.userId,
      startTime: session.startTime,
      lastActivity: session.lastActivity,
      duration: now.getTime() - session.startTime.getTime(),
      activityCount: session.activityCount,
    }))
  }

  // Clean up inactive sessions
  public static cleanupInactiveSessions(maxIdleTime: number = 30 * 60 * 1000): number {
    const now = new Date()
    let cleaned = 0

    for (const [sessionId, session] of this.activeSessions.entries()) {
      const idleTime = now.getTime() - session.lastActivity.getTime()
      if (idleTime > maxIdleTime) {
        this.endSession(sessionId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up inactive sessions', { count: cleaned })
    }

    return cleaned
  }

  public static extractIP(request?: NextRequest): string | undefined {
    if (!request) return undefined

    return (
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      undefined
    )
  }
}

// Activity tracker class
export class ActivityTracker {
  // Track user activity
  public static async trackActivity(
    activity: UserActivity,
    request?: NextRequest
  ): Promise<void> {
    const timestamp = new Date()

    // Enhance metadata
    const enhancedMetadata = {
      ...activity.metadata,
      userAgent: activity.metadata?.userAgent || request?.headers.get('user-agent'),
      ipAddress: activity.metadata?.ipAddress || SessionTracker.extractIP(request),
      referer: activity.metadata?.referer || request?.headers.get('referer'),
      timestamp,
    }

    // Log the activity
    logger.info('User Activity', {
      userId: activity.userId,
      sessionId: activity.sessionId,
      action: activity.action,
      resource: activity.resource,
      details: activity.details,
      metadata: enhancedMetadata,
    })

    // Update session activity
    if (activity.sessionId) {
      SessionTracker.updateActivity(activity.sessionId, activity.action)
    }

    // Audit significant activities
    if (this.isSignificantActivity(activity.action)) {
      await audit.userAction(
        activity.userId,
        activity.action,
        activity.resource,
        activity.details,
        {
          ip: enhancedMetadata.ipAddress,
          userAgent: enhancedMetadata.userAgent,
        }
      )
    }

    // Store activity in database for analytics (optional)
    if (this.shouldPersistActivity(activity.action)) {
      await this.persistActivity(activity, enhancedMetadata)
    }
  }

  // Track API endpoint access
  public static async trackAPIAccess(
    userId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    request?: NextRequest,
    error?: Error
  ): Promise<void> {
    const activity: UserActivity = {
      userId,
      action: 'api_access',
      resource: endpoint,
      details: {
        method,
        statusCode,
        duration,
        success: statusCode < 400,
        errorMessage: error?.message,
      },
      metadata: {
        timestamp: new Date(),
        duration,
        success: statusCode < 400,
        errorMessage: error?.message,
      }
    }

    await this.trackActivity(activity, request)

    // Log slow requests
    if (duration > 5000) { // 5 seconds
      await audit.systemEvent(
        AuditEventType.API_SLOW_RESPONSE,
        {
          endpoint,
          method,
          duration,
          userId,
        }
      )
    }

    // Log errors
    if (error) {
      await audit.apiError(endpoint, error, userId, {
        ip: SessionTracker.extractIP(request),
        userAgent: request?.headers.get('user-agent'),
      })
    }
  }

  // Track data access
  public static async trackDataAccess(
    userId: string,
    dataType: string,
    operation: 'read' | 'write' | 'delete' | 'export',
    recordCount?: number,
    filters?: Record<string, any>,
    request?: NextRequest
  ): Promise<void> {
    const activity: UserActivity = {
      userId,
      action: `data_${operation}`,
      resource: dataType,
      details: {
        operation,
        recordCount,
        filters,
        timestamp: new Date(),
      }
    }

    await this.trackActivity(activity, request)

    // Audit data exports
    if (operation === 'export') {
      await audit.userAction(
        userId,
        'export',
        dataType,
        { recordCount, filters },
        {
          ip: SessionTracker.extractIP(request),
          userAgent: request?.headers.get('user-agent'),
        }
      )
    }
  }

  // Track sync operations
  public static async trackSyncOperation(
    userId: string,
    operation: 'start' | 'complete' | 'fail',
    syncType: string,
    details: Record<string, any>
  ): Promise<void> {
    const activity: UserActivity = {
      userId,
      action: `sync_${operation}`,
      resource: 'sync_engine',
      details: {
        syncType,
        ...details,
        timestamp: new Date(),
      }
    }

    await this.trackActivity(activity)

    // Audit sync operations
    const eventType = operation === 'start'
      ? AuditEventType.SYNC_STARTED
      : operation === 'complete'
      ? AuditEventType.SYNC_COMPLETED
      : AuditEventType.SYNC_FAILED

    await audit.syncEvent(
      userId,
      eventType,
      { syncType, ...details },
      operation !== 'fail',
      operation === 'fail' ? details.error : undefined
    )
  }

  // Get user activity statistics
  public static async getUserActivityStats(
    userId: string,
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<{
    totalActivities: number
    activitiesByType: Record<string, number>
    mostAccessedResources: Array<{ resource: string; count: number }>
    averageSessionDuration: number
    lastActivity?: Date
  }> {
    // This would typically query a dedicated activity table
    // For now, we'll return mock data structure
    return {
      totalActivities: 0,
      activitiesByType: {},
      mostAccessedResources: [],
      averageSessionDuration: 0,
      lastActivity: undefined,
    }
  }

  // Check if activity should be audited
  private static isSignificantActivity(action: string): boolean {
    const significantActions = [
      'login',
      'logout',
      'export',
      'sync_start',
      'sync_complete',
      'config_change',
      'data_delete',
      'role_change',
    ]

    return significantActions.some(sig => action.includes(sig))
  }

  // Check if activity should be persisted
  private static shouldPersistActivity(action: string): boolean {
    // Persist all activities for now, but this could be more selective
    return true
  }

  // Persist activity to database
  private static async persistActivity(
    activity: UserActivity,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      // Store in system settings as activity log
      // In production, you'd want a dedicated user_activities table
      await prisma.systemSetting.create({
        data: {
          key: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          value: JSON.stringify({
            ...activity,
            metadata,
          }),
          category: 'user_activity',
          description: `${activity.action} on ${activity.resource}`,
          userId: activity.userId,
        }
      })
    } catch (error) {
      logger.error('Failed to persist user activity', {
        userId: activity.userId,
        action: activity.action,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Middleware to automatically track requests
export function createActivityTracker(options: {
  trackAPI?: boolean
  trackDataAccess?: boolean
  excludePaths?: string[]
} = {}) {
  return async function trackActivity(
    userId: string,
    request: NextRequest,
    response: Response,
    duration: number,
    error?: Error
  ): Promise<void> {
    const pathname = new URL(request.url).pathname

    // Skip excluded paths
    if (options.excludePaths?.some(path => pathname.includes(path))) {
      return
    }

    // Track API access
    if (options.trackAPI && pathname.startsWith('/api/')) {
      await ActivityTracker.trackAPIAccess(
        userId,
        pathname,
        request.method,
        response.status,
        duration,
        request,
        error
      )
    }

    // Track data access
    if (options.trackDataAccess && isDataEndpoint(pathname)) {
      const { dataType, operation } = parseDataEndpoint(pathname, request.method)
      await ActivityTracker.trackDataAccess(
        userId,
        dataType,
        operation,
        undefined, // Record count would need to be extracted from response
        extractFilters(request),
        request
      )
    }
  }

  // Helper to identify data endpoints
  function isDataEndpoint(pathname: string): boolean {
    return pathname.includes('/api/chats') ||
           pathname.includes('/api/agents') ||
           pathname.includes('/api/analytics') ||
           pathname.includes('/api/dashboard')
  }

  // Helper to parse data endpoint info
  function parseDataEndpoint(pathname: string, method: string): {
    dataType: string
    operation: 'read' | 'write' | 'delete' | 'export'
  } {
    let dataType = 'unknown'
    if (pathname.includes('/chats')) dataType = 'chats'
    else if (pathname.includes('/agents')) dataType = 'agents'
    else if (pathname.includes('/analytics')) dataType = 'analytics'
    else if (pathname.includes('/dashboard')) dataType = 'dashboard'

    let operation: 'read' | 'write' | 'delete' | 'export' = 'read'
    if (method === 'POST') operation = 'write'
    else if (method === 'DELETE') operation = 'delete'
    else if (pathname.includes('export')) operation = 'export'

    return { dataType, operation }
  }

  // Helper to extract filters from request
  function extractFilters(request: NextRequest): Record<string, any> {
    const { searchParams } = new URL(request.url)
    return Object.fromEntries(searchParams.entries())
  }
}

// Setup periodic session cleanup
let cleanupInterval: NodeJS.Timeout | null = null

export function setupActivityTracking() {
  // Clean up inactive sessions every 5 minutes
  cleanupInterval = setInterval(() => {
    SessionTracker.cleanupInactiveSessions()
  }, 5 * 60 * 1000)

  logger.info('Activity tracking initialized')
}

export function shutdownActivityTracking() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
  }

  // End all active sessions
  const activeSessions = SessionTracker.getActiveSessions()
  activeSessions.forEach(session => {
    SessionTracker.endSession(session.sessionId)
  })

  logger.info('Activity tracking shutdown')
}