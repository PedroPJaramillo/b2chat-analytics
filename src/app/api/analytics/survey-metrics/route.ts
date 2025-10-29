import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { subDays, format, startOfDay, endOfDay } from 'date-fns'

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic'

// Revalidate every 30 seconds for survey analytics data
export const revalidate = 30

/**
 * Survey Metrics Analytics API (Feature 001: Full Status Support)
 *
 * Tracks survey-related metrics:
 * - Survey completion rate
 * - Survey abandonment rate
 * - Average survey response ratings
 * - Time-to-survey-completion
 * - Survey response distribution
 * - Trends over time
 */
export async function GET(req: NextRequest) {
  let userId: string | null = null

  try {
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get time range from query params (default: last 30 days)
    const { searchParams } = new URL(req.url)
    const daysParam = searchParams.get('days')
    const days = daysParam ? parseInt(daysParam) : 30

    // Validate days parameter
    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'Invalid days parameter (must be between 1 and 365)' },
        { status: 400 }
      )
    }

    const startDate = subDays(new Date(), days)

    // Query 1: Get all chats with survey interactions
    const surveyChats = await prisma.chat.findMany({
      where: {
        pollStartedAt: { gte: startDate },
        isDeleted: false,
      },
      select: {
        id: true,
        status: true,
        pollStartedAt: true,
        pollCompletedAt: true,
        pollAbandonedAt: true,
        pollResponse: true,
        agentId: true,
        provider: true,
        closedAt: true,
      },
    })

    // Separate by survey outcome
    const completedSurveys = surveyChats.filter(chat => chat.status === 'COMPLETED_POLL')
    const abandonedSurveys = surveyChats.filter(chat => chat.status === 'ABANDONED_POLL')
    const pendingSurveys = surveyChats.filter(chat => chat.status === 'COMPLETING_POLL')

    // Calculate overall metrics
    const totalSurveysStarted = surveyChats.length
    const totalCompleted = completedSurveys.length
    const totalAbandoned = abandonedSurveys.length
    const totalPending = pendingSurveys.length

    const completionRate =
      totalSurveysStarted > 0
        ? (totalCompleted / totalSurveysStarted) * 100
        : 0

    const abandonmentRate =
      totalSurveysStarted > 0
        ? (totalAbandoned / totalSurveysStarted) * 100
        : 0

    // Calculate time-to-completion metrics
    const completionTimes = completedSurveys
      .filter(chat => chat.pollStartedAt && chat.pollCompletedAt)
      .map(chat => {
        const started = new Date(chat.pollStartedAt!).getTime()
        const completed = new Date(chat.pollCompletedAt!).getTime()
        return (completed - started) / 1000 // seconds
      })

    const avgCompletionTime =
      completionTimes.length > 0
        ? completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length
        : 0

    // Calculate abandonment time (how long before customers give up)
    const abandonmentTimes = abandonedSurveys
      .filter(chat => chat.pollStartedAt && chat.pollAbandonedAt)
      .map(chat => {
        const started = new Date(chat.pollStartedAt!).getTime()
        const abandoned = new Date(chat.pollAbandonedAt!).getTime()
        return (abandoned - started) / (1000 * 60 * 60) // hours
      })

    const avgAbandonmentTime =
      abandonmentTimes.length > 0
        ? abandonmentTimes.reduce((sum, time) => sum + time, 0) / abandonmentTimes.length
        : 0

    // Parse survey responses and extract ratings
    const surveyRatings: number[] = []
    const surveyComments: string[] = []

    completedSurveys.forEach(chat => {
      if (chat.pollResponse && typeof chat.pollResponse === 'object') {
        const response = chat.pollResponse as any

        // Extract rating (common field names: rating, score, satisfaction)
        const rating = response.rating || response.score || response.satisfaction
        if (typeof rating === 'number' && rating >= 1 && rating <= 5) {
          surveyRatings.push(rating)
        }

        // Extract comment if present
        const comment = response.comment || response.feedback || response.message
        if (typeof comment === 'string' && comment.trim().length > 0) {
          surveyComments.push(comment)
        }
      }
    })

    // Calculate rating distribution
    const ratingDistribution = {
      1: surveyRatings.filter(r => r === 1).length,
      2: surveyRatings.filter(r => r === 2).length,
      3: surveyRatings.filter(r => r === 3).length,
      4: surveyRatings.filter(r => r === 4).length,
      5: surveyRatings.filter(r => r === 5).length,
    }

    const avgRating =
      surveyRatings.length > 0
        ? surveyRatings.reduce((sum, rating) => sum + rating, 0) / surveyRatings.length
        : 0

    // Calculate NPS (Net Promoter Score): promoters (4-5) - detractors (1-2)
    const promoters = surveyRatings.filter(r => r >= 4).length
    const detractors = surveyRatings.filter(r => r <= 2).length
    const nps =
      surveyRatings.length > 0
        ? ((promoters - detractors) / surveyRatings.length) * 100
        : 0

    // Breakdown by channel
    const byChannel = surveyChats.reduce((acc, chat) => {
      const channel = chat.provider
      if (!acc[channel]) {
        acc[channel] = {
          total: 0,
          completed: 0,
          abandoned: 0,
          pending: 0,
        }
      }
      acc[channel].total++
      if (chat.status === 'COMPLETED_POLL') acc[channel].completed++
      if (chat.status === 'ABANDONED_POLL') acc[channel].abandoned++
      if (chat.status === 'COMPLETING_POLL') acc[channel].pending++
      return acc
    }, {} as Record<string, { total: number; completed: number; abandoned: number; pending: number }>)

    // Calculate trends (compare first half vs second half of period)
    const midpoint = new Date(startDate.getTime() + (new Date().getTime() - startDate.getTime()) / 2)

    const firstHalfSurveys = surveyChats.filter(chat => new Date(chat.pollStartedAt!) < midpoint)
    const secondHalfSurveys = surveyChats.filter(chat => new Date(chat.pollStartedAt!) >= midpoint)

    const firstHalfCompleted = firstHalfSurveys.filter(c => c.status === 'COMPLETED_POLL').length
    const secondHalfCompleted = secondHalfSurveys.filter(c => c.status === 'COMPLETED_POLL').length

    const firstHalfRate = firstHalfSurveys.length > 0
      ? (firstHalfCompleted / firstHalfSurveys.length) * 100
      : 0
    const secondHalfRate = secondHalfSurveys.length > 0
      ? (secondHalfCompleted / secondHalfSurveys.length) * 100
      : 0

    const completionRateTrend = secondHalfRate - firstHalfRate

    // Daily breakdown for charting
    const dailyData: Record<string, { started: number; completed: number; abandoned: number }> = {}

    surveyChats.forEach(chat => {
      const date = format(startOfDay(new Date(chat.pollStartedAt!)), 'yyyy-MM-dd')
      if (!dailyData[date]) {
        dailyData[date] = { started: 0, completed: 0, abandoned: 0 }
      }
      dailyData[date].started++
      if (chat.status === 'COMPLETED_POLL') dailyData[date].completed++
      if (chat.status === 'ABANDONED_POLL') dailyData[date].abandoned++
    })

    // Response data
    return NextResponse.json({
      timeRange: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      summary: {
        totalSurveysStarted,
        totalCompleted,
        totalAbandoned,
        totalPending,
        completionRate: Math.round(completionRate * 100) / 100,
        abandonmentRate: Math.round(abandonmentRate * 100) / 100,
        avgCompletionTimeSeconds: Math.round(avgCompletionTime),
        avgAbandonmentTimeHours: Math.round(avgAbandonmentTime * 100) / 100,
      },
      ratings: {
        avgRating: Math.round(avgRating * 100) / 100,
        totalResponses: surveyRatings.length,
        distribution: ratingDistribution,
        nps: Math.round(nps),
        totalComments: surveyComments.length,
      },
      trends: {
        completionRateChange: Math.round(completionRateTrend * 100) / 100,
        improving: completionRateTrend > 0,
      },
      byChannel: Object.entries(byChannel).map(([channel, stats]) => ({
        channel,
        total: stats.total,
        completed: stats.completed,
        abandoned: stats.abandoned,
        pending: stats.pending,
        completionRate: stats.total > 0
          ? Math.round((stats.completed / stats.total) * 10000) / 100
          : 0,
      })),
      dailyBreakdown: Object.entries(dailyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, stats]) => ({
          date,
          ...stats,
          completionRate: stats.started > 0
            ? Math.round((stats.completed / stats.started) * 10000) / 100
            : 0,
        })),
    })
  } catch (error) {
    console.error('Survey metrics analytics error:', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    })

    return NextResponse.json(
      {
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
