import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { addDays, addHours } from 'date-fns'
import { isWithinOfficeHours } from '@/lib/office-hours'
import { defaultOfficeHoursConfig, type OfficeHoursConfig } from '@/types/office-hours'
import type { OfficeHoursFilter, ChatDirectionFilter } from '@/types/filters'

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic'

// Revalidate every 60 seconds for analytics data
export const revalidate = 60

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

// Helper function to format milliseconds to readable time
function formatResponseTime(ms: number): string {
  if (ms === 0) return '0s'
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
  return `${(ms / 3600000).toFixed(1)}h`
}

// Helper function to format time difference with sign
function formatTimeDiff(ms: number): string {
  const formatted = formatResponseTime(Math.abs(ms))
  return ms >= 0 ? `+${formatted}` : `-${formatted}`
}

// Helper function to get day name from day of week number
function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[dayOfWeek]
}

// Helper function to format hour range
function getHourRange(hour: number): string {
  const start = formatHour(hour)
  const end = formatHour((hour + 1) % 24)
  return `${start} - ${end}`
}

// Helper function to format hour for display
function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:00 ${period}`
}

export async function GET(req: NextRequest) {
  let userId: string | null = null

  try {
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const weekStartParam = searchParams.get('weekStart')
    const dayOfWeekStr = searchParams.get('dayOfWeek')
    const hourStr = searchParams.get('hour')
    const agentId = searchParams.get('agentId') || 'all'
    const directionFilter = (searchParams.get('direction') || 'all') as ChatDirectionFilter
    const officeHoursFilter = (searchParams.get('officeHoursFilter') || 'all') as OfficeHoursFilter

    // Validate required parameters
    if (!weekStartParam || !dayOfWeekStr || !hourStr) {
      return NextResponse.json(
        { error: 'Missing required parameters: weekStart, dayOfWeek, hour' },
        { status: 400 }
      )
    }

    // Parse and validate dayOfWeek and hour
    const dayOfWeek = parseInt(dayOfWeekStr)
    const hour = parseInt(hourStr)

    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json(
        { error: 'Invalid dayOfWeek: must be 0-6 (0=Sunday, 6=Saturday)' },
        { status: 400 }
      )
    }

    if (isNaN(hour) || hour < 0 || hour > 23) {
      return NextResponse.json(
        { error: 'Invalid hour: must be 0-23' },
        { status: 400 }
      )
    }

    // Parse and validate weekStart date
    const weekStart = new Date(weekStartParam + 'T00:00:00.000Z')
    if (isNaN(weekStart.getTime())) {
      return NextResponse.json(
        { error: 'Invalid weekStart parameter. Expected YYYY-MM-DD format.' },
        { status: 400 }
      )
    }

    // Calculate time slot boundaries
    // Start: weekStart + dayOfWeek days + hour hours
    const timeSlotStart = new Date(weekStart)
    timeSlotStart.setUTCDate(timeSlotStart.getUTCDate() + dayOfWeek)
    timeSlotStart.setUTCHours(hour, 0, 0, 0)

    const timeSlotEnd = addHours(timeSlotStart, 1)

    // Calculate week end for weekly average query
    const weekEnd = addDays(weekStart, 7)

    // Load office hours configuration if filtering is needed
    const officeHoursConfig = officeHoursFilter !== 'all' ? await loadOfficeHoursConfig() : null

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

    // Build base where clause for time slot
    const timeSlotWhere: any = {
      createdAt: {
        gte: timeSlotStart,
        lt: timeSlotEnd
      },
      responseAt: { not: null },
      isDeleted: false,
      ...directionWhere
    }

    // Add agent filter if specified
    if (agentId !== 'all') {
      timeSlotWhere.agentId = agentId
    }

    // Build where clause for weekly average
    const weeklyWhere: any = {
      createdAt: {
        gte: weekStart,
        lt: weekEnd
      },
      responseAt: { not: null },
      isDeleted: false,
      ...directionWhere
    }

    if (agentId !== 'all') {
      weeklyWhere.agentId = agentId
    }

    // Fetch time slot chats and weekly chats in parallel
    const [timeSlotChats, weeklyChats] = await Promise.all([
      prisma.chat.findMany({
        where: timeSlotWhere,
        select: {
          id: true,
          contact: {
            select: {
              fullName: true
            }
          },
          agentId: true,
          agent: {
            select: {
              id: true,
              name: true
            }
          },
          provider: true,
          status: true,
          createdAt: true,
          responseAt: true
        }
      }),
      prisma.chat.findMany({
        where: weeklyWhere,
        select: {
          createdAt: true,
          responseAt: true
        }
      })
    ])

    // Filter by office hours if needed (application-level filter)
    const filteredTimeSlotChats = officeHoursFilter !== 'all' && officeHoursConfig
      ? timeSlotChats.filter(chat => {
          const isOfficeHours = isWithinOfficeHours(chat.createdAt, officeHoursConfig)
          return officeHoursFilter === 'office-hours' ? isOfficeHours : !isOfficeHours
        })
      : timeSlotChats

    const filteredWeeklyChats = officeHoursFilter !== 'all' && officeHoursConfig
      ? weeklyChats.filter(chat => {
          const isOfficeHours = isWithinOfficeHours(chat.createdAt, officeHoursConfig)
          return officeHoursFilter === 'office-hours' ? isOfficeHours : !isOfficeHours
        })
      : weeklyChats

    // Calculate response times for time slot
    const chatsWithResponseTime = filteredTimeSlotChats
      .filter(chat => chat.createdAt && chat.responseAt)
      .map(chat => ({
        ...chat,
        responseTimeMs: chat.responseAt!.getTime() - chat.createdAt.getTime()
      }))

    // Calculate summary statistics
    const totalChats = chatsWithResponseTime.length
    const avgResponseTimeMs = totalChats > 0
      ? Math.round(chatsWithResponseTime.reduce((sum, chat) => sum + chat.responseTimeMs, 0) / totalChats)
      : 0

    // Calculate weekly average for comparison
    const weeklyResponseTimes = filteredWeeklyChats
      .filter(chat => chat.createdAt && chat.responseAt)
      .map(chat => chat.responseAt!.getTime() - chat.createdAt.getTime())

    const weeklyAvgMs = weeklyResponseTimes.length > 0
      ? Math.round(weeklyResponseTimes.reduce((sum, t) => sum + t, 0) / weeklyResponseTimes.length)
      : 0

    // Calculate comparison
    const diffMs = avgResponseTimeMs - weeklyAvgMs
    const comparisonToWeekly = formatTimeDiff(diffMs)

    // Determine performance indicator
    const threshold = weeklyAvgMs * 0.2
    let performanceIndicator: 'default' | 'secondary' | 'destructive' = 'default'
    let performanceLabel = 'Average'

    if (weeklyAvgMs > 0) {
      if (diffMs < -threshold) {
        performanceIndicator = 'secondary'
        performanceLabel = 'Better'
      } else if (diffMs > threshold) {
        performanceIndicator = 'destructive'
        performanceLabel = 'Worse'
      }
    }

    // Calculate distribution by status
    const distributionMap: Record<string, number> = {}
    chatsWithResponseTime.forEach(chat => {
      distributionMap[chat.status] = (distributionMap[chat.status] || 0) + 1
    })

    const distribution = Object.entries(distributionMap).map(([status, count]) => ({
      status,
      count
    }))

    // Calculate agent breakdown
    const agentStatsMap: Record<string, {
      agentId: string | null
      agentName: string | null
      chatCount: number
      totalResponseTimeMs: number
    }> = {}

    chatsWithResponseTime.forEach(chat => {
      const key = chat.agentId || 'unassigned'
      if (!agentStatsMap[key]) {
        agentStatsMap[key] = {
          agentId: chat.agentId,
          agentName: chat.agent?.name || null,
          chatCount: 0,
          totalResponseTimeMs: 0
        }
      }
      agentStatsMap[key].chatCount++
      agentStatsMap[key].totalResponseTimeMs += chat.responseTimeMs
    })

    const agentBreakdown = Object.values(agentStatsMap)
      .map(agent => ({
        agentId: agent.agentId,
        agentName: agent.agentName,
        chatCount: agent.chatCount,
        avgResponseTime: formatResponseTime(Math.round(agent.totalResponseTimeMs / agent.chatCount)),
        avgResponseTimeMs: Math.round(agent.totalResponseTimeMs / agent.chatCount)
      }))
      .sort((a, b) => b.chatCount - a.chatCount) // Sort by chat count descending

    // Get top 10 slowest chats
    const slowestChats = chatsWithResponseTime
      .sort((a, b) => b.responseTimeMs - a.responseTimeMs)
      .slice(0, 10)
      .map(chat => ({
        chatId: chat.id,
        customerName: chat.contact?.fullName || 'Unknown Customer',
        agentName: chat.agent?.name || null,
        channel: chat.provider,
        responseTime: formatResponseTime(chat.responseTimeMs),
        responseTimeMs: chat.responseTimeMs,
        status: chat.status
      }))

    // Build response
    const response = {
      dayName: getDayName(dayOfWeek),
      hourRange: getHourRange(hour),
      timeSlotStart: timeSlotStart.toISOString(),
      timeSlotEnd: timeSlotEnd.toISOString(),
      summary: {
        totalChats,
        avgResponseTime: formatResponseTime(avgResponseTimeMs),
        avgResponseTimeMs,
        comparisonToWeekly,
        performanceIndicator,
        performanceLabel
      },
      distribution,
      agentBreakdown,
      slowestChats
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Response time drilldown API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drill-down data' },
      { status: 500 }
    )
  }
}
