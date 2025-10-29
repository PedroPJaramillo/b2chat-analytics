// Tests for Raw Data API Route (Feature 013 - JSON Search)

/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET } from '../route'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

// Mock dependencies
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    rawContact: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    rawChat: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}))

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockPrisma = prisma as jest.Mocked<typeof prisma>

// Helper function to create NextRequest with query parameters
function createRequest(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/raw-data')
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
  return new NextRequest(url)
}

describe('GET /api/raw-data - JSON Search (Feature 013)', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default auth mock - authenticated user
    mockAuth.mockResolvedValue({
      userId: 'test-user-123',
      sessionId: 'test-session',
      sessionClaims: {},
    } as any)

    // Default mock responses
    mockPrisma.rawContact.groupBy.mockResolvedValue([])
    mockPrisma.rawChat.groupBy.mockResolvedValue([])
    mockPrisma.rawContact.count.mockResolvedValue(0)
    mockPrisma.rawChat.count.mockResolvedValue(0)
  })

  describe('RawContact JSON searches', () => {
    test('searches by contact name in JSON', async () => {
      const mockContacts = [
        {
          id: 'contact-1',
          syncId: 'sync-1',
          b2chatContactId: '123',
          fetchedAt: new Date('2024-01-01'),
          processedAt: new Date('2024-01-01'),
          processingStatus: 'completed',
          processingError: null,
          processingAttempt: 1,
          apiPage: 1,
          apiOffset: 0,
        },
      ]

      mockPrisma.rawContact.findMany.mockResolvedValue(mockContacts)
      mockPrisma.rawContact.count.mockResolvedValue(1)

      const request = createRequest({ search: 'John', entityType: 'contacts' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.records).toHaveLength(1)

      // Verify the WHERE clause includes JSON path searches for name
      expect(mockPrisma.rawContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              // Existing scalar field searches
              { b2chatContactId: { contains: 'John', mode: 'insensitive' } },
              { syncId: { contains: 'John', mode: 'insensitive' } },
              // NEW: JSON path searches
              { rawData: { path: ['fullname'], string_contains: 'John' } },
              { rawData: { path: ['name'], string_contains: 'John' } },
            ]),
          }),
        })
      )
    })

    test('searches by mobile number in JSON', async () => {
      const mockContacts = [
        {
          id: 'contact-2',
          syncId: 'sync-2',
          b2chatContactId: '456',
          fetchedAt: new Date('2024-01-02'),
          processedAt: new Date('2024-01-02'),
          processingStatus: 'completed',
          processingError: null,
          processingAttempt: 1,
          apiPage: 1,
          apiOffset: 0,
        },
      ]

      mockPrisma.rawContact.findMany.mockResolvedValue(mockContacts)
      mockPrisma.rawContact.count.mockResolvedValue(1)

      const request = createRequest({ search: '555-1234', entityType: 'contacts' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.records).toHaveLength(1)

      // Verify the WHERE clause includes JSON path searches for mobile
      expect(mockPrisma.rawContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { rawData: { path: ['mobile'], string_contains: '555-1234' } },
              { rawData: { path: ['mobile_number'], string_contains: '555-1234' } },
            ]),
          }),
        })
      )
    })

    test('searches by contact_id in JSON', async () => {
      const mockContacts = [
        {
          id: 'contact-3',
          syncId: 'sync-3',
          b2chatContactId: '789',
          fetchedAt: new Date('2024-01-03'),
          processedAt: null,
          processingStatus: 'pending',
          processingError: null,
          processingAttempt: 0,
          apiPage: 1,
          apiOffset: 0,
        },
      ]

      mockPrisma.rawContact.findMany.mockResolvedValue(mockContacts)
      mockPrisma.rawContact.count.mockResolvedValue(1)

      const request = createRequest({ search: '789', entityType: 'contacts' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.records).toHaveLength(1)

      // Verify the WHERE clause includes JSON path searches for contact_id
      expect(mockPrisma.rawContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { rawData: { path: ['contact_id'], string_contains: '789' } },
              { rawData: { path: ['id'], string_contains: '789' } },
            ]),
          }),
        })
      )
    })
  })

  describe('RawChat JSON searches', () => {
    test('searches by chat_id in JSON', async () => {
      const mockChats = [
        {
          id: 'chat-1',
          syncId: 'sync-1',
          b2chatChatId: 'chat-abc-123',
          fetchedAt: new Date('2024-01-01'),
          processedAt: new Date('2024-01-01'),
          processingStatus: 'completed',
          processingError: null,
          processingAttempt: 1,
          apiPage: 1,
          apiOffset: 0,
        },
      ]

      mockPrisma.rawChat.findMany.mockResolvedValue(mockChats)
      mockPrisma.rawChat.count.mockResolvedValue(1)

      const request = createRequest({ search: 'chat-abc-123', entityType: 'chats' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.records).toHaveLength(1)

      // Verify the WHERE clause includes JSON path search for chat_id
      expect(mockPrisma.rawChat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { rawData: { path: ['chat_id'], string_contains: 'chat-abc-123' } },
            ]),
          }),
        })
      )
    })

    test('searches by nested contact name in JSON', async () => {
      const mockChats = [
        {
          id: 'chat-2',
          syncId: 'sync-2',
          b2chatChatId: 'chat-456',
          fetchedAt: new Date('2024-01-02'),
          processedAt: new Date('2024-01-02'),
          processingStatus: 'completed',
          processingError: null,
          processingAttempt: 1,
          apiPage: 1,
          apiOffset: 0,
        },
      ]

      mockPrisma.rawChat.findMany.mockResolvedValue(mockChats)
      mockPrisma.rawChat.count.mockResolvedValue(1)

      const request = createRequest({ search: 'Jane', entityType: 'chats' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.records).toHaveLength(1)

      // Verify the WHERE clause includes nested JSON path searches
      expect(mockPrisma.rawChat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { rawData: { path: ['contact', 'fullname'], string_contains: 'Jane' } },
              { rawData: { path: ['contact', 'name'], string_contains: 'Jane' } },
            ]),
          }),
        })
      )
    })

    test('searches by nested contact mobile in JSON', async () => {
      const mockChats = [
        {
          id: 'chat-3',
          syncId: 'sync-3',
          b2chatChatId: 'chat-789',
          fetchedAt: new Date('2024-01-03'),
          processedAt: null,
          processingStatus: 'pending',
          processingError: null,
          processingAttempt: 0,
          apiPage: 1,
          apiOffset: 0,
        },
      ]

      mockPrisma.rawChat.findMany.mockResolvedValue(mockChats)
      mockPrisma.rawChat.count.mockResolvedValue(1)

      const request = createRequest({ search: '987654', entityType: 'chats' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.records).toHaveLength(1)

      // Verify the WHERE clause includes nested JSON path searches for mobile
      expect(mockPrisma.rawChat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { rawData: { path: ['contact', 'mobile'], string_contains: '987654' } },
              { rawData: { path: ['contact', 'mobile_number'], string_contains: '987654' } },
            ]),
          }),
        })
      )
    })
  })

  describe('Backward compatibility', () => {
    test('existing B2Chat Contact ID search still works', async () => {
      mockPrisma.rawContact.findMany.mockResolvedValue([])
      mockPrisma.rawContact.count.mockResolvedValue(0)

      const request = createRequest({ search: '123456', entityType: 'contacts' })
      await GET(request)

      // Verify scalar field search is still included
      expect(mockPrisma.rawContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { b2chatContactId: { contains: '123456', mode: 'insensitive' } },
            ]),
          }),
        })
      )
    })

    test('existing Sync ID search still works', async () => {
      mockPrisma.rawContact.findMany.mockResolvedValue([])
      mockPrisma.rawContact.count.mockResolvedValue(0)

      const request = createRequest({ search: 'sync-abc', entityType: 'contacts' })
      await GET(request)

      // Verify syncId search is still included
      expect(mockPrisma.rawContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { syncId: { contains: 'sync-abc', mode: 'insensitive' } },
            ]),
          }),
        })
      )
    })
  })

  describe('Authentication', () => {
    test('returns 401 for unauthenticated requests', async () => {
      mockAuth.mockResolvedValue({ userId: null } as any)

      const request = createRequest({ search: 'test' })
      const response = await GET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })
    })
  })

  describe('Validation', () => {
    test('validates page parameter', async () => {
      const request = createRequest({ page: 'invalid' })
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid page parameter')
    })

    test('validates limit parameter range', async () => {
      const request = createRequest({ limit: '500' })
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid limit parameter')
    })

    test('validates entityType parameter', async () => {
      const request = createRequest({ entityType: 'invalid' })
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid entityType parameter')
    })
  })
})
