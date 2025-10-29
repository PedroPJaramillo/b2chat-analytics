// Filter Type Definitions for Chat Management

import { ChatPriority, ChatStatus, ChatProvider } from './chat'

export type ContactType = 'all' | 'repeat' | 'first-time' | 'vip'
export type MessageType = 'all' | 'unread' | 'customer' | 'agent'
export type DateRange = 'all' | 'today' | 'last7days' | 'last30days'
export type SortBy = 'lastActivity' | 'priority' | 'messageCount' | 'responseTime'
export type SortOrder = 'asc' | 'desc'
export type OfficeHoursFilter = 'all' | 'office-hours' | 'non-office-hours'

export interface ChatFilters {
  // Common filters across all views
  status?: ChatStatus | 'all'
  priority?: ChatPriority | 'all'
  agent?: string | 'all' | 'unassigned'
  channel?: ChatProvider | 'all'
  tags?: string[]
  dateRange?: DateRange
  search?: string

  // Contact View specific
  contactType?: ContactType
  contactId?: string
  includeContactContext?: boolean

  // Messages View specific
  messageType?: MessageType

  // Display options
  unreadOnly?: boolean

  // Sorting
  sortBy?: SortBy
  sortOrder?: SortOrder

  // Pagination
  page?: number
  limit?: number

  // Temporal filters for drill-down from analytics
  weekStart?: string // ISO date: "2025-10-13" for filtering by week
  dayOfWeek?: number // 0-6 (Sunday-Saturday) for filtering by specific day of week
  hourOfDay?: number // 0-23 for filtering by specific hour

  // Custom date range for drill-down (takes precedence over dateRange)
  customDateRange?: {
    start: string // ISO datetime
    end: string // ISO datetime
  }
}

export interface FilterOptions {
  statuses: Array<{ value: ChatStatus | 'all'; label: string }>
  priorities: Array<{ value: ChatPriority | 'all'; label: string }>
  agents: Array<{ value: string; label: string }>
  channels: Array<{ value: ChatProvider | 'all'; label: string }>
  availableTags: string[]
  contactTypes: Array<{ value: ContactType; label: string }>
  messageTypes: Array<{ value: MessageType; label: string }>
  dateRanges: Array<{ value: DateRange; label: string }>
  sortOptions: Array<{ value: SortBy; label: string }>
}

// Default filter values
export const DEFAULT_FILTERS: ChatFilters = {
  status: 'all',
  priority: 'all',
  agent: 'all',
  channel: 'all',
  tags: [],
  dateRange: 'all',
  search: '',
  contactType: 'all',
  messageType: 'all',
  unreadOnly: false,
  sortBy: 'lastActivity',
  sortOrder: 'desc',
  page: 1,
  limit: 20,
}

// Filter option constants
export const STATUS_OPTIONS: FilterOptions['statuses'] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'closed', label: 'Closed' },
]

export const PRIORITY_OPTIONS: FilterOptions['priorities'] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
]

export const CHANNEL_OPTIONS: FilterOptions['channels'] = [
  { value: 'all', label: 'All Channels' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'livechat', label: 'Live Chat' },
  { value: 'b2cbotapi', label: 'Bot API' },
]

export const CONTACT_TYPE_OPTIONS: FilterOptions['contactTypes'] = [
  { value: 'all', label: 'All Contacts' },
  { value: 'repeat', label: 'Repeat Customers' },
  { value: 'first-time', label: 'First-Time' },
  { value: 'vip', label: 'VIP Only' },
]

export const MESSAGE_TYPE_OPTIONS: FilterOptions['messageTypes'] = [
  { value: 'all', label: 'All Messages' },
  { value: 'unread', label: 'Unread Only' },
  { value: 'customer', label: 'Customer Messages' },
  { value: 'agent', label: 'Agent Messages' },
]

export const DATE_RANGE_OPTIONS: FilterOptions['dateRanges'] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
]

export const SORT_OPTIONS: FilterOptions['sortOptions'] = [
  { value: 'lastActivity', label: 'Last Activity' },
  { value: 'priority', label: 'Priority' },
  { value: 'messageCount', label: 'Message Count' },
  { value: 'responseTime', label: 'Response Time' },
]

export const OFFICE_HOURS_FILTER_OPTIONS = [
  { value: 'all' as const, label: 'All Hours' },
  { value: 'office-hours' as const, label: 'Office Hours Only' },
  { value: 'non-office-hours' as const, label: 'Non-Office Hours Only' },
]

// Chat direction filter for analytics
export type ChatDirectionFilter = 'all' | 'incoming' | 'outgoing' | 'outgoing_broadcast' | 'outgoing_all' | 'converted'

export const CHAT_DIRECTION_FILTER_OPTIONS = [
  { value: 'all' as ChatDirectionFilter, label: 'All Chats', description: 'All conversations regardless of direction' },
  { value: 'incoming' as ChatDirectionFilter, label: 'Incoming Only', description: 'Customer-initiated support chats' },
  { value: 'outgoing_all' as ChatDirectionFilter, label: 'Outgoing (All)', description: 'All agent-initiated conversations' },
  { value: 'outgoing' as ChatDirectionFilter, label: 'Outgoing 1-to-1', description: 'Agent-initiated 1-to-1 conversations' },
  { value: 'outgoing_broadcast' as ChatDirectionFilter, label: 'Broadcast Campaigns', description: 'Mass broadcast messages' },
  { value: 'converted' as ChatDirectionFilter, label: 'Converted', description: 'Outgoing chats that became support conversations' },
]
