// TanStack Query hook for fetching messages

import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { Message } from '@/types/chat'
import { ChatFilters } from '@/types/filters'

interface MessagesResponse {
  data: Message[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

/**
 * Build query string from filters for messages
 */
function buildMessagesQueryString(filters: ChatFilters): string {
  const params = new URLSearchParams()

  if (filters.messageType && filters.messageType !== 'all') {
    params.append('type', filters.messageType)
  }

  if (filters.priority && filters.priority !== 'all') {
    params.append('priority', filters.priority)
  }

  if (filters.status && filters.status !== 'all') {
    params.append('status', filters.status)
  }

  if (filters.search) {
    params.append('search', filters.search)
  }

  const page = filters.page || 1
  const limit = filters.limit || 50 // Higher limit for messages view
  params.append('limit', limit.toString())
  params.append('offset', ((page - 1) * limit).toString())

  return params.toString()
}

/**
 * Fetch messages from API
 */
async function fetchMessages(filters: ChatFilters): Promise<MessagesResponse> {
  const queryString = buildMessagesQueryString(filters)
  const response = await fetch(`/api/messages?${queryString}`)

  if (!response.ok) {
    throw new Error('Failed to fetch messages')
  }

  return response.json()
}

/**
 * Hook to fetch and manage messages for Messages View
 */
export function useMessages(filters: ChatFilters): UseQueryResult<MessagesResponse, Error> {
  return useQuery({
    queryKey: ['messages', filters],
    queryFn: () => fetchMessages(filters),
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    retry: 2,
  })
}

/**
 * Hook to fetch messages for a specific chat
 */
export function useChatMessages(chatId: string | null): UseQueryResult<Message[], Error> {
  return useQuery({
    queryKey: ['chats', chatId, 'messages'],
    queryFn: async () => {
      if (!chatId) return []

      const response = await fetch(`/api/chats/${chatId}/messages`)
      if (!response.ok) {
        throw new Error('Failed to fetch chat messages')
      }

      const data = await response.json()
      return data.data || []
    },
    enabled: !!chatId,
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}
