import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { healthMonitor } from '@/lib/health-monitor'
import { logger } from '@/lib/logger'
import { dashboardRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  let userId: string | null = null;

  try {
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Apply rate limiting
    const rateLimitResponse = await dashboardRateLimit(request, userId)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Check if user has admin access (you'd implement proper role checking)
    // For now, all authenticated users can view health status

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const includeDetails = searchParams.get('details') === 'true'
    const format = searchParams.get('format') || 'json'

    // Run health checks
    const healthResult = await healthMonitor.runHealthChecks()
    const currentMetrics = healthMonitor.getLastMetrics()

    // Prepare response
    const response = {
      timestamp: new Date().toISOString(),
      status: healthResult.status,
      summary: healthResult.summary,
      systemMetrics: currentMetrics,
      ...(includeDetails && { checks: healthResult.checks }),
    }

    // Support different response formats
    if (format === 'prometheus') {
      // Return Prometheus-compatible metrics format
      const prometheusMetrics = formatPrometheusMetrics(healthResult, currentMetrics)
      return new Response(prometheusMetrics, {
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Health check API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: userId ?? undefined,
    })

    return NextResponse.json(
      { error: 'Failed to check system health' },
      { status: 500 }
    )
  }
}

// Format metrics for Prometheus
function formatPrometheusMetrics(healthResult: any, metrics: any): string {
  const lines: string[] = []

  // Health check status (1 = healthy, 0.5 = degraded, 0 = unhealthy)
  const statusValue = healthResult.status === 'healthy' ? 1
    : healthResult.status === 'degraded' ? 0.5 : 0

  lines.push(`# HELP system_health_status Overall system health status`)
  lines.push(`# TYPE system_health_status gauge`)
  lines.push(`system_health_status ${statusValue}`)

  // Individual health checks
  lines.push(`# HELP health_check_status Individual health check status`)
  lines.push(`# TYPE health_check_status gauge`)

  healthResult.checks.forEach((check: any) => {
    const value = check.status === 'healthy' ? 1
      : check.status === 'degraded' ? 0.5 : 0
    lines.push(`health_check_status{check="${check.name}"} ${value}`)
  })

  // System metrics
  if (metrics) {
    lines.push(`# HELP system_uptime_seconds System uptime in seconds`)
    lines.push(`# TYPE system_uptime_seconds counter`)
    lines.push(`system_uptime_seconds ${metrics.uptime}`)

    lines.push(`# HELP memory_usage_percentage Memory usage percentage`)
    lines.push(`# TYPE memory_usage_percentage gauge`)
    lines.push(`memory_usage_percentage ${metrics.memoryUsage.percentage}`)

    lines.push(`# HELP memory_used_bytes Memory used in bytes`)
    lines.push(`# TYPE memory_used_bytes gauge`)
    lines.push(`memory_used_bytes ${metrics.memoryUsage.used * 1024 * 1024}`)
  }

  return lines.join('\n')
}