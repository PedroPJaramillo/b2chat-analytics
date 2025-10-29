"use client"

import { useQuery } from '@tanstack/react-query'
import type { ChatViewFilters, ChatViewResponse, ChatViewStats } from '@/types/chat-view'

/**
 * Options for useChatView hook
 * Extended by Feature 011 with additional sorting options
 */
export interface UseChatViewOptions {
  filters?: ChatViewFilters
  sortBy?: 'responseTime' | 'updatedAt' | 'createdAt' | 'messageCount' | 'status' | 'priority' | 'departmentName' | 'agentName' | 'contactName' | 'slaStatus'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

/**
 * Build query string from filters and options
 * Extended by Feature 011 with all new filter parameters
 */
function buildChatViewQueryString(options: UseChatViewOptions): string {
  const params = new URLSearchParams()

  // Pagination
  const page = options.page || 1
  const limit = options.limit || 25
  params.append('page', page.toString())
  params.append('limit', limit.toString())

  // Sorting
  if (options.sortBy) {
    params.append('sortBy', options.sortBy)
  }
  if (options.sortOrder) {
    params.append('sortOrder', options.sortOrder)
  }

  // Filters
  if (options.filters) {
    // Status filter (comma-separated)
    if (options.filters.status && options.filters.status.length > 0) {
      params.append('status', options.filters.status.join(','))
    }

    // Agent filter
    if (options.filters.agentId) {
      params.append('agentId', options.filters.agentId)
    }

    // Response time range filters
    if (options.filters.responseTimeMin !== undefined) {
      params.append('responseTimeMin', options.filters.responseTimeMin.toString())
    }
    if (options.filters.responseTimeMax !== undefined) {
      params.append('responseTimeMax', options.filters.responseTimeMax.toString())
    }

    // Contact name search
    if (options.filters.search) {
      params.append('search', options.filters.search)
    }

    // Feature 011: Department filter
    if (options.filters.departmentId) {
      params.append('departmentId', options.filters.departmentId)
    }

    // Feature 011: Priority filter
    if (options.filters.priorityFilter && options.filters.priorityFilter.length > 0) {
      params.append('priority', options.filters.priorityFilter.join(','))
    }

    // Feature 011: SLA status filter
    if (options.filters.slaStatus) {
      params.append('slaStatus', options.filters.slaStatus)
    }

    // Feature 011: Provider filter
    if (options.filters.providerFilter && options.filters.providerFilter.length > 0) {
      params.append('provider', options.filters.providerFilter.join(','))
    }

    // Feature 011: Message count range filter
    if (options.filters.messageCountRange) {
      params.append('messageCountRange', options.filters.messageCountRange)
    }

    // Feature 011: Created at date range
    if (options.filters.createdAtRange) {
      params.append('createdAtStart', options.filters.createdAtRange.start.toISOString())
      params.append('createdAtEnd', options.filters.createdAtRange.end.toISOString())
    }

    // Feature 011: Updated at date range
    if (options.filters.updatedAtRange) {
      params.append('updatedAtStart', options.filters.updatedAtRange.start.toISOString())
      params.append('updatedAtEnd', options.filters.updatedAtRange.end.toISOString())
    }
  }

  return params.toString()
}

/**
 * Fetch chat view data from API
 */
async function fetchChatView(options: UseChatViewOptions): Promise<ChatViewResponse> {
  const queryString = buildChatViewQueryString(options)
  const response = await fetch(`/api/chats/view?${queryString}`)

  if (!response.ok) {
    throw new Error('Failed to fetch chat view')
  }

  return response.json()
}

/**
 * Hook to fetch chat view with response time metrics
 * Extended by Feature 011 with additional filter and sorting options
 */
export function useChatView(options: UseChatViewOptions = {}) {
  const { filters, sortBy, sortOrder, page = 1, limit = 25 } = options

  const { data = null, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['chat-view', filters, sortBy, sortOrder, page, limit],
    queryFn: () => fetchChatView({ filters, sortBy, sortOrder, page, limit }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes (formerly cacheTime)
    refetchOnWindowFocus: true,
    retry: 2
  })

  return {
    data,
    loading,
    error: error ? (error as Error).message : null,
    refetch
  }
}

/**
 * Fetch chat view statistics from API
 * Feature 011: New endpoint for aggregated filter counts
 */
async function fetchChatViewStats(): Promise<ChatViewStats> {
  const response = await fetch('/api/chats/view/stats')

  if (!response.ok) {
    throw new Error('Failed to fetch chat view stats')
  }

  return response.json()
}

/**
 * Hook to fetch chat view statistics
 * Feature 011: Returns aggregated counts for filter dropdowns
 */
export function useChatViewStats() {
  const { data = null, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['chat-view-stats'],
    queryFn: fetchChatViewStats,
    staleTime: 10 * 60 * 1000, // 10 minutes (stats change less frequently)
    gcTime: 20 * 60 * 1000, // 20 minutes
    refetchOnWindowFocus: true,
    retry: 2
  })

  return {
    data,
    loading,
    error: error ? (error as Error).message : null,
    refetch
  }
}

/**
 * Message data for chat conversation
 */
export interface MessageData {
  id: string
  chatId: string
  text: string | null
  type: 'text' | 'image' | 'file'
  incoming: boolean
  timestamp: string
  imageUrl?: string | null
  fileUrl?: string | null
  caption?: string | null
}

/**
 * Response from messages API
 */
export interface MessagesResponse {
  messages: MessageData[]
  chat: {
    id: string
    b2chatId: string
    contactName: string
    agentName: string | null
    status: string
  }
}

/**
 * Fetch messages for a specific chat
 */
async function fetchChatMessages(chatId: string): Promise<MessagesResponse> {
  const response = await fetch(`/api/chats/${chatId}/messages`)

  if (!response.ok) {
    throw new Error('Failed to fetch chat messages')
  }

  return response.json()
}

/**
 * Hook to fetch messages for a specific chat (for expanded view)
 */
export function useChatMessages(chatId: string | null) {
  const { data = null, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['chat-messages', chatId],
    queryFn: () => fetchChatMessages(chatId!),
    enabled: !!chatId, // Only fetch when chatId is provided
    staleTime: 10 * 60 * 1000, // 10 minutes (messages don't change often for closed chats)
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus for static message history
    retry: 2
  })

  return {
    data,
    loading,
    error: error ? (error as Error).message : null,
    refetch
  }
}
