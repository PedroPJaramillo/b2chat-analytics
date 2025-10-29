// Chat Response Time Calculation Utilities
// Feature 008: Expandable Chat View for Agent Performance QA

/**
 * Response time metrics for a chat conversation
 */
export interface ResponseTimeResult {
  firstResponseTimeMs: number | null
  avgResponseTimeMs: number | null
  fastestResponseTimeMs: number | null
  slowestResponseTimeMs: number | null
  totalAgentResponses: number
}

/**
 * Message structure for response time calculations
 */
export interface MessageForResponseTime {
  timestamp: string | Date
  sender: 'customer' | 'agent' | 'bot'
}

/**
 * Response time indicator for visual classification
 */
export type ResponseTimeIndicator = 'fast' | 'good' | 'slow'

/**
 * Calculate comprehensive response time metrics for a chat conversation
 *
 * Measures time from customer message to next agent response.
 * Ignores bot messages as they are automated.
 *
 * @param messages - Array of messages ordered chronologically
 * @returns Response time metrics including first, avg, fastest, slowest response times
 */
export function calculateChatResponseTimes(
  messages: MessageForResponseTime[]
): ResponseTimeResult {
  const result: ResponseTimeResult = {
    firstResponseTimeMs: null,
    avgResponseTimeMs: null,
    fastestResponseTimeMs: null,
    slowestResponseTimeMs: null,
    totalAgentResponses: 0,
  }

  if (messages.length === 0) {
    return result
  }

  const responseTimes: number[] = []
  let lastCustomerMessageTime: number | null = null

  for (const message of messages) {
    const messageTime = new Date(message.timestamp).getTime()

    // Track customer messages as potential triggers for response time
    if (message.sender === 'customer') {
      lastCustomerMessageTime = messageTime
      continue
    }

    // Calculate response time when agent responds
    if (message.sender === 'agent' && lastCustomerMessageTime !== null) {
      const responseTime = messageTime - lastCustomerMessageTime

      // Only count positive response times (agent message after customer message)
      if (responseTime > 0) {
        responseTimes.push(responseTime)
        result.totalAgentResponses++

        // Reset to avoid counting same customer message multiple times
        lastCustomerMessageTime = null
      }
    }

    // Skip bot messages (they don't count as agent responses)
  }

  // Calculate metrics if we have any response times
  if (responseTimes.length > 0) {
    result.firstResponseTimeMs = responseTimes[0]
    result.avgResponseTimeMs = Math.round(
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    )
    result.fastestResponseTimeMs = Math.min(...responseTimes)
    result.slowestResponseTimeMs = Math.max(...responseTimes)
  }

  return result
}

/**
 * Calculate response time between a customer message and agent message pair
 *
 * @param customerMsg - Customer message with timestamp
 * @param agentMsg - Agent message with timestamp
 * @returns Response time in milliseconds
 */
export function calculateMessagePairResponseTime(
  customerMsg: { timestamp: string | Date },
  agentMsg: { timestamp: string | Date }
): number {
  const customerTime = new Date(customerMsg.timestamp).getTime()
  const agentTime = new Date(agentMsg.timestamp).getTime()

  return agentTime - customerTime
}

/**
 * Format response time in milliseconds to human-readable string
 *
 * Examples:
 * - 45000ms → "45s"
 * - 83000ms → "1m 23s"
 * - 192000ms → "3m 12s"
 * - 3665000ms → "1h 1m"
 *
 * @param ms - Time in milliseconds
 * @returns Formatted time string
 */
export function formatResponseTime(ms: number): string {
  if (ms < 0) return '0s'

  // Less than 1 minute: show seconds
  if (ms < 60000) {
    const seconds = Math.round(ms / 1000)
    return `${seconds}s`
  }

  // Less than 1 hour: show minutes and seconds
  if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.round((ms % 60000) / 1000)

    if (seconds === 0) {
      return `${minutes}m`
    }
    return `${minutes}m ${seconds}s`
  }

  // 1 hour or more: show hours and minutes
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.round((ms % 3600000) / 60000)

  if (minutes === 0) {
    return `${hours}h`
  }
  return `${hours}h ${minutes}m`
}

/**
 * Get response time indicator based on threshold
 *
 * Classification:
 * - Fast: < 60 seconds
 * - Good: 60-180 seconds (1-3 minutes)
 * - Slow: > 180 seconds (> 3 minutes)
 *
 * @param ms - Time in milliseconds
 * @returns Response time indicator for visual classification
 */
export function getResponseTimeIndicator(ms: number): ResponseTimeIndicator {
  if (ms < 60000) return 'fast'  // < 1 minute
  if (ms < 180000) return 'good' // 1-3 minutes
  return 'slow'                   // > 3 minutes
}

/**
 * Get visual badge label for response time indicator
 *
 * @param indicator - Response time indicator
 * @returns Human-readable label with emoji
 */
export function getResponseTimeLabel(indicator: ResponseTimeIndicator): string {
  switch (indicator) {
    case 'fast':
      return '⚡ Fast'
    case 'good':
      return '✓ Good'
    case 'slow':
      return '⚠️ Slow'
  }
}

/**
 * Get Tailwind CSS classes for response time badge
 *
 * @param indicator - Response time indicator
 * @returns Tailwind CSS class string
 */
export function getResponseTimeBadgeClass(indicator: ResponseTimeIndicator): string {
  switch (indicator) {
    case 'fast':
      return 'bg-green-50 text-green-700 border-green-200'
    case 'good':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'slow':
      return 'bg-orange-50 text-orange-700 border-orange-200'
  }
}
