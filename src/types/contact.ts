// Contact Types for Contacts List Feature (Feature 006)

export interface ContactTag {
  name: string
  assigned_at: number // Unix timestamp (seconds)
}

export interface ContactsFilters {
  search?: string
  tags?: string[]
  isVIP?: boolean
  contactType?: 'first-time' | 'repeat' | 'vip'
  merchantId?: string
  createdAfter?: Date
  createdBefore?: Date
  updatedAfter?: Date
  updatedBefore?: Date
  // Chat-based filters (Feature 010)
  chatStatus?: string[]  // Filter contacts by their chat statuses
  chatDateFrom?: string  // Filter contacts by chat creation date (ISO string)
  chatDateTo?: string    // Filter contacts by chat creation date (ISO string)
}

export interface ContactsSorting {
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export interface ContactWithStats {
  id: string
  b2chatId: string
  fullName: string
  email: string | null
  mobile: string | null
  phoneNumber: string | null
  company: string | null
  tags: ContactTag[] | null
  merchantId: string | null
  customAttributes: Record<string, any> | null
  createdAt: string
  updatedAt: string
  // Aggregated fields
  chatCount: number
  lastContactDate: string | null
  isVIP: boolean
}

export interface ContactsPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ContactsResponse {
  contacts: ContactWithStats[]
  pagination: ContactsPagination
}

// Contact History Types (Feature 010)

export interface MessagePreview {
  id: string
  text: string | null
  incoming: boolean
  timestamp: string
}

export type ResponseTimeIndicator = 'fast' | 'good' | 'slow'

export interface ContactHistoryChat {
  id: string
  b2chatId: string
  status: string
  alias: string | null
  tags: string[]
  priority: string
  topic: string
  agent: string
  agentId: string | null
  messages: number
  duration: number | null
  createdAt: string
  closedAt: string | null
  lastModifiedAt: string
  // Enhanced fields (Feature 010)
  messagePreview: MessagePreview[]
  firstResponseTimeMs: number | null
  avgResponseTimeMs: number | null
  responseTimeIndicator: ResponseTimeIndicator | null
}

export interface ContactHistoryFilters {
  status?: string[]
  agentId?: string
  tags?: string[]
  dateFrom?: string
  dateTo?: string
  sortBy?: 'createdAt' | 'responseTime' | 'messageCount' | 'duration'
  sortOrder?: 'asc' | 'desc'
}
