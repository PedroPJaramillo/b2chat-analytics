import { NextRequest, NextResponse } from 'next/server'
import { LRUCache } from 'lru-cache'

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  message?: string
  skipSuccessfulRequests?: boolean
}

// Default configurations for different endpoint types
export const RATE_LIMITS = {
  // General API endpoints
  default: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes
    message: 'Too many requests, please try again later',
  },
  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 requests per 15 minutes
    message: 'Too many authentication attempts, please try again later',
  },
  // Sync endpoints (more restrictive)
  sync: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 2, // 2 sync requests per minute
    message: 'Too many sync requests, please wait before trying again',
  },
  // Dashboard/analytics (moderate)
  dashboard: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
    message: 'Too many dashboard requests, please slow down',
  },
  // Search/query endpoints
  search: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 requests per minute
    message: 'Too many search requests, please wait',
  }
} as const

// In-memory cache for rate limiting
// In production, you'd want to use Redis or similar
const rateLimitCache = new LRUCache<string, { count: number; resetTime: number }>({
  max: 10000, // Maximum number of entries
  ttl: 15 * 60 * 1000, // 15 minutes TTL
})

// Get client identifier (IP + User ID if available)
function getClientId(request: NextRequest, userId?: string): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || realIp || 'unknown'

  return userId ? `${ip}:${userId}` : ip
}

// Rate limiting middleware
export function rateLimit(config: RateLimitConfig) {
  return async function rateLimitMiddleware(
    request: NextRequest,
    userId?: string
  ): Promise<NextResponse | null> {
    const clientId = getClientId(request, userId)
    const key = `rl:${clientId}`
    const now = Date.now()

    // Get current count
    const current = rateLimitCache.get(key)

    if (!current || now > current.resetTime) {
      // First request or window has expired
      rateLimitCache.set(key, {
        count: 1,
        resetTime: now + config.windowMs
      })
      return null // No rate limit applied
    }

    if (current.count >= config.maxRequests) {
      // Rate limit exceeded
      const resetIn = Math.ceil((current.resetTime - now) / 1000)

      return NextResponse.json(
        {
          error: config.message || 'Rate limit exceeded',
          retryAfter: resetIn
        },
        {
          status: 429,
          headers: {
            'Retry-After': resetIn.toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(current.resetTime / 1000).toString(),
          }
        }
      )
    }

    // Increment count
    rateLimitCache.set(key, {
      count: current.count + 1,
      resetTime: current.resetTime
    })

    return null // No rate limit applied
  }
}

// Convenience functions for specific rate limits
export const defaultRateLimit = rateLimit(RATE_LIMITS.default)
export const authRateLimit = rateLimit(RATE_LIMITS.auth)
export const syncRateLimit = rateLimit(RATE_LIMITS.sync)
export const dashboardRateLimit = rateLimit(RATE_LIMITS.dashboard)
export const searchRateLimit = rateLimit(RATE_LIMITS.search)

// Helper to apply rate limiting to API routes
export async function applyRateLimit(
  request: NextRequest,
  rateLimitType: keyof typeof RATE_LIMITS,
  userId?: string
): Promise<NextResponse | null> {
  const rateLimitFn = rateLimit(RATE_LIMITS[rateLimitType])
  return rateLimitFn(request, userId)
}

// Rate limit by endpoint pattern
export function getRateLimitForEndpoint(pathname: string): RateLimitConfig {
  if (pathname.includes('/api/sync')) {
    return RATE_LIMITS.sync
  }
  if (pathname.includes('/api/dashboard') || pathname.includes('/api/analytics')) {
    return RATE_LIMITS.dashboard
  }
  if (pathname.includes('/api/chats') || pathname.includes('/api/agents')) {
    return RATE_LIMITS.search
  }
  return RATE_LIMITS.default
}

// Clear rate limit for a client (useful for testing or admin actions)
export function clearRateLimit(clientId: string): void {
  rateLimitCache.delete(`rl:${clientId}`)
}

// Get current rate limit status for a client
export function getRateLimitStatus(clientId: string): {
  remaining: number
  resetTime: number
  total: number
} | null {
  const key = `rl:${clientId}`
  const current = rateLimitCache.get(key)

  if (!current) {
    return null
  }

  return {
    remaining: Math.max(0, RATE_LIMITS.default.maxRequests - current.count),
    resetTime: current.resetTime,
    total: RATE_LIMITS.default.maxRequests
  }
}