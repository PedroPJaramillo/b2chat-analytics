import { SyncEngine } from '../engine'
import { B2ChatClient } from '@/lib/b2chat/client'
import { prisma } from '@/lib/prisma'
import { syncLogger } from '../logger'

// Mock dependencies
jest.mock('@/lib/b2chat/client')
jest.mock('@/lib/prisma')
jest.mock('../logger')

const MockB2ChatClient = B2ChatClient as jest.MockedClass<typeof B2ChatClient>
const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockSyncLogger = syncLogger as jest.Mocked<typeof syncLogger>

describe('SyncEngine', () => {
  let syncEngine: SyncEngine
  let mockClient: jest.Mocked<B2ChatClient>

  beforeEach(() => {
    jest.clearAllMocks()

    // Create mock client instance
    mockClient = new MockB2ChatClient() as jest.Mocked<B2ChatClient>
    MockB2ChatClient.mockImplementation(() => mockClient)

    syncEngine = new SyncEngine()
  })

  describe('syncContacts', () => {
    it('should sync contacts successfully', async () => {
      // Mock B2Chat API response
      const mockContacts = [
        {
          contact_id: '1',
          fullname: 'John Doe',
          mobile: '+1234567890',
          email: 'john@example.com',
          created: '2024-01-01T00:00:00Z',
          updated: '2024-01-01T00:00:00Z'
        }
      ]

      mockClient.getContacts.mockResolvedValue({
        data: mockContacts,
        pagination: {
          total: 1,
          exported: 1,
          hasNextPage: false
        }
      })

      // Mock database operations
      mockPrisma.syncState.findUnique.mockResolvedValue(null)
      mockPrisma.syncState.upsert.mockResolvedValue({} as any)
      mockPrisma.contact.upsert.mockResolvedValue({} as any)
      mockPrisma.syncLog.create.mockResolvedValue({} as any)

      const result = await syncEngine.syncContacts('user_123')

      expect(result.success).toBe(true)
      expect(result.recordsProcessed).toBe(1)
      expect(mockClient.getContacts).toHaveBeenCalled()
      expect(mockPrisma.contact.upsert).toHaveBeenCalledTimes(1)
    })

    it('should handle empty response gracefully', async () => {
      mockClient.getContacts.mockResolvedValue({
        data: [],
        pagination: {
          total: 0,
          exported: 0,
          hasNextPage: false
        }
      })

      mockPrisma.syncState.findUnique.mockResolvedValue(null)
      mockPrisma.syncState.upsert.mockResolvedValue({} as any)
      mockPrisma.syncLog.create.mockResolvedValue({} as any)

      const result = await syncEngine.syncContacts('user_123')

      expect(result.success).toBe(true)
      expect(result.recordsProcessed).toBe(0)
    })

    it('should handle API errors', async () => {
      mockClient.getContacts.mockRejectedValue(new Error('API Error'))

      mockPrisma.syncLog.create.mockResolvedValue({} as any)

      const result = await syncEngine.syncContacts('user_123')

      expect(result.success).toBe(false)
      expect(result.error).toContain('API Error')
      expect(mockSyncLogger.error).toHaveBeenCalled()
    })

    it('should handle database errors during upsert', async () => {
      const mockContacts = [
        {
          contact_id: '1',
          fullname: 'John Doe',
          mobile: '+1234567890',
          email: 'john@example.com'
        }
      ]

      mockClient.getContacts.mockResolvedValue({
        data: mockContacts,
        pagination: { total: 1, exported: 1, hasNextPage: false }
      })

      mockPrisma.syncState.findUnique.mockResolvedValue(null)
      mockPrisma.contact.upsert.mockRejectedValue(new Error('Database error'))
      mockPrisma.syncLog.create.mockResolvedValue({} as any)

      const result = await syncEngine.syncContacts('user_123')

      expect(result.success).toBe(false)
      expect(result.recordsProcessed).toBe(0)
      expect(result.error).toContain('Database error')
    })
  })

  describe('syncChats', () => {
    it('should sync chats successfully', async () => {
      const mockChats = [
        {
          chat_id: '1',
          agent: 'Agent 1',
          contact: 'Customer 1',
          status: 'closed',
          created_at: '2024-01-01T00:00:00Z',
          provider: 'livechat'
        }
      ]

      mockClient.getChats.mockResolvedValue({
        data: mockChats,
        pagination: {
          total: 1,
          exported: 1,
          hasNextPage: false
        }
      })

      mockPrisma.syncState.findUnique.mockResolvedValue(null)
      mockPrisma.syncState.upsert.mockResolvedValue({} as any)
      mockPrisma.chat.upsert.mockResolvedValue({} as any)
      mockPrisma.agent.upsert.mockResolvedValue({ id: 'agent_1' } as any)
      mockPrisma.contact.findUnique.mockResolvedValue({ id: 'contact_1' } as any)
      mockPrisma.syncLog.create.mockResolvedValue({} as any)

      const result = await syncEngine.syncChats('user_123')

      expect(result.success).toBe(true)
      expect(result.recordsProcessed).toBe(1)
      expect(mockClient.getChats).toHaveBeenCalled()
      expect(mockPrisma.chat.upsert).toHaveBeenCalledTimes(1)
    })

    it('should extract and create agents from chat data', async () => {
      const mockChats = [
        {
          chat_id: '1',
          agent: 'New Agent',
          contact: 'Customer 1',
          status: 'closed',
          created_at: '2024-01-01T00:00:00Z',
          provider: 'livechat'
        }
      ]

      mockClient.getChats.mockResolvedValue({
        data: mockChats,
        pagination: { total: 1, exported: 1, hasNextPage: false }
      })

      mockPrisma.syncState.findUnique.mockResolvedValue(null)
      mockPrisma.syncState.upsert.mockResolvedValue({} as any)
      mockPrisma.chat.upsert.mockResolvedValue({} as any)
      mockPrisma.agent.upsert.mockResolvedValue({ id: 'new_agent' } as any)
      mockPrisma.contact.findUnique.mockResolvedValue(null)
      mockPrisma.syncLog.create.mockResolvedValue({} as any)

      await syncEngine.syncChats('user_123')

      expect(mockPrisma.agent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'New Agent' },
          create: expect.objectContaining({ name: 'New Agent' }),
          update: expect.any(Object)
        })
      )
    })
  })

  describe('syncAll', () => {
    it('should sync both contacts and chats', async () => {
      // Mock successful sync for both
      mockClient.getContacts.mockResolvedValue({
        data: [],
        pagination: { total: 0, exported: 0, hasNextPage: false }
      })

      mockClient.getChats.mockResolvedValue({
        data: [],
        pagination: { total: 0, exported: 0, hasNextPage: false }
      })

      mockPrisma.syncState.findUnique.mockResolvedValue(null)
      mockPrisma.syncState.upsert.mockResolvedValue({} as any)
      mockPrisma.syncLog.create.mockResolvedValue({} as any)

      const result = await syncEngine.syncAll('user_123')

      expect(result.contacts.success).toBe(true)
      expect(result.chats.success).toBe(true)
      expect(mockClient.getContacts).toHaveBeenCalled()
      expect(mockClient.getChats).toHaveBeenCalled()
    })

    it('should continue with chats even if contacts fail', async () => {
      mockClient.getContacts.mockRejectedValue(new Error('Contacts API Error'))
      mockClient.getChats.mockResolvedValue({
        data: [],
        pagination: { total: 0, exported: 0, hasNextPage: false }
      })

      mockPrisma.syncState.findUnique.mockResolvedValue(null)
      mockPrisma.syncState.upsert.mockResolvedValue({} as any)
      mockPrisma.syncLog.create.mockResolvedValue({} as any)

      const result = await syncEngine.syncAll('user_123')

      expect(result.contacts.success).toBe(false)
      expect(result.chats.success).toBe(true)
    })
  })
})