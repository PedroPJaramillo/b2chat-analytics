/**
 * Rate limiting for customer analysis API endpoints
 */

// In-memory store for rate limiting
// In production, use Redis or a similar distributed cache
const rateLimitStore = new Map<
  string,
  { count: number; resetAt: number }
>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterMs?: number
  error?: string
}

const RATE_LIMITS = {
  TRIGGER_ANALYSIS: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  FETCH_RESULTS: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  EXPORT: {
    maxRequests: 20,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  },
}

/**
 * Checks rate limit for a specific user and endpoint
 */
export function checkRateLimit(
  userId: string,
  endpoint: 'trigger' | 'results' | 'export'
): RateLimitResult {
  const key = `${userId}:${endpoint}`
  const now = Date.now()

  // Get rate limit config for this endpoint
  let config = RATE_LIMITS.TRIGGER_ANALYSIS
  if (endpoint === 'results') {
    config = RATE_LIMITS.FETCH_RESULTS
  } else if (endpoint === 'export') {
    config = RATE_LIMITS.EXPORT
  }

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key)

  // Reset if window has expired
  if (!entry || now >= entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    }
    rateLimitStore.set(key, entry)
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterMs: entry.resetAt - now,
      error: `Rate limit exceeded. Try again after ${new Date(entry.resetAt).toISOString()}`,
    }
  }

  // Increment counter
  entry.count++
  rateLimitStore.set(key, entry)

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Gets rate limit headers for HTTP response
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
  maxRequests: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(result.resetAt / 1000).toString(),
  }
}

/**
 * Cleanup function to remove expired entries (call periodically)
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key)
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000)
}
