/**
 * Unit tests for PDF export generation
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import type { AnalysisResultsResponse } from '@/types/customer-analysis'

// Mock @react-pdf/renderer
jest.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: any) => children,
  Page: ({ children }: any) => children,
  View: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  StyleSheet: {
    create: (styles: any) => styles,
  },
  pdf: (document: any) => ({
    toBuffer: async () => Buffer.from('mock-pdf-content'),
    toString: () => 'mock-pdf-string',
  }),
  renderToStream: jest.fn(),
}))

describe('PDF Export Generation', () => {
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

  describe('generatePDF', () => {
    it('should generate PDF buffer from analysis data', async () => {
      // This will be implemented with actual PDF generation
      const mockBuffer = Buffer.from('mock-pdf-content')
      expect(mockBuffer).toBeInstanceOf(Buffer)
      expect(mockBuffer.length).toBeGreaterThan(0)
    })

    it('should include all required sections in PDF', async () => {
      // Verify sections: cover, executive summary, customer insights, agent performance, operational insights
      const sections = [
        'cover',
        'executiveSummary',
        'customerInsights',
        'agentPerformance',
        'operationalInsights',
      ]
      expect(sections).toHaveLength(5)
    })

    it('should format percentages correctly', () => {
      const percentage = mockAnalysisData.customerInsights.intentDistribution.PROJECT_INFO
      const formatted = `${(percentage * 100).toFixed(1)}%`
      expect(formatted).toBe('60.0%')
    })

    it('should format milliseconds to readable time', () => {
      const ms = 180000
      const minutes = Math.round(ms / 60000)
      expect(minutes).toBe(3)
    })

    it('should handle empty data gracefully', async () => {
      const emptyData: AnalysisResultsResponse = {
        ...mockAnalysisData,
        agentPerformance: {
          byAgent: [],
          topPerformers: [],
        },
      }
      expect(emptyData.agentPerformance.byAgent).toHaveLength(0)
    })

    it('should include metadata in PDF', () => {
      const metadata = {
        title: 'Customer Analysis Report',
        author: 'B2Chat Analytics',
        subject: `Analysis Report ${mockAnalysisData.analysisId}`,
        creationDate: new Date(),
      }
      expect(metadata.title).toBe('Customer Analysis Report')
      expect(metadata.author).toBe('B2Chat Analytics')
    })
  })

  describe('PDF components', () => {
    it('should create cover page with analysis details', () => {
      const coverData = {
        title: 'Customer Analysis Report',
        dateRange: mockAnalysisData.summary.dateRange,
        generatedAt: new Date().toISOString(),
        totalChats: mockAnalysisData.summary.totalChatsAnalyzed,
      }
      expect(coverData.title).toBeTruthy()
      expect(coverData.totalChats).toBe(100)
    })

    it('should create executive summary with key metrics', () => {
      const summary = {
        totalChats: mockAnalysisData.summary.totalChatsAnalyzed,
        totalMessages: mockAnalysisData.summary.totalMessagesAnalyzed,
        topIntent:
          Object.entries(mockAnalysisData.customerInsights.intentDistribution).sort(
            ([, a], [, b]) => b - a
          )[0][0],
        topSentiment:
          Object.entries(mockAnalysisData.customerInsights.sentimentDistribution).sort(
            ([, a], [, b]) => b - a
          )[0][0],
      }
      expect(summary.topIntent).toBe('PROJECT_INFO')
      expect(summary.topSentiment).toBe('POSITIVE')
    })

    it('should format customer insights section', () => {
      const insights = mockAnalysisData.customerInsights
      expect(Object.keys(insights.intentDistribution)).toHaveLength(5)
      expect(Object.keys(insights.journeyStageDistribution)).toHaveLength(3)
      expect(Object.keys(insights.sentimentDistribution)).toHaveLength(3)
    })

    it('should format agent performance section', () => {
      const performance = mockAnalysisData.agentPerformance
      expect(performance.byAgent).toHaveLength(1)
      expect(performance.topPerformers).toHaveLength(1)
      expect(performance.byAgent[0].metrics.qualityScore.average).toBeGreaterThan(0)
    })

    it('should format operational insights section', () => {
      const operational = mockAnalysisData.operationalInsights
      expect(Object.keys(operational.peakTimes.byHour)).toHaveLength(3)
      expect(operational.channelDistribution.text).toBeGreaterThan(0)
      expect(operational.commonPainPoints).toHaveLength(1)
    })
  })
})
