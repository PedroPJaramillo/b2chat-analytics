/**
 * TanStack Query hooks for Customer Analysis feature
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  TriggerAnalysisRequest,
  TriggerAnalysisResponse,
  AnalysisStatusResponse,
  AnalysisResultsResponse,
  AnalysisHistoryResponse,
  AnalysisFilterOptions,
  ExportAnalysisRequest,
  ExportAnalysisResponse,
} from '@/types/customer-analysis'

// Query keys
export const customerAnalysisKeys = {
  all: ['customerAnalysis'] as const,
  lists: () => [...customerAnalysisKeys.all, 'list'] as const,
  list: (page: number, limit: number) =>
    [...customerAnalysisKeys.lists(), { page, limit }] as const,
  details: () => [...customerAnalysisKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerAnalysisKeys.details(), id] as const,
  status: (id: string) => [...customerAnalysisKeys.detail(id), 'status'] as const,
  results: (id: string) => [...customerAnalysisKeys.detail(id), 'results'] as const,
  filterOptions: () => [...customerAnalysisKeys.all, 'filterOptions'] as const,
}

/**
 * Hook to fetch analysis history with pagination
 */
export function useAnalysisList(page = 1, limit = 10) {
  return useQuery({
    queryKey: customerAnalysisKeys.list(page, limit),
    queryFn: async (): Promise<AnalysisHistoryResponse> => {
      const response = await fetch(
        `/api/customer-analysis?page=${page}&limit=${limit}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch analysis history')
      }
      return response.json()
    },
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Hook to fetch analysis status (for polling)
 */
export function useAnalysisStatus(analysisId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: analysisId ? customerAnalysisKeys.status(analysisId) : ['no-analysis'],
    queryFn: async (): Promise<AnalysisStatusResponse> => {
      if (!analysisId) throw new Error('No analysis ID provided')

      const response = await fetch(`/api/customer-analysis/${analysisId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch analysis status')
      }
      return response.json()
    },
    enabled: !!analysisId && (options?.enabled !== false),
    refetchInterval: (query) => {
      const status = (query.state.data as AnalysisStatusResponse | undefined)?.status

      // Poll every 2 seconds while processing, stop when completed/failed
      if (!status) return 2000
      if (status === 'PROCESSING' || status === 'PENDING') {
        return 2000
      }
      return false
    },
    staleTime: 0, // Always refetch for status
  })
}

/**
 * Hook to fetch complete analysis results
 */
export function useAnalysisResults(analysisId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: analysisId ? customerAnalysisKeys.results(analysisId) : ['no-analysis'],
    queryFn: async (): Promise<AnalysisResultsResponse> => {
      if (!analysisId) throw new Error('No analysis ID provided')

      const response = await fetch(`/api/customer-analysis/${analysisId}/results`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to fetch analysis results')
      }
      return response.json()
    },
    enabled: !!analysisId && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000, // 5 minutes - results don't change after completion
  })
}

/**
 * Hook to fetch filter options (agents, departments, date range)
 */
export function useFilterOptions() {
  return useQuery({
    queryKey: customerAnalysisKeys.filterOptions(),
    queryFn: async (): Promise<AnalysisFilterOptions> => {
      const response = await fetch('/api/customer-analysis/filter-options')
      if (!response.ok) {
        throw new Error('Failed to fetch filter options')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to trigger a new analysis
 */
export function useTriggerAnalysis() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      request: TriggerAnalysisRequest
    ): Promise<TriggerAnalysisResponse> => {
      const response = await fetch('/api/customer-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to trigger analysis')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate analysis list to show the new analysis
      queryClient.invalidateQueries({ queryKey: customerAnalysisKeys.lists() })
    },
  })
}

/**
 * Hook to export analysis results
 */
export function useExportAnalysis(analysisId: string) {
  return useMutation({
    mutationFn: async (request: ExportAnalysisRequest): Promise<ExportAnalysisResponse> => {
      const response = await fetch(`/api/customer-analysis/${analysisId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to export analysis')
      }

      // For CSV, the response is the file itself
      if (request.format === 'CSV') {
        const blob = await response.blob()
        const contentDisposition = response.headers.get('Content-Disposition')
        const filename = contentDisposition
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
          : 'analysis.csv'

        // Trigger download
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        return {
          exportId: 'csv-download',
          format: 'CSV',
          fileName: filename,
          downloadUrl: url,
          expiresAt: new Date().toISOString(),
          fileSizeBytes: blob.size,
        }
      }

      // For PDF, return the JSON response with blob URL
      return response.json()
    },
  })
}

/**
 * Hook to delete an analysis
 */
export function useDeleteAnalysis() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (analysisId: string): Promise<void> => {
      const response = await fetch(`/api/customer-analysis/${analysisId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to delete analysis')
      }
    },
    onSuccess: (_, analysisId) => {
      // Invalidate and remove queries
      queryClient.invalidateQueries({ queryKey: customerAnalysisKeys.lists() })
      queryClient.removeQueries({ queryKey: customerAnalysisKeys.detail(analysisId) })
    },
  })
}
