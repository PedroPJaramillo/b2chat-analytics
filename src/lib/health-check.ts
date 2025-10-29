/**
 * Environment and Health Check Module
 *
 * Validates required environment variables and external service connectivity
 * to provide early detection of configuration issues.
 */

import { logger } from './logger';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message: string;
  responseTime?: number;
  details?: any;
}

export interface EnvironmentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Required environment variables for the application
 */
const REQUIRED_ENV_VARS = {
  // Database
  DATABASE_URL: 'Database connection string',

  // Authentication
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'Clerk public key for authentication',
  CLERK_SECRET_KEY: 'Clerk secret key for authentication',

  // B2Chat API (Critical for sync operations)
  B2CHAT_API_URL: 'B2Chat API base URL',
  B2CHAT_USERNAME: 'B2Chat API username',
  B2CHAT_PASSWORD: 'B2Chat API password',
} as const;

/**
 * Optional environment variables that should generate warnings if missing
 */
const OPTIONAL_ENV_VARS = {
  BLOB_READ_WRITE_TOKEN: 'File storage token',
  RESEND_API_KEY: 'Email service API key',
  SENTRY_DSN: 'Error monitoring DSN',
} as const;

/**
 * Validate all required environment variables
 */
export function validateEnvironmentVariables(): EnvironmentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const [varName, description] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      errors.push(`Missing required environment variable: ${varName} (${description})`);
    }
  }

  // Check optional variables
  for (const [varName, description] of Object.entries(OPTIONAL_ENV_VARS)) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      warnings.push(`Missing optional environment variable: ${varName} (${description})`);
    }
  }

  // Additional validation for specific variables
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
  }

  if (process.env.B2CHAT_API_URL && !process.env.B2CHAT_API_URL.startsWith('http')) {
    errors.push('B2CHAT_API_URL must be a valid HTTP/HTTPS URL');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check B2Chat API connectivity
 */
export async function checkB2ChatAPIHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const apiUrl = process.env.B2CHAT_API_URL;
    const username = process.env.B2CHAT_USERNAME;
    const password = process.env.B2CHAT_PASSWORD;

    if (!apiUrl || !username || !password) {
      return {
        service: 'B2Chat API',
        status: 'unhealthy',
        message: 'B2Chat API credentials not configured',
        details: {
          missingCredentials: !username || !password,
          missingUrl: !apiUrl
        }
      };
    }

    // Test authentication endpoint
    const authResponse = await fetch(`${apiUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username,
        password,
      }),
    });

    const responseTime = Date.now() - startTime;

    if (authResponse.ok) {
      return {
        service: 'B2Chat API',
        status: 'healthy',
        message: 'B2Chat API is accessible and authentication successful',
        responseTime,
      };
    } else {
      const errorText = await authResponse.text().catch(() => 'Unknown error');
      return {
        service: 'B2Chat API',
        status: 'unhealthy',
        message: `B2Chat API authentication failed: ${authResponse.status} ${authResponse.statusText}`,
        responseTime,
        details: {
          status: authResponse.status,
          statusText: authResponse.statusText,
          error: errorText
        }
      };
    }

  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      service: 'B2Chat API',
      status: 'unhealthy',
      message: `Failed to connect to B2Chat API: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Check database connectivity using Prisma
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Dynamic import to avoid issues during build
    const { prisma } = await import('./prisma');

    // Simple query to test database connectivity
    await prisma.$queryRaw`SELECT 1`;

    const responseTime = Date.now() - startTime;

    return {
      service: 'Database',
      status: 'healthy',
      message: 'Database connection successful',
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      service: 'Database',
      status: 'unhealthy',
      message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Run comprehensive health checks
 */
export async function runHealthChecks(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  // Environment validation
  const envValidation = validateEnvironmentVariables();
  results.push({
    service: 'Environment Variables',
    status: envValidation.isValid ? 'healthy' : 'unhealthy',
    message: envValidation.isValid
      ? 'All required environment variables are configured'
      : `Missing ${envValidation.errors.length} required environment variables`,
    details: {
      errors: envValidation.errors,
      warnings: envValidation.warnings
    }
  });

  // Only run connectivity checks if environment is valid
  if (envValidation.isValid) {
    // Check database
    results.push(await checkDatabaseHealth());

    // Check B2Chat API
    results.push(await checkB2ChatAPIHealth());
  }

  return results;
}

/**
 * Log environment validation results at startup
 */
export function logEnvironmentValidation(): void {
  const validation = validateEnvironmentVariables();

  if (validation.isValid) {
    logger.info('Environment validation passed', {
      warnings: validation.warnings.length,
      warningDetails: validation.warnings
    });
  } else {
    logger.error('Environment validation failed', {
      errors: validation.errors.length,
      errorDetails: validation.errors,
      warnings: validation.warnings.length,
      warningDetails: validation.warnings
    });
  }
}

/**
 * Get a summary of critical missing environment variables for user display
 */
export function getCriticalEnvironmentIssues(): string[] {
  const validation = validateEnvironmentVariables();

  if (validation.isValid) {
    return [];
  }

  // Focus on the most critical issues for sync operations
  const criticalIssues: string[] = [];

  validation.errors.forEach(error => {
    if (error.includes('B2CHAT_')) {
      criticalIssues.push('B2Chat API credentials are not configured. Sync operations will fail.');
    } else if (error.includes('DATABASE_URL')) {
      criticalIssues.push('Database connection is not configured. The application will not function.');
    } else if (error.includes('CLERK_')) {
      criticalIssues.push('Authentication service is not configured. Users will not be able to log in.');
    }
  });

  return criticalIssues;
}