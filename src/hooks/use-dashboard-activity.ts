"use client"

import { useState, useEffect } from 'react'

interface Activity {
  id: string
  type: string
  title: string
  subtitle: string
  timestamp: string
  timeAgo: string
  color: string
}

export function useDashboardActivity() {
  const [data, setData] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/dashboard/activity')

        if (!response.ok) {
          throw new Error('Failed to fetch dashboard activity')
        }

        const activity = await response.json()
        setData(activity)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchActivity()
  }, [])

  return { data, loading, error, refetch: () => setLoading(true) }
}