/**
 * Integration tests for customer analysis API routes
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { POST, GET } from '../route'
import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

// Mock dependencies
jest.mock('@clerk/nextjs/server')
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    chat: {
      count: jest.fn(),
    },
    message: {
      count: jest.fn(),
    },
    customerAnalysis: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}))

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('POST /api/customer-analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 if user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any)

    const request = new NextRequest('http://localhost/api/customer-analysis', {
      method: 'POST',
      body: JSON.stringify({
        filters: {
          dateStart: '2025-09-01',
          dateEnd: '2025-10-08',
        },
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('should return 403 if user is not Manager or Admin', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'user@example.com',
      role: 'Viewer' as any, // Not a valid role for analysis
    } as any)

    const request = new NextRequest('http://localhost/api/customer-analysis', {
      method: 'POST',
      body: JSON.stringify({
        filters: {
          dateStart: '2025-09-01',
          dateEnd: '2025-10-08',
        },
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN_ROLE')
  })

  it('should return 400 for invalid date range', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'manager@example.com',
      role: 'Manager',
    } as any)

    const request = new NextRequest('http://localhost/api/customer-analysis', {
      method: 'POST',
      body: JSON.stringify({
        filters: {
          dateStart: '2025-10-08',
          dateEnd: '2025-09-01', // End before start
        },
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe('INVALID_DATE_RANGE')
    expect(data.error.message).toContain('dateEnd must be after')
  })

  it('should create analysis job successfully for valid request', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'manager@example.com',
      role: 'Manager',
    } as any)

    mockPrisma.chat.count.mockResolvedValue(100)
    mockPrisma.message.count.mockResolvedValue(500)

    mockPrisma.customerAnalysis.create.mockResolvedValue({
      id: 'analysis-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'PENDING',
      triggeredBy: 'user-123',
      filters: {
        dateStart: '2025-09-01',
        dateEnd: '2025-10-08',
      },
      totalChatsAnalyzed: 0,
      totalMessagesAnalyzed: 0,
      aiAnalysisCount: 0,
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      processingTimeMs: null,
    } as any)

    const request = new NextRequest('http://localhost/api/customer-analysis', {
      method: 'POST',
      body: JSON.stringify({
        filters: {
          dateStart: '2025-09-01',
          dateEnd: '2025-10-08',
        },
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.analysisId).toBe('analysis-123')
    expect(data.status).toBe('PENDING')
    expect(data.message).toContain('100 chats')
    expect(data.message).toContain('500 messages')
  })

  it('should include rate limit headers in response', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'manager@example.com',
      role: 'Manager',
    } as any)

    mockPrisma.chat.count.mockResolvedValue(10)
    mockPrisma.message.count.mockResolvedValue(50)

    mockPrisma.customerAnalysis.create.mockResolvedValue({
      id: 'analysis-123',
      status: 'PENDING',
    } as any)

    const request = new NextRequest('http://localhost/api/customer-analysis', {
      method: 'POST',
      body: JSON.stringify({
        filters: {
          dateStart: '2025-09-01',
          dateEnd: '2025-10-08',
        },
      }),
    })

    const response = await POST(request)

    expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(response.headers.has('X-RateLimit-Remaining')).toBe(true)
    expect(response.headers.has('X-RateLimit-Reset')).toBe(true)
  })
})

describe('GET /api/customer-analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 if user is not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any)

    const request = new NextRequest('http://localhost/api/customer-analysis', {
      method: 'GET',
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('should return analysis history for authenticated manager', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'manager@example.com',
      role: 'Manager',
    } as any)

    const mockAnalyses = [
      {
        id: 'analysis-1',
        createdAt: new Date('2025-10-08'),
        status: 'COMPLETED',
        filters: { dateStart: '2025-09-01', dateEnd: '2025-10-08' },
        totalChatsAnalyzed: 100,
        totalMessagesAnalyzed: 500,
      },
    ]

    mockPrisma.customerAnalysis.findMany.mockResolvedValue(mockAnalyses as any)
    mockPrisma.customerAnalysis.count.mockResolvedValue(1)

    const request = new NextRequest('http://localhost/api/customer-analysis', {
      method: 'GET',
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.analyses).toHaveLength(1)
    expect(data.analyses[0].id).toBe('analysis-1')
    expect(data.pagination.total).toBe(1)
  })

  it('should support pagination parameters', async () => {
    mockAuth.mockResolvedValue({ userId: 'user-123' } as any)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'admin@example.com',
      role: 'Admin',
    } as any)

    mockPrisma.customerAnalysis.findMany.mockResolvedValue([])
    mockPrisma.customerAnalysis.count.mockResolvedValue(50)

    const request = new NextRequest(
      'http://localhost/api/customer-analysis?limit=10&offset=20',
      {
        method: 'GET',
      }
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.pagination.limit).toBe(10)
    expect(data.pagination.offset).toBe(20)
    expect(data.pagination.total).toBe(50)

    // Verify prisma was called with correct pagination
    expect(mockPrisma.customerAnalysis.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 20,
      })
    )
  })
})
