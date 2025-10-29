/**
 * Type verification tests for customer analysis
 * These tests verify that Prisma generated the correct types and our custom types work
 */

import { describe, it, expect } from '@jest/globals'
import type {
  CustomerAnalysis,
  CustomerCategorization,
  AnalysisKPI,
  AnalysisExport,
  AnalysisStatus,
  CustomerIntent,
  JourneyStage,
  Sentiment,
  MetricType,
  ExportFormat,
  AnalysisFilters,
  TriggerAnalysisRequest,
  AnalysisResultsResponse,
} from '@/types/customer-analysis'

describe('Customer Analysis Types', () => {
  it('should have AnalysisStatus enum values', () => {
    const statuses: AnalysisStatus[] = [
      'PENDING',
      'PROCESSING',
      'COMPLETED',
      'FAILED',
      'PARTIAL',
    ]
    expect(statuses).toHaveLength(5)
  })

  it('should have CustomerIntent enum values', () => {
    const intents: CustomerIntent[] = [
      'PROJECT_INFO',
      'PAYMENT',
      'LEGAL',
      'POST_PURCHASE',
      'OTHER',
    ]
    expect(intents).toHaveLength(5)
  })

  it('should have JourneyStage enum values', () => {
    const stages: JourneyStage[] = ['PROSPECT', 'ACTIVE_BUYER', 'POST_PURCHASE']
    expect(stages).toHaveLength(3)
  })

  it('should have Sentiment enum values', () => {
    const sentiments: Sentiment[] = ['POSITIVE', 'NEUTRAL', 'FRICTION']
    expect(sentiments).toHaveLength(3)
  })

  it('should have MetricType enum values', () => {
    const metricTypes: MetricType[] = [
      'RESPONSE_TIME',
      'VOLUME',
      'PEAK_TIME',
      'CUSTOMER_INTENT',
      'JOURNEY_STAGE',
      'SENTIMENT',
      'AGENT_QUALITY',
      'CHANNEL_USAGE',
    ]
    expect(metricTypes).toHaveLength(8)
  })

  it('should have ExportFormat enum values', () => {
    const formats: ExportFormat[] = ['PDF', 'CSV']
    expect(formats).toHaveLength(2)
  })

  it('should accept valid AnalysisFilters', () => {
    const filters: AnalysisFilters = {
      dateStart: '2025-09-01',
      dateEnd: '2025-10-08',
      agentIds: ['agent-1', 'agent-2'],
      departmentIds: ['dept-1'],
    }

    expect(filters.dateStart).toBe('2025-09-01')
    expect(filters.agentIds).toHaveLength(2)
  })

  it('should accept valid TriggerAnalysisRequest', () => {
    const request: TriggerAnalysisRequest = {
      filters: {
        dateStart: '2025-09-01',
        dateEnd: '2025-10-08',
      },
    }

    expect(request.filters.dateStart).toBe('2025-09-01')
  })

  it('should type CustomerAnalysis model correctly', () => {
    // This test verifies that the Prisma-generated type has the expected shape
    const analysis: Partial<CustomerAnalysis> = {
      id: 'test-id',
      status: 'PENDING',
      triggeredBy: 'user-id',
      filters: { dateStart: '2025-09-01', dateEnd: '2025-10-08' },
      totalChatsAnalyzed: 0,
      totalMessagesAnalyzed: 0,
      aiAnalysisCount: 0,
    }

    expect(analysis.id).toBe('test-id')
    expect(analysis.status).toBe('PENDING')
  })

  it('should type CustomerCategorization model correctly', () => {
    const categorization: Partial<CustomerCategorization> = {
      id: 'test-id',
      analysisId: 'analysis-id',
      chatId: 'chat-id',
      customerIntent: 'PROJECT_INFO',
      journeyStage: 'PROSPECT',
      sentiment: 'POSITIVE',
      agentQualityScore: 8,
    }

    expect(categorization.customerIntent).toBe('PROJECT_INFO')
    expect(categorization.journeyStage).toBe('PROSPECT')
  })

  it('should type AnalysisKPI model correctly', () => {
    const kpi: Partial<AnalysisKPI> = {
      id: 'test-id',
      analysisId: 'analysis-id',
      metricType: 'RESPONSE_TIME',
      metricName: 'first_response_p50',
      numericValue: 180000,
      category: 'performance',
    }

    expect(kpi.metricType).toBe('RESPONSE_TIME')
    expect(kpi.numericValue).toBe(180000)
  })

  it('should type AnalysisExport model correctly', () => {
    const exportRecord: Partial<AnalysisExport> = {
      id: 'test-id',
      analysisId: 'analysis-id',
      format: 'PDF',
      fileName: 'analysis-report.pdf',
      generatedBy: 'user-id',
    }

    expect(exportRecord.format).toBe('PDF')
    expect(exportRecord.fileName).toBe('analysis-report.pdf')
  })

  it('should type AnalysisResultsResponse correctly', () => {
    const results: Partial<AnalysisResultsResponse> = {
      analysisId: 'test-id',
      status: 'COMPLETED',
      summary: {
        totalChatsAnalyzed: 1234,
        totalMessagesAnalyzed: 5678,
        aiAnalysisCount: 1234,
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
          NEUTRAL: 0.2,
          FRICTION: 0.1,
        },
      },
    }

    expect(results.status).toBe('COMPLETED')
    expect(results.summary?.totalChatsAnalyzed).toBe(1234)
    expect(results.customerInsights?.intentDistribution.PROJECT_INFO).toBe(0.6)
  })
})
