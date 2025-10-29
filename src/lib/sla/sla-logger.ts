import { logger, type LogContext } from '@/lib/logger-pino';
import { prisma } from '@/lib/prisma';
import type { SLAMetrics } from './sla-calculator';

/**
 * SLA Log Categories based on SPEC_CLARIFICATIONS.md
 */
export enum SLALogCategory {
  CALCULATION = 'calculation',           // Log all SLA calculations (pickup, response, resolution)
  BREACH = 'breach',                     // Log when an SLA is breached
  CONFIG_CHANGE = 'config_change',       // Log changes to SLA targets or office hours
  BUSINESS_HOURS = 'business_hours',     // Log business hours calculations specifically
  API = 'api',                          // Log SLA-related API calls
}

/**
 * SLA Log Entry Interface
 */
export interface SLALogEntry {
  category: SLALogCategory;
  chatId?: string;
  agentId?: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

/**
 * SLA-specific logger class
 * Extends the base logger with SLA-specific functionality
 */
class SLALogger {
  private source = 'sla-engine';

  /**
   * Logs SLA calculation events
   *
   * @param chatId - The chat ID
   * @param metrics - The calculated SLA metrics
   * @param calculationType - Type of calculation (initial, update, recalculation)
   */
  async logCalculation(
    chatId: string,
    metrics: SLAMetrics,
    calculationType: 'initial' | 'update' | 'recalculation' | 'config_change'
  ): Promise<void> {
    const message = `SLA calculation ${calculationType} for chat ${chatId}`;

    const context: LogContext = {
      source: this.source,
      category: SLALogCategory.CALCULATION,
      chatId,
      calculationType,
      metrics: {
        timeToPickup: metrics.timeToPickup,
        firstResponseTime: metrics.firstResponseTime,
        avgResponseTime: metrics.avgResponseTime,
        resolutionTime: metrics.resolutionTime,
        overallSLA: metrics.overallSLA,
        overallSLABH: metrics.overallSLABH,
      },
    };

    logger.info(message, context);

    // Persist to database (async, non-blocking)
    this.persistSLALog({
      category: SLALogCategory.CALCULATION,
      chatId,
      message,
      metadata: {
        calculationType,
        metrics: context.metrics,
      },
    }).catch(err => {
      console.error('Failed to persist SLA calculation log:', err);
    });
  }

  /**
   * Logs SLA breach events
   *
   * @param chatId - The chat ID
   * @param agentId - The agent ID (if applicable)
   * @param breachedMetrics - Which SLA metrics were breached
   * @param metrics - The full SLA metrics
   */
  async logBreach(
    chatId: string,
    agentId: string | null,
    breachedMetrics: Array<'pickup' | 'first_response' | 'avg_response' | 'resolution'>,
    metrics: Partial<SLAMetrics>
  ): Promise<void> {
    const message = `SLA breach detected for chat ${chatId}: ${breachedMetrics.join(', ')}`;

    const context: LogContext = {
      source: this.source,
      category: SLALogCategory.BREACH,
      chatId,
      agentId: agentId || undefined,
      breachedMetrics,
      severity: 'warning',
      metrics: {
        timeToPickup: metrics.timeToPickup,
        firstResponseTime: metrics.firstResponseTime,
        avgResponseTime: metrics.avgResponseTime,
        resolutionTime: metrics.resolutionTime,
        pickupSLA: metrics.pickupSLA,
        firstResponseSLA: metrics.firstResponseSLA,
        avgResponseSLA: metrics.avgResponseSLA,
        resolutionSLA: metrics.resolutionSLA,
      },
    };

    logger.warn(message, context);

    // Persist to database (async, non-blocking)
    this.persistSLALog({
      category: SLALogCategory.BREACH,
      chatId,
      agentId: agentId || undefined,
      message,
      metadata: {
        breachedMetrics,
        metrics: context.metrics,
      },
    }).catch(err => {
      console.error('Failed to persist SLA breach log:', err);
    });
  }

  /**
   * Logs SLA configuration changes
   *
   * @param changedSettings - Array of changed setting keys
   * @param oldValues - Old configuration values
   * @param newValues - New configuration values
   * @param userId - User who made the change
   */
  async logConfigChange(
    changedSettings: string[],
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    userId?: string
  ): Promise<void> {
    const message = `SLA configuration changed: ${changedSettings.join(', ')}`;

    const context: LogContext = {
      source: this.source,
      category: SLALogCategory.CONFIG_CHANGE,
      userId,
      changedSettings,
      oldValues,
      newValues,
    };

    logger.info(message, context);

    // Persist to database (async, non-blocking)
    this.persistSLALog({
      category: SLALogCategory.CONFIG_CHANGE,
      message,
      metadata: {
        changedSettings,
        oldValues,
        newValues,
        userId,
      },
    }).catch(err => {
      console.error('Failed to persist SLA config change log:', err);
    });
  }

  /**
   * Logs business hours calculation events
   *
   * @param chatId - The chat ID
   * @param calculationDetails - Details about the business hours calculation
   */
  async logBusinessHoursCalculation(
    chatId: string,
    calculationDetails: {
      startTime: Date;
      endTime: Date;
      businessHoursSeconds: number;
      wallClockSeconds: number;
      officeHoursConfig: Record<string, any>;
    }
  ): Promise<void> {
    const message = `Business hours calculation for chat ${chatId}`;

    const context: LogContext = {
      source: this.source,
      category: SLALogCategory.BUSINESS_HOURS,
      chatId,
      ...calculationDetails,
    };

    logger.debug(message, context);

    // Persist to database (async, non-blocking)
    this.persistSLALog({
      category: SLALogCategory.BUSINESS_HOURS,
      chatId,
      message,
      metadata: calculationDetails,
    }).catch(err => {
      console.error('Failed to persist business hours calculation log:', err);
    });
  }

  /**
   * Logs SLA API events
   *
   * @param endpoint - API endpoint called
   * @param method - HTTP method
   * @param statusCode - Response status code
   * @param userId - User who made the request
   * @param requestDetails - Additional request details
   */
  async logAPICall(
    endpoint: string,
    method: string,
    statusCode: number,
    userId?: string,
    requestDetails?: Record<string, any>
  ): Promise<void> {
    const message = `SLA API ${method} ${endpoint} - ${statusCode}`;

    const context: LogContext = {
      source: this.source,
      category: SLALogCategory.API,
      userId,
      endpoint,
      method,
      statusCode,
      ...requestDetails,
    };

    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    if (logLevel === 'error') {
      await logger.error(message, context);
    } else if (logLevel === 'warn') {
      logger.warn(message, context);
    } else {
      logger.info(message, context);
    }

    // Persist to database (async, non-blocking)
    this.persistSLALog({
      category: SLALogCategory.API,
      message,
      metadata: {
        endpoint,
        method,
        statusCode,
        userId,
        ...requestDetails,
      },
    }).catch(err => {
      console.error('Failed to persist SLA API log:', err);
    });
  }

  /**
   * Persists SLA log entry to database
   *
   * @param entry - The SLA log entry to persist
   */
  private async persistSLALog(entry: SLALogEntry): Promise<void> {
    try {
      // Check if SLALog model exists
      if (!(prisma as any).sLALog) {
        // Model doesn't exist yet, skip persistence
        return;
      }

      await (prisma as any).sLALog.create({
        data: {
          category: entry.category,
          chatId: entry.chatId,
          agentId: entry.agentId,
          message: entry.message,
          metadata: entry.metadata || {},
          timestamp: entry.timestamp || new Date(),
        },
      });
    } catch (err) {
      // Silently fail - we don't want logging errors to crash the app
      console.error('Error persisting SLA log to database:', err);
    }
  }

  /**
   * Queries SLA logs from database
   *
   * @param filters - Filters to apply
   * @returns Array of SLA log entries
   */
  async queryLogs(filters: {
    category?: SLALogCategory;
    chatId?: string;
    agentId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<any[]> {
    try {
      // Check if SLALog model exists
      if (!(prisma as any).sLALog) {
        return [];
      }

      const where: any = {};

      if (filters.category) {
        where.category = filters.category;
      }

      if (filters.chatId) {
        where.chatId = filters.chatId;
      }

      if (filters.agentId) {
        where.agentId = filters.agentId;
      }

      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) {
          where.timestamp.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.timestamp.lte = filters.endDate;
        }
      }

      const logs = await (prisma as any).sLALog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 100,
      });

      return logs;
    } catch (err) {
      console.error('Error querying SLA logs:', err);
      return [];
    }
  }

  /**
   * Gets breach summary statistics
   *
   * @param startDate - Start date for analysis
   * @param endDate - End date for analysis
   * @returns Breach statistics
   */
  async getBreachStats(startDate: Date, endDate: Date): Promise<{
    totalBreaches: number;
    breachByMetric: Record<string, number>;
    breachByAgent: Record<string, number>;
  }> {
    try {
      // Check if SLALog model exists
      if (!(prisma as any).sLALog) {
        return {
          totalBreaches: 0,
          breachByMetric: {},
          breachByAgent: {},
        };
      }

      const breachLogs = await (prisma as any).sLALog.findMany({
        where: {
          category: SLALogCategory.BREACH,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const breachByMetric: Record<string, number> = {};
      const breachByAgent: Record<string, number> = {};

      for (const log of breachLogs) {
        // Count by metric
        if (log.metadata?.breachedMetrics) {
          for (const metric of log.metadata.breachedMetrics) {
            breachByMetric[metric] = (breachByMetric[metric] || 0) + 1;
          }
        }

        // Count by agent
        if (log.agentId) {
          breachByAgent[log.agentId] = (breachByAgent[log.agentId] || 0) + 1;
        }
      }

      return {
        totalBreaches: breachLogs.length,
        breachByMetric,
        breachByAgent,
      };
    } catch (err) {
      console.error('Error getting breach stats:', err);
      return {
        totalBreaches: 0,
        breachByMetric: {},
        breachByAgent: {},
      };
    }
  }
}

// Export singleton instance
export const slaLogger = new SLALogger();
