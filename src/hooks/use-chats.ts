"use client"

import { useState, useEffect, useCallback } from 'react'

interface Chat {
  id: string
  customer: string
  agent: string
  status: string
  priority: string
  topic: string
  messages: number
  startTime: string
  lastMessage: string
  createdAt: string
  updatedAt: string
}

interface UseChatsParams {
  status?: string
  priority?: string
  limit?: number
  offset?: number
}

export function useChats(params: UseChatsParams = {}) {
  const [data, setData] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchChats = useCallback(async () => {
    try {
      setLoading(true)
      const searchParams = new URLSearchParams()

      if (params.status) searchParams.set('status', params.status)
      if (params.priority) searchParams.set('priority', params.priority)
      if (params.limit) searchParams.set('limit', params.limit.toString())
      if (params.offset) searchParams.set('offset', params.offset.toString())

      const response = await fetch(`/api/chats?${searchParams.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch chats')
      }

      const chats = await response.json()
      setData(chats)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [params.status, params.priority, params.limit, params.offset])

  useEffect(() => {
    fetchChats()
  }, [fetchChats])

  return { data, loading, error, refetch: fetchChats }
}