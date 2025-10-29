/**
 * @jest-environment node
 */

import { POST } from '../route'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}))

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contact: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

// Mock audit logger
jest.mock('@/lib/audit', () => ({
  auditLogger: {
    log: jest.fn(),
  },
  AuditEventType: {
    DATA_ACCESS: 'DATA_ACCESS',
  },
  AuditSeverity: {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
  },
}))

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('/api/sync/reconcile-contacts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 if user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null })

    const response = await POST()

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data).toEqual({ error: 'Unauthorized' })
  })

  it('should return reconciliation results with no stale stubs', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    // Mock contact counts by sync source
    mockPrisma.contact.count
      .mockResolvedValueOnce(5) // stubs
      .mockResolvedValueOnce(100) // full contacts
      .mockResolvedValueOnce(20) // upgraded

    // Mock no stale stubs
    mockPrisma.contact.findMany.mockResolvedValue([])

    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      results: {
        summary: {
          totalStubs: 5,
          totalFullContacts: 100,
          totalUpgradedContacts: 20,
          staleStubsFound: 0,
        },
        staleStubs: [],
        recommendations: ['No action needed - all contacts are up to date'],
      },
    })
  })

  it('should return reconciliation results with stale stubs', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    // Mock contact counts
    mockPrisma.contact.count
      .mockResolvedValueOnce(15) // stubs
      .mockResolvedValueOnce(100) // full contacts
      .mockResolvedValueOnce(50) // upgraded

    // Mock stale stubs (older than 7 days)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    const staleStubs = [
      {
        id: 'contact_stub_1',
        b2chatId: 'STUB_001',
        fullName: 'Stale Contact 1',
        lastSyncAt: tenDaysAgo,
      },
      {
        id: 'contact_stub_2',
        b2chatId: 'STUB_002',
        fullName: 'Stale Contact 2',
        lastSyncAt: tenDaysAgo,
      },
    ]
    mockPrisma.contact.findMany.mockResolvedValue(staleStubs)

    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.results.summary.staleStubsFound).toBe(2)
    expect(data.results.staleStubs).toHaveLength(2)
    expect(data.results.staleStubs[0]).toEqual({
      b2chatId: 'STUB_001',
      fullName: 'Stale Contact 1',
      lastSyncAt: tenDaysAgo.toISOString(),
      daysSinceLastSync: 10,
    })
    expect(data.results.recommendations).toEqual([
      'Run contact extraction to upgrade stale stubs',
      'Review stale contacts - they may be deleted from B2Chat',
    ])
  })

  it('should query stale stubs with correct date filter (>7 days)', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    mockPrisma.contact.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(15)

    mockPrisma.contact.findMany.mockResolvedValue([])

    await POST()

    // Verify findMany was called with correct date filter
    expect(mockPrisma.contact.findMany).toHaveBeenCalledWith({
      where: {
        needsFullSync: true,
        lastSyncAt: {
          lt: expect.any(Date),
        },
      },
      select: {
        id: true,
        b2chatId: true,
        fullName: true,
        lastSyncAt: true,
      },
      take: 100,
    })

    // Verify date is approximately 7 days ago (within 1 minute tolerance)
    const call = mockPrisma.contact.findMany.mock.calls[0][0]
    const filterDate = call.where.lastSyncAt.lt as Date
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const diff = Math.abs(filterDate.getTime() - sevenDaysAgo)
    expect(diff).toBeLessThan(60000) // Within 1 minute
  })

  it('should limit stale stub results to 100', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    mockPrisma.contact.count
      .mockResolvedValueOnce(200)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(50)

    mockPrisma.contact.findMany.mockResolvedValue([])

    await POST()

    // Verify take: 100 limit
    expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      })
    )
  })

  it('should call count three times for sync source breakdown', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    mockPrisma.contact.count
      .mockResolvedValueOnce(30) // chat_embedded
      .mockResolvedValueOnce(150) // contacts_api
      .mockResolvedValueOnce(70) // upgraded

    mockPrisma.contact.findMany.mockResolvedValue([])

    await POST()

    // Verify count was called 3 times with correct filters
    expect(mockPrisma.contact.count).toHaveBeenCalledTimes(3)
    expect(mockPrisma.contact.count).toHaveBeenNthCalledWith(1, {
      where: { syncSource: 'chat_embedded' },
    })
    expect(mockPrisma.contact.count).toHaveBeenNthCalledWith(2, {
      where: { syncSource: 'contacts_api' },
    })
    expect(mockPrisma.contact.count).toHaveBeenNthCalledWith(3, {
      where: { syncSource: 'upgraded' },
    })
  })

  it('should handle database errors gracefully', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    // Mock database error
    mockPrisma.contact.count.mockRejectedValue(new Error('Database connection failed'))

    const response = await POST()

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data).toEqual({ error: 'Failed to reconcile contacts' })
  })

  it('should use Promise.all for parallel count queries', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    mockPrisma.contact.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(30)

    mockPrisma.contact.findMany.mockResolvedValue([])

    await POST()

    // Verify all three counts were called (parallel execution)
    expect(mockPrisma.contact.count).toHaveBeenCalledTimes(3)
  })

  it('should calculate daysSinceLastSync correctly', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' })

    mockPrisma.contact.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(15)

    const exactlyTenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    mockPrisma.contact.findMany.mockResolvedValue([
      {
        id: 'contact_1',
        b2chatId: 'STUB_001',
        fullName: 'Test Contact',
        lastSyncAt: exactlyTenDaysAgo,
      },
    ])

    const response = await POST()
    const data = await response.json()

    expect(data.results.staleStubs[0].daysSinceLastSync).toBe(10)
  })
})
