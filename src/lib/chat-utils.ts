// Chat Management Utility Functions

import { ChatPriority, ChatStatus, ChatProvider } from '@/types/chat'
import { format, formatDistanceToNow } from 'date-fns'

/**
 * Get Tailwind CSS class for status badge (Feature 001: 8-status support)
 *
 * Status lifecycle color coding:
 * - BOT_CHATTING: Purple (bot handling)
 * - OPENED: Blue (available for pickup)
 * - PICKED_UP: Cyan (agent accepted)
 * - RESPONDED_BY_AGENT: Green (agent responded)
 * - CLOSED: Gray (completed without survey)
 * - COMPLETING_POLL: Orange (awaiting survey)
 * - COMPLETED_POLL: Emerald (survey completed)
 * - ABANDONED_POLL: Rose (survey abandoned)
 */
export function getStatusColor(status: ChatStatus): string {
  switch (status) {
    // New 8-status lifecycle (Feature 001)
    case 'BOT_CHATTING':
      return 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
    case 'OPENED':
      return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
    case 'PICKED_UP':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100'
    case 'RESPONDED_BY_AGENT':
      return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
    case 'CLOSED':
      return 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
    case 'COMPLETING_POLL':
      return 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
    case 'COMPLETED_POLL':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
    case 'ABANDONED_POLL':
      return 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'

    // Legacy statuses (backward compatibility)
    case 'open':
      return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
    case 'closed':
      return 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
    case 'pending':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'

    default:
      return 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
  }
}

/**
 * Get human-readable status label (Feature 001: 8-status support)
 */
export function getStatusLabel(status: ChatStatus): string {
  switch (status) {
    case 'BOT_CHATTING': return 'Bot Chatting'
    case 'OPENED': return 'Open'
    case 'PICKED_UP': return 'Picked Up'
    case 'RESPONDED_BY_AGENT': return 'Responded'
    case 'CLOSED': return 'Closed'
    case 'COMPLETING_POLL': return 'Survey Pending'
    case 'COMPLETED_POLL': return 'Survey Complete'
    case 'ABANDONED_POLL': return 'Survey Abandoned'
    // Legacy
    case 'open': return 'Open'
    case 'closed': return 'Closed'
    case 'pending': return 'Pending'
    default: return status
  }
}

/**
 * Get status icon (Feature 001: 8-status support)
 */
export function getStatusIcon(status: ChatStatus): string {
  switch (status) {
    case 'BOT_CHATTING': return '🤖'
    case 'OPENED': return '📥'
    case 'PICKED_UP': return '👤'
    case 'RESPONDED_BY_AGENT': return '✅'
    case 'CLOSED': return '🔒'
    case 'COMPLETING_POLL': return '📊'
    case 'COMPLETED_POLL': return '⭐'
    case 'ABANDONED_POLL': return '⏱️'
    // Legacy
    case 'open': return '✅'
    case 'closed': return '🔒'
    case 'pending': return '⏳'
    default: return '•'
  }
}

/**
 * Get Tailwind CSS class for priority badge
 */
export function getPriorityColor(priority: ChatPriority): string {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'normal':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'low':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

/**
 * Get Tailwind CSS class for priority card border and background
 */
export function getPriorityCardStyle(priority: ChatPriority): string {
  switch (priority) {
    case 'urgent':
      return 'border-l-2 border-red-500/50 bg-red-500/5'
    case 'high':
      return 'border-l-2 border-orange-500/50 bg-orange-500/5'
    case 'normal':
      return 'border-l-2 border-blue-500/40 bg-transparent'
    case 'low':
      return 'border-l-2 border-slate-300 bg-transparent'
    default:
      return 'border-l-2 border-slate-300 bg-transparent'
  }
}

/**
 * Get numeric priority value for sorting
 */
export function getPriorityValue(priority: ChatPriority): number {
  switch (priority) {
    case 'urgent': return 4
    case 'high': return 3
    case 'normal': return 2
    case 'low': return 1
    default: return 0
  }
}

/**
 * Get human-readable channel name
 */
export function getChannelName(provider: ChatProvider): string {
  switch (provider) {
    case 'whatsapp': return 'WhatsApp'
    case 'facebook': return 'Facebook'
    case 'telegram': return 'Telegram'
    case 'livechat': return 'Live Chat'
    case 'b2cbotapi': return 'Bot API'
    default: return provider
  }
}

/**
 * Format timestamp as relative time (e.g., "5 minutes ago")
 */
export function formatTimeAgo(timestamp: string | Date): string {
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    // Less than 1 minute
    if (diff < 60000) return 'Just now'

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    }

    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours} hour${hours > 1 ? 's' : ''} ago`
    }

    // More than 24 hours - use formatted date
    return format(date, 'MMM d, yyyy HH:mm')
  } catch (error) {
    console.error('Error formatting time:', error)
    return String(timestamp)
  }
}

/**
 * Format timestamp as full date
 */
export function formatDate(timestamp: string | Date): string {
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
    return format(date, 'MMM d, yyyy HH:mm')
  } catch (error) {
    console.error('Error formatting date:', error)
    return String(timestamp)
  }
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

/**
 * Format duration in minutes to human-readable string
 */
export function formatDurationMinutes(minutes: number): string {
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${Math.round(minutes)}m`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = Math.round(minutes % 60)

  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}

/**
 * Truncate text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Check if contact is VIP based on custom attributes
 * Accepts Prisma's JsonValue type (from customAttributes field)
 */
export function isVIPContact(customAttributes: unknown): boolean {
  // Type guard: ensure it's a non-null object (not array, not primitive)
  if (!customAttributes || typeof customAttributes !== 'object' || Array.isArray(customAttributes)) {
    return false
  }

  const attrs = customAttributes as Record<string, any>
  return attrs.vip === true || attrs.isVIP === true
}

/**
 * Get contact type based on chat count
 */
export function getContactType(chatCount: number, isVIP: boolean): 'vip' | 'repeat' | 'first-time' {
  if (isVIP) return 'vip'
  if (chatCount > 1) return 'repeat'
  return 'first-time'
}

/**
 * Calculate resolution time in minutes
 */
export function calculateResolutionTime(createdAt: string, closedAt: string | null): number | null {
  if (!closedAt) return null

  try {
    const created = new Date(createdAt).getTime()
    const closed = new Date(closedAt).getTime()
    return Math.floor((closed - created) / 60000) // Convert to minutes
  } catch (error) {
    console.error('Error calculating resolution time:', error)
    return null
  }
}

/**
 * Group chats by contact ID
 */
export function groupChatsByContact<T extends { contactId: string | null }>(
  chats: T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>()

  for (const chat of chats) {
    const contactId = chat.contactId || 'unassigned'
    const existing = grouped.get(contactId) || []
    grouped.set(contactId, [...existing, chat])
  }

  return grouped
}

/**
 * Sort chats by priority and last activity
 */
export function sortChatsByPriority<T extends { priority: ChatPriority; lastMessage: string }>(
  chats: T[]
): T[] {
  return [...chats].sort((a, b) => {
    // First sort by priority (urgent first)
    const priorityDiff = getPriorityValue(b.priority) - getPriorityValue(a.priority)
    if (priorityDiff !== 0) return priorityDiff

    // Then by last activity (most recent first)
    return new Date(b.lastMessage).getTime() - new Date(a.lastMessage).getTime()
  })
}

/**
 * Filter chats to only active ones (open or pending)
 */
export function filterActiveChats<T extends { status: ChatStatus }>(chats: T[]): T[] {
  return chats.filter(chat => chat.status === 'open' || chat.status === 'pending')
}

/**
 * Get date range for filter
 */
export function getDateRangeTimestamps(range: 'today' | 'last7days' | 'last30days'): {
  start: Date
  end: Date
} {
  const now = new Date()
  const end = now
  let start = new Date()

  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0)
      break
    case 'last7days':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'last30days':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
  }

  return { start, end }
}
