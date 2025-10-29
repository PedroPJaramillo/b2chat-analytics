// TanStack Query hook for fetching chats with filters

import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { Chat } from '@/types/chat'
import { ChatFilters } from '@/types/filters'

interface ChatsResponse {
  data: Chat[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

/**
 * Build query string from filters
 */
function buildQueryString(filters: ChatFilters): string {
  const params = new URLSearchParams()

  if (filters.status && filters.status !== 'all') {
    params.append('status', filters.status)
  }

  if (filters.priority && filters.priority !== 'all') {
    params.append('priority', filters.priority)
  }

  if (filters.agent) {
    if (filters.agent === 'unassigned') {
      params.append('agentId', 'null')
    } else if (filters.agent !== 'all') {
      params.append('agentId', filters.agent)
    }
  }

  if (filters.channel && filters.channel !== 'all') {
    params.append('channel', filters.channel)
  }

  if (filters.tags && filters.tags.length > 0) {
    params.append('tags', filters.tags.join(','))
  }

  if (filters.dateRange && filters.dateRange !== 'all') {
    params.append('dateRange', filters.dateRange)
  }

  if (filters.search) {
    params.append('search', filters.search)
  }

  if (filters.contactType && filters.contactType !== 'all') {
    params.append('contactType', filters.contactType)
  }

  if (filters.unreadOnly) {
    params.append('unreadOnly', 'true')
  }

  if (filters.sortBy) {
    params.append('sortBy', filters.sortBy)
  }

  if (filters.sortOrder) {
    params.append('sortOrder', filters.sortOrder)
  }

  const page = filters.page || 1
  const limit = filters.limit || 20
  params.append('limit', limit.toString())
  params.append('offset', ((page - 1) * limit).toString())

  // Only include contact context when specifically requested or when filtering by contact
  if (filters.includeContactContext || filters.contactId) {
    params.append('includeContactContext', 'true')
  }

  return params.toString()
}

/**
 * Fetch chats from API
 */
async function fetchChats(filters: ChatFilters): Promise<ChatsResponse> {
  const queryString = buildQueryString(filters)
  const response = await fetch(`/api/chats?${queryString}`)

  if (!response.ok) {
    throw new Error('Failed to fetch chats')
  }

  return response.json()
}

/**
 * Hook to fetch and manage chats with filters
 */
export function useChats(filters: ChatFilters): UseQueryResult<ChatsResponse, Error> {
  return useQuery({
    queryKey: ['chats', filters],
    queryFn: () => fetchChats(filters),
    staleTime: 30000, // 30 seconds - data is considered fresh
    gcTime: 5 * 60 * 1000, // 5 minutes - cache time
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    retry: 2, // Retry failed requests twice
  })
}

/**
 * Hook to fetch chats for a specific contact
 */
export function useContactChats(contactId: string | null): UseQueryResult<ChatsResponse, Error> {
  return useQuery({
    queryKey: ['chats', 'contact', contactId],
    queryFn: () => fetchChats({ contactId: contactId || undefined } as any),
    enabled: !!contactId, // Only run query if contactId is provided
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Hook to get available filter options (agents, tags, etc.)
 */
export function useFilterOptions() {
  return useQuery({
    queryKey: ['filter-options'],
    queryFn: async () => {
      const response = await fetch('/api/chats/filter-options')
      if (!response.ok) {
        throw new Error('Failed to fetch filter options')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  })
}
