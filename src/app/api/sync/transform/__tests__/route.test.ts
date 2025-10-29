/**
 * @jest-environment node
 */

import { POST, GET } from '../route'
import { auth } from '@clerk/nextjs/server'
import { TransformEngine } from '@/lib/sync/transform-engine'

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}))

// Mock TransformEngine
jest.mock('@/lib/sync/transform-engine', () => ({
  TransformEngine: jest.fn(),
}))

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    extractLog: {
      findUnique: jest.fn(),
    },
    transformLog: {
      findMany: jest.fn(),
    },
  },
}))

const mockAuth = auth as jest.MockedFunction<typeof auth>
const MockedTransformEngine = TransformEngine as jest.MockedClass<typeof TransformEngine>

describe('/api/sync/transform', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST - Legacy Mode (with extractSyncId)', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null })

      const request = new Request('http://localhost/api/sync/transform', {
        method: 'POST',
        body: JSON.stringify({
          extractSyncId: 'extract_123',
          entityType: 'contacts',
        }),
      })

      const response = await POST(request as any)
      expect(response.status).toBe(401)
    })

    it('should return 400 if entityType is missing', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' })

      const request = new Request('http://localhost/api/sync/transform', {
        method: 'POST',
        body: JSON.stringify({
          extractSyncId: 'extract_123',
        }),
      })

      const response = await POST(request as any)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid entityType')
    })

    it('should return 404 if extractSyncId not found', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' })

      const { prisma } = await import('@/lib/prisma')
      ;(prisma.extractLog.findUnique as jest.Mock).mockResolvedValue(null)

      const request = new Request('http://localhost/api/sync/transform', {
        method: 'POST',
        body: JSON.stringify({
          extractSyncId: 'extract_nonexistent',
          entityType: 'contacts',
        }),
      })

      const response = await POST(request as any)
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toContain('Extract log not found')
    })

    it('should return 400 if extract is not completed', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' })

      const { prisma } = await import('@/lib/prisma')
      ;(prisma.extractLog.findUnique as jest.Mock).mockResolvedValue({
        syncId: 'extract_123',
        status: 'running',
      })

      const request = new Request('http://localhost/api/sync/transform', {
        method: 'POST',
        body: JSON.stringify({
          extractSyncId: 'extract_123',
          entityType: 'contacts',
        }),
      })

      const response = await POST(request as any)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('not completed')
    })

    it('should transform contacts successfully with extractSyncId', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' })

      const { prisma } = await import('@/lib/prisma')
      ;(prisma.extractLog.findUnique as jest.Mock).mockResolvedValue({
        syncId: 'extract_123',
        status: 'completed',
      })

      const mockResult = {
        syncId: 'transform_123',
        extractSyncId: 'extract_123',
        status: 'completed',
        recordsProcessed: 10,
      }

      const mockTransformContacts = jest.fn().mockResolvedValue(mockResult)
      MockedTransformEngine.mockImplementation(() => ({
        transformContacts: mockTransformContacts,
        transformChats: jest.fn(),
        transformAll: jest.fn(),
      }) as any)

      const request = new Request('http://localhost/api/sync/transform', {
        method: 'POST',
        body: JSON.stringify({
          extractSyncId: 'extract_123',
          entityType: 'contacts',
        }),
      })

      const response = await POST(request as any)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.result.contacts).toEqual(mockResult)
      expect(mockTransformContacts).toHaveBeenCalledWith(
        'extract_123',
        expect.objectContaining({ userId: 'user_123' })
      )
    })
  })

  describe('POST - Batch-Agnostic Mode (without extractSyncId)', () => {
    it('should allow transform without extractSyncId (batch-agnostic)', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' })

      const mockResult = {
        syncId: 'transform_456',
        extractSyncId: null,
        status: 'completed',
        recordsProcessed: 294,
      }

      const mockTransformContacts = jest.fn().mockResolvedValue(mockResult)
      MockedTransformEngine.mockImplementation(() => ({
        transformContacts: mockTransformContacts,
        transformChats: jest.fn(),
        transformAll: jest.fn(),
      }) as any)

      const request = new Request('http://localhost/api/sync/transform', {
        method: 'POST',
        body: JSON.stringify({
          // No extractSyncId provided
          entityType: 'contacts',
        }),
      })

      const response = await POST(request as any)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.result.contacts.extractSyncId).toBeNull()
      expect(data.result.contacts.recordsProcessed).toBe(294)

      // Verify transformContacts was called with undefined extractSyncId
      expect(mockTransformContacts).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ userId: 'user_123' })
      )
    })

    it('should transform chats without extractSyncId', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' })

      const mockResult = {
        syncId: 'transform_789',
        extractSyncId: null,
        status: 'completed',
        recordsProcessed: 50,
      }

      const mockTransformChats = jest.fn().mockResolvedValue(mockResult)
      MockedTransformEngine.mockImplementation(() => ({
        transformContacts: jest.fn(),
        transformChats: mockTransformChats,
        transformAll: jest.fn(),
      }) as any)

      const request = new Request('http://localhost/api/sync/transform', {
        method: 'POST',
        body: JSON.stringify({
          entityType: 'chats',
        }),
      })

      const response = await POST(request as any)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.result.chats.recordsProcessed).toBe(50)
      expect(mockTransformChats).toHaveBeenCalledWith(undefined, expect.any(Object))
    })

    it('should transform all entities without extractSyncId', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' })

      const mockResult = {
        contacts: {
          syncId: 'transform_contacts',
          extractSyncId: null,
          status: 'completed',
          recordsProcessed: 100,
        },
        chats: {
          syncId: 'transform_chats',
          extractSyncId: null,
          status: 'completed',
          recordsProcessed: 50,
        },
      }

      const mockTransformAll = jest.fn().mockResolvedValue(mockResult)
      MockedTransformEngine.mockImplementation(() => ({
        transformContacts: jest.fn(),
        transformChats: jest.fn(),
        transformAll: mockTransformAll,
      }) as any)

      const request = new Request('http://localhost/api/sync/transform', {
        method: 'POST',
        body: JSON.stringify({
          entityType: 'all',
        }),
      })

      const response = await POST(request as any)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.result.contacts.recordsProcessed).toBe(100)
      expect(data.result.chats.recordsProcessed).toBe(50)
      expect(mockTransformAll).toHaveBeenCalledWith(undefined, expect.any(Object))
    })

    it('should not verify extractLog when extractSyncId not provided', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' })

      const { prisma } = await import('@/lib/prisma')
      const findUniqueSpy = prisma.extractLog.findUnique as jest.Mock

      const mockTransformContacts = jest.fn().mockResolvedValue({
        syncId: 'transform_999',
        extractSyncId: null,
        status: 'completed',
        recordsProcessed: 0,
      })

      MockedTransformEngine.mockImplementation(() => ({
        transformContacts: mockTransformContacts,
        transformChats: jest.fn(),
        transformAll: jest.fn(),
      }) as any)

      const request = new Request('http://localhost/api/sync/transform', {
        method: 'POST',
        body: JSON.stringify({
          entityType: 'contacts',
        }),
      })

      await POST(request as any)

      // Verify extractLog.findUnique was NOT called
      expect(findUniqueSpy).not.toHaveBeenCalled()
    })
  })

  describe('GET', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null })

      const request = new Request('http://localhost/api/sync/transform')
      const response = await GET(request as any)

      expect(response.status).toBe(401)
    })

    it('should fetch all transform logs when no extractSyncId provided', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' })

      const { prisma } = await import('@/lib/prisma')
      const mockLogs = [
        { id: 'log_1', syncId: 'transform_1', extractSyncId: 'extract_1' },
        { id: 'log_2', syncId: 'transform_2', extractSyncId: null },
      ]
      ;(prisma.transformLog.findMany as jest.Mock).mockResolvedValue(mockLogs)

      const request = new Request('http://localhost/api/sync/transform')
      const response = await GET(request as any)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.transforms).toEqual(mockLogs)
    })

    it('should fetch transform logs for specific extractSyncId', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' })

      const { prisma } = await import('@/lib/prisma')
      const mockLogs = [
        { id: 'log_1', syncId: 'transform_1', extractSyncId: 'extract_123' },
      ]
      ;(prisma.transformLog.findMany as jest.Mock).mockResolvedValue(mockLogs)

      const request = new Request('http://localhost/api/sync/transform?extractSyncId=extract_123')
      const response = await GET(request as any)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.transforms).toEqual(mockLogs)
    })
  })
})
