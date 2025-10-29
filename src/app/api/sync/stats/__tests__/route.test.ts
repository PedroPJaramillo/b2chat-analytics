/**
 * @jest-environment node
 */

import { GET } from '../route'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { B2ChatClient } from '@/lib/b2chat/client'

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}))

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contact: {
      count: jest.fn(),
    },
    chat: {
      count: jest.fn(),
    },
    rawContact: {
      groupBy: jest.fn(),
    },
    rawChat: {
      groupBy: jest.fn(),
    },
  },
}))

// Mock B2ChatClient
const mockGetTotalCounts = jest.fn()
jest.mock('@/lib/b2chat/client', () => ({
  B2ChatClient: jest.fn().mockImplementation(() => ({
    getTotalCounts: mockGetTotalCounts,
  })),
}))

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('/api/sync/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 if user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null })

    const response = await GET({} as any)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data).toEqual({ error: 'Unauthorized' })
  })

  it('should return complete sync statistics including stub contacts', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    // Mock B2Chat totals
    mockGetTotalCounts.mockResolvedValue({
      contacts: 1000,
      chats: 500,
    })

    // Mock Prisma counts - Fix 006: includes stub contact count
    mockPrisma.contact.count
      .mockResolvedValueOnce(521) // total contacts
      .mockResolvedValueOnce(15) // stub contacts (needsFullSync=true)
    mockPrisma.chat.count.mockResolvedValue(250)

    // Mock groupBy for raw tables
    mockPrisma.rawContact.groupBy.mockResolvedValue([
      { processingStatus: 'pending', _count: { id: 294 } },
      { processingStatus: 'completed', _count: { id: 200 } },
      { processingStatus: 'failed', _count: { id: 6 } },
    ])
    mockPrisma.rawChat.groupBy.mockResolvedValue([
      { processingStatus: 'pending', _count: { id: 50 } },
      { processingStatus: 'completed', _count: { id: 150 } },
    ])

    const response = await GET({} as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      b2chat: {
        contacts: 1000,
        chats: 500,
        total: 1500,
      },
      synced: {
        contacts: 521,
        chats: 250,
        contactsNeedingSync: 15, // Fix 006: stub count
        total: 771,
      },
      raw: {
        contacts: {
          total: 500,
          pending: 294,
          processing: 0,
          completed: 200,
          failed: 6,
        },
        chats: {
          total: 200,
          pending: 50,
          processing: 0,
          completed: 150,
          failed: 0,
        },
        total: 700,
      },
      syncPercentage: {
        contacts: 52,
        chats: 50,
        overall: 51,
      },
    })
  })

  it('should return zero contactsNeedingSync when all contacts are full', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    mockGetTotalCounts.mockResolvedValue({
      contacts: 100,
      chats: 50,
    })

    mockPrisma.contact.count
      .mockResolvedValueOnce(100) // total contacts
      .mockResolvedValueOnce(0) // no stub contacts
    mockPrisma.chat.count.mockResolvedValue(50)

    mockPrisma.rawContact.groupBy.mockResolvedValue([])
    mockPrisma.rawChat.groupBy.mockResolvedValue([])

    const response = await GET({} as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.synced.contactsNeedingSync).toBe(0)
  })

  it('should query stub contacts with correct filter (needsFullSync=true)', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    mockGetTotalCounts.mockResolvedValue({
      contacts: 100,
      chats: 50,
    })

    mockPrisma.contact.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(25) // stub contacts

    mockPrisma.chat.count.mockResolvedValue(50)
    mockPrisma.rawContact.groupBy.mockResolvedValue([])
    mockPrisma.rawChat.groupBy.mockResolvedValue([])

    await GET({} as any)

    // Verify the stub contacts query
    expect(mockPrisma.contact.count).toHaveBeenCalledTimes(2)
    expect(mockPrisma.contact.count).toHaveBeenNthCalledWith(1) // first call: total
    expect(mockPrisma.contact.count).toHaveBeenNthCalledWith(2, {
      where: { needsFullSync: true },
    })
  })

  it('should calculate raw table statistics correctly', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    mockGetTotalCounts.mockResolvedValue({
      contacts: 1000,
      chats: 500,
    })

    mockPrisma.contact.count.mockResolvedValueOnce(500).mockResolvedValueOnce(10)
    mockPrisma.chat.count.mockResolvedValue(250)

    // Mock raw contacts with all processing statuses
    mockPrisma.rawContact.groupBy.mockResolvedValue([
      { processingStatus: 'pending', _count: { id: 100 } },
      { processingStatus: 'processing', _count: { id: 50 } },
      { processingStatus: 'completed', _count: { id: 300 } },
      { processingStatus: 'failed', _count: { id: 50 } },
    ])

    // Mock raw chats
    mockPrisma.rawChat.groupBy.mockResolvedValue([
      { processingStatus: 'pending', _count: { id: 75 } },
      { processingStatus: 'completed', _count: { id: 175 } },
    ])

    const response = await GET({} as any)
    const data = await response.json()

    expect(data.raw.contacts).toEqual({
      total: 500,
      pending: 100,
      processing: 50,
      completed: 300,
      failed: 50,
    })

    expect(data.raw.chats).toEqual({
      total: 250,
      pending: 75,
      processing: 0,
      completed: 175,
      failed: 0,
    })

    expect(data.raw.total).toBe(750)
  })

  it('should calculate sync percentages correctly', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    mockGetTotalCounts.mockResolvedValue({
      contacts: 1000,
      chats: 400,
    })

    mockPrisma.contact.count.mockResolvedValueOnce(750).mockResolvedValueOnce(20)
    mockPrisma.chat.count.mockResolvedValue(200)
    mockPrisma.rawContact.groupBy.mockResolvedValue([])
    mockPrisma.rawChat.groupBy.mockResolvedValue([])

    const response = await GET({} as any)
    const data = await response.json()

    expect(data.syncPercentage).toEqual({
      contacts: 75, // 750/1000
      chats: 50, // 200/400
      overall: 68, // 950/1400
    })
  })

  it('should handle zero B2Chat counts gracefully', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    mockGetTotalCounts.mockResolvedValue({
      contacts: 0,
      chats: 0,
    })

    mockPrisma.contact.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0)
    mockPrisma.chat.count.mockResolvedValue(0)
    mockPrisma.rawContact.groupBy.mockResolvedValue([])
    mockPrisma.rawChat.groupBy.mockResolvedValue([])

    const response = await GET({} as any)
    const data = await response.json()

    expect(data.syncPercentage).toEqual({
      contacts: 100, // Default to 100% when B2Chat count is 0
      chats: 100,
      overall: 100,
    })
  })

  it('should handle database errors gracefully', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    mockGetTotalCounts.mockResolvedValue({
      contacts: 1000,
      chats: 500,
    })

    // Mock database error
    mockPrisma.contact.count.mockRejectedValue(new Error('Database connection failed'))

    const response = await GET({} as any)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data).toEqual({ error: 'Failed to get sync statistics' })
  })

  it('should use Promise.all for parallel queries', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    mockGetTotalCounts.mockResolvedValue({
      contacts: 100,
      chats: 50,
    })

    mockPrisma.contact.count.mockResolvedValueOnce(100).mockResolvedValueOnce(5)
    mockPrisma.chat.count.mockResolvedValue(50)
    mockPrisma.rawContact.groupBy.mockResolvedValue([])
    mockPrisma.rawChat.groupBy.mockResolvedValue([])

    await GET({} as any)

    // Verify all queries were called (parallel execution)
    expect(mockPrisma.contact.count).toHaveBeenCalledTimes(2) // total + stubs
    expect(mockPrisma.chat.count).toHaveBeenCalledTimes(1)
    expect(mockPrisma.rawContact.groupBy).toHaveBeenCalledTimes(1)
    expect(mockPrisma.rawChat.groupBy).toHaveBeenCalledTimes(1)
  })
})
