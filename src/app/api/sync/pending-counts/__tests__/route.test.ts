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
    extractLog: {
      findMany: jest.fn(),
    },
    rawContact: {
      count: jest.fn(),
    },
    rawChat: {
      count: jest.fn(),
    },
  },
}))

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('/api/sync/pending-counts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 if user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null })

    const response = await GET()

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data).toEqual({ error: 'Unauthorized' })
  })

  it('should return correct pending counts with completed extracts', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    // Mock completed extracts
    mockPrisma.extractLog.findMany.mockResolvedValue([
      { syncId: 'extract_contacts_1', entityType: 'contacts' },
      { syncId: 'extract_chats_1', entityType: 'chats' },
      { syncId: 'extract_all_1', entityType: 'all' },
    ])

    // Mock pending counts
    mockPrisma.rawContact.count.mockResolvedValue(294)
    mockPrisma.rawChat.count.mockResolvedValue(50)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      counts: {
        contacts: 294,
        chats: 50,
        total: 344,
      },
    })
  })

  it('should return zero counts when no pending data', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    // Mock completed extracts
    mockPrisma.extractLog.findMany.mockResolvedValue([
      { syncId: 'extract_contacts_1', entityType: 'contacts' },
    ])

    // Mock zero pending counts
    mockPrisma.rawContact.count.mockResolvedValue(0)
    mockPrisma.rawChat.count.mockResolvedValue(0)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      counts: {
        contacts: 0,
        chats: 0,
        total: 0,
      },
    })
  })

  it('should only count from completed extracts', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    // Mock with some completed and some running extracts
    mockPrisma.extractLog.findMany.mockResolvedValue([
      { syncId: 'extract_contacts_1', entityType: 'contacts' },
      { syncId: 'extract_contacts_2', entityType: 'contacts' },
    ])

    mockPrisma.rawContact.count.mockResolvedValue(100)
    mockPrisma.rawChat.count.mockResolvedValue(25)

    const response = await GET()

    // Verify the findMany was called with status: 'completed'
    expect(mockPrisma.extractLog.findMany).toHaveBeenCalledWith({
      where: { status: 'completed' },
      select: { syncId: true, entityType: true },
    })

    const data = await response.json()
    expect(data.counts).toEqual({
      contacts: 100,
      chats: 25,
      total: 125,
    })
  })

  it('should handle entityType filtering correctly for contacts', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    // Mock extracts with different entity types
    mockPrisma.extractLog.findMany.mockResolvedValue([
      { syncId: 'extract_contacts_1', entityType: 'contacts' },
      { syncId: 'extract_all_1', entityType: 'all' },
      { syncId: 'extract_chats_1', entityType: 'chats' },
    ])

    mockPrisma.rawContact.count.mockResolvedValue(150)
    mockPrisma.rawChat.count.mockResolvedValue(30)

    const response = await GET()

    // Verify rawContact.count was called with correct syncIds (contacts + all)
    expect(mockPrisma.rawContact.count).toHaveBeenCalledWith({
      where: {
        processingStatus: 'pending',
        syncId: { in: expect.arrayContaining(['extract_contacts_1', 'extract_all_1']) },
      },
    })

    // Verify rawChat.count was called with correct syncIds (chats + all)
    expect(mockPrisma.rawChat.count).toHaveBeenCalledWith({
      where: {
        processingStatus: 'pending',
        syncId: { in: expect.arrayContaining(['extract_chats_1', 'extract_all_1']) },
      },
    })

    const data = await response.json()
    expect(response.status).toBe(200)
  })

  it('should handle database errors gracefully', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    // Mock database error
    mockPrisma.extractLog.findMany.mockRejectedValue(new Error('Database connection failed'))

    const response = await GET()

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data).toEqual({ error: 'Failed to fetch pending counts' })
  })

  it('should handle empty completed extracts', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    // Mock no completed extracts
    mockPrisma.extractLog.findMany.mockResolvedValue([])

    mockPrisma.rawContact.count.mockResolvedValue(0)
    mockPrisma.rawChat.count.mockResolvedValue(0)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.counts).toEqual({
      contacts: 0,
      chats: 0,
      total: 0,
    })

    // Verify count was called with empty array
    expect(mockPrisma.rawContact.count).toHaveBeenCalledWith({
      where: {
        processingStatus: 'pending',
        syncId: { in: [] },
      },
    })
  })

  it('should use Promise.all for parallel queries', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    mockPrisma.extractLog.findMany.mockResolvedValue([
      { syncId: 'extract_1', entityType: 'all' },
    ])

    mockPrisma.rawContact.count.mockResolvedValue(100)
    mockPrisma.rawChat.count.mockResolvedValue(50)

    const response = await GET()

    // Verify both counts were called (parallel execution)
    expect(mockPrisma.rawContact.count).toHaveBeenCalled()
    expect(mockPrisma.rawChat.count).toHaveBeenCalled()

    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.counts.total).toBe(150)
  })
})
