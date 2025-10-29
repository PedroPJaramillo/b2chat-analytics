/**
 * Rule-based metrics calculation for customer analysis
 */

import type { Chat, Message } from '@prisma/client'
import type {
  ResponseTimeMetrics,
  VolumeMetrics,
  PeakTimeMetrics,
} from '@/types/customer-analysis'

interface ChatWithMessages extends Chat {
  messages: Message[]
}

/**
 * Calculates response time metrics for chats
 */
export function calculateResponseTimeMetrics(
  chats: ChatWithMessages[]
): ResponseTimeMetrics {
  const firstResponseTimes: number[] = []
  const responseTimesByHour: Record<string, number[]> = {}

  for (const chat of chats) {
    // Calculate first response time
    if (chat.pickedUpAt && chat.openedAt) {
      const responseTime = chat.pickedUpAt.getTime() - chat.openedAt.getTime()
      firstResponseTimes.push(responseTime)

      // Group by hour
      const hour = chat.openedAt.getHours().toString()
      if (!responseTimesByHour[hour]) {
        responseTimesByHour[hour] = []
      }
      responseTimesByHour[hour].push(responseTime)
    }
  }

  // Calculate percentiles
  const sortedTimes = firstResponseTimes.sort((a, b) => a - b)
  const p50 = calculatePercentile(sortedTimes, 50)
  const p90 = calculatePercentile(sortedTimes, 90)
  const p95 = calculatePercentile(sortedTimes, 95)
  const average = sortedTimes.length > 0
    ? sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length
    : 0

  // Average handling time
  const validDurations = chats.filter((c) => c.duration).map((c) => c.duration!)
  const averageHandlingTime =
    validDurations.length > 0
      ? (validDurations.reduce((a, b) => a + b, 0) / validDurations.length) * 1000
      : 0

  // Calculate average response times by hour
  const avgResponseTimesByHour: Record<string, number> = {}
  for (const [hour, times] of Object.entries(responseTimesByHour)) {
    avgResponseTimesByHour[hour] =
      times.reduce((a, b) => a + b, 0) / times.length
  }

  return {
    firstResponseTime: {
      average,
      p50,
      p90,
      p95,
    },
    averageHandlingTime,
    responseTimesByHour: avgResponseTimesByHour,
  }
}

/**
 * Calculates volume metrics for chats and messages
 */
export function calculateVolumeMetrics(
  chats: ChatWithMessages[]
): VolumeMetrics {
  const messagesByAgent: Record<string, number> = {}
  const messagesByHour: Record<string, number> = {}
  const channelDistribution = {
    text: 0,
    voice: 0,
    media: 0,
  }

  let totalMessages = 0

  for (const chat of chats) {
    // Count messages by agent
    if (chat.agentId) {
      messagesByAgent[chat.agentId] = (messagesByAgent[chat.agentId] || 0) + chat.messages.length
    }

    // Process messages
    for (const message of chat.messages) {
      totalMessages++

      // Count by hour
      const hour = message.timestamp.getHours().toString()
      messagesByHour[hour] = (messagesByHour[hour] || 0) + 1

      // Count by channel/type
      if (message.type === 'text') {
        channelDistribution.text++
      } else if (message.type === 'file' && message.mediaMimeType?.startsWith('audio/')) {
        channelDistribution.voice++
      } else if (message.type === 'image' || message.type === 'file') {
        channelDistribution.media++
      }
    }
  }

  return {
    totalChats: chats.length,
    totalMessages,
    messagesByAgent,
    messagesByHour,
    channelDistribution,
  }
}

/**
 * Calculates peak time metrics
 */
export function calculatePeakTimeMetrics(
  chats: ChatWithMessages[]
): PeakTimeMetrics {
  const byHour: Record<string, number> = {}
  const byDayOfWeek: Record<string, number> = {}
  const concurrentChatsByAgent: Record<string, number> = {}

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  for (const chat of chats) {
    // Count by hour
    const hour = chat.createdAt.getHours().toString()
    byHour[hour] = (byHour[hour] || 0) + 1

    // Count by day of week
    const dayIndex = chat.createdAt.getDay()
    const dayName = dayNames[dayIndex]
    byDayOfWeek[dayName] = (byDayOfWeek[dayName] || 0) + 1

    // Track concurrent chats per agent (simplified: count chats per agent)
    if (chat.agentId) {
      concurrentChatsByAgent[chat.agentId] =
        (concurrentChatsByAgent[chat.agentId] || 0) + 1
    }
  }

  return {
    byHour,
    byDayOfWeek,
    concurrentChatsByAgent,
  }
}

/**
 * Calculates percentile value from sorted array
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0

  const index = (percentile / 100) * (sortedValues.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower

  if (lower === upper) {
    return sortedValues[lower]
  }

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
}

/**
 * Groups chats by agent for individual agent metrics
 */
export function groupChatsByAgent(
  chats: ChatWithMessages[]
): Record<string, ChatWithMessages[]> {
  const grouped: Record<string, ChatWithMessages[]> = {}

  for (const chat of chats) {
    if (chat.agentId) {
      if (!grouped[chat.agentId]) {
        grouped[chat.agentId] = []
      }
      grouped[chat.agentId].push(chat)
    }
  }

  return grouped
}

/**
 * Calculates agent-specific metrics
 */
export function calculateAgentMetrics(chats: ChatWithMessages[]) {
  const responseMetrics = calculateResponseTimeMetrics(chats)
  const volumeMetrics = calculateVolumeMetrics(chats)

  return {
    totalChats: chats.length,
    totalMessages: volumeMetrics.totalMessages,
    firstResponseTime: responseMetrics.firstResponseTime,
    averageHandlingTime: responseMetrics.averageHandlingTime,
  }
}
