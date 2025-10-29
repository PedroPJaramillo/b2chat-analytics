import { healthMonitor } from './health-monitor'
import { auditLogger, audit, AuditEventType, AuditSeverity } from './audit'
import { ActivityTracker, SessionTracker } from './activity-tracker'
import { alerting, AlertSeverity } from './monitoring/alerts'
import { logger } from './logger'
import { invalidateRelatedCache } from './cache'

// Monitoring integration class
export class MonitoringIntegration {
  private static instance: MonitoringIntegration
  private monitoringInterval: NodeJS.Timeout | null = null
  private alertCheckInterval: NodeJS.Timeout | null = null
  private isRunning = false

  // Alert thresholds
  private thresholds = {
    memoryUsage: 80, // 80%
    errorRate: 5, // 5%
    responseTime: 5000, // 5 seconds
    failedHealthChecks: 2, // 2 or more critical failures
    activeAlerts: 10, // Maximum active alerts
    sessionDuration: 8 * 60 * 60 * 1000, // 8 hours
    suspiciousActivityThreshold: 50, // 50 activities per minute
  }

  private constructor() {
    this.setupEventListeners()
  }

  public static getInstance(): MonitoringIntegration {
    if (!MonitoringIntegration.instance) {
      MonitoringIntegration.instance = new MonitoringIntegration()
    }
    return MonitoringIntegration.instance
  }

  // Start comprehensive monitoring
  public start(options: {
    healthCheckInterval?: number
    alertCheckInterval?: number
    enableAutoRemediation?: boolean
  } = {}): void {
    if (this.isRunning) {
      logger.warn('Monitoring integration already running')
      return
    }

    const {
      healthCheckInterval = 60000, // 1 minute
      alertCheckInterval = 30000, // 30 seconds
      enableAutoRemediation = false,
    } = options

    // Start health monitoring
    healthMonitor.startMonitoring(healthCheckInterval)

    // Start periodic checks
    this.monitoringInterval = setInterval(() => {
      this.runPeriodicChecks().catch(error => {
        logger.error('Periodic monitoring check failed', {
          error: error instanceof Error ? error : new Error(String(error)),
        })
      })
    }, healthCheckInterval)

    // Start alert checks
    this.alertCheckInterval = setInterval(() => {
      this.checkForAlerts().catch(error => {
        logger.error('Alert check failed', {
          error: error instanceof Error ? error : new Error(String(error)),
        })
      })
    }, alertCheckInterval)

    this.isRunning = true

    logger.info('Monitoring integration started', {
      healthCheckInterval,
      alertCheckInterval,
      enableAutoRemediation,
    })

    // Log system startup event
    audit.systemEvent(
      AuditEventType.SYSTEM_STARTUP,
      {
        component: 'monitoring_integration',
        configuration: options,
      },
      AuditSeverity.LOW
    )
  }

  // Stop monitoring
  public stop(): void {
    if (!this.isRunning) {
      return
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval)
      this.alertCheckInterval = null
    }

    healthMonitor.stopMonitoring()
    this.isRunning = false

    logger.info('Monitoring integration stopped')

    // Log system shutdown event
    audit.systemEvent(
      AuditEventType.SYSTEM_SHUTDOWN,
      { component: 'monitoring_integration' },
      AuditSeverity.LOW
    )
  }

  // Run periodic checks
  private async runPeriodicChecks(): Promise<void> {
    try {
      // Check system health
      const healthResult = await healthMonitor.runHealthChecks()

      // Check for critical health failures
      const criticalFailures = healthResult.checks.filter(
        check => check.critical && check.status === 'unhealthy'
      )

      if (criticalFailures.length >= this.thresholds.failedHealthChecks) {
        alerting.systemDown(
          criticalFailures.map(f => f.name).join(', '),
          { failures: criticalFailures }
        )
      }

      // Check memory usage
      const metrics = healthMonitor.getLastMetrics()
      if (metrics && metrics.memoryUsage.percentage > this.thresholds.memoryUsage) {
        alerting.highMemoryUsage(metrics.memoryUsage.percentage, this.thresholds.memoryUsage)
      }

      // Check for suspicious user activity
      await this.checkSuspiciousActivity()

      // Check long-running sessions
      this.checkLongRunningSessions()

      // Cleanup old data
      await this.performMaintenanceTasks()

    } catch (error) {
      logger.error('Periodic check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Check for alerts that need to be created
  private async checkForAlerts(): Promise<void> {
    try {
      // Check audit log for security events
      const auditStats = await auditLogger.getAuditStats('1h')

      if (auditStats.securityEvents > 5) {
        alerting.custom(
          'Suspicious Activity',
          `High number of security events: ${auditStats.securityEvents}`,
          AlertSeverity.HIGH,
          'security_monitor',
          { securityEvents: auditStats.securityEvents }
        )
      }

      if (auditStats.errorRate > this.thresholds.errorRate) {
        alerting.custom(
          'High Error Rate',
          `System error rate is ${auditStats.errorRate}%`,
          AlertSeverity.HIGH,
          'system_monitor',
          { errorRate: auditStats.errorRate }
        )
      }

    } catch (error) {
      logger.error('Alert check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Check for suspicious user activity
  private async checkSuspiciousActivity(): Promise<void> {
    const activeSessions = SessionTracker.getActiveSessions()

    for (const session of activeSessions) {
      // Check for extremely high activity count
      const activityRate = session.activityCount / (session.duration / 60000) // per minute

      if (activityRate > this.thresholds.suspiciousActivityThreshold) {
        alerting.custom(
          'Suspicious Activity',
          `User ${session.userId} showing unusually high activity rate`,
          AlertSeverity.HIGH,
          'activity_monitor',
          {
            userId: session.userId,
            activityRate: Math.round(activityRate),
            sessionDuration: Math.round(session.duration / 1000),
            activityCount: session.activityCount,
          }
        )

        // Log suspicious activity
        await audit.securityEvent(
          AuditEventType.SUSPICIOUS_ACTIVITY,
          {
            userId: session.userId,
            activityRate: Math.round(activityRate),
            threshold: this.thresholds.suspiciousActivityThreshold,
          }
        )
      }
    }
  }

  // Check for long-running sessions
  private checkLongRunningSessions(): void {
    const activeSessions = SessionTracker.getActiveSessions()

    for (const session of activeSessions) {
      if (session.duration > this.thresholds.sessionDuration) {
        logger.warn('Long-running session detected', {
          userId: session.userId,
          sessionId: session.sessionId,
          duration: Math.round(session.duration / 1000 / 60), // minutes
        })

        // Optionally create an alert for very long sessions
        if (session.duration > this.thresholds.sessionDuration * 1.5) {
          alerting.custom(
            'Long Session Alert',
            `User ${session.userId} has extremely long session duration`,
            AlertSeverity.MEDIUM,
            'session_monitor',
            {
              userId: session.userId,
              sessionDuration: Math.round(session.duration / 1000 / 60),
              threshold: Math.round(this.thresholds.sessionDuration / 1000 / 60),
            }
          )
        }
      }
    }
  }

  // Perform maintenance tasks
  private async performMaintenanceTasks(): Promise<void> {
    try {
      // Clean up old audit logs (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const cleanedAuditLogs = await auditLogger.cleanupOldLogs(thirtyDaysAgo)

      if (cleanedAuditLogs > 0) {
        logger.info('Maintenance: Cleaned up old audit logs', { count: cleanedAuditLogs })
      }

      // Clean up inactive sessions
      const cleanedSessions = SessionTracker.cleanupInactiveSessions()

      if (cleanedSessions > 0) {
        logger.info('Maintenance: Cleaned up inactive sessions', { count: cleanedSessions })
      }

      // Auto-resolve old alerts (from alerts route)
      // This would need to be imported from the alerts module

    } catch (error) {
      logger.error('Maintenance tasks failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Setup event listeners for real-time monitoring
  private setupEventListeners(): void {
    // Listen for process events
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack })

      alerting.systemDown('application', {
        error: error.message,
        type: 'uncaught_exception'
      })

      audit.systemEvent(
        AuditEventType.API_ERROR,
        {
          error: error.message,
          type: 'uncaught_exception',
          stack: error.stack,
        },
        AuditSeverity.CRITICAL
      )
    })

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', { reason, promise })

      alerting.systemDown('application', {
        error: String(reason),
        type: 'unhandled_rejection'
      })

      audit.systemEvent(
        AuditEventType.API_ERROR,
        {
          error: String(reason),
          type: 'unhandled_rejection',
        },
        AuditSeverity.HIGH
      )
    })

    // Listen for memory warnings
    process.on('warning', (warning) => {
      logger.warn('Process warning', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
      })

      if (warning.name === 'MaxListenersExceededWarning' ||
          warning.name === 'DeprecationWarning') {
        alerting.systemDown('application', {
          warning: warning.name,
          message: warning.message,
        })
      }
    })
  }

  // Manual alert trigger methods
  public triggerAlert = {
    // Database alerts
    databaseError: (error: Error) => {
      alerting.databaseConnection(error.message)
      audit.systemEvent(
        AuditEventType.DATABASE_CONNECTION_FAILED,
        { error: error.message },
        AuditSeverity.CRITICAL
      )
    },

    // API alerts
    apiError: (endpoint: string, error: Error, userId?: string) => {
      alerting.custom(
        'API Error',
        `High error rate on endpoint ${endpoint}`,
        AlertSeverity.HIGH,
        'api_monitor',
        { endpoint }
      )
      audit.apiError(endpoint, error, userId)
    },

    // Security alerts
    securityBreach: (details: Record<string, any>) => {
      alerting.custom(
        'Security Breach Alert',
        'Potential security breach detected',
        AlertSeverity.CRITICAL,
        'security_monitor',
        details
      )
      audit.securityEvent(AuditEventType.SUSPICIOUS_ACTIVITY, details)
    },

    // Sync alerts
    syncFailure: (entityType: string, error: string, userId: string) => {
      alerting.syncFailure(entityType, error)
      audit.syncEvent(userId, AuditEventType.SYNC_FAILED, { entityType, error }, false, error)
    },

    // External service alerts
    externalServiceDown: (service: string, error: string) => {
      if (service === 'b2chat') {
        alerting.systemDown('b2chat-api', { error })
      } else {
        alerting.systemDown(service, { error, service })
      }
    },
  }

  // Configuration methods
  public updateThresholds(newThresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds }

    logger.info('Monitoring thresholds updated', {
      oldThresholds: this.thresholds,
      newThresholds,
    })

    audit.systemEvent(
      AuditEventType.SYSTEM_CONFIG_CHANGED,
      {
        component: 'monitoring_thresholds',
        changes: newThresholds,
      }
    )
  }

  public getStatus(this: MonitoringIntegration): {
    isRunning: boolean
    uptime: number
    thresholds: MonitoringIntegration['thresholds']
    healthStatus: any
    lastMetrics: any
    activeSessions: number
  } {
    return {
      isRunning: this.isRunning,
      uptime: process.uptime(),
      thresholds: this.thresholds,
      healthStatus: healthMonitor.getMonitoringStatus(),
      lastMetrics: healthMonitor.getLastMetrics(),
      activeSessions: SessionTracker.getActiveSessions().length,
    }
  }
}

// Export singleton instance
export const monitoring = MonitoringIntegration.getInstance()

// Initialize monitoring on module load in production
if (process.env.NODE_ENV === 'production') {
  monitoring.start({
    healthCheckInterval: 60000, // 1 minute
    alertCheckInterval: 30000, // 30 seconds
    enableAutoRemediation: true,
  })
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down monitoring')
  monitoring.stop()
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down monitoring')
  monitoring.stop()
})
