/**
 * Simple in-memory cache for analysis results
 * In production, use Redis or Vercel KV
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class Cache {
  private store = new Map<string, CacheEntry<any>>()

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    })
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key)
      return null
    }

    return entry.data as T
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.expiresAt) {
        this.store.delete(key)
      }
    }
  }
}

// Singleton instance
export const cache = new Cache()

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => cache.cleanup(), 5 * 60 * 1000)
}

// Cache TTLs
export const CACHE_TTL = {
  RESULTS: 24 * 60 * 60 * 1000, // 24 hours
  FILTER_OPTIONS: 60 * 60 * 1000, // 1 hour
  STATUS: 10 * 1000, // 10 seconds (short for polling)
}

// Cache key builders
export function getResultsCacheKey(analysisId: string): string {
  return `analysis:results:${analysisId}`
}

export function getFilterOptionsCacheKey(userId: string): string {
  return `analysis:filter-options:${userId}`
}

export function getStatusCacheKey(analysisId: string): string {
  return `analysis:status:${analysisId}`
}

/**
 * Invalidates cache for an analysis (called when analysis is deleted or updated)
 */
export function invalidateAnalysisCache(analysisId: string): void {
  cache.delete(getResultsCacheKey(analysisId))
  cache.delete(getStatusCacheKey(analysisId))
}
