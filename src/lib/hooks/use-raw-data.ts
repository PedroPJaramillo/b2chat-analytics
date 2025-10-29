"use client"

import { useQuery } from '@tanstack/react-query'
import {
  RawDataResponse,
  RawDataRecordDetail,
  RawDataFilters,
  RawDataSorting
} from '@/types/raw-data'

interface UseRawDataOptions {
  filters?: RawDataFilters
  sorting?: RawDataSorting
  page?: number
  limit?: number
}

/**
 * Build query string from filters, sorting, and pagination
 */
function buildRawDataQueryString(
  filters: RawDataFilters = { entityType: 'all' },
  sorting: RawDataSorting = { sortBy: 'fetchedAt', sortOrder: 'desc' },
  page: number = 1,
  limit: number = 100
): string {
  const params = new URLSearchParams()

  // Pagination
  params.append('page', page.toString())
  params.append('limit', limit.toString())

  // Entity type
  params.append('entityType', filters.entityType)

  // Search
  if (filters.search) {
    params.append('search', filters.search)
  }

  // Processing status filter
  if (filters.processingStatus) {
    params.append('processingStatus', filters.processingStatus)
  }

  // Sync ID filter
  if (filters.syncId) {
    params.append('syncId', filters.syncId)
  }

  // Date range filters
  if (filters.fetchedAfter) {
    params.append('fetchedAfter', filters.fetchedAfter.toISOString())
  }
  if (filters.fetchedBefore) {
    params.append('fetchedBefore', filters.fetchedBefore.toISOString())
  }

  // Sorting
  params.append('sortBy', sorting.sortBy)
  params.append('sortOrder', sorting.sortOrder)

  return params.toString()
}

/**
 * Fetch raw data from API
 */
async function fetchRawData(
  filters: RawDataFilters = { entityType: 'all' },
  sorting: RawDataSorting = { sortBy: 'fetchedAt', sortOrder: 'desc' },
  page: number = 1,
  limit: number = 100
): Promise<RawDataResponse> {
  const queryString = buildRawDataQueryString(filters, sorting, page, limit)
  const response = await fetch(`/api/raw-data?${queryString}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch raw data: ${response.statusText}`)
  }

  return response.json()
}

/**
 * React Query hook for fetching raw data with filters, sorting, and pagination
 *
 * Usage:
 * ```tsx
 * const { data, isLoading, error } = useRawData({
 *   filters: { entityType: 'contacts', processingStatus: 'failed' },
 *   sorting: { sortBy: 'fetchedAt', sortOrder: 'desc' },
 *   page: 1,
 *   limit: 100
 * })
 * ```
 */
export function useRawData(options: UseRawDataOptions = {}) {
  const {
    filters = { entityType: 'all' },
    sorting = { sortBy: 'fetchedAt', sortOrder: 'desc' },
    page = 1,
    limit = 100
  } = options

  return useQuery<RawDataResponse, Error>({
    queryKey: ['raw-data', filters, sorting, page, limit],
    queryFn: () => fetchRawData(filters, sorting, page, limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes (formerly cacheTime)
  })
}

/**
 * Fetch single raw data record with full details
 */
async function fetchRawDataRecord(
  id: string,
  entityType?: 'contact' | 'chat'
): Promise<RawDataRecordDetail> {
  const params = new URLSearchParams()
  if (entityType) {
    params.append('entityType', entityType)
  }

  const queryString = params.toString()
  const url = `/api/raw-data/${id}${queryString ? `?${queryString}` : ''}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch raw data record: ${response.statusText}`)
  }

  const data = await response.json()
  return data.record
}

/**
 * React Query hook for fetching single raw data record
 *
 * Usage:
 * ```tsx
 * const { data, isLoading, error } = useRawDataRecord('record-id', 'contact')
 * ```
 */
export function useRawDataRecord(
  id: string | null,
  entityType?: 'contact' | 'chat'
) {
  return useQuery<RawDataRecordDetail, Error>({
    queryKey: ['raw-data-record', id, entityType],
    queryFn: () => {
      if (!id) {
        throw new Error('Record ID is required')
      }
      return fetchRawDataRecord(id, entityType)
    },
    enabled: !!id,
    staleTime: 1 * 60 * 1000, // 1 minute (shorter for debugging)
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Helper function to format processing status for display
 */
export function formatProcessingStatus(status: string): {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  color: string
} {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending',
        variant: 'outline',
        color: 'bg-yellow-50 text-yellow-700 border-yellow-200'
      }
    case 'processing':
      return {
        label: 'Processing',
        variant: 'default',
        color: 'bg-blue-50 text-blue-700 border-blue-200'
      }
    case 'completed':
      return {
        label: 'Completed',
        variant: 'secondary',
        color: 'bg-green-50 text-green-700 border-green-200'
      }
    case 'failed':
      return {
        label: 'Failed',
        variant: 'destructive',
        color: 'bg-red-50 text-red-700 border-red-200'
      }
    default:
      return {
        label: status,
        variant: 'outline',
        color: 'bg-gray-50 text-gray-700 border-gray-200'
      }
  }
}
