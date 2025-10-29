"use client"

import { useQuery } from '@tanstack/react-query'
import type { MessagePreview, ResponseTimeIndicator } from '@/types/contact'

interface ContactHistoryChat {
  id: string
  b2chatId: string
  status: string
  alias: string | null
  tags: string[]
  priority: string
  topic: string
  agent: string
  agentId: string | null
  messages: number
  duration: number | null
  createdAt: string
  closedAt: string | null
  lastModifiedAt: string
  // Enhanced fields (Feature 010)
  messagePreview: MessagePreview[]
  firstResponseTimeMs: number | null
  avgResponseTimeMs: number | null
  responseTimeIndicator: ResponseTimeIndicator | null
}

interface ContactHistoryStats {
  totalChats: number
  openChats: number
  closedChats: number
  pendingChats: number
  avgResolutionTime: number
  commonTags: string[]
  mostContactedAgent: {
    name: string
    count: number
  } | null
}

interface ContactHistoryTimeline {
  date: string
  chat: {
    id: string
    b2chatId: string
    topic: string
    status: string
    agent: string
    messages: number
    duration: number | null
  }
}

interface ContactHistoryResponse {
  contact: {
    id: string
    name: string
    email: string | null
    mobile: string | null
    phone: string | null
    company: string | null
  }
  chats: ContactHistoryChat[]
  stats: ContactHistoryStats
  timeline: ContactHistoryTimeline[]
}

async function fetchContactHistory(
  contactId: string
): Promise<ContactHistoryResponse> {
  const url = `/api/contacts/${contactId}/history`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch contact history: ${response.statusText}`)
  }

  return response.json()
}

export function useContactHistory(contactId: string | null) {
  return useQuery<ContactHistoryResponse, Error>({
    queryKey: ['contact-history', contactId],
    queryFn: () => {
      if (!contactId) {
        throw new Error('Contact ID is required')
      }
      return fetchContactHistory(contactId)
    },
    enabled: !!contactId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  })
}