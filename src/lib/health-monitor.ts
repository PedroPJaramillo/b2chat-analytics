import { prisma } from './prisma'
import { logger } from './logger'
import { audit, AuditEventType, AuditSeverity } from './audit'
import { B2ChatClient } from './b2chat/client'
import { getCacheStats } from './cache'

// Health check status
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

// Health check result interface
export interface HealthCheckResult {
  name: string
  status: HealthStatus
  message?: string
  details?: Record<string, any>
  duration?: number
  timestamp: Date
  critical?: boolean
}

// System metrics interface
export interface SystemMetrics {
  timestamp: Date
  uptime: number
  memoryUsage: {
    used: number
    total: number
    percentage: number
  }
  cpuUsage?: number
  activeConnections: number
  errorRate: number
  responseTime: {
    avg: number
    p95: number
    p99: number
  }
}

// Health monitor class
export class HealthMonitor {
  private static instance: HealthMonitor
  private healthChecks: Map<string, () => Promise<HealthCheckResult>> = new Map()
  private lastMetrics: SystemMetrics | null = null
  private metricsHistory: SystemMetrics[] = []
  private checkInterval: NodeJS.Timeout | null = null
  private alertThresholds = {
    errorRate: 5, // 5%
    responseTime: 5000, // 5 seconds
    memoryUsage: 80, // 80%
    dbConnections: 50, // 50 active connections
    cacheHitRate: 70, // 70% minimum
  }

  private constructor() {
    this.registerDefaultHealthChecks()
  }

  public static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor()
    }
    return HealthMonitor.instance
  }

  // Register default health checks
  private registerDefaultHealthChecks(): void {
    this.registerHealthCheck('database', this.checkDatabase.bind(this))
    this.registerHealthCheck('b2chat_api', this.checkB2ChatAPI.bind(this))
    this.registerHealthCheck('cache', this.checkCache.bind(this))
    this.registerHealthCheck('memory', this.checkMemory.bind(this))
    this.registerHealthCheck('disk_space', this.checkDiskSpace.bind(this))
    this.registerHealthCheck('external_services', this.checkExternalServices.bind(this))
  }

  // Register a health check
  public registerHealthCheck(
    name: string,
    checkFunction: () => Promise<HealthCheckResult>
  ): void {
    this.healthChecks.set(name, checkFunction)
    logger.debug('Health check registered', { name })
  }

  // Run all health checks
  public async runHealthChecks(): Promise<{
    status: HealthStatus
    checks: HealthCheckResult[]
    summary: {
      total: number
      healthy: number
      degraded: number
      unhealthy: number
      critical_failures: number
    }
  }> {
    const startTime = Date.now()
    const results: HealthCheckResult[] = []

    // Run all health checks in parallel
    const checkPromises = Array.from(this.healthChecks.entries()).map(
      async ([name, checkFn]) => {
        try {
          const checkStart = Date.now()
          const result = await checkFn()
          result.duration = Date.now() - checkStart
          return result
        } catch (error) {
          return {
            name,
            status: HealthStatus.UNHEALTHY,
            message: error instanceof Error ? error.message : 'Check failed',
            duration: Date.now() - checkStart,
            timestamp: new Date(),
            critical: true,
          } as HealthCheckResult
        }
      }
    )

    const checkResults = await Promise.all(checkPromises)
    results.push(...checkResults)

    // Calculate overall status
    const summary = {
      total: results.length,
      healthy: results.filter(r => r.status === HealthStatus.HEALTHY).length,
      degraded: results.filter(r => r.status === HealthStatus.DEGRADED).length,
      unhealthy: results.filter(r => r.status === HealthStatus.UNHEALTHY).length,
      critical_failures: results.filter(r => r.critical && r.status === HealthStatus.UNHEALTHY).length,
    }

    let overallStatus = HealthStatus.HEALTHY
    if (summary.critical_failures > 0) {
      overallStatus = HealthStatus.UNHEALTHY
    } else if (summary.unhealthy > 0 || summary.degraded > 0) {
      overallStatus = HealthStatus.DEGRADED
    }

    const totalDuration = Date.now() - startTime

    logger.info('Health checks completed', {
      overallStatus,
      duration: totalDuration,
      summary,
    })

    // Alert on critical failures
    if (summary.critical_failures > 0) {
      const criticalFailures = results.filter(r => r.critical && r.status === HealthStatus.UNHEALTHY)
      await audit.systemEvent(
        AuditEventType.SYSTEM_STARTUP, // Using as generic system event
        {
          event: 'critical_health_check_failure',
          failures: criticalFailures.map(f => ({ name: f.name, message: f.message })),
        },
        AuditSeverity.CRITICAL
      )
    }

    return {
      status: overallStatus,
      checks: results,
      summary,
    }
  }

  // Database health check
  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    try {
      // Test basic connectivity
      await prisma.$queryRaw`SELECT 1`

      // Check active connections
      const connectionInfo = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'
      `

      const activeConnections = Number(connectionInfo[0]?.count || 0)
      const duration = Date.now() - startTime

      let status = HealthStatus.HEALTHY
      let message = 'Database connection healthy'

      if (activeConnections > this.alertThresholds.dbConnections) {
        status = HealthStatus.DEGRADED
        message = `High number of active connections: ${activeConnections}`
      }

      if (duration > 1000) { // 1 second
        status = HealthStatus.DEGRADED
        message = `Slow database response: ${duration}ms`
      }

      return {
        name: 'database',
        status,
        message,
        details: {
          activeConnections,
          responseTime: duration,
        },
        timestamp: new Date(),
        critical: true,
      }
    } catch (error) {
      return {
        name: 'database',
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Database connection failed',
        timestamp: new Date(),
        critical: true,
      }
    }
  }

  // B2Chat API health check
  private async checkB2ChatAPI(): Promise<HealthCheckResult> {
    try {
      const client = new B2ChatClient()
      const startTime = Date.now()

      // Test with a minimal request
      await client.getTotalCounts()
      const duration = Date.now() - startTime

      let status = HealthStatus.HEALTHY
      let message = 'B2Chat API connection healthy'

      if (duration > 5000) { // 5 seconds
        status = HealthStatus.DEGRADED
        message = `Slow B2Chat API response: ${duration}ms`
      }

      return {
        name: 'b2chat_api',
        status,
        message,
        details: {
          responseTime: duration,
          endpoint: 'getTotalCounts',
        },
        timestamp: new Date(),
        critical: false,
      }
    } catch (error) {
      return {
        name: 'b2chat_api',
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'B2Chat API connection failed',
        timestamp: new Date(),
        critical: false,
      }
    }
  }

  // Cache health check
  private async checkCache(): Promise<HealthCheckResult> {
    try {
      const cacheStats = getCacheStats()

      // Calculate overall cache metrics
      let totalSize = 0
      let totalMax = 0

      if (Array.isArray(cacheStats)) {
        totalSize = cacheStats.reduce((sum, cache) => sum + cache.size, 0)
        totalMax = cacheStats.reduce((sum, cache) => sum + cache.max, 0)
      }

      const utilizationRate = totalMax > 0 ? (totalSize / totalMax) * 100 : 0

      let status = HealthStatus.HEALTHY
      let message = 'Cache system healthy'

      if (utilizationRate > 90) {
        status = HealthStatus.DEGRADED
        message = `High cache utilization: ${utilizationRate.toFixed(1)}%`
      }

      return {
        name: 'cache',
        status,
        message,
        details: {
          utilizationRate: Math.round(utilizationRate),
          totalSize,
          totalMax,
          caches: cacheStats,
        },
        timestamp: new Date(),
        critical: false,
      }
    } catch (error) {
      return {
        name: 'cache',
        status: HealthStatus.DEGRADED,
        message: error instanceof Error ? error.message : 'Cache check failed',
        timestamp: new Date(),
        critical: false,
      }
    }
  }

  // Memory health check
  private async checkMemory(): Promise<HealthCheckResult> {
    try {
      const memoryUsage = process.memoryUsage()
      const totalMemory = memoryUsage.heapTotal + memoryUsage.external
      const usedMemory = memoryUsage.heapUsed
      const percentage = (usedMemory / totalMemory) * 100

      let status = HealthStatus.HEALTHY
      let message = 'Memory usage normal'

      if (percentage > this.alertThresholds.memoryUsage) {
        status = percentage > 95 ? HealthStatus.UNHEALTHY : HealthStatus.DEGRADED
        message = `High memory usage: ${percentage.toFixed(1)}%`
      }

      return {
        name: 'memory',
        status,
        message,
        details: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          external: Math.round(memoryUsage.external / 1024 / 1024), // MB
          percentage: Math.round(percentage),
        },
        timestamp: new Date(),
        critical: percentage > 95,
      }
    } catch (error) {
      return {
        name: 'memory',
        status: HealthStatus.UNKNOWN,
        message: 'Could not check memory usage',
        timestamp: new Date(),
        critical: false,
      }
    }
  }

  // Disk space health check (basic version)
  private async checkDiskSpace(): Promise<HealthCheckResult> {
    // Note: This is a simplified check. In production, you'd want to check actual disk usage
    try {
      return {
        name: 'disk_space',
        status: HealthStatus.HEALTHY,
        message: 'Disk space check not implemented',
        details: {
          note: 'Implement actual disk space checking for production',
        },
        timestamp: new Date(),
        critical: false,
      }
    } catch (error) {
      return {
        name: 'disk_space',
        status: HealthStatus.UNKNOWN,
        message: 'Disk space check failed',
        timestamp: new Date(),
        critical: false,
      }
    }
  }

  // External services health check
  private async checkExternalServices(): Promise<HealthCheckResult> {
    try {
      // Check Clerk service (simplified)
      const clerkHealthy = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? true : false

      let status = HealthStatus.HEALTHY
      let message = 'External services healthy'
      const services = {
        clerk: clerkHealthy ? 'healthy' : 'not configured',
      }

      if (!clerkHealthy) {
        status = HealthStatus.DEGRADED
        message = 'Some external services not properly configured'
      }

      return {
        name: 'external_services',
        status,
        message,
        details: { services },
        timestamp: new Date(),
        critical: false,
      }
    } catch (error) {
      return {
        name: 'external_services',
        status: HealthStatus.DEGRADED,
        message: 'Could not check external services',
        timestamp: new Date(),
        critical: false,
      }
    }
  }

  // Collect system metrics
  public async collectMetrics(): Promise<SystemMetrics> {
    const timestamp = new Date()
    const memoryUsage = process.memoryUsage()
    const totalMemory = memoryUsage.heapTotal + memoryUsage.external
    const usedMemory = memoryUsage.heapUsed

    // Get basic metrics (would be enhanced with real monitoring in production)
    const metrics: SystemMetrics = {
      timestamp,
      uptime: process.uptime(),
      memoryUsage: {
        used: Math.round(usedMemory / 1024 / 1024), // MB
        total: Math.round(totalMemory / 1024 / 1024), // MB
        percentage: Math.round((usedMemory / totalMemory) * 100),
      },
      activeConnections: 0, // Would be populated by actual connection monitoring
      errorRate: 0, // Would be calculated from error logs
      responseTime: {
        avg: 0,
        p95: 0,
        p99: 0,
      },
    }

    this.lastMetrics = metrics
    this.metricsHistory.push(metrics)

    // Keep only last 24 hours of metrics (assuming collected every minute)
    if (this.metricsHistory.length > 24 * 60) {
      this.metricsHistory = this.metricsHistory.slice(-24 * 60)
    }

    return metrics
  }

  // Get current metrics
  public getLastMetrics(): SystemMetrics | null {
    return this.lastMetrics
  }

  // Get metrics history
  public getMetricsHistory(duration: '1h' | '6h' | '24h' = '24h'): SystemMetrics[] {
    const now = Date.now()
    const durationMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    }

    const cutoff = now - durationMs[duration]
    return this.metricsHistory.filter(m => m.timestamp.getTime() > cutoff)
  }

  // Start periodic monitoring
  public startMonitoring(interval: number = 60000): void { // Default 1 minute
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    this.checkInterval = setInterval(async () => {
      try {
        // Collect metrics
        await this.collectMetrics()

        // Run health checks (less frequently)
        if (Date.now() % (5 * 60 * 1000) < interval) { // Every 5 minutes
          await this.runHealthChecks()
        }
      } catch (error) {
        logger.error('Health monitoring error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }, interval)

    logger.info('Health monitoring started', { interval })
  }

  // Stop monitoring
  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    logger.info('Health monitoring stopped')
  }

  // Get monitoring status
  public getMonitoringStatus(): {
    isRunning: boolean
    lastCheck?: Date
    metricsCount: number
    registeredChecks: string[]
  } {
    return {
      isRunning: this.checkInterval !== null,
      lastCheck: this.lastMetrics?.timestamp,
      metricsCount: this.metricsHistory.length,
      registeredChecks: Array.from(this.healthChecks.keys()),
    }
  }
}

// Export singleton instance
export const healthMonitor = HealthMonitor.getInstance()

// Convenience functions
export const health = {
  check: () => healthMonitor.runHealthChecks(),
  metrics: () => healthMonitor.getLastMetrics(),
  history: (duration?: '1h' | '6h' | '24h') => healthMonitor.getMetricsHistory(duration),
  status: () => healthMonitor.getMonitoringStatus(),
  start: (interval?: number) => healthMonitor.startMonitoring(interval),
  stop: () => healthMonitor.stopMonitoring(),
}