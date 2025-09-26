"use client"

import { useState, useEffect } from 'react'

interface DashboardStats {
  totalAgents: number
  totalChats: number
  totalMessages: number
  activeChats: number
  onlineAgents: number
  avgResponseTime: string
  satisfactionRate: number
  trends: {
    agentsChange: number
    chatsChange: number
    responseTimeChange: number
    satisfactionChange: number
  }
}

export function useDashboardStats() {
  const [data, setData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/dashboard/stats')

        if (!response.ok) {
          throw new Error('Failed to fetch dashboard stats')
        }

        const stats = await response.json()
        setData(stats)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return { data, loading, error, refetch: () => setLoading(true) }
}