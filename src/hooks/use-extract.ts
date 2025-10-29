"use client"

import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface ExtractBatch {
  id: string
  syncId: string
  entityType: string
  operation: string
  status: string
  recordsFetched: number
  totalPages: number
  apiCallCount: number
  startedAt: string
  completedAt?: string
  errorMessage?: string
  dateRangeFrom?: string
  dateRangeTo?: string
  timeRangePreset?: string
  batchSize?: number
  contactFilterMobile?: string
  metadata?: {
    error?: {
      statusCode?: number
      endpoint?: string
      requestUrl?: string
      rawResponse?: any
      timestamp?: string
    }
    [key: string]: any
  }
}

export interface ExtractOptions {
  batchSize?: number
  fullSync?: boolean
  timeRangePreset?: '1d' | '7d' | '30d' | '90d' | 'custom' | 'full'
  dateRange?: {
    startDate?: string
    endDate?: string
  }
  contactFilter?: {
    mobile?: string
    b2chatId?: string
  }
}

export function useExtract() {
  const [extracting, setExtracting] = useState(false)
  const [batches, setBatches] = useState<ExtractBatch[]>([])
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const { toast } = useToast()

  /**
   * Trigger extract operation
   */
  const triggerExtract = async (
    entityType: 'contacts' | 'chats' | 'all',
    options: ExtractOptions = {}
  ) => {
    const controller = new AbortController()
    setAbortController(controller)

    try {
      setExtracting(true)

      const response = await fetch('/api/sync/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityType,
          options,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Extract failed')
      }

      const result = await response.json()

      toast({
        title: 'Extract Started',
        description: `Extracting ${entityType} data from B2Chat API...`,
      })

      // Refresh batches list
      await fetchBatches(entityType === 'all' ? undefined : entityType)

      return result
    } catch (error) {
      // Handle abort/cancel
      if (error instanceof Error && error.name === 'AbortError') {
        toast({
          title: 'Extract Cancelled',
          description: 'Operation was cancelled by user.',
        })
        return { cancelled: true }
      }

      const errorMessage = error instanceof Error ? error.message : 'Extract operation failed'
      toast({
        title: 'Extract Failed',
        description: errorMessage,
        variant: 'destructive',
      })
      throw error
    } finally {
      setExtracting(false)
      setAbortController(null)
    }
  }

  /**
   * Cancel ongoing extract operation
   */
  const cancelExtract = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      toast({
        title: 'Cancelling Extract',
        description: 'Stopping extract operation...',
      })
    }
  }

  /**
   * Fetch available extract batches
   */
  const fetchBatches = async (entityType?: 'contacts' | 'chats') => {
    try {
      setLoadingBatches(true)

      const params = entityType ? `?entityType=${entityType}` : ''
      const response = await fetch(`/api/sync/extract${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch extract batches')
      }

      const data = await response.json()
      setBatches(data.batches || [])

      return data.batches
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch extract batches'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      return []
    } finally {
      setLoadingBatches(false)
    }
  }

  return {
    extracting,
    batches,
    loadingBatches,
    triggerExtract,
    fetchBatches,
    cancelExtract,
  }
}
