import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { subDays, subMonths, startOfHour, startOfDay, startOfWeek, startOfMonth, format } from 'date-fns'
import { isWithinOfficeHours } from '@/lib/office-hours'
import { defaultOfficeHoursConfig, type OfficeHoursConfig } from '@/types/office-hours'
import type { OfficeHoursFilter, ChatDirectionFilter } from '@/types/filters'
import type { ChatProvider } from '@prisma/client'

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic'

// Revalidate every 60 seconds for analytics data
export const revalidate = 60

type TimeRange = '7d' | '30d' | '90d' | '12m'
type GroupBy = 'hour' | 'day' | 'week' | 'month'

interface VolumeDataPoint {
  timestamp: string
  count: number
  label: string
}

interface ChannelBreakdown {
  channel: string
  count: number
}

interface VolumeChartData {
  timeSeries: VolumeDataPoint[]
  channelBreakdown: ChannelBreakdown[]
  summary: {
    total: number
    avgPerPeriod: number
    peak: {
      timestamp: string
      count: number
      label: string
    } | null
    trend: number // percentage change vs previous period
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

// Helper function to determine group-by based on time range
function getDefaultGroupBy(timeRange: TimeRange): GroupBy {
  switch (timeRange) {
    case '7d':
      return 'hour'
    case '30d':
      return 'day'
    case '90d':
      return 'week'
    case '12m':
      return 'month'
    default:
      return 'day'
  }
}

// Helper function to get time range bounds
function getTimeRangeBounds(timeRange: TimeRange): { start: Date; end: Date; previousStart: Date } {
  const end = new Date()
  let start: Date
  let previousStart: Date

  switch (timeRange) {
    case '7d':
      start = subDays(end, 7)
      previousStart = subDays(start, 7)
      break
    case '30d':
      start = subDays(end, 30)
      previousStart = subDays(start, 30)
      break
    case '90d':
      start = subDays(end, 90)
      previousStart = subDays(start, 90)
      break
    case '12m':
      start = subMonths(end, 12)
      previousStart = subMonths(start, 12)
      break
    default:
      start = subDays(end, 30)
      previousStart = subDays(start, 30)
  }

  return { start, end, previousStart }
}

// Helper function to group timestamp
function groupTimestamp(date: Date, groupBy: GroupBy): Date {
  switch (groupBy) {
    case 'hour':
      return startOfHour(date)
    case 'day':
      return startOfDay(date)
    case 'week':
      return startOfWeek(date)
    case 'month':
      return startOfMonth(date)
    default:
      return startOfDay(date)
  }
}

// Helper function to format timestamp for display
function formatTimestamp(date: Date, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'hour':
      return format(date, 'MMM d, ha')
    case 'day':
      return format(date, 'MMM d')
    case 'week':
      return format(date, 'MMM d')
    case 'month':
      return format(date, 'MMM yyyy')
    default:
      return format(date, 'MMM d')
  }
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await auth()
    const userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const timeRange = (searchParams.get('timeRange') || '30d') as TimeRange
    const groupByParam = searchParams.get('groupBy') as GroupBy | null
    const groupBy = groupByParam || getDefaultGroupBy(timeRange)
    const officeHoursFilter = (searchParams.get('officeHoursFilter') || 'all') as OfficeHoursFilter
    const directionFilter = (searchParams.get('direction') || 'all') as ChatDirectionFilter
    const channelFilter = searchParams.get('channel') as ChatProvider | null
    const agentId = searchParams.get('agentId')
    const departmentId = searchParams.get('departmentId')

    // Load office hours configuration if filtering is needed
    const officeHoursConfig = officeHoursFilter !== 'all' ? await loadOfficeHoursConfig() : null

    // Get time range bounds
    const { start, end, previousStart } = getTimeRangeBounds(timeRange)

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

    // Build additional filters
    const additionalFilters: any = {}
    if (channelFilter) {
      additionalFilters.provider = channelFilter
    }
    if (agentId && agentId !== 'all') {
      additionalFilters.agentId = agentId
    }
    if (departmentId && departmentId !== 'all') {
      additionalFilters.departmentId = departmentId
    }

    // Fetch chats for current period
    const chats = await prisma.chat.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end
        },
        isDeleted: false,
        ...directionWhere,
        ...additionalFilters
      },
      select: {
        id: true,
        createdAt: true,
        openedAt: true,
        provider: true
      },
      orderBy: { createdAt: 'asc' }
    })

    // Fetch chats for previous period (for trend calculation)
    const previousChats = await prisma.chat.count({
      where: {
        createdAt: {
          gte: previousStart,
          lt: start
        },
        isDeleted: false,
        ...directionWhere,
        ...additionalFilters
      }
    })

    // Apply office hours filter
    const shouldIncludeChat = (chat: typeof chats[0]): boolean => {
      if (!officeHoursConfig || officeHoursFilter === 'all') return true

      const chatDate = new Date(chat.openedAt || chat.createdAt)
      const isWithinOffice = isWithinOfficeHours(chatDate, officeHoursConfig)

      if (officeHoursFilter === 'office-hours') {
        return isWithinOffice
      } else if (officeHoursFilter === 'non-office-hours') {
        return !isWithinOffice
      }

      return true
    }

    const filteredChats = chats.filter(shouldIncludeChat)

    // Group chats by time period
    const groupedData = new Map<string, number>()
    filteredChats.forEach(chat => {
      const timestamp = groupTimestamp(new Date(chat.createdAt), groupBy)
      const key = timestamp.toISOString()
      groupedData.set(key, (groupedData.get(key) || 0) + 1)
    })

    // Convert to time series array
    const timeSeries: VolumeDataPoint[] = Array.from(groupedData.entries())
      .map(([timestamp, count]) => ({
        timestamp,
        count,
        label: formatTimestamp(new Date(timestamp), groupBy)
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // Calculate channel breakdown
    const channelCounts = new Map<string, number>()
    filteredChats.forEach(chat => {
      channelCounts.set(chat.provider, (channelCounts.get(chat.provider) || 0) + 1)
    })

    const channelBreakdown: ChannelBreakdown[] = Array.from(channelCounts.entries())
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count)

    // Calculate summary statistics with NaN protection
    const total = filteredChats.length
    const avgPerPeriod = timeSeries.length > 0 ? total / timeSeries.length : 0

    const peak = timeSeries.length > 0
      ? timeSeries.reduce((max, curr) => curr.count > max.count ? curr : max, timeSeries[0])
      : null

    const trend = previousChats > 0
      ? Math.round(((total - previousChats) / previousChats) * 100)
      : total > 0 ? 100 : 0

    // Ensure no NaN values in summary
    const safeAvgPerPeriod = isNaN(avgPerPeriod) || !isFinite(avgPerPeriod) ? 0 : Math.round(avgPerPeriod * 10) / 10
    const safeTrend = isNaN(trend) || !isFinite(trend) ? 0 : trend

    // Validate time series data to ensure no NaN values
    const safeTimeSeries = timeSeries.map(point => ({
      ...point,
      count: isNaN(point.count) || !isFinite(point.count) ? 0 : Math.max(0, point.count)
    }))

    const responseData: VolumeChartData = {
      timeSeries: safeTimeSeries,
      channelBreakdown,
      summary: {
        total,
        avgPerPeriod: safeAvgPerPeriod,
        peak,
        trend: safeTrend
      }
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Volume chart API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch volume chart data' },
      { status: 500 }
    )
  }
}
