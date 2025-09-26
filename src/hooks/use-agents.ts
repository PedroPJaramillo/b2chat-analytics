"use client"

import { useState, useEffect } from 'react'

interface Agent {
  id: string
  name: string
  email: string
  status: string
  activeChats: number
  totalChats: number
  totalMessages: number
  avgResponseTime: string
  satisfaction: number
  createdAt: string
  updatedAt: string
}

export function useAgents() {
  const [data, setData] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAgents = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/agents')

      if (!response.ok) {
        throw new Error('Failed to fetch agents')
      }

      const agents = await response.json()
      setData(agents)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [])

  return { data, loading, error, refetch: fetchAgents }
}