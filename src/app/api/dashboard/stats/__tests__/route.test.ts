/**
 * @jest-environment node
 */

import { GET } from '../route'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}))

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    agent: {
      count: jest.fn(),
    },
    chat: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    message: {
      count: jest.fn(),
    },
  },
}))

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('/api/dashboard/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 if user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null })

    const response = await GET()

    expect(response.status).toBe(401)
  })

  it('should return dashboard stats successfully', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    // Mock database queries
    mockPrisma.agent.count
      .mockResolvedValueOnce(10) // totalAgents
      .mockResolvedValueOnce(8) // agentsLastMonth

    mockPrisma.chat.count
      .mockResolvedValueOnce(250) // totalChats
      .mockResolvedValueOnce(5) // activeChats
      .mockResolvedValueOnce(15) // chatsYesterday
      .mockResolvedValueOnce(18) // chatsToday

    mockPrisma.message.count.mockResolvedValue(1500) // totalMessages

    mockPrisma.chat.findMany.mockResolvedValue([
      {
        openedAt: new Date('2024-01-01T10:00:00Z'),
        pickedUpAt: new Date('2024-01-01T10:02:30Z'), // 2.5 minutes response time
      },
      {
        openedAt: new Date('2024-01-01T11:00:00Z'),
        pickedUpAt: new Date('2024-01-01T11:01:30Z'), // 1.5 minutes response time
      },
    ])

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      totalAgents: 10,
      totalChats: 250,
      totalMessages: 1500,
      activeChats: 5,
      avgResponseTime: expect.stringContaining('m'),
      satisfactionRate: expect.any(Number),
      trends: {
        agentsChange: expect.any(Number),
        chatsChange: expect.any(Number),
        responseTimeChange: 0,
        satisfactionChange: 0,
      },
    })
  })

  it('should calculate satisfaction rate based on response time', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    // Mock for excellent response time scenario
    mockPrisma.agent.count
      .mockResolvedValueOnce(10) // totalAgents
      .mockResolvedValueOnce(10) // onlineAgents
      .mockResolvedValueOnce(8) // agentsLastMonth

    mockPrisma.chat.count
      .mockResolvedValueOnce(100) // totalChats
      .mockResolvedValueOnce(5) // activeChats
      .mockResolvedValueOnce(10) // chatsYesterday
      .mockResolvedValueOnce(12) // chatsToday

    mockPrisma.message.count.mockResolvedValue(500)

    // Mock fast response times (under 2 minutes)
    mockPrisma.chat.findMany.mockResolvedValue([
      {
        openedAt: new Date('2024-01-01T10:00:00Z'),
        pickedUpAt: new Date('2024-01-01T10:01:00Z'), // 1 minute
      },
      {
        openedAt: new Date('2024-01-01T11:00:00Z'),
        pickedUpAt: new Date('2024-01-01T11:01:30Z'), // 1.5 minutes
      },
    ])

    const response = await GET()
    const data = await response.json()

    expect(data.satisfactionRate).toBeGreaterThanOrEqual(95) // Should be high for fast response
  })

  it('should handle database errors gracefully', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    mockPrisma.agent.count.mockRejectedValue(new Error('Database error'))

    const response = await GET()

    expect(response.status).toBe(500)
  })

  it('should calculate trends correctly', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    mockPrisma.agent.count
      .mockResolvedValueOnce(12) // totalAgents (current)
      .mockResolvedValueOnce(10) // agentsLastMonth

    mockPrisma.chat.count
      .mockResolvedValueOnce(100) // totalChats
      .mockResolvedValueOnce(5) // activeChats
      .mockResolvedValueOnce(10) // chatsYesterday
      .mockResolvedValueOnce(15) // chatsToday

    mockPrisma.message.count.mockResolvedValue(500)
    mockPrisma.chat.findMany.mockResolvedValue([])

    const response = await GET()
    const data = await response.json()

    expect(data.trends.agentsChange).toBe(2) // 12 - 10 = 2
    expect(data.trends.chatsChange).toBe(50) // ((15-10)/10)*100 = 50%
  })

  it('should handle zero data gracefully', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    // Mock all counts as zero
    mockPrisma.agent.count.mockResolvedValue(0)
    mockPrisma.chat.count.mockResolvedValue(0)
    mockPrisma.message.count.mockResolvedValue(0)
    mockPrisma.chat.findMany.mockResolvedValue([])

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.totalAgents).toBe(0)
    expect(data.totalChats).toBe(0)
    expect(data.avgResponseTime).toBe('0m')
    expect(data.satisfactionRate).toBe(85) // Default for no data
  })
})