"use client"

import { useQuery } from '@tanstack/react-query'

export interface RawTableStats {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
}

export interface SyncStats {
  b2chat: {
    contacts: number
    chats: number
    total: number
  }
  synced: {
    contacts: number
    chats: number
    contactsNeedingSync: number // Fix 006: Stub contacts needing full sync
    total: number
  }
  raw: {
    contacts: RawTableStats
    chats: RawTableStats
    total: number
  }
  syncPercentage: {
    contacts: number
    chats: number
    overall: number
  }
}

const fetchSyncStats = async (): Promise<SyncStats> => {
  try {
    const response = await fetch('/api/sync/stats', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      // If unauthorized, return default stats (this is expected when not logged in)
      if (response.status === 401) {
        return {
          b2chat: { contacts: 0, chats: 0, total: 0 },
          synced: { contacts: 0, chats: 0, contactsNeedingSync: 0, total: 0 },
          raw: {
            contacts: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 },
            chats: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 },
            total: 0
          },
          syncPercentage: { contacts: 0, chats: 0, overall: 0 }
        }
      }
      // For other errors, throw to trigger React Query error handling
      throw new Error(`HTTP ${response.status}: Failed to fetch sync statistics`)
    }

    const data = await response.json()

    // Validate the response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format from sync stats API')
    }

    return data
  } catch (error) {
    // Log error for debugging but don't crash the page
    console.warn('Sync stats fetch failed:', error)

    // If it's a network error or parsing error, return default stats
    if (error instanceof TypeError || error instanceof SyntaxError) {
      return {
        b2chat: { contacts: 0, chats: 0, total: 0 },
        synced: { contacts: 0, chats: 0, contactsNeedingSync: 0, total: 0 },
        raw: {
          contacts: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 },
          chats: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 },
          total: 0
        },
        syncPercentage: { contacts: 0, chats: 0, overall: 0 }
      }
    }

    // Re-throw other errors to let React Query handle them
    throw error
  }
}

export function useSyncStats() {
  const {
    data: stats,
    isLoading: loading,
    error,
    refetch
  } = useQuery({
    queryKey: ['sync-stats'],
    queryFn: fetchSyncStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: false, // Disable auto-refetch to prevent issues
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        return false
      }
      // Only retry twice for other errors
      return failureCount < 2
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  return {
    stats,
    loading,
    error: error?.message || null,
    refetch
  }
}