// Chat Management System Type Definitions

export type ViewMode = 'contact' | 'active' | 'messages'

export type ChatPriority = 'urgent' | 'high' | 'normal' | 'low'

/**
 * Chat Status - Feature 001: Full 8-status lifecycle support
 *
 * Full lifecycle:
 * - BOT_CHATTING: Chat being handled by bot (before human agent)
 * - OPENED: Available for agent pickup (not yet assigned)
 * - PICKED_UP: Agent has accepted and is handling the chat
 * - RESPONDED_BY_AGENT: Agent has sent first response
 * - CLOSED: Chat completed (no survey)
 * - COMPLETING_POLL: Awaiting customer satisfaction survey response
 * - COMPLETED_POLL: Customer completed satisfaction survey
 * - ABANDONED_POLL: Customer did not complete survey within timeout
 *
 * Legacy statuses (backward compatibility):
 * - open, closed, pending
 */
export type ChatStatus =
  | 'BOT_CHATTING'
  | 'OPENED'
  | 'PICKED_UP'
  | 'RESPONDED_BY_AGENT'
  | 'CLOSED'
  | 'COMPLETING_POLL'
  | 'COMPLETED_POLL'
  | 'ABANDONED_POLL'
  | 'open'
  | 'closed'
  | 'pending'

export type ChatProvider = 'whatsapp' | 'facebook' | 'telegram' | 'livechat' | 'b2cbotapi'

export interface Chat {
  id: string
  b2chatId: string
  customer: string
  contactId: string | null
  agent: string | null
  agentId: string | null
  status: ChatStatus
  alias: string | null
  tags: string[]
  priority: ChatPriority
  topic: string | null
  messages: number
  unreadCount: number
  resolutionNote: string | null
  startTime: string
  lastMessage: string
  createdAt: string
  updatedAt: string
  provider: ChatProvider
  // Contact context fields
  contactChatCount?: number
  contactPreviousChats?: PreviousChat[]
  isRepeatCustomer?: boolean
  // VIP status from contact custom attributes
  isVIP?: boolean
  // Contact stats for analytics
  contactStats?: {
    totalChats: number
    avgResolutionTimeMinutes: number
    satisfactionScore?: number
  }
  // Contact info for display
  contactEmail?: string | null
  contactPhone?: string | null
}

export interface PreviousChat {
  id: string
  b2chatId: string
  topic: string | null
  status: ChatStatus
  priority: ChatPriority
  createdAt: string
  closedAt: string | null
  messageCount: number
  resolutionNote: string | null
  tags: string[]
}

export interface Message {
  id: string
  chatId: string
  text: string | null
  type: 'text' | 'image' | 'file'
  incoming: boolean
  timestamp: string
  // Enriched fields for Messages View
  customer?: string
  customerEmail?: string
  sender?: string
  senderIsAgent?: boolean
  chatTopic?: string | null
  chatPriority?: ChatPriority
  chatStatus?: ChatStatus
}

export interface ContactInfo {
  id: string
  name: string
  email: string | null
  mobile: string | null
  phone: string | null
  company: string | null
  customAttributes?: Record<string, any>
  isVIP?: boolean
  // Feature 002: Contact tags from B2Chat
  tags?: Array<{ name: string; assigned_at: number }> | null
  merchantId?: string | null
}

export interface ContactHistory {
  contact: ContactInfo
  stats: {
    totalChats: number
    openChats: number
    pendingChats: number
    closedChats: number
    avgResolutionTime: number // in minutes
    mostContactedAgent?: {
      name: string
      count: number
    }
    commonTags: string[]
  }
  chats: Chat[]
}

export interface ChatStats {
  totalChats: number
  openChats: number
  pendingChats: number
  closedChats: number
  urgentChats: number
  unassignedChats: number
  vipCustomers: number
  avgResolutionTime: number
  commonTags: string[]
}
