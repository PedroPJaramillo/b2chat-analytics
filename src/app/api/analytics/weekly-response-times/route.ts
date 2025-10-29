import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { addDays, format } from 'date-fns'
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

// Helper function to get day name from day of week number
function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[dayOfWeek]
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
    const agentId = searchParams.get('agentId') || 'all'
    const directionFilter = (searchParams.get('direction') || 'all') as ChatDirectionFilter
    const officeHoursFilter = (searchParams.get('officeHoursFilter') || 'all') as OfficeHoursFilter

    // Validate weekStart parameter
    if (!weekStartParam) {
      return NextResponse.json(
        { error: 'Missing required parameter: weekStart (YYYY-MM-DD format)' },
        { status: 400 }
      )
    }

    // Parse and validate date (add T00:00:00.000Z to ensure UTC interpretation)
    const weekStart = new Date(weekStartParam + 'T00:00:00.000Z')
    if (isNaN(weekStart.getTime())) {
      return NextResponse.json(
        { error: 'Invalid weekStart parameter. Expected YYYY-MM-DD format.' },
        { status: 400 }
      )
    }

    // Calculate week end (7 days after start for query range < weekEnd)
    const weekEnd = addDays(weekStart, 7)

    // If agent is specified (and not "all"), verify agent exists and get name
    let agentName: string | null = null
    if (agentId !== 'all') {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { id: true, name: true }
      })

      if (!agent) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        )
      }

      agentName = agent.name
    }

    // Load office hours configuration if filtering is needed
    const officeHoursConfig = officeHoursFilter !== 'all' ? await loadOfficeHoursConfig() : null

    // Build direction filter for queries (same logic as main analytics route)
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

    // Build base where clause
    const baseWhere: any = {
      createdAt: {
        gte: weekStart,
        lt: weekEnd
      },
      openedAt: { not: null },
      responseAt: { not: null },
      isDeleted: false,
      ...directionWhere
    }

    // Add agent filter if specified
    if (agentId !== 'all') {
      baseWhere.agentId = agentId
    }

    // Fetch all matching chats
    const chats = await prisma.chat.findMany({
      where: baseWhere,
      select: {
        id: true,
        createdAt: true,
        openedAt: true,
        responseAt: true,
        agentId: true
      }
    })

    // Filter by office hours if needed (application-level filter)
    const filteredChats = officeHoursFilter !== 'all' && officeHoursConfig
      ? chats.filter(chat => {
          const isOfficeHours = isWithinOfficeHours(chat.createdAt, officeHoursConfig)
          return officeHoursFilter === 'office-hours' ? isOfficeHours : !isOfficeHours
        })
      : chats

    // Group chats by day of week and hour (using UTC to match test expectations)
    const grouped = new Map<string, { responseTimes: number[], chatIds: string[] }>()

    filteredChats.forEach(chat => {
      if (!chat.openedAt || !chat.responseAt) return

      const dayOfWeek = chat.createdAt.getUTCDay() // 0=Sunday, 6=Saturday
      const hour = chat.createdAt.getUTCHours() // 0-23
      const responseTime = new Date(chat.responseAt).getTime() - new Date(chat.openedAt).getTime()

      const key = `${dayOfWeek}-${hour}`
      if (!grouped.has(key)) {
        grouped.set(key, { responseTimes: [], chatIds: [] })
      }
      const group = grouped.get(key)!
      group.responseTimes.push(responseTime)
      group.chatIds.push(chat.id)
    })

    // Build 168-item array (7 days × 24 hours)
    const data = []
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`
        const group = grouped.get(key) || { responseTimes: [], chatIds: [] }
        const avgMs = group.responseTimes.length > 0
          ? group.responseTimes.reduce((sum, t) => sum + t, 0) / group.responseTimes.length
          : 0

        data.push({
          dayOfWeek: day,
          dayName: getDayName(day),
          hour: hour,
          avg: formatResponseTime(avgMs),
          avgMs: Math.round(avgMs),
          count: group.responseTimes.length,
          chatIds: group.chatIds
        })
      }
    }

    // Calculate summary statistics
    const allResponseTimes = filteredChats
      .filter(chat => chat.openedAt && chat.responseAt)
      .map(chat => new Date(chat.responseAt!).getTime() - new Date(chat.openedAt!).getTime())

    const totalChats = allResponseTimes.length
    const overallAvgMs = totalChats > 0
      ? Math.round(allResponseTimes.reduce((sum, t) => sum + t, 0) / totalChats)
      : 0

    // Find fastest and slowest hours (only from slots with data)
    const slotsWithData = data.filter(slot => slot.count > 0)
    const fastestHour = slotsWithData.length > 0
      ? slotsWithData.reduce((min, slot) => slot.avgMs < min.avgMs ? slot : min)
      : null
    const slowestHour = slotsWithData.length > 0
      ? slotsWithData.reduce((max, slot) => slot.avgMs > max.avgMs ? slot : max)
      : null

    // Build response (ensure dates are formatted correctly)
    // Calculate week end as ISO date string
    const weekEndDate = addDays(weekStart, 6)
    const year = weekEndDate.getUTCFullYear()
    const month = String(weekEndDate.getUTCMonth() + 1).padStart(2, '0')
    const day = String(weekEndDate.getUTCDate()).padStart(2, '0')
    const weekEndFormatted = `${year}-${month}-${day}`

    return NextResponse.json({
      weekStart: weekStartParam, // Return the original parameter as-is
      weekEnd: weekEndFormatted,
      agentId: agentId === 'all' ? null : agentId,
      agentName: agentName,
      filters: {
        direction: directionFilter,
        officeHours: officeHoursFilter
      },
      data,
      summary: {
        totalChats,
        overallAvg: formatResponseTime(overallAvgMs),
        overallAvgMs,
        fastestHour: fastestHour ? {
          dayOfWeek: fastestHour.dayOfWeek,
          hour: fastestHour.hour,
          avg: fastestHour.avg
        } : null,
        slowestHour: slowestHour ? {
          dayOfWeek: slowestHour.dayOfWeek,
          hour: slowestHour.hour,
          avg: slowestHour.avg
        } : null
      }
    })

  } catch (error) {
    console.error('Weekly response times API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weekly response times' },
      { status: 500 }
    )
  }
}
