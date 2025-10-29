/**
 * Alert Management System - Types and utilities
 *
 * Defines alert severity levels, status, and core alert functionality
 * for the monitoring system.
 */

// Alert severity levels
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Alert status
export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

// Alert interface
export interface Alert {
  id: string
  title: string
  description: string
  severity: AlertSeverity
  status: AlertStatus
  source: string
  createdAt: Date
  acknowledgedAt?: Date
  resolvedAt?: Date
  acknowledgedBy?: string
  resolvedBy?: string
  metadata?: Record<string, any>
}

// In-memory storage for alerts (in production, this would be a database)
const alerts = new Map<string, Alert>()

// Alert creation function
export function createAlert(
  title: string,
  description: string,
  severity: AlertSeverity,
  source: string,
  metadata?: Record<string, any>
): string {
  const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const alert: Alert = {
    id: alertId,
    title,
    description,
    severity,
    status: AlertStatus.ACTIVE,
    source,
    createdAt: new Date(),
    metadata,
  }

  alerts.set(alertId, alert)
  return alertId
}

// Get all alerts
export function getAllAlerts(): Alert[] {
  return Array.from(alerts.values()).sort((a, b) =>
    b.createdAt.getTime() - a.createdAt.getTime()
  )
}

// Get alert by ID
export function getAlert(id: string): Alert | undefined {
  return alerts.get(id)
}

// Update alert
export function updateAlert(id: string, updates: Partial<Alert>): Alert | null {
  const alert = alerts.get(id)
  if (!alert) return null

  const updatedAlert = { ...alert, ...updates }
  alerts.set(id, updatedAlert)
  return updatedAlert
}

// Acknowledge alert
export function acknowledgeAlert(id: string, userId?: string): Alert | null {
  return updateAlert(id, {
    status: AlertStatus.ACKNOWLEDGED,
    acknowledgedAt: new Date(),
    acknowledgedBy: userId
  })
}

// Resolve alert
export function resolveAlert(id: string, userId?: string): Alert | null {
  return updateAlert(id, {
    status: AlertStatus.RESOLVED,
    resolvedAt: new Date(),
    resolvedBy: userId
  })
}

// Get alert summary
export function getAlertSummary(): {
  total: number
  active: number
  acknowledged: number
  resolved: number
  bySeverity: Record<AlertSeverity, number>
  bySource: Record<string, number>
} {
  const allAlerts = Array.from(alerts.values())

  const bySeverity: Record<AlertSeverity, number> = {
    [AlertSeverity.LOW]: 0,
    [AlertSeverity.MEDIUM]: 0,
    [AlertSeverity.HIGH]: 0,
    [AlertSeverity.CRITICAL]: 0,
  }

  const bySource: Record<string, number> = {}

  let active = 0
  let acknowledged = 0
  let resolved = 0

  allAlerts.forEach(alert => {
    // Count by status
    if (alert.status === AlertStatus.ACTIVE) active++
    else if (alert.status === AlertStatus.ACKNOWLEDGED) acknowledged++
    else if (alert.status === AlertStatus.RESOLVED) resolved++

    // Count by severity
    bySeverity[alert.severity]++

    // Count by source
    bySource[alert.source] = (bySource[alert.source] || 0) + 1
  })

  return {
    total: allAlerts.length,
    active,
    acknowledged,
    resolved,
    bySeverity,
    bySource,
  }
}

// Auto-resolve old alerts
export function resolveOldAlerts(maxAge: number = 7 * 24 * 60 * 60 * 1000): number { // 7 days
  const cutoff = new Date(Date.now() - maxAge)
  let resolvedCount = 0

  for (const [id, alert] of Array.from(alerts.entries())) {
    if (alert.status === AlertStatus.ACTIVE && alert.createdAt < cutoff) {
      resolveAlert(id, 'system_auto_resolve')
      resolvedCount++
    }
  }

  return resolvedCount
}

// Convenience functions for creating specific alerts
export const alerting = {
  // System alerts
  systemDown: (service: string, details?: any) =>
    createAlert(
      `System Service Down: ${service}`,
      `The ${service} service is not responding. Please investigate immediately.`,
      AlertSeverity.CRITICAL,
      'system_monitor',
      details
    ),

  highMemoryUsage: (usage: number, threshold: number) =>
    createAlert(
      'High Memory Usage Detected',
      `Memory usage is at ${usage}%, exceeding the threshold of ${threshold}%.`,
      usage > 90 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
      'resource_monitor',
      { usage, threshold }
    ),

  syncFailure: (syncType: string, error: string) =>
    createAlert(
      `Sync Failure: ${syncType}`,
      `The ${syncType} synchronization process has failed: ${error}`,
      AlertSeverity.HIGH,
      'sync_monitor',
      { syncType, error }
    ),

  slowResponse: (endpoint: string, responseTime: number, threshold: number) =>
    createAlert(
      'Slow API Response Detected',
      `API endpoint ${endpoint} responded in ${responseTime}ms, exceeding threshold of ${threshold}ms.`,
      responseTime > threshold * 2 ? AlertSeverity.MEDIUM : AlertSeverity.LOW,
      'performance_monitor',
      { endpoint, responseTime, threshold }
    ),

  databaseConnection: (error: string) =>
    createAlert(
      'Database Connection Issues',
      `Database connection problems detected: ${error}`,
      AlertSeverity.CRITICAL,
      'database_monitor',
      { error }
    ),

  // Custom alert
  custom: (title: string, description: string, severity: AlertSeverity, source: string, metadata?: any) =>
    createAlert(title, description, severity, source, metadata)
}