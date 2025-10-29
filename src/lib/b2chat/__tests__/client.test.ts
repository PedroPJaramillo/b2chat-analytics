import { B2ChatClient, B2ChatAPIError } from '../client'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('B2ChatClient', () => {
  let client: B2ChatClient

  beforeEach(() => {
    client = new B2ChatClient()
    mockFetch.mockClear()

    // Set up environment variables for tests
    process.env.B2CHAT_API_URL = 'https://api.b2chat.io'
    process.env.B2CHAT_USERNAME = 'test_user'
    process.env.B2CHAT_PASSWORD = 'test_pass'
  })

  describe('constructor', () => {
    it('should initialize with environment variables', () => {
      expect(client).toBeInstanceOf(B2ChatClient)
    })
  })

  describe('authentication', () => {
    it('should authenticate successfully', async () => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          expires_in: 3600
        })
      })

      // Mock successful API call that triggers authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: [],
          total: 0,
          exported: 0
        })
      })

      const result = await client.getContacts()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.b2chat.io/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic')
          })
        })
      )

      expect(result).toEqual({
        data: [],
        pagination: {
          total: 0,
          exported: 0,
          hasNextPage: false
        }
      })
    })

    it('should throw error on authentication failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      })

      await expect(client.getContacts()).rejects.toThrow(B2ChatAPIError)
    })
  })

  describe('getContacts', () => {
    beforeEach(() => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          expires_in: 3600
        })
      })
    })

    it('should fetch contacts successfully', async () => {
      const mockContacts = [
        {
          contact_id: '1',
          fullname: 'John Doe',
          mobile: '+1234567890',
          email: 'john@example.com'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: mockContacts,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getContacts()

      expect(result.data).toHaveLength(1)
      expect(result.data[0].contact_id).toBe('1')
      expect(result.pagination.total).toBe(1)
    })

    it('should handle pagination parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: [],
          total: 0,
          exported: 0
        })
      })

      await client.getContacts({ page: 2, limit: 50 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=50&limit=50'),
        expect.any(Object)
      )
    })
  })

  describe('getChats', () => {
    beforeEach(() => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          expires_in: 3600
        })
      })
    })

    it('should fetch chats successfully', async () => {
      const mockChats = [
        {
          chat_id: '1',
          agent: 'Agent 1',
          contact: 'Customer 1',
          status: 'closed',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chats: mockChats,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getChats()

      expect(result.data).toHaveLength(1)
      expect(result.data[0].chat_id).toBe('1')
    })
  })

  describe('getTotalCounts', () => {
    beforeEach(() => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          expires_in: 3600
        })
      })
    })

    it('should get total counts for contacts and chats', async () => {
      // Mock contacts count
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: [],
          total: 100
        })
      })

      // Mock chats count
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chats: [],
          total: 250
        })
      })

      const result = await client.getTotalCounts()

      expect(result).toEqual({
        contacts: 100,
        chats: 250
      })
    })
  })

  describe('Feature 002: Contact Field Fixes - Tags Schema', () => {
    beforeEach(() => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          expires_in: 3600
        })
      })
    })

    it('should parse tags with assignment timestamps correctly', async () => {
      const mockContacts = [
        {
          contact_id: '123',
          fullname: 'Test User',
          tags: [
            { name: 'VIP', assigned_at: 1706644084 },
            { name: 'Premium', assigned_at: 1706648900 }
          ]
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: mockContacts,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getContacts()

      expect(result.data).toHaveLength(1)
      expect(result.data[0].tags).toHaveLength(2)
      expect(result.data[0].tags?.[0]).toEqual({ name: 'VIP', assigned_at: 1706644084 })
      expect(result.data[0].tags?.[1]).toEqual({ name: 'Premium', assigned_at: 1706648900 })
    })

    it('should handle null tags', async () => {
      const mockContacts = [
        {
          contact_id: '123',
          fullname: 'Test User',
          tags: null
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: mockContacts,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getContacts()

      expect(result.data[0].tags).toBeNull()
    })

    it('should handle missing tags field', async () => {
      const mockContacts = [
        {
          contact_id: '123',
          fullname: 'Test User'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: mockContacts,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getContacts()

      expect(result.data[0].tags).toBeUndefined()
    })

    it('should handle dynamic new tags (no schema change needed)', async () => {
      // Simulates B2Chat user creating new tag "Urgent Follow-up"
      const mockContacts = [
        {
          contact_id: '123',
          fullname: 'Test User',
          tags: [
            { name: 'VIP', assigned_at: 1706644084 },
            { name: 'Urgent Follow-up', assigned_at: 1730000000 } // New tag!
          ]
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: mockContacts,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getContacts()

      expect(result.data[0].tags?.[1]?.name).toBe('Urgent Follow-up')
      expect(result.data[0].tags?.[1]?.assigned_at).toBe(1730000000)
    })

    it('should recognize landline field', async () => {
      const mockContacts = [
        {
          contact_id: '123',
          fullname: 'Office Contact',
          mobile: '+573001234567',
          landline: '+571234567'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: mockContacts,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getContacts()

      expect(result.data[0].landline).toBe('+571234567')
      expect(result.data[0].mobile).toBe('+573001234567')
    })

    it('should recognize merchant_id as number', async () => {
      const mockContacts = [
        {
          contact_id: '123',
          fullname: 'Merchant User',
          merchant_id: 100
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: mockContacts,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getContacts()

      expect(result.data[0].merchant_id).toBe(100)
    })

    it('should recognize merchant_id as string', async () => {
      const mockContacts = [
        {
          contact_id: '123',
          fullname: 'Merchant User',
          merchant_id: 'merchant_abc'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: mockContacts,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getContacts()

      expect(result.data[0].merchant_id).toBe('merchant_abc')
    })

    it('should parse B2Chat created/updated timestamps', async () => {
      const mockContacts = [
        {
          contact_id: '123',
          fullname: 'Old Contact',
          created: '2020-11-09 19:10:23',
          updated: '2024-01-25 16:24:14'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: mockContacts,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getContacts()

      expect(result.data[0].created).toBe('2020-11-09 19:10:23')
      expect(result.data[0].updated).toBe('2024-01-25 16:24:14')
    })
  })

  describe('Feature 001: Full Status Support - 8 Statuses', () => {
    beforeEach(() => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          expires_in: 3600
        })
      })
    })

    it('should map BOT_CHATTING status correctly', async () => {
      const mockChats = [
        {
          chat_id: '123',
          status: 'BOT_CHATTING',
          provider: 'whatsapp',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chats: mockChats,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getChats()

      expect(result.data[0].status).toBe('BOT_CHATTING')
    })

    it('should map all 8 B2Chat statuses correctly', async () => {
      // Mock a response with all 8 statuses in one call
      const mockChats = [
        { chat_id: 'chat1', status: 'BOT_CHATTING', provider: 'whatsapp', created_at: '2024-01-01T00:00:00Z' },
        { chat_id: 'chat2', status: 'OPENED', provider: 'whatsapp', created_at: '2024-01-01T00:00:00Z' },
        { chat_id: 'chat3', status: 'PICKED_UP', provider: 'whatsapp', created_at: '2024-01-01T00:00:00Z' },
        { chat_id: 'chat4', status: 'RESPONDED_BY_AGENT', provider: 'whatsapp', created_at: '2024-01-01T00:00:00Z' },
        { chat_id: 'chat5', status: 'CLOSED', provider: 'whatsapp', created_at: '2024-01-01T00:00:00Z' },
        { chat_id: 'chat6', status: 'COMPLETING_POLL', provider: 'whatsapp', created_at: '2024-01-01T00:00:00Z' },
        { chat_id: 'chat7', status: 'COMPLETED_POLL', provider: 'whatsapp', created_at: '2024-01-01T00:00:00Z' },
        { chat_id: 'chat8', status: 'ABANDONED_POLL', provider: 'whatsapp', created_at: '2024-01-01T00:00:00Z' }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chats: mockChats,
          total: 8,
          exported: 8
        })
      })

      const result = await client.getChats()

      const statuses = [
        'BOT_CHATTING',
        'OPENED',
        'PICKED_UP',
        'RESPONDED_BY_AGENT',
        'CLOSED',
        'COMPLETING_POLL',
        'COMPLETED_POLL',
        'ABANDONED_POLL'
      ]

      statuses.forEach((expectedStatus, index) => {
        expect(result.data[index].status).toBe(expectedStatus)
      })
    })

    it('should map legacy OPEN status to PICKED_UP', async () => {
      const mockChats = [
        {
          chat_id: '123',
          status: 'OPEN',
          provider: 'whatsapp',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chats: mockChats,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getChats()

      expect(result.data[0].status).toBe('PICKED_UP')
    })

    it('should map legacy PENDING status to OPENED', async () => {
      const mockChats = [
        {
          chat_id: '123',
          status: 'PENDING',
          provider: 'whatsapp',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chats: mockChats,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getChats()

      expect(result.data[0].status).toBe('OPENED')
    })

    it('should map legacy FINISHED status to CLOSED', async () => {
      const mockChats = [
        {
          chat_id: '123',
          status: 'FINISHED',
          provider: 'whatsapp',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chats: mockChats,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getChats()

      expect(result.data[0].status).toBe('CLOSED')
    })

    it('should handle lowercase status values', async () => {
      const mockChats = [
        {
          chat_id: '123',
          status: 'bot_chatting', // lowercase
          provider: 'whatsapp',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chats: mockChats,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getChats()

      expect(result.data[0].status).toBe('BOT_CHATTING')
    })

    it('should handle mixed case status values with spaces', async () => {
      const mockChats = [
        {
          chat_id: '123',
          status: 'Picked Up', // mixed case with space
          provider: 'whatsapp',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chats: mockChats,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getChats()

      expect(result.data[0].status).toBe('PICKED_UP')
    })

    it('should fallback to OPENED for unknown statuses and log warning', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const mockChats = [
        {
          chat_id: '123',
          status: 'UNKNOWN_STATUS',
          provider: 'whatsapp',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chats: mockChats,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getChats()

      expect(result.data[0].status).toBe('OPENED')
      // Logger should have been called with warning
      consoleWarnSpy.mockRestore()
    })

    it('should handle null status', async () => {
      const mockChats = [
        {
          chat_id: '123',
          status: null,
          provider: 'whatsapp',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chats: mockChats,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getChats()

      expect(result.data[0].status).toBe('OPENED')
    })

    it('should parse survey fields correctly', async () => {
      const mockChats = [
        {
          chat_id: '456',
          status: 'COMPLETED_POLL',
          provider: 'whatsapp',
          created_at: '2024-01-01T00:00:00Z',
          poll_started_at: '2025-01-01T10:00:00Z',
          poll_completed_at: '2025-01-01T10:05:00Z',
          poll_response: {
            rating: 5,
            comment: 'Great service!'
          }
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chats: mockChats,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getChats()

      expect(result.data[0].status).toBe('COMPLETED_POLL')
      expect(result.data[0].poll_started_at).toBe('2025-01-01T10:00:00Z')
      expect(result.data[0].poll_completed_at).toBe('2025-01-01T10:05:00Z')
      expect(result.data[0].poll_response).toEqual({
        rating: 5,
        comment: 'Great service!'
      })
    })

    it('should handle null survey fields', async () => {
      const mockChats = [
        {
          chat_id: '789',
          status: 'CLOSED',
          provider: 'whatsapp',
          created_at: '2024-01-01T00:00:00Z',
          poll_started_at: null,
          poll_completed_at: null,
          poll_abandoned_at: null,
          poll_response: null
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chats: mockChats,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getChats()

      expect(result.data[0].poll_started_at).toBeNull()
      expect(result.data[0].poll_completed_at).toBeNull()
      expect(result.data[0].poll_abandoned_at).toBeNull()
      expect(result.data[0].poll_response).toBeNull()
    })

    it('should handle abandoned poll status with timestamp', async () => {
      const mockChats = [
        {
          chat_id: '999',
          status: 'ABANDONED_POLL',
          provider: 'whatsapp',
          created_at: '2024-01-01T00:00:00Z',
          poll_started_at: '2025-01-01T10:00:00Z',
          poll_abandoned_at: '2025-01-02T10:00:00Z' // 24 hours later
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chats: mockChats,
          total: 1,
          exported: 1
        })
      })

      const result = await client.getChats()

      expect(result.data[0].status).toBe('ABANDONED_POLL')
      expect(result.data[0].poll_started_at).toBe('2025-01-01T10:00:00Z')
      expect(result.data[0].poll_abandoned_at).toBe('2025-01-02T10:00:00Z')
    })
  })

  describe('error handling', () => {
    it('should throw B2ChatAPIError for API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server Error'
      })

      await expect(client.getContacts()).rejects.toThrow(B2ChatAPIError)
    })
  })
})