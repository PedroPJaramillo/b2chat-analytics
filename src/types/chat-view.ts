// Chat View Types for Agent Performance QA (Feature 008)
// Extended by Feature 011: Enhanced Filters, Sorting, and Column Management

import type { ChatStatus, ChatPriority, ChatProvider } from './chat'

/**
 * Response time indicator for visual classification
 */
export type ResponseTimeIndicator = 'fast' | 'good' | 'slow'

/**
 * Filters for chat view list
 * Extended by Feature 011 with comprehensive filtering options
 */
export interface ChatViewFilters {
  status?: ChatStatus[]
  agentId?: string
  responseTimeMin?: number  // milliseconds
  responseTimeMax?: number  // milliseconds
  search?: string  // contact name search
  // Feature 011: New filters
  departmentId?: string
  priorityFilter?: ChatPriority[]
  slaStatus?: 'all' | 'within' | 'breached'
  providerFilter?: ChatProvider[]
  messageCountRange?: '0' | '1-5' | '6-10' | '11-20' | '20+'
  createdAtRange?: { start: Date; end: Date }
  updatedAtRange?: { start: Date; end: Date }
}

/**
 * Chat item with response time metrics for table view
 * Extended by Feature 011 with additional columns
 */
export interface ChatViewItem {
  id: string
  b2chatId: string
  contactName: string
  contactId: string
  agentName: string | null
  agentId: string | null
  status: ChatStatus
  messageCount: number
  firstResponseTimeMs: number | null
  firstResponseTimeFormatted: string | null
  responseTimeIndicator: ResponseTimeIndicator | null
  lastModifiedAt: string
  updatedAt: string
  // Feature 011: New columns
  departmentName: string | null
  departmentId: string | null
  priority: ChatPriority
  slaStatus: 'within' | 'breached' | 'incomplete'
  createdAt: string
  provider: ChatProvider
  tags: string[]
  topic: string | null
  unreadCount: number
  openedAt: string | null
  pickedUpAt: string | null
  responseAt: string | null
  closedAt: string | null
  pickupTimeMs: number | null
  resolutionTimeMs: number | null
  avgResponseTimeMs: number | null
  direction: 'inbound' | 'outbound' | null

  // SLA Tooltips: Wall Clock SLA Compliance Flags
  pickupSLA?: boolean | null
  firstResponseSLA?: boolean | null
  avgResponseSLA?: boolean | null
  resolutionSLA?: boolean | null
  overallSLA?: boolean | null

  // SLA Tooltips: Business Hours Time Metrics (milliseconds)
  pickupTimeBHMs?: number | null
  firstResponseTimeBHMs?: number | null
  avgResponseTimeBHMs?: number | null
  resolutionTimeBHMs?: number | null

  // SLA Tooltips: Business Hours SLA Compliance Flags
  pickupSLABH?: boolean | null
  firstResponseSLABH?: boolean | null
  avgResponseSLABH?: boolean | null
  resolutionSLABH?: boolean | null
  overallSLABH?: boolean | null
}

/**
 * Pagination metadata for chat view
 */
export interface ChatViewPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

/**
 * Chat view API response
 */
export interface ChatViewResponse {
  chats: ChatViewItem[]
  pagination: ChatViewPagination
}

/**
 * Sorting options for chat view
 * Extended by Feature 011 to support all columns
 */
export interface ChatViewSorting {
  sortBy:
    | 'responseTime'
    | 'updatedAt'
    | 'createdAt'
    | 'messageCount'
    | 'status'
    | 'priority'
    | 'departmentName'
    | 'agentName'
    | 'contactName'
    | 'slaStatus'
  sortOrder: 'asc' | 'desc'
}

/**
 * Aggregated statistics for filter dropdowns
 * Feature 011: Used to display counts in filter options
 */
export interface ChatViewStats {
  byStatus: Record<ChatStatus, number>
  byDepartment: Record<string, { name: string; count: number }>
  byAgent: {
    unassigned: number
    [agentId: string]: number | { name: string; count: number }
  }
  byPriority: Record<ChatPriority, number>
  bySLA: { within: number; breached: number }
  byProvider: Record<ChatProvider, number>
  byMessageCount: {
    '0': number
    '1-5': number
    '6-10': number
    '11-20': number
    '20+': number
  }
}

/**
 * Column visibility preferences
 * Feature 011: Persisted in localStorage
 */
export interface ColumnVisibilityState {
  id: boolean
  contactName: boolean
  status: boolean
  agentName: boolean
  responseTime: boolean
  updatedAt: boolean
  departmentName: boolean
  priority: boolean
  slaStatus: boolean
  createdAt: boolean
  provider: boolean
  tags: boolean
  topic: boolean
  unreadCount: boolean
  messageCount: boolean
  openedAt: boolean
  pickedUpAt: boolean
  responseAt: boolean
  closedAt: boolean
  pickupTime: boolean
  resolutionTime: boolean
  avgResponseTime: boolean
  direction: boolean
}

/**
 * Default column visibility
 * Feature 011: Shows essential columns by default
 */
export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibilityState = {
  id: true,
  contactName: true,
  status: true,
  agentName: true,
  responseTime: true,
  updatedAt: true,
  departmentName: true,
  priority: true,
  slaStatus: true,
  createdAt: true,
  provider: false,
  tags: false,
  topic: false,
  unreadCount: false,
  messageCount: false,
  openedAt: false,
  pickedUpAt: false,
  responseAt: false,
  closedAt: false,
  pickupTime: false,
  resolutionTime: false,
  avgResponseTime: false,
  direction: false,
}
