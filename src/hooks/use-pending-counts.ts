"use client"

import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface PendingCounts {
  contacts: number
  chats: number
  total: number
}

export function usePendingCounts() {
  const [counts, setCounts] = useState<PendingCounts>({
    contacts: 0,
    chats: 0,
    total: 0,
  })
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  /**
   * Fetch pending transformation counts from API
   */
  const fetchCounts = useCallback(async () => {
    try {
      setLoading(true)

      const response = await fetch('/api/sync/pending-counts')

      if (!response.ok) {
        throw new Error('Failed to fetch pending counts')
      }

      const data = await response.json()
      setCounts(data.counts)

      return data.counts
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch pending counts'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      return { contacts: 0, chats: 0, total: 0 }
    } finally {
      setLoading(false)
    }
  }, [toast])

  return {
    counts,
    loading,
    fetchCounts,
  }
}
