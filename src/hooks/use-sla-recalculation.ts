import { useState, useCallback } from 'react'
import { RecalculationRequest, RecalculationResult } from '@/types/sla'

export interface UseSLARecalculationReturn {
  recalculate: (request: RecalculationRequest) => Promise<RecalculationResult>
  result: RecalculationResult | null
  loading: boolean
  error: Error | null
}

/**
 * Hook for triggering SLA recalculation
 */
export function useSLARecalculation(): UseSLARecalculationReturn {
  const [result, setResult] = useState<RecalculationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const recalculate = useCallback(async (request: RecalculationRequest): Promise<RecalculationResult> => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Build query parameters
      const params = new URLSearchParams()
      if (request.startDate) {
        params.set('startDate', request.startDate)
      }
      if (request.endDate) {
        params.set('endDate', request.endDate)
      }
      if (request.chatId) {
        params.set('chatId', request.chatId)
      }
      // Support both batchSize (new) and limit (legacy) parameters
      if (request.batchSize !== undefined) {
        params.set('batchSize', request.batchSize.toString())
      } else if (request.limit !== undefined) {
        params.set('batchSize', request.limit.toString())
      }

      // Make API request
      const response = await fetch(`/api/sla/recalculate?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // Handle error responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `Recalculation failed: ${response.statusText}`
        throw new Error(errorMessage)
      }

      // Parse successful response
      const data: RecalculationResult = await response.json()
      setResult(data)
      return data
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error during recalculation')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    recalculate,
    result,
    loading,
    error,
  }
}
