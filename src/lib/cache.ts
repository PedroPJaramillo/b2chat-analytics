import { LRUCache } from 'lru-cache'

// Cache configuration for different data types
interface CacheConfig {
  max: number // Maximum entries
  ttl: number // Time to live in milliseconds
}

const CACHE_CONFIGS = {
  // Dashboard stats - refresh every 5 minutes
  dashboard: {
    max: 100,
    ttl: 5 * 60 * 1000,
  },
  // Analytics data - refresh every 15 minutes
  analytics: {
    max: 200,
    ttl: 15 * 60 * 1000,
  },
  // Agent data - refresh every 30 minutes
  agents: {
    max: 50,
    ttl: 30 * 60 * 1000,
  },
  // Sync status - refresh every minute
  sync: {
    max: 10,
    ttl: 60 * 1000,
  },
  // Chat data - refresh every 2 minutes
  chats: {
    max: 500,
    ttl: 2 * 60 * 1000,
  },
} as const

// Create cache instances
const caches = {
  dashboard: new LRUCache<string, any>(CACHE_CONFIGS.dashboard),
  analytics: new LRUCache<string, any>(CACHE_CONFIGS.analytics),
  agents: new LRUCache<string, any>(CACHE_CONFIGS.agents),
  sync: new LRUCache<string, any>(CACHE_CONFIGS.sync),
  chats: new LRUCache<string, any>(CACHE_CONFIGS.chats),
}

type CacheType = keyof typeof caches

// Generate cache key based on user and parameters
export function generateCacheKey(
  userId: string,
  endpoint: string,
  params?: Record<string, any>
): string {
  const paramString = params ? JSON.stringify(params) : ''
  return `${userId}:${endpoint}:${paramString}`
}

// Get cached data
export function getCached<T>(
  cacheType: CacheType,
  key: string
): T | undefined {
  return caches[cacheType].get(key) as T | undefined
}

// Set cached data
export function setCached<T>(
  cacheType: CacheType,
  key: string,
  data: T
): void {
  caches[cacheType].set(key, data)
}

// Delete cached data
export function deleteCached(
  cacheType: CacheType,
  key: string
): boolean {
  return caches[cacheType].delete(key)
}

// Clear cache for a specific type
export function clearCache(cacheType: CacheType): void {
  caches[cacheType].clear()
}

// Clear all user-specific cache entries
export function clearUserCache(userId: string): void {
  Object.values(caches).forEach(cache => {
    const keysToDelete: string[] = []
    cache.forEach((_, key) => {
      if (typeof key === 'string' && key.startsWith(`${userId}:`)) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => cache.delete(key))
  })
}

// Cache wrapper for async functions
export async function withCache<T>(
  cacheType: CacheType,
  key: string,
  fetchFn: () => Promise<T>,
  options?: {
    skipCache?: boolean
    customTtl?: number
  }
): Promise<T> {
  // Skip cache if requested
  if (options?.skipCache) {
    return fetchFn()
  }

  // Try to get from cache first
  const cached = getCached<T>(cacheType, key)
  if (cached !== undefined) {
    return cached
  }

  // Fetch fresh data
  const data = await fetchFn()

  // Cache the result
  setCached(cacheType, key, data)

  return data
}

// Cache statistics
export function getCacheStats(cacheType?: CacheType) {
  if (cacheType) {
    const cache = caches[cacheType]
    return {
      type: cacheType,
      size: cache.size,
      max: cache.max,
      ttl: CACHE_CONFIGS[cacheType].ttl,
    }
  }

  // Return stats for all caches
  return Object.entries(caches).map(([type, cache]) => ({
    type,
    size: cache.size,
    max: cache.max,
    ttl: CACHE_CONFIGS[type as CacheType].ttl,
  }))
}

// Invalidate cache based on data changes
export function invalidateRelatedCache(operation: {
  type: 'sync' | 'update' | 'delete'
  entity: 'contacts' | 'chats' | 'agents' | 'users'
  userId?: string
}) {
  switch (operation.entity) {
    case 'contacts':
      clearCache('dashboard')
      clearCache('analytics')
      if (operation.userId) {
        // Clear specific user's contact-related cache
        const userPrefix = `${operation.userId}:`
        caches.chats.forEach((_, key) => {
          if (typeof key === 'string' && key.startsWith(userPrefix)) {
            caches.chats.delete(key)
          }
        })
      }
      break

    case 'chats':
      clearCache('dashboard')
      clearCache('analytics')
      clearCache('chats')
      break

    case 'agents':
      clearCache('dashboard')
      clearCache('analytics')
      clearCache('agents')
      clearCache('chats')
      break

    case 'users':
      if (operation.userId) {
        clearUserCache(operation.userId)
      }
      break
  }

  // Always clear sync cache on any data change
  clearCache('sync')
}

// Preload cache for common queries
export async function preloadCache(userId: string) {
  // This would be called after login to preload common data
  // Implementation depends on your specific use case
  console.log(`Preloading cache for user: ${userId}`)
}

// Cache warming - periodically refresh important data
export function setupCacheWarming() {
  // This would set up intervals to refresh commonly accessed data
  // before it expires to ensure fast response times
  setInterval(() => {
    // Warm dashboard cache for active users
    // Implementation would depend on identifying active users
  }, 4 * 60 * 1000) // Every 4 minutes
}

// Export cache types for type safety
export type { CacheType }