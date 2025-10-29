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
      groupBy: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    department: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  },
}))

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}))

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('/api/chats/view/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createRequest(): NextRequest {
    const url = new URL('http://localhost:3000/api/chats/view/stats')
    return new NextRequest(url)
  }

  it('should return 401 if user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any)

    const request = createRequest()
    const response = await GET(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('should return aggregated statistics', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)

    // Mock status counts
    ;(mockPrisma.chat.groupBy as jest.Mock).mockResolvedValueOnce([
      { status: 'OPENED', _count: 5 },
      { status: 'CLOSED', _count: 10 },
      { status: 'PICKED_UP', _count: 3 },
    ])

    // Mock department counts
    ;(mockPrisma.chat.groupBy as jest.Mock).mockResolvedValueOnce([
      { departmentId: 'dept1', _count: 8 },
      { departmentId: 'dept2', _count: 6 },
    ])

    mockPrisma.department.findMany.mockResolvedValue([
      { id: 'dept1', name: 'Support' },
      { id: 'dept2', name: 'Sales' },
    ] as any)

    // Mock agent counts
    ;(mockPrisma.chat.groupBy as jest.Mock).mockResolvedValueOnce([
      { agentId: 'agent1', _count: 7 },
      { agentId: 'agent2', _count: 4 },
    ])

    ;(mockPrisma.chat.count as jest.Mock).mockResolvedValueOnce(3) // unassigned count

    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'agent1', name: 'Agent One' },
      { id: 'agent2', name: 'Agent Two' },
    ] as any)

    // Mock priority counts
    ;(mockPrisma.chat.groupBy as jest.Mock).mockResolvedValueOnce([
      { priority: 'normal', _count: 10 },
      { priority: 'high', _count: 5 },
      { priority: 'urgent', _count: 3 },
    ])

    // Mock SLA counts
    ;(mockPrisma.chat.count as jest.Mock)
      .mockResolvedValueOnce(12) // SLA within
      .mockResolvedValueOnce(6) // SLA breached

    // Mock provider counts
    ;(mockPrisma.chat.groupBy as jest.Mock).mockResolvedValueOnce([
      { provider: 'whatsapp', _count: 10 },
      { provider: 'telegram', _count: 5 },
      { provider: 'facebook', _count: 3 },
    ])

    // Mock message counts
    mockPrisma.chat.findMany.mockResolvedValue([
      { id: 'chat1', _count: { messages: 0 } },
      { id: 'chat2', _count: { messages: 3 } },
      { id: 'chat3', _count: { messages: 8 } },
      { id: 'chat4', _count: { messages: 15 } },
      { id: 'chat5', _count: { messages: 25 } },
    ] as any)

    const request = createRequest()
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    // Verify structure
    expect(data).toHaveProperty('byStatus')
    expect(data).toHaveProperty('byDepartment')
    expect(data).toHaveProperty('byAgent')
    expect(data).toHaveProperty('byPriority')
    expect(data).toHaveProperty('bySLA')
    expect(data).toHaveProperty('byProvider')
    expect(data).toHaveProperty('byMessageCount')

    // Verify status counts
    expect(data.byStatus.OPENED).toBe(5)
    expect(data.byStatus.CLOSED).toBe(10)
    expect(data.byStatus.PICKED_UP).toBe(3)

    // Verify department counts
    expect(data.byDepartment.dept1).toEqual({ name: 'Support', count: 8 })
    expect(data.byDepartment.dept2).toEqual({ name: 'Sales', count: 6 })

    // Verify agent counts
    expect(data.byAgent.unassigned).toBe(3)
    expect(data.byAgent.agent1).toEqual({ name: 'Agent One', count: 7 })
    expect(data.byAgent.agent2).toEqual({ name: 'Agent Two', count: 4 })

    // Verify priority counts
    expect(data.byPriority.normal).toBe(10)
    expect(data.byPriority.high).toBe(5)
    expect(data.byPriority.urgent).toBe(3)

    // Verify SLA counts
    expect(data.bySLA.within).toBe(12)
    expect(data.bySLA.breached).toBe(6)

    // Verify provider counts
    expect(data.byProvider.whatsapp).toBe(10)
    expect(data.byProvider.telegram).toBe(5)
    expect(data.byProvider.facebook).toBe(3)

    // Verify message count ranges
    expect(data.byMessageCount['0']).toBe(1)
    expect(data.byMessageCount['1-5']).toBe(1)
    expect(data.byMessageCount['6-10']).toBe(1)
    expect(data.byMessageCount['11-20']).toBe(1)
    expect(data.byMessageCount['20+']).toBe(1)
  })

  it('should handle empty department results', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)

    ;(mockPrisma.chat.groupBy as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.chat.count as jest.Mock).mockResolvedValue(0)
    mockPrisma.department.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.chat.findMany.mockResolvedValue([])

    const request = createRequest()
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.byDepartment).toEqual({})
    expect(data.byAgent.unassigned).toBe(0)
  })

  it('should handle database errors gracefully', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)

    ;(mockPrisma.chat.groupBy as jest.Mock).mockRejectedValue(
      new Error('Database connection failed')
    )

    const request = createRequest()
    const response = await GET(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Failed to fetch chat view stats')
  })

  it('should correctly categorize message counts', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)

    // Set up minimal mocks for other groupBy calls
    ;(mockPrisma.chat.groupBy as jest.Mock).mockResolvedValue([])
    ;(mockPrisma.chat.count as jest.Mock).mockResolvedValue(0)
    mockPrisma.department.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([])

    // Mock various message counts
    mockPrisma.chat.findMany.mockResolvedValue([
      { id: 'chat1', _count: { messages: 0 } },
      { id: 'chat2', _count: { messages: 0 } },
      { id: 'chat3', _count: { messages: 1 } },
      { id: 'chat4', _count: { messages: 5 } },
      { id: 'chat5', _count: { messages: 6 } },
      { id: 'chat6', _count: { messages: 10 } },
      { id: 'chat7', _count: { messages: 11 } },
      { id: 'chat8', _count: { messages: 20 } },
      { id: 'chat9', _count: { messages: 21 } },
      { id: 'chat10', _count: { messages: 50 } },
    ] as any)

    const request = createRequest()
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.byMessageCount['0']).toBe(2) // 0, 0
    expect(data.byMessageCount['1-5']).toBe(2) // 1, 5
    expect(data.byMessageCount['6-10']).toBe(2) // 6, 10
    expect(data.byMessageCount['11-20']).toBe(2) // 11, 20
    expect(data.byMessageCount['20+']).toBe(2) // 21, 50
  })
})
