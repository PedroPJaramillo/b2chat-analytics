"use client"

import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface TransformResult {
  syncId: string
  extractSyncId: string | null
  entityType: string
  status: string
  recordsProcessed: number
  recordsCreated: number
  recordsUpdated: number
  recordsSkipped: number
  recordsFailed: number
  validationWarnings: number
  changesSummary: any
  startedAt: string
  completedAt?: string
  errorMessage?: string
}

export interface TransformOptions {
  batchSize?: number
}

export function useTransform() {
  const [transforming, setTransforming] = useState(false)
  const [results, setResults] = useState<TransformResult[]>([])
  const [loadingResults, setLoadingResults] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const { toast } = useToast()

  /**
   * Trigger transform operation
   * @param entityType - Type of entities to transform (contacts, chats, or all)
   * @param extractSyncId - Optional extract batch ID (legacy mode). If not provided, processes all pending data (batch-agnostic mode)
   * @param options - Transform options (batchSize, etc.)
   */
  const triggerTransform = async (
    entityType: 'contacts' | 'chats' | 'all',
    extractSyncId?: string,
    options: TransformOptions = {}
  ) => {
    const controller = new AbortController()
    setAbortController(controller)

    try {
      setTransforming(true)

      // Build request body - only include extractSyncId if provided
      const body: {
        entityType: string
        options: TransformOptions
        extractSyncId?: string
      } = {
        entityType,
        options,
      }

      // Only include extractSyncId if provided (legacy mode)
      if (extractSyncId) {
        body.extractSyncId = extractSyncId
      }

      const response = await fetch('/api/sync/transform', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Transform failed')
      }

      const result = await response.json()

      toast({
        title: 'Transform Started',
        description: extractSyncId
          ? `Processing ${entityType} from specific batch...`
          : `Processing all pending ${entityType}...`,
      })

      // Refresh results (only if extractSyncId provided, otherwise fetch all)
      if (extractSyncId) {
        await fetchTransformResults(extractSyncId)
      } else {
        await fetchAllTransforms()
      }

      return result
    } catch (error) {
      // Handle abort/cancel
      if (error instanceof Error && error.name === 'AbortError') {
        toast({
          title: 'Transform Cancelled',
          description: 'Operation was cancelled by user.',
        })
        return { cancelled: true }
      }

      const errorMessage = error instanceof Error ? error.message : 'Transform operation failed'
      toast({
        title: 'Transform Failed',
        description: errorMessage,
        variant: 'destructive',
      })
      throw error
    } finally {
      setTransforming(false)
      setAbortController(null)
    }
  }

  /**
   * Cancel ongoing transform operation
   */
  const cancelTransform = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      toast({
        title: 'Cancelling Transform',
        description: 'Stopping transform operation...',
      })
    }
  }

  /**
   * Fetch transform results for an extract
   */
  const fetchTransformResults = async (extractSyncId: string) => {
    try {
      setLoadingResults(true)

      const response = await fetch(`/api/sync/transform?extractSyncId=${extractSyncId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch transform results')
      }

      const data = await response.json()
      setResults(data.transforms || [])

      return data.transforms
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch transform results'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      return []
    } finally {
      setLoadingResults(false)
    }
  }

  /**
   * Fetch all transform results (not filtered by extract)
   */
  const fetchAllTransforms = async () => {
    try {
      setLoadingResults(true)

      const response = await fetch('/api/sync/transform')

      if (!response.ok) {
        throw new Error('Failed to fetch transforms')
      }

      const data = await response.json()
      setResults(data.transforms || [])

      return data.transforms
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch transforms'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      return []
    } finally {
      setLoadingResults(false)
    }
  }

  return {
    transforming,
    results,
    loadingResults,
    triggerTransform,
    fetchTransformResults,
    fetchAllTransforms,
    cancelTransform,
  }
}
