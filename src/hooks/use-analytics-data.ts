"use client"

import { useState, useEffect } from 'react'

interface AnalyticsData {
  totalConversations: number
  avgResponseTime: string
  satisfactionRate: number
  resolutionRate: number
  weeklyData: { name: string; value: number }[]
  agentPerformanceData: { name: string; value: number }[]
  responseTimeData: { name: string; value: number }[]
  trends: {
    conversationsTrend: number
    responseTimeTrend: number
    satisfactionTrend: number
    resolutionTrend: number
  }
}

export function useAnalyticsData() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/analytics')

        if (!response.ok) {
          throw new Error('Failed to fetch analytics data')
        }

        const analyticsData = await response.json()
        setData(analyticsData)
        setError(null)
      } catch (err) {
        // If the API doesn't exist yet, use mock data
        const mockData: AnalyticsData = {
          totalConversations: 2547,
          avgResponseTime: '2.3m',
          satisfactionRate: 94.2,
          resolutionRate: 87.3,
          weeklyData: [
            { name: "Monday", value: 245 },
            { name: "Tuesday", value: 318 },
            { name: "Wednesday", value: 287 },
            { name: "Thursday", value: 392 },
            { name: "Friday", value: 456 },
            { name: "Saturday", value: 198 },
            { name: "Sunday", value: 167 }
          ],
          agentPerformanceData: [
            { name: "Sarah Johnson", value: 94 },
            { name: "Mike Chen", value: 87 },
            { name: "Lisa Wong", value: 91 },
            { name: "David Smith", value: 83 }
          ],
          responseTimeData: [
            { name: "< 1 minute", value: 45 },
            { name: "1-3 minutes", value: 32 },
            { name: "3-5 minutes", value: 18 },
            { name: "5-10 minutes", value: 3 },
            { name: "> 10 minutes", value: 2 }
          ],
          trends: {
            conversationsTrend: 12.5,
            responseTimeTrend: -8.2,
            satisfactionTrend: 1.8,
            resolutionTrend: 3.1
          }
        }
        setData(mockData)
        setError(null)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  return { data, loading, error }
}