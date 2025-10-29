/**
 * Integration tests for CSV export functionality
 */

import { describe, it, expect } from '@jest/globals'
import { generateCSV, generateCSVFilename, csvToBuffer } from '../export-csv'
import type { AnalysisResultsResponse } from '@/types/customer-analysis'

describe('CSV Export Integration Tests', () => {
  const mockAnalysisData: AnalysisResultsResponse = {
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

  describe('CSV Generation', () => {
    it('should generate CSV string', () => {
      const csv = generateCSV(mockAnalysisData)
      expect(csv).toBeTruthy()
      expect(csv).toContain('Section,Metric,Value,Unit')
      expect(csv).toContain('Summary')
      expect(csv).toContain('Customer Intent')
      expect(csv).toContain('Agent Performance')
    })

    it('should include all data sections', () => {
      const csv = generateCSV(mockAnalysisData)
      expect(csv).toContain('Journey Stage')
      expect(csv).toContain('Sentiment')
      expect(csv).toContain('Peak Times')
      expect(csv).toContain('Channel Distribution')
      expect(csv).toContain('Common Pain Points')
    })

    it('should generate valid filename', () => {
      const filename = generateCSVFilename('test-analysis-123')
      expect(filename).toContain('customer-analysis-')
      expect(filename).toContain('test-ana') // First 8 chars of ID
      expect(filename).toMatch(/\.csv$/)
    })

    it('should convert CSV to buffer', () => {
      const csv = generateCSV(mockAnalysisData)
      const buffer = csvToBuffer(csv)
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
      expect(buffer.toString('utf-8')).toBe(csv)
    })
  })

  describe('Data Completeness', () => {
    it('CSV should include all summary fields', () => {
      const csv = generateCSV(mockAnalysisData)
      expect(csv).toContain('test-analysis-123')
      expect(csv).toContain('100') // total chats
      expect(csv).toContain('500') // total messages
      expect(csv).toContain('2025-09-01')
      expect(csv).toContain('2025-10-08')
    })

    it('CSV should include all intent categories', () => {
      const csv = generateCSV(mockAnalysisData)
      expect(csv).toContain('PROJECT_INFO')
      expect(csv).toContain('PAYMENT')
      expect(csv).toContain('LEGAL')
      expect(csv).toContain('POST_PURCHASE')
      expect(csv).toContain('OTHER')
    })

    it('CSV should include agent metrics', () => {
      const csv = generateCSV(mockAnalysisData)
      expect(csv).toContain('Test Agent')
      expect(csv).toContain('50') // total chats
      expect(csv).toContain('250') // total messages
      expect(csv).toContain('8.5') // quality score
    })

    it('CSV should properly format peak times', () => {
      const csv = generateCSV(mockAnalysisData)
      expect(csv).toContain('9:00')
      expect(csv).toContain('10:00')
      expect(csv).toContain('11:00')
      expect(csv).toContain('Mon')
      expect(csv).toContain('Tue')
      expect(csv).toContain('Wed')
    })

    it('CSV should include pain points', () => {
      const csv = generateCSV(mockAnalysisData)
      expect(csv).toContain('Payment Confusion')
      expect(csv).toContain('Customers unclear about payment schedules')
      expect(csv).toContain('15') // frequency
    })
  })

  describe('CSV Formatting', () => {
    it('should have proper CSV structure', () => {
      const csv = generateCSV(mockAnalysisData)
      const lines = csv.split('\n')

      // Should have header
      expect(lines[0]).toBe('Section,Metric,Value,Unit')

      // Should have multiple lines
      expect(lines.length).toBeGreaterThan(10)
    })

    it('should handle percentages correctly', () => {
      const csv = generateCSV(mockAnalysisData)
      expect(csv).toContain('60.0%') // PROJECT_INFO
      expect(csv).toContain('20.0%') // PAYMENT
      expect(csv).toContain('70.0%') // POSITIVE sentiment
    })

    it('should convert time values to seconds', () => {
      const csv = generateCSV(mockAnalysisData)
      expect(csv).toContain('180 seconds') // 180000ms = 180s
      expect(csv).toContain('150 seconds') // 150000ms = 150s
    })
  })
})
