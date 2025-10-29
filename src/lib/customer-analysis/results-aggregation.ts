/**
 * Results aggregation utilities for customer analysis
 */

import type {
  CustomerCategorization,
  AnalysisKPI,
  CustomerIntent,
  JourneyStage,
  Sentiment,
} from '@prisma/client'
import type { AnalysisResultsResponse } from '@/types/customer-analysis'

/**
 * Aggregates analysis results from categorizations and KPIs
 */
export function aggregateAnalysisResults(
  categorizations: CustomerCategorization[],
  kpis: AnalysisKPI[]
): Omit<AnalysisResultsResponse, 'analysisId' | 'status' | 'summary'> {
  const customerInsights = aggregateCustomerInsights(categorizations)
  const agentPerformance = aggregateAgentPerformance(kpis, categorizations)
  const operationalInsights = aggregateOperationalInsights(kpis)

  return {
    customerInsights,
    agentPerformance,
    operationalInsights,
  }
}

/**
 * Aggregates customer insights from categorizations
 */
function aggregateCustomerInsights(
  categorizations: CustomerCategorization[]
) {
  const intentCounts: Record<CustomerIntent, number> = {
    PROJECT_INFO: 0,
    PAYMENT: 0,
    LEGAL: 0,
    POST_PURCHASE: 0,
    OTHER: 0,
  }

  const journeyCounts: Record<JourneyStage, number> = {
    PROSPECT: 0,
    ACTIVE_BUYER: 0,
    POST_PURCHASE: 0,
  }

  const sentimentCounts: Record<Sentiment, number> = {
    POSITIVE: 0,
    NEUTRAL: 0,
    FRICTION: 0,
  }

  // Count occurrences
  for (const cat of categorizations) {
    if (cat.customerIntent) {
      intentCounts[cat.customerIntent]++
    }
    if (cat.journeyStage) {
      journeyCounts[cat.journeyStage]++
    }
    if (cat.sentiment) {
      sentimentCounts[cat.sentiment]++
    }
  }

  const total = categorizations.length || 1 // Avoid division by zero

  // Convert to percentages
  const intentDistribution: Record<CustomerIntent, number> = {
    PROJECT_INFO: intentCounts.PROJECT_INFO / total,
    PAYMENT: intentCounts.PAYMENT / total,
    LEGAL: intentCounts.LEGAL / total,
    POST_PURCHASE: intentCounts.POST_PURCHASE / total,
    OTHER: intentCounts.OTHER / total,
  }

  const journeyStageDistribution: Record<JourneyStage, number> = {
    PROSPECT: journeyCounts.PROSPECT / total,
    ACTIVE_BUYER: journeyCounts.ACTIVE_BUYER / total,
    POST_PURCHASE: journeyCounts.POST_PURCHASE / total,
  }

  const sentimentDistribution: Record<Sentiment, number> = {
    POSITIVE: sentimentCounts.POSITIVE / total,
    NEUTRAL: sentimentCounts.NEUTRAL / total,
    FRICTION: sentimentCounts.FRICTION / total,
  }

  return {
    intentDistribution,
    journeyStageDistribution,
    sentimentDistribution,
  }
}

/**
 * Aggregates agent performance metrics from KPIs
 */
function aggregateAgentPerformance(
  kpis: AnalysisKPI[],
  categorizations: CustomerCategorization[]
) {
  // Group KPIs by agent
  const agentKPIs = new Map<string, AnalysisKPI[]>()

  for (const kpi of kpis) {
    if (kpi.agentId && kpi.category === 'agent_performance') {
      if (!agentKPIs.has(kpi.agentId)) {
        agentKPIs.set(kpi.agentId, [])
      }
      agentKPIs.get(kpi.agentId)!.push(kpi)
    }
  }

  // Build agent metrics
  const byAgent = Array.from(agentKPIs.entries()).map(([agentId, agentKpis]) => {
    // Find metrics for this agent
    const responseTimeKpi = agentKpis.find(
      (k) => k.metricName === 'agent_first_response_p50'
    )
    const totalChatsKpi = agentKpis.find(
      (k) => k.metricName === 'agent_total_chats'
    )
    const totalMessagesKpi = agentKpis.find(
      (k) => k.metricName === 'agent_total_messages'
    )

    // Calculate quality score from categorizations
    const agentCategorizations = categorizations.filter(
      (c) => c.agentQualityScore !== null
    )
    const qualityScores = agentCategorizations
      .filter((c) => c.agentQualityScore !== null)
      .map((c) => c.agentQualityScore!)

    const avgQuality =
      qualityScores.length > 0
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
        : 0

    // Build quality distribution
    const qualityDistribution: Record<number, number> = {}
    for (const score of qualityScores) {
      qualityDistribution[score] = (qualityDistribution[score] || 0) + 1
    }

    return {
      agentId,
      agentName: `Agent ${agentId.slice(0, 8)}`, // Would fetch from DB in real implementation
      metrics: {
        totalChats: totalChatsKpi?.numericValue || 0,
        totalMessages: totalMessagesKpi?.numericValue || 0,
        firstResponseTime: {
          average: responseTimeKpi?.numericValue || 0,
          p50: responseTimeKpi?.numericValue || 0,
          p90: responseTimeKpi?.numericValue || 0,
          p95: responseTimeKpi?.numericValue || 0,
        },
        averageHandlingTime: 0, // Would be calculated from additional KPIs
        qualityScore: {
          average: avgQuality,
          distribution: qualityDistribution,
        },
      },
    }
  })

  // Identify top performers
  const topPerformers = []

  // Fastest response
  const sortedBySpeed = [...byAgent].sort(
    (a, b) =>
      a.metrics.firstResponseTime.p50 - b.metrics.firstResponseTime.p50
  )
  if (sortedBySpeed.length > 0 && sortedBySpeed[0].metrics.firstResponseTime.p50 > 0) {
    topPerformers.push({
      agentId: sortedBySpeed[0].agentId,
      agentName: sortedBySpeed[0].agentName,
      metric: 'fastest_response' as const,
      value: sortedBySpeed[0].metrics.firstResponseTime.p50,
    })
  }

  // Most chats
  const sortedByVolume = [...byAgent].sort(
    (a, b) => b.metrics.totalChats - a.metrics.totalChats
  )
  if (sortedByVolume.length > 0) {
    topPerformers.push({
      agentId: sortedByVolume[0].agentId,
      agentName: sortedByVolume[0].agentName,
      metric: 'most_chats' as const,
      value: sortedByVolume[0].metrics.totalChats,
    })
  }

  // Highest quality
  const sortedByQuality = [...byAgent].sort(
    (a, b) => b.metrics.qualityScore.average - a.metrics.qualityScore.average
  )
  if (sortedByQuality.length > 0 && sortedByQuality[0].metrics.qualityScore.average > 0) {
    topPerformers.push({
      agentId: sortedByQuality[0].agentId,
      agentName: sortedByQuality[0].agentName,
      metric: 'highest_quality' as const,
      value: sortedByQuality[0].metrics.qualityScore.average,
    })
  }

  return {
    byAgent,
    topPerformers,
  }
}

/**
 * Aggregates operational insights from KPIs
 */
function aggregateOperationalInsights(kpis: AnalysisKPI[]) {
  const peakTimeKpi = kpis.find(
    (k) => k.metricName === 'messages_by_hour'
  )
  const peakDayKpi = kpis.find(
    (k) => k.metricName === 'messages_by_day'
  )
  const channelKpi = kpis.find(
    (k) => k.metricName === 'channel_distribution'
  )

  return {
    peakTimes: {
      byHour: (peakTimeKpi?.jsonValue as Record<string, number>) || {},
      byDayOfWeek: (peakDayKpi?.jsonValue as Record<string, number>) || {},
    },
    channelDistribution: {
      text: ((channelKpi?.jsonValue as any)?.text as number) || 0,
      voice: ((channelKpi?.jsonValue as any)?.voice as number) || 0,
      media: ((channelKpi?.jsonValue as any)?.media as number) || 0,
    },
    commonPainPoints: [], // Would be extracted from sentiment analysis in real implementation
  }
}
