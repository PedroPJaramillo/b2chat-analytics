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