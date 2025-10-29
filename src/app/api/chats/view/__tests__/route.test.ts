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
      count: jest.fn(),
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

describe('/api/chats/view', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function createRequest(searchParams: Record<string, string> = {}): NextRequest {
    const url = new URL('http://localhost:3000/api/chats/view')
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
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

  it('should return chats with response time metrics', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)

    mockPrisma.chat.count.mockResolvedValue(2)
    mockPrisma.chat.findMany.mockResolvedValue([
      {
        id: 'chat1',
        b2chatId: 'b2chat-1',
        status: 'CLOSED',
        priority: 'normal',
        provider: 'whatsapp',
        overallSLA: true,
        tags: [],
        topic: null,
        unreadCount: 0,
        direction: 'inbound',
        lastModifiedAt: new Date('2025-01-15T12:00:00Z'),
        createdAt: new Date('2025-01-15T10:00:00Z'),
        openedAt: new Date('2025-01-15T10:00:00Z'),
        pickedUpAt: new Date('2025-01-15T10:00:30Z'),
        responseAt: new Date('2025-01-15T10:01:23Z'),
        closedAt: new Date('2025-01-15T12:00:00Z'),
        pickupSLA: true,
        firstResponseSLA: true,
        resolutionSLA: true,
        contact: {
          id: 'contact1',
          fullName: 'John Doe',
        },
        agent: {
          id: 'agent1',
          name: 'Agent Smith',
        },
        department: {
          id: 'dept1',
          name: 'Support',
        },
        messages: [
          { timestamp: new Date('2025-01-15T10:00:00Z'), incoming: true },
          { timestamp: new Date('2025-01-15T10:01:23Z'), incoming: false }, // 83s response
        ],
      },
      {
        id: 'chat2',
        b2chatId: 'b2chat-2',
        status: 'OPENED',
        priority: 'high',
        provider: 'telegram',
        overallSLA: false,
        tags: ['urgent'],
        topic: 'billing',
        unreadCount: 2,
        direction: 'inbound',
        lastModifiedAt: new Date('2025-01-15T11:00:00Z'),
        createdAt: new Date('2025-01-15T11:00:00Z'),
        openedAt: new Date('2025-01-15T11:00:00Z'),
        pickedUpAt: null,
        responseAt: null,
        closedAt: null,
        pickupSLA: false,
        firstResponseSLA: false,
        resolutionSLA: false,
        contact: {
          id: 'contact2',
          fullName: 'Jane Smith',
        },
        agent: null,
        department: null,
        messages: [
          { timestamp: new Date('2025-01-15T11:00:00Z'), incoming: true },
        ],
      },
    ] as any)

    const request = createRequest()
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.chats).toHaveLength(2)
    expect(data.chats[0]).toMatchObject({
      id: 'chat1',
      b2chatId: 'b2chat-1',
      contactName: 'John Doe',
      agentName: 'Agent Smith',
      messageCount: 2,
      firstResponseTimeMs: 83000,
      firstResponseTimeFormatted: '1m 23s',
      responseTimeIndicator: 'good',
    })
    expect(data.chats[1]).toMatchObject({
      id: 'chat2',
      contactName: 'Jane Smith',
      agentName: null,
      messageCount: 1,
      firstResponseTimeMs: null,
      firstResponseTimeFormatted: null,
      responseTimeIndicator: null,
    })
  })

  it('should validate pagination parameters', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)

    // Invalid page
    let request = createRequest({ page: '0' })
    let response = await GET(request)
    expect(response.status).toBe(400)

    // Invalid limit (too high)
    request = createRequest({ limit: '200' })
    response = await GET(request)
    expect(response.status).toBe(400)

    // Invalid limit (negative)
    request = createRequest({ limit: '-1' })
    response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('should filter by status', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)
    mockPrisma.chat.count.mockResolvedValue(0)
    mockPrisma.chat.findMany.mockResolvedValue([])

    const request = createRequest({ status: 'OPENED,CLOSED' })
    await GET(request)

    expect(mockPrisma.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['OPENED', 'CLOSED'] },
        }),
      })
    )
  })

  it('should filter by agent', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)
    mockPrisma.chat.count.mockResolvedValue(0)
    mockPrisma.chat.findMany.mockResolvedValue([])

    const request = createRequest({ agentId: 'agent1' })
    await GET(request)

    expect(mockPrisma.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          agentId: 'agent1',
        }),
      })
    )
  })

  it('should filter by unassigned agent', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)
    mockPrisma.chat.count.mockResolvedValue(0)
    mockPrisma.chat.findMany.mockResolvedValue([])

    const request = createRequest({ agentId: 'unassigned' })
    await GET(request)

    expect(mockPrisma.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          agentId: null,
        }),
      })
    )
  })

  it('should filter by contact name search', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)
    mockPrisma.chat.count.mockResolvedValue(0)
    mockPrisma.chat.findMany.mockResolvedValue([])

    const request = createRequest({ search: 'John' })
    await GET(request)

    expect(mockPrisma.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          contact: {
            fullName: { contains: 'John', mode: 'insensitive' },
          },
        }),
      })
    )
  })

  it('should filter by response time range', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)
    mockPrisma.chat.count.mockResolvedValue(3)
    mockPrisma.chat.findMany.mockResolvedValue([
      {
        id: 'chat1',
        b2chatId: 'b2chat-1',
        status: 'CLOSED',
        lastModifiedAt: new Date('2025-01-15T12:00:00Z'),
        createdAt: new Date('2025-01-15T10:00:00Z'),
        contact: { id: 'contact1', fullName: 'John Doe' },
        agent: { id: 'agent1', name: 'Agent Smith' },
        messages: [
          { timestamp: new Date('2025-01-15T10:00:00Z'), incoming: true },
          { timestamp: new Date('2025-01-15T10:00:30Z'), incoming: false }, // 30s - fast
        ],
      },
      {
        id: 'chat2',
        b2chatId: 'b2chat-2',
        status: 'CLOSED',
        lastModifiedAt: new Date('2025-01-15T12:00:00Z'),
        createdAt: new Date('2025-01-15T10:00:00Z'),
        contact: { id: 'contact2', fullName: 'Jane Smith' },
        agent: { id: 'agent1', name: 'Agent Smith' },
        messages: [
          { timestamp: new Date('2025-01-15T10:00:00Z'), incoming: true },
          { timestamp: new Date('2025-01-15T10:02:00Z'), incoming: false }, // 120s - good
        ],
      },
      {
        id: 'chat3',
        b2chatId: 'b2chat-3',
        status: 'CLOSED',
        lastModifiedAt: new Date('2025-01-15T12:00:00Z'),
        createdAt: new Date('2025-01-15T10:00:00Z'),
        contact: { id: 'contact3', fullName: 'Bob Johnson' },
        agent: { id: 'agent1', name: 'Agent Smith' },
        messages: [
          { timestamp: new Date('2025-01-15T10:00:00Z'), incoming: true },
          { timestamp: new Date('2025-01-15T10:05:00Z'), incoming: false }, // 300s - slow
        ],
      },
    ] as any)

    // Filter for fast responses (< 60s)
    const request = createRequest({ responseTimeMax: '60000' })
    const response = await GET(request)
    const data = await response.json()

    expect(data.chats).toHaveLength(1)
    expect(data.chats[0].firstResponseTimeMs).toBe(30000)
  })

  it('should sort by updatedAt', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)
    mockPrisma.chat.count.mockResolvedValue(0)
    mockPrisma.chat.findMany.mockResolvedValue([])

    const request = createRequest({ sortBy: 'updatedAt', sortOrder: 'asc' })
    await GET(request)

    expect(mockPrisma.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'asc' },
      })
    )
  })

  it('should sort by response time', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)
    mockPrisma.chat.count.mockResolvedValue(3)
    mockPrisma.chat.findMany.mockResolvedValue([
      {
        id: 'chat1',
        b2chatId: 'b2chat-1',
        status: 'CLOSED',
        lastModifiedAt: new Date('2025-01-15T12:00:00Z'),
        createdAt: new Date('2025-01-15T10:00:00Z'),
        contact: { id: 'contact1', fullName: 'John' },
        agent: { id: 'agent1', name: 'Agent' },
        messages: [
          { timestamp: new Date('2025-01-15T10:00:00Z'), incoming: true },
          { timestamp: new Date('2025-01-15T10:05:00Z'), incoming: false }, // 300s
        ],
      },
      {
        id: 'chat2',
        b2chatId: 'b2chat-2',
        status: 'CLOSED',
        lastModifiedAt: new Date('2025-01-15T12:00:00Z'),
        createdAt: new Date('2025-01-15T10:00:00Z'),
        contact: { id: 'contact2', fullName: 'Jane' },
        agent: { id: 'agent1', name: 'Agent' },
        messages: [
          { timestamp: new Date('2025-01-15T10:00:00Z'), incoming: true },
          { timestamp: new Date('2025-01-15T10:01:00Z'), incoming: false }, // 60s
        ],
      },
      {
        id: 'chat3',
        b2chatId: 'b2chat-3',
        status: 'CLOSED',
        lastModifiedAt: new Date('2025-01-15T12:00:00Z'),
        createdAt: new Date('2025-01-15T10:00:00Z'),
        contact: { id: 'contact3', fullName: 'Bob' },
        agent: { id: 'agent1', name: 'Agent' },
        messages: [
          { timestamp: new Date('2025-01-15T10:00:00Z'), incoming: true },
          { timestamp: new Date('2025-01-15T10:03:00Z'), incoming: false }, // 180s
        ],
      },
    ] as any)

    // Sort by response time descending (slowest first)
    const request = createRequest({ sortBy: 'responseTime', sortOrder: 'desc' })
    const response = await GET(request)
    const data = await response.json()

    expect(data.chats[0].firstResponseTimeMs).toBe(300000) // Slowest
    expect(data.chats[1].firstResponseTimeMs).toBe(180000)
    expect(data.chats[2].firstResponseTimeMs).toBe(60000)  // Fastest
  })

  it('should handle pagination correctly', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)
    mockPrisma.chat.count.mockResolvedValue(50)
    mockPrisma.chat.findMany.mockResolvedValue([])

    const request = createRequest({ page: '2', limit: '10' })
    const response = await GET(request)
    const data = await response.json()

    expect(data.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 50,
      totalPages: 5,
    })

    expect(mockPrisma.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10, // (page 2 - 1) * 10
        take: 10,
      })
    )
  })

  it('should validate sortBy parameter', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)

    const request = createRequest({ sortBy: 'invalidField' })
    const response = await GET(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('Invalid sortBy parameter')
  })

  it('should validate response time parameters', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)

    // Invalid responseTimeMin
    let request = createRequest({ responseTimeMin: '-100' })
    let response = await GET(request)
    expect(response.status).toBe(400)

    // Invalid responseTimeMax
    request = createRequest({ responseTimeMax: 'notanumber' })
    response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('should handle database errors gracefully', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)
    mockPrisma.chat.count.mockRejectedValue(new Error('Database connection failed'))

    const request = createRequest()
    const response = await GET(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Failed to fetch chat view')
  })

  it('should handle chats without contacts gracefully', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' } as any)
    mockPrisma.chat.count.mockResolvedValue(1)
    mockPrisma.chat.findMany.mockResolvedValue([
      {
        id: 'chat1',
        b2chatId: 'b2chat-1',
        status: 'OPENED',
        lastModifiedAt: new Date('2025-01-15T12:00:00Z'),
        createdAt: new Date('2025-01-15T10:00:00Z'),
        contact: null,
        agent: null,
        messages: [],
      },
    ] as any)

    const request = createRequest()
    const response = await GET(request)
    const data = await response.json()

    expect(data.chats[0].contactName).toBe('Unknown')
    expect(data.chats[0].contactId).toBe('')
  })
})
