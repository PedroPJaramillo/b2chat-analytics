/**
 * Unit tests for analysis results aggregation
 */

import { describe, it, expect } from '@jest/globals'
import { aggregateAnalysisResults } from '../results-aggregation'
import type { CustomerCategorization, AnalysisKPI } from '@prisma/client'

describe('Results Aggregation', () => {
  describe('aggregateAnalysisResults', () => {
    it('should aggregate customer insights from categorizations', () => {
      const categorizations: Partial<CustomerCategorization>[] = [
        {
          customerIntent: 'PROJECT_INFO',
          journeyStage: 'PROSPECT',
          sentiment: 'POSITIVE',
        },
        {
          customerIntent: 'PROJECT_INFO',
          journeyStage: 'PROSPECT',
          sentiment: 'NEUTRAL',
        },
        {
          customerIntent: 'PAYMENT',
          journeyStage: 'ACTIVE_BUYER',
          sentiment: 'POSITIVE',
        },
        {
          customerIntent: 'LEGAL',
          journeyStage: 'ACTIVE_BUYER',
          sentiment: 'FRICTION',
        },
        {
          customerIntent: 'POST_PURCHASE',
          journeyStage: 'POST_PURCHASE',
          sentiment: 'POSITIVE',
        },
      ]

      const result = aggregateAnalysisResults(
        categorizations as CustomerCategorization[],
        []
      )

      // Check intent distribution
      expect(result.customerInsights.intentDistribution.PROJECT_INFO).toBe(0.4) // 2/5
      expect(result.customerInsights.intentDistribution.PAYMENT).toBe(0.2) // 1/5
      expect(result.customerInsights.intentDistribution.LEGAL).toBe(0.2) // 1/5
      expect(result.customerInsights.intentDistribution.POST_PURCHASE).toBe(0.2) // 1/5

      // Check journey stage distribution
      expect(result.customerInsights.journeyStageDistribution.PROSPECT).toBe(0.4) // 2/5
      expect(result.customerInsights.journeyStageDistribution.ACTIVE_BUYER).toBe(0.4) // 2/5
      expect(result.customerInsights.journeyStageDistribution.POST_PURCHASE).toBe(0.2) // 1/5

      // Check sentiment distribution
      expect(result.customerInsights.sentimentDistribution.POSITIVE).toBe(0.6) // 3/5
      expect(result.customerInsights.sentimentDistribution.NEUTRAL).toBe(0.2) // 1/5
      expect(result.customerInsights.sentimentDistribution.FRICTION).toBe(0.2) // 1/5
    })

    it('should aggregate agent performance from KPIs', () => {
      const kpis: Partial<AnalysisKPI>[] = [
        {
          agentId: 'agent-1',
          metricType: 'RESPONSE_TIME',
          metricName: 'agent_first_response_p50',
          numericValue: 180000,
          category: 'agent_performance',
        },
        {
          agentId: 'agent-1',
          metricType: 'VOLUME',
          metricName: 'agent_total_chats',
          numericValue: 50,
          category: 'agent_performance',
        },
        {
          agentId: 'agent-2',
          metricType: 'RESPONSE_TIME',
          metricName: 'agent_first_response_p50',
          numericValue: 120000,
          category: 'agent_performance',
        },
        {
          agentId: 'agent-2',
          metricType: 'VOLUME',
          metricName: 'agent_total_chats',
          numericValue: 75,
          category: 'agent_performance',
        },
      ]

      const result = aggregateAnalysisResults([], kpis as AnalysisKPI[])

      expect(result.agentPerformance.byAgent).toHaveLength(2)

      const agent1 = result.agentPerformance.byAgent.find(
        (a) => a.agentId === 'agent-1'
      )
      expect(agent1?.metrics.totalChats).toBe(50)
      expect(agent1?.metrics.firstResponseTime.p50).toBe(180000)

      const agent2 = result.agentPerformance.byAgent.find(
        (a) => a.agentId === 'agent-2'
      )
      expect(agent2?.metrics.totalChats).toBe(75)
      expect(agent2?.metrics.firstResponseTime.p50).toBe(120000)
    })

    it('should identify top performers', () => {
      const kpis: Partial<AnalysisKPI>[] = [
        {
          agentId: 'agent-1',
          metricType: 'RESPONSE_TIME',
          metricName: 'agent_first_response_p50',
          numericValue: 180000,
          category: 'agent_performance',
        },
        {
          agentId: 'agent-1',
          metricType: 'VOLUME',
          metricName: 'agent_total_chats',
          numericValue: 50,
          category: 'agent_performance',
        },
        {
          agentId: 'agent-2',
          metricType: 'RESPONSE_TIME',
          metricName: 'agent_first_response_p50',
          numericValue: 120000, // Fastest
          category: 'agent_performance',
        },
        {
          agentId: 'agent-2',
          metricType: 'VOLUME',
          metricName: 'agent_total_chats',
          numericValue: 100, // Most chats
          category: 'agent_performance',
        },
      ]

      const result = aggregateAnalysisResults([], kpis as AnalysisKPI[])

      const fastestAgent = result.agentPerformance.topPerformers.find(
        (p) => p.metric === 'fastest_response'
      )
      expect(fastestAgent?.agentId).toBe('agent-2')
      expect(fastestAgent?.value).toBe(120000)

      const mostChatsAgent = result.agentPerformance.topPerformers.find(
        (p) => p.metric === 'most_chats'
      )
      expect(mostChatsAgent?.agentId).toBe('agent-2')
      expect(mostChatsAgent?.value).toBe(100)
    })

    it('should aggregate operational insights from KPIs', () => {
      const kpis: Partial<AnalysisKPI>[] = [
        {
          metricType: 'PEAK_TIME',
          metricName: 'messages_by_hour',
          jsonValue: { '9': 100, '10': 150, '11': 120 },
          category: 'operational',
        },
        {
          metricType: 'PEAK_TIME',
          metricName: 'messages_by_day',
          jsonValue: { Mon: 200, Tue: 180, Wed: 220 },
          category: 'operational',
        },
        {
          metricType: 'CHANNEL_USAGE',
          metricName: 'channel_distribution',
          jsonValue: { text: 500, voice: 100, media: 50 },
          category: 'operational',
        },
      ]

      const result = aggregateAnalysisResults([], kpis as AnalysisKPI[])

      expect(result.operationalInsights.peakTimes.byHour).toEqual({
        '9': 100,
        '10': 150,
        '11': 120,
      })

      expect(result.operationalInsights.peakTimes.byDayOfWeek).toEqual({
        Mon: 200,
        Tue: 180,
        Wed: 220,
      })

      expect(result.operationalInsights.channelDistribution).toEqual({
        text: 500,
        voice: 100,
        media: 50,
      })
    })

    it('should handle empty categorizations gracefully', () => {
      const result = aggregateAnalysisResults([], [])

      expect(result.customerInsights.intentDistribution.PROJECT_INFO).toBe(0)
      expect(result.customerInsights.journeyStageDistribution.PROSPECT).toBe(0)
      expect(result.customerInsights.sentimentDistribution.POSITIVE).toBe(0)
    })

    it('should handle missing agent IDs in KPIs', () => {
      const kpis: Partial<AnalysisKPI>[] = [
        {
          agentId: null,
          metricType: 'VOLUME',
          metricName: 'total_chats',
          numericValue: 100,
        },
      ]

      const result = aggregateAnalysisResults([], kpis as AnalysisKPI[])

      // Should not crash and should have empty agent performance
      expect(result.agentPerformance.byAgent).toHaveLength(0)
    })
  })
})
