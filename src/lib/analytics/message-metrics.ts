/**
 * Message-level analytics calculator for outgoing chats
 * Used for campaign effectiveness and agent productivity metrics
 */

import type { Chat, Message } from '@prisma/client'

export interface ChatWithMessages extends Chat {
  messages: Message[]
}

export interface OutgoingMessageMetrics {
  // Volume metrics
  totalMessagesSent: number
  totalChats: number
  averageMessagesPerChat: number

  // Engagement metrics
  chatsWithReply: number
  replyRate: number // Percentage of chats that got customer reply
  averageTimeToReply: number | null // Average time for customer to reply (ms)

  // Message type distribution
  messagesByType: {
    text: number
    image: number
    file: number
  }

  // Conversion metrics
  convertedToSupport: number // Chats where direction changed to incoming
  conversionRate: number // Percentage converted

  // Time patterns
  messagesByHour: Record<string, number>
  messagesByDayOfWeek: Record<string, number>
}

export interface AgentOutgoingMetrics {
  agentId: string
  agentName?: string
  messagesSent: number
  chatsInitiated: number
  averageMessagesPerChat: number
  replyRate: number
  conversions: number
  productivityScore: number // 0-100 normalized score
}

/**
 * Calculates message-level metrics for outgoing chats
 */
export function calculateOutgoingMessageMetrics(
  chats: ChatWithMessages[]
): OutgoingMessageMetrics {
  let totalMessagesSent = 0
  let chatsWithReply = 0
  let replyTimes: number[] = []
  let convertedToSupport = 0

  const messagesByType = {
    text: 0,
    image: 0,
    file: 0
  }

  const messagesByHour: Record<string, number> = {}
  const messagesByDayOfWeek: Record<string, number> = {}
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  for (const chat of chats) {
    // Count agent messages (outgoing = incoming: false)
    const agentMessages = chat.messages.filter(msg => !msg.incoming)
    totalMessagesSent += agentMessages.length

    // Check if customer replied
    const customerMessages = chat.messages.filter(msg => msg.incoming)
    if (customerMessages.length > 0) {
      chatsWithReply++

      // Calculate time to first reply
      const firstAgentMessage = agentMessages.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )[0]

      const firstCustomerReply = customerMessages.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )[0]

      if (firstAgentMessage && firstCustomerReply) {
        const timeToReply = new Date(firstCustomerReply.timestamp).getTime() -
                            new Date(firstAgentMessage.timestamp).getTime()
        if (timeToReply > 0) {
          replyTimes.push(timeToReply)
        }
      }
    }

    // Check if chat converted to support
    if (chat.direction === 'incoming' && chat.originalDirection !== 'incoming') {
      convertedToSupport++
    }

    // Count messages by type
    for (const message of agentMessages) {
      messagesByType[message.type as keyof typeof messagesByType]++

      // Count by hour
      const hour = new Date(message.timestamp).getHours().toString()
      messagesByHour[hour] = (messagesByHour[hour] || 0) + 1

      // Count by day of week
      const dayIndex = new Date(message.timestamp).getDay()
      const dayName = dayNames[dayIndex]
      messagesByDayOfWeek[dayName] = (messagesByDayOfWeek[dayName] || 0) + 1
    }
  }

  const averageTimeToReply = replyTimes.length > 0
    ? replyTimes.reduce((sum, time) => sum + time, 0) / replyTimes.length
    : null

  return {
    totalMessagesSent,
    totalChats: chats.length,
    averageMessagesPerChat: chats.length > 0 ? totalMessagesSent / chats.length : 0,
    chatsWithReply,
    replyRate: chats.length > 0 ? (chatsWithReply / chats.length) * 100 : 0,
    averageTimeToReply,
    messagesByType,
    convertedToSupport,
    conversionRate: chats.length > 0 ? (convertedToSupport / chats.length) * 100 : 0,
    messagesByHour,
    messagesByDayOfWeek
  }
}

/**
 * Groups outgoing chats by agent and calculates per-agent metrics
 */
export function calculateAgentOutgoingMetrics(
  chats: ChatWithMessages[],
  agents: Array<{ id: string; name: string }>
): AgentOutgoingMetrics[] {
  // Group chats by agent
  const chatsByAgent: Record<string, ChatWithMessages[]> = {}

  for (const chat of chats) {
    if (chat.agentId) {
      if (!chatsByAgent[chat.agentId]) {
        chatsByAgent[chat.agentId] = []
      }
      chatsByAgent[chat.agentId].push(chat)
    }
  }

  // Calculate metrics for each agent
  const agentMetrics: AgentOutgoingMetrics[] = []

  for (const [agentId, agentChats] of Object.entries(chatsByAgent)) {
    const agent = agents.find(a => a.id === agentId)
    const metrics = calculateOutgoingMessageMetrics(agentChats)

    // Calculate productivity score (0-100)
    // Based on: messages sent, reply rate, and conversion rate
    const messageScore = Math.min((metrics.totalMessagesSent / 100) * 30, 30) // Max 30 points
    const replyScore = (metrics.replyRate / 100) * 40 // Max 40 points
    const conversionScore = (metrics.conversionRate / 100) * 30 // Max 30 points
    const productivityScore = Math.round(messageScore + replyScore + conversionScore)

    agentMetrics.push({
      agentId,
      agentName: agent?.name,
      messagesSent: metrics.totalMessagesSent,
      chatsInitiated: agentChats.length,
      averageMessagesPerChat: metrics.averageMessagesPerChat,
      replyRate: metrics.replyRate,
      conversions: metrics.convertedToSupport,
      productivityScore
    })
  }

  // Sort by productivity score (highest first)
  return agentMetrics.sort((a, b) => b.productivityScore - a.productivityScore)
}

/**
 * Calculates broadcast campaign metrics
 */
export function calculateBroadcastMetrics(
  chats: ChatWithMessages[]
): {
  totalRecipients: number
  messagesDelivered: number
  deliveryRate: number
  replyRate: number
  averageEngagement: number
} {
  const metrics = calculateOutgoingMessageMetrics(chats)

  // For broadcasts, engagement is measured by reply + conversion
  const engagementScore = (metrics.replyRate + metrics.conversionRate) / 2

  return {
    totalRecipients: chats.length,
    messagesDelivered: metrics.totalMessagesSent,
    deliveryRate: chats.length > 0 ? (metrics.totalMessagesSent / chats.length) * 100 : 0,
    replyRate: metrics.replyRate,
    averageEngagement: engagementScore
  }
}

/**
 * Formats time in milliseconds to human-readable string
 */
export function formatTime(ms: number | null): string {
  if (ms === null || ms === 0) return 'N/A'

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}
