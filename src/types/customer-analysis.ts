/**
 * Customer Analysis Domain Types
 *
 * Type definitions for the Customer Service Analysis Dashboard feature.
 * These types extend the Prisma-generated types and provide additional
 * domain-specific interfaces for API requests/responses.
 */

import {
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
} from '@prisma/client'

// Re-export Prisma enums for convenience
export {
  AnalysisStatus,
  CustomerIntent,
  JourneyStage,
  Sentiment,
  MetricType,
  ExportFormat,
}

// Re-export Prisma models
export type {
  CustomerAnalysis,
  CustomerCategorization,
  AnalysisKPI,
  AnalysisExport,
}

// ============================================================================
// Filter Types
// ============================================================================

export interface AnalysisFilters {
  dateStart: string // ISO 8601 date
  dateEnd: string // ISO 8601 date
  agentIds?: string[]
  departmentIds?: string[]
  contactIds?: string[]
}

export interface AnalysisFilterOptions {
  agents: Array<{
    id: string
    name: string
    departmentId: string
    departmentName: string
  }>
  departments: Array<{
    id: string
    name: string
  }>
  dateRangeLimits: {
    earliestChatDate: string
    latestChatDate: string
    maxRangeDays: number
  }
}

// ============================================================================
// Analysis Request/Response Types
// ============================================================================

export interface TriggerAnalysisRequest {
  filters: AnalysisFilters
}

export interface TriggerAnalysisResponse {
  analysisId: string
  status: 'PENDING'
  estimatedProcessingTime: number
  message: string
}

export interface AnalysisStatusResponse {
  id: string
  status: AnalysisStatus
  progress?: {
    chatsProcessed: number
    totalChats: number
    percentComplete: number
  }
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  totalChatsAnalyzed?: number
  totalMessagesAnalyzed?: number
  aiAnalysisCount?: number
  processingTimeMs?: number
  filters: {
    dateStart: string
    dateEnd: string
    agentIds?: string[]
    departmentIds?: string[]
  }
}

// ============================================================================
// Analysis Results Types
// ============================================================================

export interface AnalysisResultsSummary {
  totalChatsAnalyzed: number
  totalMessagesAnalyzed: number
  aiAnalysisCount: number
  dateRange: {
    start: string
    end: string
  }
}

export interface CustomerInsights {
  intentDistribution: Record<CustomerIntent, number>
  journeyStageDistribution: Record<JourneyStage, number>
  sentimentDistribution: Record<Sentiment, number>
}

export interface AgentMetrics {
  totalChats: number
  totalMessages: number
  firstResponseTime: {
    average: number
    p50: number
    p90: number
    p95: number
  }
  averageHandlingTime: number
  qualityScore: {
    average: number
    distribution: Record<number, number>
  }
}

export interface AgentPerformance {
  byAgent: Array<{
    agentId: string
    agentName: string
    metrics: AgentMetrics
  }>
  topPerformers: Array<{
    agentId: string
    agentName: string
    metric: 'fastest_response' | 'highest_quality' | 'most_chats'
    value: number
  }>
}

export interface OperationalInsights {
  peakTimes: {
    byHour: Record<string, number>
    byDayOfWeek: Record<string, number>
  }
  channelDistribution: {
    text: number
    voice: number
    media: number
  }
  commonPainPoints: Array<{
    category: string
    description: string
    frequency: number
    exampleChatIds: string[]
  }>
}

export interface AnalysisResultsResponse {
  analysisId: string
  status: 'COMPLETED' | 'PARTIAL'
  summary: AnalysisResultsSummary
  customerInsights: CustomerInsights
  agentPerformance: AgentPerformance
  operationalInsights: OperationalInsights
}

// ============================================================================
// Export Types
// ============================================================================

export interface ExportAnalysisRequest {
  format: ExportFormat
  options?: {
    includeSections?: Array<
      'customer_insights' | 'agent_performance' | 'operational_insights'
    >
    anonymizeCustomers?: boolean
  }
}

export interface ExportAnalysisResponse {
  exportId: string
  format: ExportFormat
  fileName: string
  downloadUrl: string
  expiresAt: string
  fileSizeBytes: number
}

// ============================================================================
// Analysis History Types
// ============================================================================

export interface AnalysisHistoryItem {
  id: string
  createdAt: string
  status: AnalysisStatus
  filters: {
    dateStart: string
    dateEnd: string
    agentIds?: string[]
    departmentIds?: string[]
  }
  summary: {
    totalChatsAnalyzed: number
    totalMessagesAnalyzed: number
  }
}

export interface AnalysisHistoryResponse {
  analyses: AnalysisHistoryItem[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

// ============================================================================
// Worker Types (Internal)
// ============================================================================

export interface AnalysisWorkerRequest {
  analysisId: string
}

export interface ClaudeAnalysisPrompt {
  conversations: Array<{
    conversationIndex: number // Array index for reliable mapping
    chatId: string // For Claude's reference only
    messages: Array<{
      sender: string
      content: string
      timestamp: string
    }>
  }>
  analysisRequest: {
    categorizeIntent: boolean
    identifyJourneyStage: boolean
    assessSentiment: boolean
    evaluateAgentQuality: boolean
  }
}

export interface ClaudeAnalysisResponse {
  conversations: Array<{
    conversationIndex: number // Primary mapping key
    chatId?: string // Optional: For debugging/validation only
    customerIntent: CustomerIntent
    journeyStage: JourneyStage
    sentiment: Sentiment
    agentQualityScore: number
    reasoningNotes: string
  }>
}

// ============================================================================
// Metric Calculation Types
// ============================================================================

export interface ResponseTimeMetrics {
  firstResponseTime: {
    average: number
    p50: number
    p90: number
    p95: number
  }
  averageHandlingTime: number
  responseTimesByHour: Record<string, number>
}

export interface VolumeMetrics {
  totalChats: number
  totalMessages: number
  messagesByAgent: Record<string, number>
  messagesByHour: Record<string, number>
  channelDistribution: {
    text: number
    voice: number
    media: number
  }
}

export interface PeakTimeMetrics {
  byHour: Record<string, number>
  byDayOfWeek: Record<string, number>
  concurrentChatsByAgent: Record<string, number>
}

// ============================================================================
// Error Types
// ============================================================================

export interface AnalysisErrorResponse {
  error: {
    code: string
    message: string
    details?: unknown
    timestamp: string
  }
}

export type AnalysisErrorCode =
  | 'INVALID_DATE_RANGE'
  | 'MISSING_REQUIRED_FIELDS'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN_ROLE'
  | 'FORBIDDEN_DEPARTMENT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'ANALYSIS_NOT_FOUND'
  | 'ANALYSIS_NOT_COMPLETED'
  | 'INVALID_FORMAT'
  | 'EXPORT_GENERATION_FAILED'

// ============================================================================
// Database Query Types
// ============================================================================

export interface CreateAnalysisData {
  triggeredBy: string
  filters: AnalysisFilters
}

export interface UpdateAnalysisStatusData {
  status: AnalysisStatus
  startedAt?: Date
  completedAt?: Date
  errorMessage?: string
  processingTimeMs?: number
  totalChatsAnalyzed?: number
  totalMessagesAnalyzed?: number
  aiAnalysisCount?: number
}

export interface CreateCategorizationData {
  analysisId: string
  chatId: string
  customerIntent?: CustomerIntent
  journeyStage?: JourneyStage
  sentiment?: Sentiment
  agentQualityScore?: number
  reasoningNotes?: string
  confidenceScore?: number
}

export interface CreateKPIData {
  analysisId: string
  metricType: MetricType
  metricName: string
  numericValue?: number
  stringValue?: string
  jsonValue?: unknown
  agentId?: string
  departmentId?: string
  category?: string
}

export interface CreateExportData {
  analysisId: string
  format: ExportFormat
  fileName: string
  blobUrl?: string
  blobKey?: string
  generatedBy: string
  fileSizeBytes?: number
  expiresAt?: Date
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface AnalysisFiltersProps {
  onSubmit: (filters: AnalysisFilters) => void
  isLoading?: boolean
  filterOptions: AnalysisFilterOptions
}

export interface AnalysisResultsProps {
  analysisId: string
  results: AnalysisResultsResponse
  onExport: (format: ExportFormat) => void
}

export interface CustomerInsightsViewProps {
  insights: CustomerInsights
}

export interface AgentPerformanceViewProps {
  performance: AgentPerformance
}

export interface OperationalInsightsViewProps {
  insights: OperationalInsights
}

export interface ExportButtonProps {
  analysisId: string
  onExport: (format: ExportFormat) => Promise<void>
  isLoading?: boolean
}

// ============================================================================
// Hook Return Types
// ============================================================================

export interface UseAnalysisListResult {
  analyses: AnalysisHistoryItem[]
  isLoading: boolean
  error: Error | null
  pagination: {
    total: number
    limit: number
    offset: number
  }
  loadMore: () => void
  refetch: () => void
}

export interface UseAnalysisStatusResult {
  status: AnalysisStatusResponse | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export interface UseAnalysisResultsResult {
  results: AnalysisResultsResponse | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export interface UseTriggerAnalysisResult {
  trigger: (filters: AnalysisFilters) => Promise<TriggerAnalysisResponse>
  isLoading: boolean
  error: Error | null
}

export interface UseExportAnalysisResult {
  exportAnalysis: (
    analysisId: string,
    request: ExportAnalysisRequest
  ) => Promise<ExportAnalysisResponse>
  isLoading: boolean
  error: Error | null
}
