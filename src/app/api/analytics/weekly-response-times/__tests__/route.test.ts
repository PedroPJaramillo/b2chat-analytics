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
    agent: {
      findUnique: jest.fn(),
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
  const url = new URL('http://localhost:3000/api/analytics/weekly-response-times')
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
  return new NextRequest(url)
}

// Helper to create mock chat data
function createMockChat(overrides: any = {}) {
  return {
    id: 'chat_' + Math.random(),
    createdAt: new Date('2025-10-15T10:00:00Z'),
    openedAt: new Date('2025-10-15T10:00:00Z'),
    responseAt: new Date('2025-10-15T10:02:00Z'), // 2 min response
    agentId: 'agent_123',
    direction: 'incoming',
    isDeleted: false,
    ...overrides,
  }
}

describe('GET /api/analytics/weekly-response-times', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: 'user_123' })
    mockPrisma.systemSetting.findMany.mockResolvedValue([])
  })

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null })

      const request = createMockRequest({ weekStart: '2025-10-13' })
      const response = await GET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('Query Parameter Validation', () => {
    it('should return 400 if weekStart parameter is missing', async () => {
      const request = createMockRequest({})
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('weekStart')
    })

    it('should return 400 if weekStart parameter is invalid format', async () => {
      const request = createMockRequest({ weekStart: 'invalid-date' })
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid')
    })

    it('should accept valid weekStart in YYYY-MM-DD format', async () => {
      mockPrisma.chat.findMany.mockResolvedValue([])

      const request = createMockRequest({ weekStart: '2025-10-13' })
      const response = await GET(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Agent Filter', () => {
    it('should return aggregate data when agentId is "all"', async () => {
      mockPrisma.chat.findMany.mockResolvedValue([
        createMockChat({ agentId: 'agent_1' }),
        createMockChat({ agentId: 'agent_2' }),
      ])

      const request = createMockRequest({ weekStart: '2025-10-13', agentId: 'all' })
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.agentId).toBeNull()
      expect(data.agentName).toBeNull()
    })

    it('should filter by specific agent when agentId is provided', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({
        id: 'agent_123',
        name: 'John Doe',
        email: 'john@example.com',
      } as any)

      mockPrisma.chat.findMany.mockResolvedValue([
        createMockChat({ agentId: 'agent_123' }),
      ])

      const request = createMockRequest({ weekStart: '2025-10-13', agentId: 'agent_123' })
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.agentId).toBe('agent_123')
      expect(data.agentName).toBe('John Doe')
    })

    it('should return 404 if agent does not exist', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null)

      const request = createMockRequest({ weekStart: '2025-10-13', agentId: 'nonexistent' })
      const response = await GET(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toContain('Agent not found')
    })
  })

  describe('Direction Filter', () => {
    it('should filter by incoming direction', async () => {
      mockPrisma.chat.findMany.mockResolvedValue([
        createMockChat({ direction: 'incoming' }),
      ])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        direction: 'incoming'
      })
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.filters.direction).toBe('incoming')
    })

    it('should filter by outgoing direction', async () => {
      mockPrisma.chat.findMany.mockResolvedValue([
        createMockChat({ direction: 'outgoing' }),
      ])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        direction: 'outgoing'
      })
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.filters.direction).toBe('outgoing')
    })

    it('should handle "all" direction filter', async () => {
      mockPrisma.chat.findMany.mockResolvedValue([
        createMockChat({ direction: 'incoming' }),
        createMockChat({ direction: 'outgoing' }),
      ])

      const request = createMockRequest({
        weekStart: '2025-10-13',
        direction: 'all'
      })
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.filters.direction).toBe('all')
    })
  })

  describe('Data Structure', () => {
    it('should return 168 hourly data points (7 days × 24 hours)', async () => {
      mockPrisma.chat.findMany.mockResolvedValue([])

      const request = createMockRequest({ weekStart: '2025-10-13' })
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data).toHaveLength(168)
    })

    it('should have correct data structure for each hourly slot', async () => {
      mockPrisma.chat.findMany.mockResolvedValue([])

      const request = createMockRequest({ weekStart: '2025-10-13' })
      const response = await GET(request)

      const data = await response.json()
      const firstSlot = data.data[0]

      expect(firstSlot).toHaveProperty('dayOfWeek')
      expect(firstSlot).toHaveProperty('dayName')
      expect(firstSlot).toHaveProperty('hour')
      expect(firstSlot).toHaveProperty('avg')
      expect(firstSlot).toHaveProperty('avgMs')
      expect(firstSlot).toHaveProperty('count')

      expect(firstSlot.dayOfWeek).toBeGreaterThanOrEqual(0)
      expect(firstSlot.dayOfWeek).toBeLessThanOrEqual(6)
      expect(firstSlot.hour).toBeGreaterThanOrEqual(0)
      expect(firstSlot.hour).toBeLessThanOrEqual(23)
    })

    it('should return correct week boundaries', async () => {
      mockPrisma.chat.findMany.mockResolvedValue([])

      const request = createMockRequest({ weekStart: '2025-10-13' })
      const response = await GET(request)

      const data = await response.json()
      expect(data.weekStart).toBe('2025-10-13')
      expect(data.weekEnd).toBe('2025-10-19')
    })
  })

  describe('Response Time Calculations', () => {
    it('should calculate average response time for time slot with data', async () => {
      // Monday Oct 13, 2025 at 10AM
      const mondayMorning = new Date('2025-10-13T10:00:00Z')

      mockPrisma.chat.findMany.mockResolvedValue([
        createMockChat({
          createdAt: mondayMorning,
          openedAt: mondayMorning,
          responseAt: new Date('2025-10-13T10:02:00Z'), // 2 min
        }),
        createMockChat({
          createdAt: mondayMorning,
          openedAt: mondayMorning,
          responseAt: new Date('2025-10-13T10:04:00Z'), // 4 min
        }),
      ])

      const request = createMockRequest({ weekStart: '2025-10-13' })
      const response = await GET(request)

      const data = await response.json()
      // Find Monday 10AM slot
      const mondaySlot = data.data.find((slot: any) =>
        slot.dayOfWeek === 1 && slot.hour === 10
      )

      expect(mondaySlot.count).toBe(2)
      expect(mondaySlot.avgMs).toBe(180000) // Average of 2min and 4min = 3min = 180000ms
      expect(mondaySlot.avg).toBe('3.0m')
    })

    it('should return count=0 for empty time slots', async () => {
      mockPrisma.chat.findMany.mockResolvedValue([
        // Only one chat on Monday morning
        createMockChat({
          createdAt: new Date('2025-10-13T10:00:00Z'),
        }),
      ])

      const request = createMockRequest({ weekStart: '2025-10-13' })
      const response = await GET(request)

      const data = await response.json()
      // Find Tuesday 10AM slot (should be empty)
      const tuesdaySlot = data.data.find((slot: any) =>
        slot.dayOfWeek === 2 && slot.hour === 10
      )

      expect(tuesdaySlot.count).toBe(0)
      expect(tuesdaySlot.avgMs).toBe(0)
      expect(tuesdaySlot.avg).toBe('0s')
    })
  })

  describe('Summary Statistics', () => {
    it('should include summary with total chats and overall average', async () => {
      mockPrisma.chat.findMany.mockResolvedValue([
        createMockChat({
          createdAt: new Date('2025-10-13T10:00:00Z'),
          openedAt: new Date('2025-10-13T10:00:00Z'),
          responseAt: new Date('2025-10-13T10:02:00Z'), // 2 min
        }),
        createMockChat({
          createdAt: new Date('2025-10-13T14:00:00Z'),
          openedAt: new Date('2025-10-13T14:00:00Z'),
          responseAt: new Date('2025-10-13T14:06:00Z'), // 6 min
        }),
      ])

      const request = createMockRequest({ weekStart: '2025-10-13' })
      const response = await GET(request)

      const data = await response.json()
      expect(data.summary).toHaveProperty('totalChats')
      expect(data.summary).toHaveProperty('overallAvg')
      expect(data.summary).toHaveProperty('overallAvgMs')
      expect(data.summary).toHaveProperty('fastestHour')
      expect(data.summary).toHaveProperty('slowestHour')

      expect(data.summary.totalChats).toBe(2)
      expect(data.summary.overallAvgMs).toBe(240000) // Average 4 min
    })

    it('should identify fastest and slowest hours', async () => {
      mockPrisma.chat.findMany.mockResolvedValue([
        // Fast hour: Monday 9AM (1 min)
        createMockChat({
          createdAt: new Date('2025-10-13T09:00:00Z'),
          openedAt: new Date('2025-10-13T09:00:00Z'),
          responseAt: new Date('2025-10-13T09:01:00Z'),
        }),
        // Slow hour: Monday 2PM (10 min)
        createMockChat({
          createdAt: new Date('2025-10-13T14:00:00Z'),
          openedAt: new Date('2025-10-13T14:00:00Z'),
          responseAt: new Date('2025-10-13T14:10:00Z'),
        }),
      ])

      const request = createMockRequest({ weekStart: '2025-10-13' })
      const response = await GET(request)

      const data = await response.json()
      expect(data.summary.fastestHour.hour).toBe(9)
      expect(data.summary.slowestHour.hour).toBe(14)
    })
  })

  describe('Edge Cases', () => {
    it('should handle week with no data', async () => {
      mockPrisma.chat.findMany.mockResolvedValue([])

      const request = createMockRequest({ weekStart: '2025-10-13' })
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.data).toHaveLength(168)
      expect(data.summary.totalChats).toBe(0)
      expect(data.summary.overallAvgMs).toBe(0)
    })

    it('should exclude chats with null openedAt or responseAt', async () => {
      mockPrisma.chat.findMany.mockResolvedValue([
        createMockChat({ openedAt: null }),
        createMockChat({ responseAt: null }),
        createMockChat(), // Valid chat
      ])

      const request = createMockRequest({ weekStart: '2025-10-13' })
      const response = await GET(request)

      const data = await response.json()
      expect(data.summary.totalChats).toBe(1) // Only the valid chat
    })

    it('should exclude deleted chats', async () => {
      // Mock should return only non-deleted chats (Prisma filters at DB level)
      mockPrisma.chat.findMany.mockResolvedValue([
        createMockChat({ isDeleted: false }),
      ])

      const request = createMockRequest({ weekStart: '2025-10-13' })
      const response = await GET(request)

      const data = await response.json()
      expect(data.summary.totalChats).toBe(1)
    })
  })

  describe('Error Handling', () => {
    it('should return 500 if database query fails', async () => {
      mockPrisma.chat.findMany.mockRejectedValue(new Error('Database error'))

      const request = createMockRequest({ weekStart: '2025-10-13' })
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toContain('Failed to fetch weekly response times')
    })
  })
})
