/**
 * @jest-environment node
 */

import { GET } from '../route'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}))

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    chat: {
      findMany: jest.fn(),
    },
    systemSetting: {
      findMany: jest.fn(),
    },
  },
}))

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockPrisma = prisma as jest.Mocked<typeof prisma>

// Helper to create mock request
function createMockRequest(searchParams: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/analytics/response-time-drilldown')
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
  return new NextRequest(url)
}

// Helper to create mock chat data
function createMockChat(overrides: any = {}) {
  return {
    id: 'chat_' + Math.random(),
    contact: {
      fullName: 'John Doe'
    },
    agentId: 'agent_123',
    agent: {
      id: 'agent_123',
      name: 'Agent Smith'
    },
    provider: 'whatsapp',
    status: 'resolved',
    createdAt: new Date('2025-10-15T14:00:00Z'),
    openedAt: new Date('2025-10-15T14:00:00Z'),
    responseAt: new Date('2025-10-15T14:05:00Z'), // 5 min response
    direction: 'incoming',
    isDeleted: false,
    ...overrides,
  }
}

describe('GET /api/analytics/response-time-drilldown', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    mockPrisma.systemSetting.findMany.mockResolvedValue([])
  })

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null })

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14'
      })
      const response = await GET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('Query Parameter Validation', () => {
    it('should return 400 if weekStart parameter is missing', async () => {
      const request = createMockRequest({ dayOfWeek: '2', hour: '14' })
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('weekStart')
    })

    it('should return 400 if dayOfWeek parameter is missing', async () => {
      const request = createMockRequest({ weekStart: '2025-10-13', hour: '14' })
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('dayOfWeek')
    })

    it('should return 400 if hour parameter is missing', async () => {
      const request = createMockRequest({ weekStart: '2025-10-13', dayOfWeek: '2' })
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('hour')
    })

    it('should return 400 if dayOfWeek is less than 0', async () => {
      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '-1',
        hour: '14'
      })
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('dayOfWeek')
    })

    it('should return 400 if dayOfWeek is greater than 6', async () => {
      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '7',
        hour: '14'
      })
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('dayOfWeek')
    })

    it('should return 400 if hour is less than 0', async () => {
      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '-1'
      })
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('hour')
    })

    it('should return 400 if hour is greater than 23', async () => {
      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '24'
      })
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('hour')
    })

    it('should accept valid parameters', async () => {
      mockPrisma.chat.findMany.mockResolvedValue([])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14'
      })
      const response = await GET(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Time Slot Calculation', () => {
    it('should correctly calculate time slot boundaries for Tuesday 2PM', async () => {
      mockPrisma.chat.findMany
        .mockResolvedValueOnce([]) // Time slot query
        .mockResolvedValueOnce([]) // Weekly query

      const request = createMockRequest({
        weekStart: '2025-10-13', // Monday
        dayOfWeek: '2', // Tuesday (0=Sunday, 1=Monday, 2=Tuesday)
        hour: '14' // 2 PM
      })
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.dayName).toBe('Tuesday')
      expect(data.hourRange).toBe('2:00 PM - 3:00 PM')
      expect(data.timeSlotStart).toBe('2025-10-15T14:00:00.000Z')
      expect(data.timeSlotEnd).toBe('2025-10-15T15:00:00.000Z')
    })

    it('should handle midnight hour (hour 0)', async () => {
      mockPrisma.chat.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '0', // Sunday (weekStart + 0 days)
        hour: '0' // Midnight
      })
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.hourRange).toBe('12:00 AM - 1:00 AM')
      expect(data.timeSlotStart).toBe('2025-10-13T00:00:00.000Z') // Monday at midnight
    })

    it('should handle end of day hour (hour 23)', async () => {
      mockPrisma.chat.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '6', // Saturday (weekStart + 6 days = Oct 19)
        hour: '23'
      })
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.hourRange).toBe('11:00 PM - 12:00 AM')
      expect(data.timeSlotStart).toBe('2025-10-19T23:00:00.000Z') // Saturday Oct 19 at 11 PM
    })
  })

  describe('Summary Statistics', () => {
    it('should calculate correct summary for time slot with chats', async () => {
      // Time slot has 3 chats: 3min, 6min, 9min (avg = 6min)
      const timeSlotChats = [
        createMockChat({
          createdAt: new Date('2025-10-15T14:00:00Z'),
          responseAt: new Date('2025-10-15T14:03:00Z'), // 3 min
        }),
        createMockChat({
          createdAt: new Date('2025-10-15T14:15:00Z'),
          responseAt: new Date('2025-10-15T14:21:00Z'), // 6 min
        }),
        createMockChat({
          createdAt: new Date('2025-10-15T14:30:00Z'),
          responseAt: new Date('2025-10-15T14:39:00Z'), // 9 min
        }),
      ]

      // Weekly average: 4min
      const weeklyChats = [
        createMockChat({
          createdAt: new Date('2025-10-13T10:00:00Z'),
          responseAt: new Date('2025-10-13T10:04:00Z'), // 4 min
        }),
      ]

      mockPrisma.chat.findMany
        .mockResolvedValueOnce(timeSlotChats) // Time slot query
        .mockResolvedValueOnce(weeklyChats) // Weekly query

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14'
      })
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.summary.totalChats).toBe(3)
      expect(data.summary.avgResponseTime).toBe('6.0m')
      expect(data.summary.avgResponseTimeMs).toBe(360000)
      expect(data.summary.comparisonToWeekly).toBe('+2.0m')
      expect(data.summary.performanceIndicator).toBe('destructive')
      expect(data.summary.performanceLabel).toBe('Worse')
    })

    it('should return zero values for empty time slot', async () => {
      mockPrisma.chat.findMany
        .mockResolvedValueOnce([]) // Time slot query (empty)
        .mockResolvedValueOnce([]) // Weekly query (empty)

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14'
      })
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.summary.totalChats).toBe(0)
      expect(data.summary.avgResponseTime).toBe('0s')
      expect(data.summary.avgResponseTimeMs).toBe(0)
    })

    it('should mark performance as "Better" when faster than weekly average', async () => {
      // Time slot: 2min
      const timeSlotChats = [
        createMockChat({
          createdAt: new Date('2025-10-15T14:00:00Z'),
          responseAt: new Date('2025-10-15T14:02:00Z'),
        }),
      ]

      // Weekly average: 10min
      const weeklyChats = [
        createMockChat({
          createdAt: new Date('2025-10-13T10:00:00Z'),
          responseAt: new Date('2025-10-13T10:10:00Z'),
        }),
      ]

      mockPrisma.chat.findMany
        .mockResolvedValueOnce(timeSlotChats)
        .mockResolvedValueOnce(weeklyChats)

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14'
      })
      const response = await GET(request)

      const data = await response.json()
      expect(data.summary.comparisonToWeekly).toBe('-8.0m')
      expect(data.summary.performanceIndicator).toBe('secondary')
      expect(data.summary.performanceLabel).toBe('Better')
    })

    it('should mark performance as "Average" when within 20% threshold', async () => {
      // Time slot: 5min
      const timeSlotChats = [
        createMockChat({
          createdAt: new Date('2025-10-15T14:00:00Z'),
          responseAt: new Date('2025-10-15T14:05:00Z'),
        }),
      ]

      // Weekly average: 5.5min (within 20% threshold)
      const weeklyChats = [
        createMockChat({
          createdAt: new Date('2025-10-13T10:00:00Z'),
          responseAt: new Date('2025-10-13T10:05:30Z'),
        }),
      ]

      mockPrisma.chat.findMany
        .mockResolvedValueOnce(timeSlotChats)
        .mockResolvedValueOnce(weeklyChats)

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14'
      })
      const response = await GET(request)

      const data = await response.json()
      expect(data.summary.performanceIndicator).toBe('default')
      expect(data.summary.performanceLabel).toBe('Average')
    })
  })

  describe('Chat Distribution', () => {
    it('should correctly count chats by status', async () => {
      const timeSlotChats = [
        createMockChat({ status: 'resolved' }),
        createMockChat({ status: 'resolved' }),
        createMockChat({ status: 'resolved' }),
        createMockChat({ status: 'pending' }),
        createMockChat({ status: 'pending' }),
        createMockChat({ status: 'active' }),
      ]

      mockPrisma.chat.findMany
        .mockResolvedValueOnce(timeSlotChats)
        .mockResolvedValueOnce([])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14'
      })
      const response = await GET(request)

      const data = await response.json()
      expect(data.distribution).toHaveLength(3)

      const resolved = data.distribution.find((d: any) => d.status === 'resolved')
      const pending = data.distribution.find((d: any) => d.status === 'pending')
      const active = data.distribution.find((d: any) => d.status === 'active')

      expect(resolved.count).toBe(3)
      expect(pending.count).toBe(2)
      expect(active.count).toBe(1)
    })

    it('should return empty distribution for no chats', async () => {
      mockPrisma.chat.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14'
      })
      const response = await GET(request)

      const data = await response.json()
      expect(data.distribution).toEqual([])
    })
  })

  describe('Agent Breakdown', () => {
    it('should calculate agent breakdown when agentId is "all"', async () => {
      const timeSlotChats = [
        createMockChat({
          agentId: 'agent_1',
          agent: { id: 'agent_1', name: 'Agent One' },
          createdAt: new Date('2025-10-15T14:00:00Z'),
          responseAt: new Date('2025-10-15T14:10:00Z'), // 10 min
        }),
        createMockChat({
          agentId: 'agent_1',
          agent: { id: 'agent_1', name: 'Agent One' },
          createdAt: new Date('2025-10-15T14:15:00Z'),
          responseAt: new Date('2025-10-15T14:20:00Z'), // 5 min
        }),
        createMockChat({
          agentId: 'agent_2',
          agent: { id: 'agent_2', name: 'Agent Two' },
          createdAt: new Date('2025-10-15T14:30:00Z'),
          responseAt: new Date('2025-10-15T14:33:00Z'), // 3 min
        }),
      ]

      mockPrisma.chat.findMany
        .mockResolvedValueOnce(timeSlotChats)
        .mockResolvedValueOnce([])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14'
      })
      const response = await GET(request)

      const data = await response.json()
      expect(data.agentBreakdown).toHaveLength(2)

      // Should be sorted by chat count descending
      expect(data.agentBreakdown[0].agentId).toBe('agent_1')
      expect(data.agentBreakdown[0].agentName).toBe('Agent One')
      expect(data.agentBreakdown[0].chatCount).toBe(2)
      expect(data.agentBreakdown[0].avgResponseTime).toBe('7.5m')

      expect(data.agentBreakdown[1].agentId).toBe('agent_2')
      expect(data.agentBreakdown[1].chatCount).toBe(1)
      expect(data.agentBreakdown[1].avgResponseTime).toBe('3.0m')
    })

    it('should return single agent when agentId is specified', async () => {
      const timeSlotChats = [
        createMockChat({
          agentId: 'agent_123',
          agent: 'Specific Agent',
        }),
      ]

      mockPrisma.chat.findMany
        .mockResolvedValueOnce(timeSlotChats)
        .mockResolvedValueOnce([])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14',
        agentId: 'agent_123'
      })
      const response = await GET(request)

      const data = await response.json()
      expect(data.agentBreakdown).toHaveLength(1)
      expect(data.agentBreakdown[0].agentId).toBe('agent_123')
    })

    it('should handle chats with null agent (unassigned)', async () => {
      const timeSlotChats = [
        createMockChat({
          agentId: null,
          agent: null,
        }),
      ]

      mockPrisma.chat.findMany
        .mockResolvedValueOnce(timeSlotChats)
        .mockResolvedValueOnce([])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14'
      })
      const response = await GET(request)

      const data = await response.json()
      expect(data.agentBreakdown).toHaveLength(1)
      expect(data.agentBreakdown[0].agentId).toBeNull()
      expect(data.agentBreakdown[0].agentName).toBeNull()
    })
  })

  describe('Slowest Chats', () => {
    it('should return top 10 slowest chats sorted by response time', async () => {
      const timeSlotChats = Array.from({ length: 15 }, (_, i) =>
        createMockChat({
          id: `chat_${i}`,
          createdAt: new Date('2025-10-15T14:00:00Z'),
          responseAt: new Date(new Date('2025-10-15T14:00:00Z').getTime() + (i + 1) * 60000), // 1min, 2min, ... 15min
          contact: { fullName: `Customer ${i}` },
        })
      )

      mockPrisma.chat.findMany
        .mockResolvedValueOnce(timeSlotChats)
        .mockResolvedValueOnce([])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14'
      })
      const response = await GET(request)

      const data = await response.json()
      expect(data.slowestChats).toHaveLength(10)

      // Should be sorted slowest first
      expect(data.slowestChats[0].chatId).toBe('chat_14') // 15 min
      expect(data.slowestChats[0].responseTime).toBe('15.0m')
      expect(data.slowestChats[9].chatId).toBe('chat_5') // 6 min
    })

    it('should return all chats if less than 10 exist', async () => {
      const timeSlotChats = Array.from({ length: 3 }, (_, i) =>
        createMockChat({ id: `chat_${i}` })
      )

      mockPrisma.chat.findMany
        .mockResolvedValueOnce(timeSlotChats)
        .mockResolvedValueOnce([])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14'
      })
      const response = await GET(request)

      const data = await response.json()
      expect(data.slowestChats).toHaveLength(3)
    })

    it('should include all required fields for slowest chats', async () => {
      const timeSlotChats = [
        createMockChat({
          id: 'chat_123',
          contact: { fullName: 'John Doe' },
          agentId: 'agent_456',
          agent: { id: 'agent_456', name: 'Agent Smith' },
          provider: 'whatsapp',
          status: 'resolved',
          createdAt: new Date('2025-10-15T14:00:00Z'),
          responseAt: new Date('2025-10-15T14:05:00Z'),
        }),
      ]

      mockPrisma.chat.findMany
        .mockResolvedValueOnce(timeSlotChats)
        .mockResolvedValueOnce([])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14'
      })
      const response = await GET(request)

      const data = await response.json()
      const chat = data.slowestChats[0]

      expect(chat).toHaveProperty('chatId')
      expect(chat).toHaveProperty('customerName')
      expect(chat).toHaveProperty('agentName')
      expect(chat).toHaveProperty('channel')
      expect(chat).toHaveProperty('responseTime')
      expect(chat).toHaveProperty('responseTimeMs')
      expect(chat).toHaveProperty('status')

      expect(chat.chatId).toBe('chat_123')
      expect(chat.customerName).toBe('John Doe')
      expect(chat.agentName).toBe('Agent Smith')
      expect(chat.channel).toBe('whatsapp')
      expect(chat.status).toBe('resolved')
    })
  })

  describe('Direction Filter', () => {
    it('should filter by incoming direction', async () => {
      const timeSlotChats = [
        createMockChat({ direction: 'incoming' }),
      ]

      mockPrisma.chat.findMany
        .mockResolvedValueOnce(timeSlotChats)
        .mockResolvedValueOnce([])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14',
        direction: 'incoming'
      })
      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('should filter by outgoing direction', async () => {
      mockPrisma.chat.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14',
        direction: 'outgoing'
      })
      const response = await GET(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Error Handling', () => {
    it('should return 500 if database query fails', async () => {
      mockPrisma.chat.findMany.mockRejectedValue(new Error('Database error'))

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14'
      })
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toContain('Failed to fetch drill-down data')
    })
  })

  describe('Edge Cases', () => {
    it('should exclude chats with null createdAt', async () => {
      const timeSlotChats = [
        createMockChat({ createdAt: null }),
        createMockChat(), // Valid chat
      ]

      mockPrisma.chat.findMany
        .mockResolvedValueOnce(timeSlotChats)
        .mockResolvedValueOnce([])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14'
      })
      const response = await GET(request)

      const data = await response.json()
      expect(data.summary.totalChats).toBe(1)
    })

    it('should exclude chats with null responseAt', async () => {
      const timeSlotChats = [
        createMockChat({ responseAt: null }),
        createMockChat(), // Valid chat
      ]

      mockPrisma.chat.findMany
        .mockResolvedValueOnce(timeSlotChats)
        .mockResolvedValueOnce([])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        dayOfWeek: '2',
        hour: '14'
      })
      const response = await GET(request)

      const data = await response.json()
      expect(data.summary.totalChats).toBe(1)
    })
  })
})
