/**
 * @jest-environment node
 */

import { describe, it, expect } from '@jest/globals'
import {
  calculateChatResponseTimes,
  calculateMessagePairResponseTime,
  formatResponseTime,
  getResponseTimeIndicator,
  getResponseTimeLabel,
  getResponseTimeBadgeClass,
  type MessageForResponseTime,
  type ResponseTimeIndicator,
} from '../chat-response-time'

describe('Chat Response Time Utilities', () => {
  describe('calculateChatResponseTimes', () => {
    it('should calculate first response time correctly', () => {
      const messages: MessageForResponseTime[] = [
        { timestamp: new Date('2025-01-15T10:00:00Z'), sender: 'customer' },
        { timestamp: new Date('2025-01-15T10:01:23Z'), sender: 'agent' },
      ]

      const result = calculateChatResponseTimes(messages)

      expect(result.firstResponseTimeMs).toBe(83000) // 1 min 23 sec = 83000ms
      expect(result.totalAgentResponses).toBe(1)
    })

    it('should calculate avg, fastest, and slowest response times', () => {
      const messages: MessageForResponseTime[] = [
        { timestamp: new Date('2025-01-15T10:00:00Z'), sender: 'customer' },
        { timestamp: new Date('2025-01-15T10:01:00Z'), sender: 'agent' }, // 60s
        { timestamp: new Date('2025-01-15T10:02:00Z'), sender: 'customer' },
        { timestamp: new Date('2025-01-15T10:05:00Z'), sender: 'agent' }, // 180s
        { timestamp: new Date('2025-01-15T10:06:00Z'), sender: 'customer' },
        { timestamp: new Date('2025-01-15T10:07:30Z'), sender: 'agent' }, // 90s
      ]

      const result = calculateChatResponseTimes(messages)

      expect(result.firstResponseTimeMs).toBe(60000)
      expect(result.avgResponseTimeMs).toBe(110000) // (60 + 180 + 90) / 3 = 110s
      expect(result.fastestResponseTimeMs).toBe(60000)
      expect(result.slowestResponseTimeMs).toBe(180000)
      expect(result.totalAgentResponses).toBe(3)
    })

    it('should ignore bot messages', () => {
      const messages: MessageForResponseTime[] = [
        { timestamp: new Date('2025-01-15T10:00:00Z'), sender: 'customer' },
        { timestamp: new Date('2025-01-15T10:00:30Z'), sender: 'bot' },
        { timestamp: new Date('2025-01-15T10:01:00Z'), sender: 'agent' },
      ]

      const result = calculateChatResponseTimes(messages)

      expect(result.firstResponseTimeMs).toBe(60000) // From customer to agent, not bot
      expect(result.totalAgentResponses).toBe(1)
    })

    it('should handle consecutive agent messages', () => {
      const messages: MessageForResponseTime[] = [
        { timestamp: new Date('2025-01-15T10:00:00Z'), sender: 'customer' },
        { timestamp: new Date('2025-01-15T10:01:00Z'), sender: 'agent' }, // Counted
        { timestamp: new Date('2025-01-15T10:01:30Z'), sender: 'agent' }, // Not counted (no new customer message)
        { timestamp: new Date('2025-01-15T10:02:00Z'), sender: 'customer' },
        { timestamp: new Date('2025-01-15T10:04:00Z'), sender: 'agent' }, // Counted
      ]

      const result = calculateChatResponseTimes(messages)

      expect(result.totalAgentResponses).toBe(2)
      expect(result.avgResponseTimeMs).toBe(90000) // (60 + 120) / 2 = 90s
    })

    it('should return null values for empty message array', () => {
      const result = calculateChatResponseTimes([])

      expect(result.firstResponseTimeMs).toBeNull()
      expect(result.avgResponseTimeMs).toBeNull()
      expect(result.fastestResponseTimeMs).toBeNull()
      expect(result.slowestResponseTimeMs).toBeNull()
      expect(result.totalAgentResponses).toBe(0)
    })

    it('should return null values when no agent responses', () => {
      const messages: MessageForResponseTime[] = [
        { timestamp: new Date('2025-01-15T10:00:00Z'), sender: 'customer' },
        { timestamp: new Date('2025-01-15T10:01:00Z'), sender: 'customer' },
        { timestamp: new Date('2025-01-15T10:02:00Z'), sender: 'bot' },
      ]

      const result = calculateChatResponseTimes(messages)

      expect(result.firstResponseTimeMs).toBeNull()
      expect(result.totalAgentResponses).toBe(0)
    })

    it('should handle agent message before first customer message', () => {
      const messages: MessageForResponseTime[] = [
        { timestamp: new Date('2025-01-15T10:00:00Z'), sender: 'agent' },
        { timestamp: new Date('2025-01-15T10:01:00Z'), sender: 'customer' },
        { timestamp: new Date('2025-01-15T10:02:00Z'), sender: 'agent' },
      ]

      const result = calculateChatResponseTimes(messages)

      expect(result.totalAgentResponses).toBe(1)
      expect(result.firstResponseTimeMs).toBe(60000)
    })

    it('should handle string timestamps', () => {
      const messages: MessageForResponseTime[] = [
        { timestamp: '2025-01-15T10:00:00Z', sender: 'customer' },
        { timestamp: '2025-01-15T10:02:00Z', sender: 'agent' },
      ]

      const result = calculateChatResponseTimes(messages)

      expect(result.firstResponseTimeMs).toBe(120000) // 2 minutes
    })
  })

  describe('calculateMessagePairResponseTime', () => {
    it('should calculate time difference between two messages', () => {
      const customerMsg = { timestamp: new Date('2025-01-15T10:00:00Z') }
      const agentMsg = { timestamp: new Date('2025-01-15T10:03:45Z') }

      const result = calculateMessagePairResponseTime(customerMsg, agentMsg)

      expect(result).toBe(225000) // 3 min 45 sec = 225000ms
    })

    it('should handle string timestamps', () => {
      const customerMsg = { timestamp: '2025-01-15T10:00:00Z' }
      const agentMsg = { timestamp: '2025-01-15T10:01:30Z' }

      const result = calculateMessagePairResponseTime(customerMsg, agentMsg)

      expect(result).toBe(90000) // 1 min 30 sec
    })

    it('should return negative value if agent responds before customer', () => {
      const customerMsg = { timestamp: new Date('2025-01-15T10:02:00Z') }
      const agentMsg = { timestamp: new Date('2025-01-15T10:01:00Z') }

      const result = calculateMessagePairResponseTime(customerMsg, agentMsg)

      expect(result).toBe(-60000)
    })
  })

  describe('formatResponseTime', () => {
    it('should format seconds correctly', () => {
      expect(formatResponseTime(0)).toBe('0s')
      expect(formatResponseTime(5000)).toBe('5s')
      expect(formatResponseTime(45000)).toBe('45s')
      expect(formatResponseTime(59000)).toBe('59s')
    })

    it('should format minutes and seconds correctly', () => {
      expect(formatResponseTime(60000)).toBe('1m')
      expect(formatResponseTime(83000)).toBe('1m 23s')
      expect(formatResponseTime(120000)).toBe('2m')
      expect(formatResponseTime(192000)).toBe('3m 12s')
      expect(formatResponseTime(3540000)).toBe('59m')
    })

    it('should format hours and minutes correctly', () => {
      expect(formatResponseTime(3600000)).toBe('1h')
      expect(formatResponseTime(3665000)).toBe('1h 1m')
      expect(formatResponseTime(7200000)).toBe('2h')
      expect(formatResponseTime(9000000)).toBe('2h 30m')
    })

    it('should handle negative values gracefully', () => {
      expect(formatResponseTime(-5000)).toBe('0s')
    })

    it('should round seconds properly', () => {
      expect(formatResponseTime(1499)).toBe('1s')
      expect(formatResponseTime(1500)).toBe('2s')
      expect(formatResponseTime(59499)).toBe('59s')
    })
  })

  describe('getResponseTimeIndicator', () => {
    it('should return "fast" for response times under 60 seconds', () => {
      expect(getResponseTimeIndicator(0)).toBe('fast')
      expect(getResponseTimeIndicator(30000)).toBe('fast')
      expect(getResponseTimeIndicator(59999)).toBe('fast')
    })

    it('should return "good" for response times between 60-180 seconds', () => {
      expect(getResponseTimeIndicator(60000)).toBe('good')
      expect(getResponseTimeIndicator(120000)).toBe('good')
      expect(getResponseTimeIndicator(179999)).toBe('good')
    })

    it('should return "slow" for response times over 180 seconds', () => {
      expect(getResponseTimeIndicator(180000)).toBe('slow')
      expect(getResponseTimeIndicator(240000)).toBe('slow')
      expect(getResponseTimeIndicator(3600000)).toBe('slow')
    })
  })

  describe('getResponseTimeLabel', () => {
    it('should return correct labels with emoji', () => {
      expect(getResponseTimeLabel('fast')).toBe('⚡ Fast')
      expect(getResponseTimeLabel('good')).toBe('✓ Good')
      expect(getResponseTimeLabel('slow')).toBe('⚠️ Slow')
    })
  })

  describe('getResponseTimeBadgeClass', () => {
    it('should return correct Tailwind classes', () => {
      expect(getResponseTimeBadgeClass('fast')).toContain('bg-green-50')
      expect(getResponseTimeBadgeClass('fast')).toContain('text-green-700')

      expect(getResponseTimeBadgeClass('good')).toContain('bg-blue-50')
      expect(getResponseTimeBadgeClass('good')).toContain('text-blue-700')

      expect(getResponseTimeBadgeClass('slow')).toContain('bg-orange-50')
      expect(getResponseTimeBadgeClass('slow')).toContain('text-orange-700')
    })
  })

  describe('Edge Cases and Integration', () => {
    it('should handle very large time differences', () => {
      const messages: MessageForResponseTime[] = [
        { timestamp: new Date('2025-01-15T10:00:00Z'), sender: 'customer' },
        { timestamp: new Date('2025-01-16T10:00:00Z'), sender: 'agent' }, // 24 hours
      ]

      const result = calculateChatResponseTimes(messages)

      expect(result.firstResponseTimeMs).toBe(86400000) // 24 hours in ms
      expect(formatResponseTime(result.firstResponseTimeMs!)).toBe('24h')
      expect(getResponseTimeIndicator(result.firstResponseTimeMs!)).toBe('slow')
    })

    it('should handle mixed sender types in realistic conversation', () => {
      const messages: MessageForResponseTime[] = [
        { timestamp: new Date('2025-01-15T10:00:00Z'), sender: 'customer' },
        { timestamp: new Date('2025-01-15T10:00:30Z'), sender: 'bot' },
        { timestamp: new Date('2025-01-15T10:01:00Z'), sender: 'customer' },
        { timestamp: new Date('2025-01-15T10:02:00Z'), sender: 'agent' }, // 60s from last customer
        { timestamp: new Date('2025-01-15T10:02:30Z'), sender: 'agent' },
        { timestamp: new Date('2025-01-15T10:03:00Z'), sender: 'customer' },
        { timestamp: new Date('2025-01-15T10:03:45Z'), sender: 'agent' }, // 45s
      ]

      const result = calculateChatResponseTimes(messages)

      expect(result.totalAgentResponses).toBe(2)
      expect(result.fastestResponseTimeMs).toBe(45000)
      expect(result.slowestResponseTimeMs).toBe(60000)
    })
  })
})
