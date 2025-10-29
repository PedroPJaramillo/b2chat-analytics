import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { subDays, startOfWeek, endOfWeek, format, startOfHour, endOfHour } from 'date-fns'
import { calculateSLAMetrics, formatThreshold } from '@/lib/sla'
import { defaultSLAConfig, type SLAConfig } from '@/types/sla'
import { isWithinOfficeHours } from '@/lib/office-hours'
import { defaultOfficeHoursConfig, type OfficeHoursConfig } from '@/types/office-hours'
import type { OfficeHoursFilter, ChatDirectionFilter } from '@/types/filters'

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic'

// Revalidate every 60 seconds for analytics data
export const revalidate = 60

// Helper function to load SLA configuration
async function loadSLAConfig(): Promise<SLAConfig> {
  try {
    const slaSettings = await prisma.systemSetting.findMany({
      where: { category: "sla" },
    })

    if (slaSettings.length === 0) {
      return defaultSLAConfig
    }

    const config = { ...defaultSLAConfig }

    slaSettings.forEach((setting) => {
      const key = setting.key.replace("sla.", "")
      try {
        const value = JSON.parse(setting.value)
        if (key === "channelOverrides" || key === "priorityOverrides") {
          config[key] = value
        } else {
          (config as any)[key] = value
        }
      } catch (error) {
        console.error(`Error parsing SLA setting ${setting.key}:`, error)
      }
    })

    return config
  } catch (error) {
    console.error("Error loading SLA config:", error)
    return defaultSLAConfig
  }
}

// Helper function to load office hours configuration
async function loadOfficeHoursConfig(): Promise<OfficeHoursConfig> {
  try {
    const officeHoursSettings = await prisma.systemSetting.findMany({
      where: { category: "office-hours" },
    })

    if (officeHoursSettings.length === 0) {
      return defaultOfficeHoursConfig
    }

    const config = { ...defaultOfficeHoursConfig }

    officeHoursSettings.forEach((setting) => {
      const key = setting.key.replace("office-hours.", "")
      try {
        const value = JSON.parse(setting.value)
        if (key === "schedule") {
          config.schedule = value
        } else {
          (config as any)[key] = value
        }
      } catch (error) {
        console.error(`Error parsing office hours setting ${setting.key}:`, error)
      }
    })

    return config
  } catch (error) {
    console.error("Error loading office hours config:", error)
    return defaultOfficeHoursConfig
  }
}

// Helper function to calculate percentiles
function calculatePercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
  return sortedArray[Math.max(0, index)]
}

// Helper function to format milliseconds to readable time
function formatResponseTime(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
  return `${(ms / 3600000).toFixed(1)}h`
}

export async function GET(req: NextRequest) {
  let userId: string | null = null;

  try {
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get filters from query params
    const { searchParams } = new URL(req.url)
    const officeHoursFilter = (searchParams.get('officeHoursFilter') || 'all') as OfficeHoursFilter
    const directionFilter = (searchParams.get('direction') || 'all') as ChatDirectionFilter

    // Load office hours configuration if filtering is needed
    const officeHoursConfig = officeHoursFilter !== 'all' ? await loadOfficeHoursConfig() : null

    // Optimized: Use time-based window instead of record limit (last 30 days)
    const thirtyDaysAgo = subDays(new Date(), 30)

    // Build direction filter for queries
    const directionWhere: any = {}
    if (directionFilter === 'incoming') {
      directionWhere.direction = 'incoming'
    } else if (directionFilter === 'outgoing') {
      directionWhere.direction = 'outgoing'
    } else if (directionFilter === 'outgoing_broadcast') {
      directionWhere.direction = 'outgoing_broadcast'
    } else if (directionFilter === 'outgoing_all') {
      directionWhere.direction = { in: ['outgoing', 'outgoing_broadcast'] }
    } else if (directionFilter === 'converted') {
      directionWhere.direction = 'incoming'
      directionWhere.originalDirection = { not: 'incoming' }
    }
    // 'all' = no direction filter

    // Get chats with response time data - limit to recent time window
    const chatsWithResponseTime = await prisma.chat.findMany({
      where: {
        responseAt: { not: null }, // Changed: using responseAt (first agent message) instead of pickedUpAt
        openedAt: { not: null },
        isDeleted: false,
        createdAt: { gte: thirtyDaysAgo }, // Only last 30 days
        ...directionWhere // Apply direction filter
      },
      select: {
        id: true,
        provider: true,
        openedAt: true,
        pickedUpAt: true,
        responseAt: true,
        closedAt: true,
        createdAt: true,
        agentId: true,
        departmentId: true
      },
      orderBy: { createdAt: 'desc' }
    })

    // Helper function to apply office hours filter
    const shouldIncludeChat = (chat: typeof chatsWithResponseTime[0]): boolean => {
      if (!officeHoursConfig || officeHoursFilter === 'all') return true

      const chatDate = new Date(chat.openedAt!)
      const isWithinOffice = isWithinOfficeHours(chatDate, officeHoursConfig)

      if (officeHoursFilter === 'office-hours') {
        return isWithinOffice
      } else if (officeHoursFilter === 'non-office-hours') {
        return !isWithinOffice
      }

      return true
    }

    // Filter chats based on office hours setting
    const filteredChats = chatsWithResponseTime.filter(shouldIncludeChat)

    // Calculate first response times in milliseconds (openedAt -> responseAt)
    // responseAt = when agent actually sent first message (RESPONDED_BY_AGENT state)
    const responseTimes = filteredChats
      .map(chat => {
        const opened = new Date(chat.openedAt!).getTime()
        const responded = new Date(chat.responseAt!).getTime()
        return responded - opened
      })
      .filter(time => time >= 0) // Filter out negative times (data issues)
      .sort((a, b) => a - b)

    // Calculate percentiles
    const responseTimeMetrics = {
      avg: responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0,
      p50: calculatePercentile(responseTimes, 50),
      p95: calculatePercentile(responseTimes, 95),
      p99: calculatePercentile(responseTimes, 99),
      min: responseTimes.length > 0 ? responseTimes[0] : 0,
      max: responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : 0
    }

    // Calculate first response time vs resolution time
    const resolutionTimes = filteredChats
      .filter(chat => chat.closedAt && chat.openedAt)
      .map(chat => {
        const opened = new Date(chat.openedAt!).getTime()
        const closed = new Date(chat.closedAt!).getTime()
        return closed - opened
      })
      .filter(time => time >= 0)
      .sort((a, b) => a - b)

    const resolutionTimeMetrics = {
      avg: resolutionTimes.length > 0
        ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
        : 0,
      p50: calculatePercentile(resolutionTimes, 50),
      p95: calculatePercentile(resolutionTimes, 95)
    }

    // Response time by channel (first agent message time)
    const channelResponseTimes: Record<string, number[]> = {}
    filteredChats.forEach(chat => {
      if (!chat.openedAt || !chat.responseAt) return
      const responseTime = new Date(chat.responseAt).getTime() - new Date(chat.openedAt).getTime()
      if (!channelResponseTimes[chat.provider]) {
        channelResponseTimes[chat.provider] = []
      }
      channelResponseTimes[chat.provider].push(responseTime)
    })

    const responseTimeByChannel = Object.entries(channelResponseTimes).map(([channel, times]) => ({
      name: channel,
      avg: times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0,
      p50: calculatePercentile(times.sort((a, b) => a - b), 50),
      p95: calculatePercentile(times.sort((a, b) => a - b), 95),
      count: times.length
    }))

    // Calculate hourly response time pattern (last 7 days)
    const hourlyPattern: Record<number, number[]> = {}
    const sevenDaysAgo = subDays(new Date(), 7)

    filteredChats
      .filter(chat => new Date(chat.createdAt) >= sevenDaysAgo)
      .forEach(chat => {
        if (!chat.openedAt || !chat.responseAt) return
        const hour = new Date(chat.createdAt).getHours()
        const responseTime = new Date(chat.responseAt).getTime() - new Date(chat.openedAt).getTime()
        if (!hourlyPattern[hour]) {
          hourlyPattern[hour] = []
        }
        hourlyPattern[hour].push(responseTime)
      })

    const hourlyResponseTimes = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      avg: hourlyPattern[hour]?.length > 0
        ? hourlyPattern[hour].reduce((sum, t) => sum + t, 0) / hourlyPattern[hour].length
        : 0,
      count: hourlyPattern[hour]?.length || 0
    }))

    // Get total conversations (chats) - using same 30-day window for consistency
    const totalChats = await prisma.chat.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        isDeleted: false,
        ...directionWhere
      }
    })

    // Get chats by status (within 30-day window)
    const openChats = await prisma.chat.count({
      where: {
        status: 'open',
        createdAt: { gte: thirtyDaysAgo },
        isDeleted: false,
        ...directionWhere
      }
    })
    const closedChats = await prisma.chat.count({
      where: {
        status: 'closed',
        createdAt: { gte: thirtyDaysAgo },
        isDeleted: false,
        ...directionWhere
      }
    })

    // Get agent performance data with first response times
    const agents = await prisma.agent.findMany({
      where: { isDeleted: false },
      include: {
        chats: {
          where: {
            responseAt: { not: null }, // Changed: using responseAt for actual first message time
            openedAt: { not: null },
            ...directionWhere
          },
          select: {
            openedAt: true,
            responseAt: true
          },
          take: 100 // Last 100 chats per agent
        }
      }
    })

    const agentResponseTimes = agents.map(agent => {
      const times = agent.chats
        .map(chat => new Date(chat.responseAt!).getTime() - new Date(chat.openedAt!).getTime())
        .filter(time => time >= 0)
        .sort((a, b) => a - b)

      return {
        name: agent.name,
        avg: times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0,
        p50: calculatePercentile(times, 50),
        p95: calculatePercentile(times, 95),
        chatCount: agent.chats.length
      }
    }).filter(agent => agent.chatCount > 0)
      .sort((a, b) => a.avg - b.avg) // Sort by fastest average response time

    // Get department response times
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      include: {
        chats: {
          where: {
            responseAt: { not: null }, // Changed: using responseAt for actual first message time
            openedAt: { not: null },
            ...directionWhere
          },
          select: {
            openedAt: true,
            responseAt: true
          },
          take: 100
        }
      }
    })

    const departmentResponseTimes = departments.map(dept => {
      const times = dept.chats
        .map(chat => new Date(chat.responseAt!).getTime() - new Date(chat.openedAt!).getTime())
        .filter(time => time >= 0)
        .sort((a, b) => a - b)

      return {
        name: dept.name,
        avg: times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0,
        p50: calculatePercentile(times, 50),
        p95: calculatePercentile(times, 95),
        chatCount: dept.chats.length
      }
    }).filter(dept => dept.chatCount > 0)

    // Get weekly chat data (last 7 days) - optimized with single query
    const weekStart = startOfWeek(new Date())
    const weekEnd = endOfWeek(new Date())
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    // Fetch all chats for the week in a single query
    const weekChats = await prisma.chat.findMany({
      where: {
        createdAt: {
          gte: weekStart,
          lte: weekEnd
        },
        ...directionWhere
      },
      select: {
        createdAt: true
      }
    })

    // Group by day of week in memory (fast for 7 days of data)
    const chatsByDay = new Array(7).fill(0)
    weekChats.forEach(chat => {
      const dayIndex = new Date(chat.createdAt).getDay()
      chatsByDay[dayIndex]++
    })

    const weeklyData = daysOfWeek.map((day, index) => ({
      name: day,
      value: chatsByDay[index]
    }))

    // Response time distribution with real data
    const responseTimeRanges = [
      { min: 0, max: 60000, label: "< 1 minute" },
      { min: 60000, max: 180000, label: "1-3 minutes" },
      { min: 180000, max: 300000, label: "3-5 minutes" },
      { min: 300000, max: 600000, label: "5-10 minutes" },
      { min: 600000, max: Infinity, label: "> 10 minutes" }
    ]

    const responseTimeData = responseTimeRanges.map(range => ({
      name: range.label,
      value: responseTimes.filter(time => time >= range.min && time < range.max).length
    }))

    // Load SLA configuration and calculate compliance
    const slaConfig = await loadSLAConfig()

    // Calculate comprehensive SLA metrics using configured thresholds
    const slaMetrics = calculateSLAMetrics(
      filteredChats.map(chat => ({
        provider: chat.provider,
        openedAt: chat.openedAt,
        pickedUpAt: chat.pickedUpAt,
        responseAt: chat.responseAt,
        closedAt: chat.closedAt,
      })),
      slaConfig
    )

    // Use first response SLA for backward compatibility with existing UI
    const slaCompliance = slaMetrics.firstResponse.complianceRate
    const slaThreshold = formatThreshold(slaConfig.firstResponseThreshold)

    // Calculate trends (comparing last 30 days with previous 30 days)
    const sixtyDaysAgo = subDays(new Date(), 60)

    const previousPeriodChats = await prisma.chat.count({
      where: {
        createdAt: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo
        },
        isDeleted: false,
        ...directionWhere
      }
    })

    // Calculate conversation trend
    const conversationsTrend = previousPeriodChats > 0
      ? Math.round(((totalChats - previousPeriodChats) / previousPeriodChats) * 100)
      : totalChats > 0 ? 100 : 0

    // Get previous period response times for trend calculation
    const previousPeriodResponseTimes = await prisma.chat.findMany({
      where: {
        responseAt: { not: null },
        openedAt: { not: null },
        createdAt: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo
        },
        isDeleted: false,
        ...directionWhere
      },
      select: {
        openedAt: true,
        responseAt: true
      }
    })

    const previousAvgResponseTime = previousPeriodResponseTimes.length > 0
      ? previousPeriodResponseTimes.reduce((sum, chat) => {
          const time = new Date(chat.responseAt!).getTime() - new Date(chat.openedAt!).getTime()
          return sum + time
        }, 0) / previousPeriodResponseTimes.length
      : 0

    const responseTimeTrend = previousAvgResponseTime > 0
      ? Math.round(((previousAvgResponseTime - responseTimeMetrics.avg) / previousAvgResponseTime) * 100)
      : 0

    const trends = {
      conversationsTrend,
      responseTimeTrend, // Positive = improvement (faster), negative = slower
      satisfactionTrend: 0, // Not yet implemented - requires satisfaction data from polls
      resolutionTrend: 0    // Not yet implemented - requires historical resolution tracking
    }

    // Calculate agent performance scores (normalized 0-100 based on response times)
    // Lower response time = higher score
    const allAgentAvgTimes = agentResponseTimes.map(a => a.avg)
    const minResponseTime = allAgentAvgTimes.length > 0 ? Math.min(...allAgentAvgTimes) : 0
    const maxResponseTime = allAgentAvgTimes.length > 0 ? Math.max(...allAgentAvgTimes) : 1
    const responseTimeRange = maxResponseTime - minResponseTime || 1 // Avoid division by zero

    const analyticsData = {
      totalConversations: totalChats,
      avgResponseTime: formatResponseTime(responseTimeMetrics.avg),
      // Note: Customer satisfaction from B2Chat polls (COMPLETED_POLL state) not yet synced
      // When implemented, query EffectivenessAnalysis table or add poll data to Chat model
      satisfactionRate: null,
      resolutionRate: closedChats > 0 ? Math.round((closedChats / totalChats) * 100 * 10) / 10 : 0,
      weeklyData,
      agentPerformanceData: agentResponseTimes.slice(0, 10).map(agent => {
        // Normalize to 0-100 scale where faster response = higher score
        // If all agents have same time, everyone gets 100
        if (responseTimeRange === 0) return { name: agent.name, value: 100 }

        const normalizedScore = 100 - ((agent.avg - minResponseTime) / responseTimeRange * 100)
        return {
          name: agent.name,
          value: Math.round(Math.max(0, Math.min(100, normalizedScore))) // Clamp to 0-100
        }
      }),
      responseTimeData,
      trends,
      // New enhanced metrics
      responseTimeMetrics: {
        avg: formatResponseTime(responseTimeMetrics.avg),
        p50: formatResponseTime(responseTimeMetrics.p50),
        p95: formatResponseTime(responseTimeMetrics.p95),
        p99: formatResponseTime(responseTimeMetrics.p99),
        min: formatResponseTime(responseTimeMetrics.min),
        max: formatResponseTime(responseTimeMetrics.max)
      },
      resolutionTimeMetrics: {
        avg: formatResponseTime(resolutionTimeMetrics.avg),
        p50: formatResponseTime(resolutionTimeMetrics.p50),
        p95: formatResponseTime(resolutionTimeMetrics.p95)
      },
      responseTimeByChannel: responseTimeByChannel.map(channel => ({
        ...channel,
        avg: formatResponseTime(channel.avg),
        p50: formatResponseTime(channel.p50),
        p95: formatResponseTime(channel.p95)
      })),
      hourlyResponseTimes: hourlyResponseTimes.map(hour => ({
        ...hour,
        avg: formatResponseTime(hour.avg)
      })),
      agentResponseTimes: agentResponseTimes.slice(0, 10).map(agent => ({
        ...agent,
        avg: formatResponseTime(agent.avg),
        p50: formatResponseTime(agent.p50),
        p95: formatResponseTime(agent.p95)
      })),
      departmentResponseTimes: departmentResponseTimes.map(dept => ({
        ...dept,
        avg: formatResponseTime(dept.avg),
        p50: formatResponseTime(dept.p50),
        p95: formatResponseTime(dept.p95)
      })),
      // SLA metrics (backward compatible)
      slaCompliance,
      slaThreshold,
      // Detailed SLA metrics with all thresholds
      slaMetrics: {
        firstResponse: {
          ...slaMetrics.firstResponse,
          threshold: formatThreshold(slaMetrics.firstResponse.threshold),
          avgTime: formatResponseTime(slaMetrics.firstResponse.avgTime),
        },
        resolution: {
          ...slaMetrics.resolution,
          threshold: formatThreshold(slaMetrics.resolution.threshold),
          avgTime: formatResponseTime(slaMetrics.resolution.avgTime),
        },
        pickup: {
          ...slaMetrics.pickup,
          threshold: formatThreshold(slaMetrics.pickup.threshold),
          avgTime: formatResponseTime(slaMetrics.pickup.avgTime),
        },
      },
    }

    return NextResponse.json(analyticsData)

  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}