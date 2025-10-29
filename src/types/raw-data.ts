// Raw Data Types for Raw Data Viewer Feature (Feature 007)

export type EntityType = 'contact' | 'chat'
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface RawDataFilters {
  search?: string
  entityType: 'contacts' | 'chats' | 'all'
  processingStatus?: ProcessingStatus
  syncId?: string
  fetchedAfter?: Date
  fetchedBefore?: Date
}

export interface RawDataSorting {
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export interface RawDataRecord {
  id: string
  entityType: EntityType
  b2chatId: string
  syncId: string
  processingStatus: ProcessingStatus
  fetchedAt: string
  processedAt: string | null
  apiPage: number
  apiOffset: number
  processingError: string | null
  processingAttempt: number
}

export interface RawDataRecordDetail extends RawDataRecord {
  rawData: any // Full JSON from B2Chat API
  extractMetadata?: {
    operation: string
    entityType: string
    recordsFetched: number
    dateRange?: { from: string; to: string }
    startedAt: string
    completedAt: string | null
  }
  transformedRecord?: any
}

export interface RawDataPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface RawDataStats {
  byStatus: {
    pending: number
    processing: number
    completed: number
    failed: number
  }
}

export interface RawDataResponse {
  records: RawDataRecord[]
  pagination: RawDataPagination
  stats?: RawDataStats
}
