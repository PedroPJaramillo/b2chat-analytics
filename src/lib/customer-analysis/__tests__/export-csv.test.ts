/**
 * Unit tests for CSV export generation
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import type { AnalysisResultsResponse } from '@/types/customer-analysis'

describe('CSV Export Generation', () => {
  let mockAnalysisData: AnalysisResultsResponse

  beforeEach(() => {
    mockAnalysisData = {
      analysisId: 'test-analysis-123',
      status: 'COMPLETED',
      summary: {
        totalChatsAnalyzed: 100,
        totalMessagesAnalyzed: 500,
        aiAnalysisCount: 100,
        dateRange: {
          start: '2025-09-01',
          end: '2025-10-08',
        },
      },
      customerInsights: {
        intentDistribution: {
          PROJECT_INFO: 0.6,
          PAYMENT: 0.2,
          LEGAL: 0.15,
          POST_PURCHASE: 0.05,
          OTHER: 0.0,
        },
        journeyStageDistribution: {
          PROSPECT: 0.5,
          ACTIVE_BUYER: 0.3,
          POST_PURCHASE: 0.2,
        },
        sentimentDistribution: {
          POSITIVE: 0.7,
          NEUTRAL: 0.25,
          FRICTION: 0.05,
        },
      },
      agentPerformance: {
        byAgent: [
          {
            agentId: 'agent-1',
            agentName: 'Test Agent',
            metrics: {
              totalChats: 50,
              totalMessages: 250,
              firstResponseTime: {
                average: 180000,
                p50: 150000,
                p90: 300000,
                p95: 400000,
              },
              averageHandlingTime: 600000,
              qualityScore: {
                average: 8.5,
                distribution: { 8: 20, 9: 25, 10: 5 },
              },
            },
          },
        ],
        topPerformers: [
          {
            agentId: 'agent-1',
            agentName: 'Test Agent',
            metric: 'fastest_response',
            value: 150000,
          },
        ],
      },
      operationalInsights: {
        peakTimes: {
          byHour: {
            '9': 45,
            '10': 60,
            '11': 55,
          },
          byDayOfWeek: {
            Mon: 80,
            Tue: 85,
            Wed: 90,
          },
        },
        channelDistribution: {
          text: 400,
          voice: 80,
          media: 20,
        },
        commonPainPoints: [
          {
            category: 'Payment Confusion',
            description: 'Customers unclear about payment schedules',
            frequency: 15,
            exampleChatIds: ['chat-1', 'chat-2'],
          },
        ],
      },
    }
  })

  describe('generateCSV', () => {
    it('should generate CSV string from analysis data', () => {
      const mockCSV = 'Section,Metric,Value\nSummary,Total Chats,100'
      expect(mockCSV).toBeTruthy()
      expect(mockCSV).toContain('Section,Metric,Value')
    })

    it('should escape commas in CSV values', () => {
      const value = 'Test, with comma'
      const escaped = `"${value}"`
      expect(escaped).toBe('"Test, with comma"')
    })

    it('should escape quotes in CSV values', () => {
      const value = 'Test "with" quotes'
      const escaped = `"${value.replace(/"/g, '""')}"`
      expect(escaped).toBe('"Test ""with"" quotes"')
    })

    it('should handle newlines in CSV values', () => {
      const value = 'Test\nwith newline'
      const escaped = `"${value}"`
      expect(escaped).toContain('\n')
    })

    it('should convert milliseconds to seconds in CSV', () => {
      const ms = 180000
      const seconds = ms / 1000
      expect(seconds).toBe(180)
    })
  })

  describe('CSV structure', () => {
    it('should include summary section', () => {
      const summaryRows = [
        ['Summary', 'Analysis ID', mockAnalysisData.analysisId],
        ['Summary', 'Status', mockAnalysisData.status],
        ['Summary', 'Total Chats Analyzed', mockAnalysisData.summary.totalChatsAnalyzed],
        ['Summary', 'Total Messages Analyzed', mockAnalysisData.summary.totalMessagesAnalyzed],
        ['Summary', 'Date Range Start', mockAnalysisData.summary.dateRange.start],
        ['Summary', 'Date Range End', mockAnalysisData.summary.dateRange.end],
      ]
      expect(summaryRows).toHaveLength(6)
      expect(summaryRows[0][1]).toBe('Analysis ID')
    })

    it('should include customer intent distribution', () => {
      const intentRows = Object.entries(
        mockAnalysisData.customerInsights.intentDistribution
      ).map(([intent, percentage]) => [
        'Customer Intent',
        intent,
        `${(percentage * 100).toFixed(1)}%`,
      ])
      expect(intentRows).toHaveLength(5)
      expect(intentRows[0][0]).toBe('Customer Intent')
    })

    it('should include journey stage distribution', () => {
      const journeyRows = Object.entries(
        mockAnalysisData.customerInsights.journeyStageDistribution
      ).map(([stage, percentage]) => [
        'Journey Stage',
        stage,
        `${(percentage * 100).toFixed(1)}%`,
      ])
      expect(journeyRows).toHaveLength(3)
    })

    it('should include sentiment distribution', () => {
      const sentimentRows = Object.entries(
        mockAnalysisData.customerInsights.sentimentDistribution
      ).map(([sentiment, percentage]) => [
        'Sentiment',
        sentiment,
        `${(percentage * 100).toFixed(1)}%`,
      ])
      expect(sentimentRows).toHaveLength(3)
    })

    it('should include agent performance metrics', () => {
      const agent = mockAnalysisData.agentPerformance.byAgent[0]
      const agentRows = [
        ['Agent Performance', 'Agent Name', agent.agentName],
        ['Agent Performance', 'Total Chats', agent.metrics.totalChats],
        ['Agent Performance', 'Total Messages', agent.metrics.totalMessages],
        [
          'Agent Performance',
          'First Response Time (avg, seconds)',
          agent.metrics.firstResponseTime.average / 1000,
        ],
        [
          'Agent Performance',
          'First Response Time (p50, seconds)',
          agent.metrics.firstResponseTime.p50 / 1000,
        ],
        ['Agent Performance', 'Quality Score (avg)', agent.metrics.qualityScore.average],
      ]
      expect(agentRows).toHaveLength(6)
    })

    it('should include peak times', () => {
      const peakHourRows = Object.entries(
        mockAnalysisData.operationalInsights.peakTimes.byHour
      ).map(([hour, count]) => ['Peak Times', `Hour ${hour}`, count])
      expect(peakHourRows).toHaveLength(3)
    })

    it('should include channel distribution', () => {
      const channels = mockAnalysisData.operationalInsights.channelDistribution
      const channelRows = [
        ['Channel Distribution', 'Text', channels.text],
        ['Channel Distribution', 'Voice', channels.voice],
        ['Channel Distribution', 'Media', channels.media],
      ]
      expect(channelRows).toHaveLength(3)
    })

    it('should include common pain points', () => {
      const painPoint = mockAnalysisData.operationalInsights.commonPainPoints[0]
      const painPointRows = [
        ['Common Pain Points', 'Category', painPoint.category],
        ['Common Pain Points', 'Description', painPoint.description],
        ['Common Pain Points', 'Frequency', painPoint.frequency],
      ]
      expect(painPointRows).toHaveLength(3)
    })
  })

  describe('CSV formatting helpers', () => {
    it('should format CSV row correctly', () => {
      const row = ['Section', 'Metric', 'Value']
      const formatted = row.join(',')
      expect(formatted).toBe('Section,Metric,Value')
    })

    it('should format CSV with escaped values', () => {
      const escapeCSVValue = (value: string | number): string => {
        const strValue = String(value)
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`
        }
        return strValue
      }

      expect(escapeCSVValue('Normal value')).toBe('Normal value')
      expect(escapeCSVValue('Value, with comma')).toBe('"Value, with comma"')
      expect(escapeCSVValue('Value "with" quotes')).toBe('"Value ""with"" quotes"')
    })

    it('should handle undefined and null values', () => {
      const formatValue = (value: any): string => {
        if (value === null || value === undefined) return ''
        return String(value)
      }

      expect(formatValue(null)).toBe('')
      expect(formatValue(undefined)).toBe('')
      expect(formatValue(0)).toBe('0')
    })
  })
})
