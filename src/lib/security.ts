import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getRateLimitForEndpoint, applyRateLimit } from './rate-limit'
import { logger } from './logger'

// Security headers
export const SECURITY_HEADERS = {
  // Prevent XSS attacks
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',

  // HTTPS enforcement
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',

  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Note: Consider making this stricter
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://api.clerk.dev https://api.b2chat.io",
    "frame-ancestors 'none'"
  ].join('; '),

  // Prevent information disclosure
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Cache control
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
} as const

// Sensitive information patterns to redact from logs
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /authorization/i,
  /cookie/i,
] as const

// Redact sensitive information from objects
export function redactSensitiveInfo(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveInfo)
  }

  const redacted = { ...obj }

  Object.keys(redacted).forEach(key => {
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key))

    if (isSensitive) {
      redacted[key] = '[REDACTED]'
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSensitiveInfo(redacted[key])
    }
  })

  return redacted
}

// Enhanced error response that doesn't leak information
export function createSecureErrorResponse(
  error: Error | string,
  status: number = 500,
  userMessage?: string
): NextResponse {
  const errorMessage = typeof error === 'string' ? error : error.message

  // Log full error details internally
  logger.error('API Error', {
    error: errorMessage,
    stack: typeof error === 'object' ? error.stack : undefined,
    status
  })

  // Return generic message to client in production
  const clientMessage = process.env.NODE_ENV === 'development'
    ? errorMessage
    : userMessage || 'An error occurred while processing your request'

  return NextResponse.json(
    {
      error: clientMessage,
      timestamp: new Date().toISOString(),
      status
    },
    {
      status,
      headers: SECURITY_HEADERS
    }
  )
}

// Comprehensive API security middleware
export async function withSecurity<T>(
  request: NextRequest,
  handler: (request: NextRequest, context: { userId: string }) => Promise<T>
): Promise<T | NextResponse> {
  try {
    // 1. Authentication check
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        {
          status: 401,
          headers: SECURITY_HEADERS
        }
      )
    }

    // 2. Apply rate limiting
    const pathname = new URL(request.url).pathname
    const rateLimitConfig = getRateLimitForEndpoint(pathname)
    const rateLimitResponse = await applyRateLimit(request, 'default', userId)

    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // 3. Log request (with sensitive info redacted)
    logger.info('API Request', {
      method: request.method,
      pathname,
      userId,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      headers: redactSensitiveInfo(Object.fromEntries(request.headers.entries()))
    })

    // 4. Execute handler with security context
    const result = await handler(request, { userId })

    // 5. Add security headers to successful responses
    if (result instanceof NextResponse) {
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        result.headers.set(key, value)
      })
    }

    return result

  } catch (error) {
    // Handle unexpected errors securely
    return createSecureErrorResponse(
      error instanceof Error ? error : new Error('Unknown error'),
      500,
      'Internal server error'
    )
  }
}

// Input sanitization helpers
export function sanitizeHtml(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .trim()
    .slice(0, 10000) // Limit length
}

export function sanitizeSql(input: string): string {
  // Note: We're using Prisma which handles SQL injection prevention
  // This is just an additional layer for direct queries
  return input
    .replace(/[';--]/g, '')
    .trim()
}

export function validateUUID(input: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(input)
}

export function validateEmail(input: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(input) && input.length <= 254
}

// CORS configuration for API routes
export function getCorsHeaders(origin?: string) {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://your-domain.com',
    // Add your production domains
  ]

  const isAllowed = origin && allowedOrigins.includes(origin)

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  }
}

// Security audit helper
export function auditRequest(request: NextRequest) {
  const suspicious = []

  // Check for common attack patterns
  const url = request.url
  const userAgent = request.headers.get('user-agent') || ''

  // SQL injection attempts
  if (/union|select|drop|insert|delete/i.test(url)) {
    suspicious.push('Potential SQL injection')
  }

  // XSS attempts
  if (/<script|javascript:|onerror=/i.test(url)) {
    suspicious.push('Potential XSS attempt')
  }

  // Path traversal
  if (/\.\.|\/etc\/|\/proc\//i.test(url)) {
    suspicious.push('Potential path traversal')
  }

  // Unusual user agents
  if (!userAgent || userAgent.length < 10 || /bot|crawler|spider/i.test(userAgent)) {
    suspicious.push('Suspicious user agent')
  }

  if (suspicious.length > 0) {
    logger.warn('Suspicious request detected', {
      url,
      userAgent,
      suspicious,
      ip: request.headers.get('x-forwarded-for'),
      timestamp: new Date().toISOString()
    })
  }

  return suspicious
}

// Export security utilities
export const securityUtils = {
  redactSensitiveInfo,
  createSecureErrorResponse,
  withSecurity,
  sanitizeHtml,
  sanitizeSql,
  validateUUID,
  validateEmail,
  getCorsHeaders,
  auditRequest,
  SECURITY_HEADERS,
}