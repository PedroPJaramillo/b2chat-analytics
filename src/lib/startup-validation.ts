/**
 * Startup Validation - Critical system checks on application startup
 *
 * Performs essential validations when the application starts to ensure
 * all required services and configurations are available.
 */

import { logEnvironmentValidation, validateEnvironmentVariables } from './health-check';
import { logger } from './logger';

/**
 * Run all startup validations
 */
export function runStartupValidation(): void {
  logger.info('Running startup validation checks...');

  try {
    // Validate environment variables
    logEnvironmentValidation();

    const envValidation = validateEnvironmentVariables();

    if (!envValidation.isValid) {
      logger.warn('Application started with configuration issues', {
        errorCount: envValidation.errors.length,
        warningCount: envValidation.warnings.length
      });

      // Log critical missing configuration
      const criticalMissing = envValidation.errors.filter(error =>
        error.includes('B2CHAT_') || error.includes('DATABASE_URL')
      );

      if (criticalMissing.length > 0) {
        logger.error('Critical configuration missing - core functionality will not work', {
          criticalIssues: criticalMissing
        });
      }
    } else {
      logger.info('All required environment variables are configured');
    }

    logger.info('Startup validation completed', {
      status: envValidation.isValid ? 'healthy' : 'degraded',
      errors: envValidation.errors.length,
      warnings: envValidation.warnings.length
    });

  } catch (error) {
    logger.error('Startup validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

/**
 * Check if the application can perform sync operations
 */
export function canPerformSync(): { canSync: boolean; reason?: string } {
  const envValidation = validateEnvironmentVariables();

  // Check for B2Chat credentials
  const b2chatErrors = envValidation.errors.filter(error => error.includes('B2CHAT_'));
  if (b2chatErrors.length > 0) {
    return {
      canSync: false,
      reason: 'B2Chat API credentials are not configured. Please set B2CHAT_USERNAME, B2CHAT_PASSWORD, and B2CHAT_API_URL environment variables.'
    };
  }

  // Check for database connection
  const dbErrors = envValidation.errors.filter(error => error.includes('DATABASE_URL'));
  if (dbErrors.length > 0) {
    return {
      canSync: false,
      reason: 'Database connection is not configured. Please set DATABASE_URL environment variable.'
    };
  }

  return { canSync: true };
}