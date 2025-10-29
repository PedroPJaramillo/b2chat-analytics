/**
 * Health Check API - System health and configuration validation
 *
 * Provides endpoints for checking system health, environment configuration,
 * and external service connectivity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { runHealthChecks, validateEnvironmentVariables, getCriticalEnvironmentIssues } from '@/lib/health-check';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check authentication for detailed health info
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';

    // Basic health check - always available
    if (!detailed) {
      const envValidation = validateEnvironmentVariables();
      const criticalIssues = getCriticalEnvironmentIssues();

      return NextResponse.json({
        status: envValidation.isValid && criticalIssues.length === 0 ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        criticalIssues: criticalIssues.length > 0 ? criticalIssues : undefined
      });
    }

    // Detailed health check - requires authentication
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required for detailed health check' },
        { status: 401 }
      );
    }

    logger.info('Detailed health check requested', { userId });

    // Run comprehensive health checks
    const healthResults = await runHealthChecks();
    const overallStatus = healthResults.every(r => r.status === 'healthy') ? 'healthy' :
                         healthResults.some(r => r.status === 'unhealthy') ? 'unhealthy' : 'degraded';

    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      checks: healthResults,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
        }
      }
    });

  } catch (error) {
    logger.error('Health check API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}