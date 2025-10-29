import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import React from 'react'
import { useChatView, useChatMessages, useChatViewStats } from '../use-chat-view'
import type { ChatViewResponse, ChatViewStats } from '@/types/chat-view'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

// Create wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const TestWrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  TestWrapper.displayName = 'TestWrapper';

  return TestWrapper;
}

describe('useChatView', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('should return loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    const { result } = renderHook(() => useChatView(), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should fetch and return chat view data successfully', async () => {
    const mockResponse: ChatViewResponse = {
      chats: [
        {
          id: 'chat1',
          b2chatId: 'b2chat-1',
          contactName: 'John Doe',
          contactId: 'contact1',
          agentName: 'Agent Smith',
          agentId: 'agent1',
          status: 'CLOSED',
          messageCount: 10,
          firstResponseTimeMs: 83000,
          firstResponseTimeFormatted: '1m 23s',
          responseTimeIndicator: 'good',
          lastModifiedAt: '2025-01-15T12:00:00Z',
          updatedAt: '2025-01-15T12:00:00Z'
        }
      ],
      pagination: {
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1
      }
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const { result } = renderHook(() => useChatView(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockResponse)
    expect(result.current.error).toBeNull()
  })

  it('should build query string with filters correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ chats: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } }),
    })

    const filters = {
      status: ['OPENED', 'CLOSED'],
      agentId: 'agent1',
      responseTimeMin: 60000,
      responseTimeMax: 180000,
      search: 'John'
    }

    renderHook(() => useChatView({ filters, sortBy: 'responseTime', sortOrder: 'asc', page: 2, limit: 10 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const callUrl = mockFetch.mock.calls[0][0]
    expect(callUrl).toContain('page=2')
    expect(callUrl).toContain('limit=10')
    expect(callUrl).toContain('sortBy=responseTime')
    expect(callUrl).toContain('sortOrder=asc')
    expect(callUrl).toContain('status=OPENED%2CCLOSED')
    expect(callUrl).toContain('agentId=agent1')
    expect(callUrl).toContain('responseTimeMin=60000')
    expect(callUrl).toContain('responseTimeMax=180000')
    expect(callUrl).toContain('search=John')
  })

  it('should handle API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })

    const { result } = renderHook(() => useChatView(), {
      wrapper: createWrapper(),
    })

    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy()
      },
      { timeout: 5000 }
    )

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('Failed to fetch chat view')
  })

  it('should handle network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useChatView(), {
      wrapper: createWrapper(),
    })

    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy()
      },
      { timeout: 5000 }
    )

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeTruthy()
  })

  it('should use default values for pagination when not provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ chats: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } }),
    })

    renderHook(() => useChatView(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const callUrl = mockFetch.mock.calls[0][0]
    expect(callUrl).toContain('page=1')
    expect(callUrl).toContain('limit=25')
  })

  it('should update query when options change', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ chats: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } }),
    })

    const { rerender } = renderHook(
      ({ page }) => useChatView({ page }),
      {
        wrapper: createWrapper(),
        initialProps: { page: 1 }
      }
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    mockFetch.mockClear()

    rerender({ page: 2 })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const callUrl = mockFetch.mock.calls[0][0]
    expect(callUrl).toContain('page=2')
  })

  // Feature 011: Test new filter parameters
  it('should build query string with Feature 011 filters correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ chats: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } }),
    })

    const filters = {
      departmentId: 'dept1',
      priorityFilter: ['high', 'urgent'],
      slaStatus: 'breached' as const,
      providerFilter: ['whatsapp', 'telegram'],
      messageCountRange: '1-5' as const,
      createdAtRange: { start: new Date('2025-01-01'), end: new Date('2025-01-31') },
      updatedAtRange: { start: new Date('2025-02-01'), end: new Date('2025-02-28') }
    }

    renderHook(() => useChatView({ filters }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const callUrl = mockFetch.mock.calls[0][0]
    expect(callUrl).toContain('departmentId=dept1')
    expect(callUrl).toContain('priority=high%2Curgent')
    expect(callUrl).toContain('slaStatus=breached')
    expect(callUrl).toContain('provider=whatsapp%2Ctelegram')
    expect(callUrl).toContain('messageCountRange=1-5')
    expect(callUrl).toContain('createdAtStart=')
    expect(callUrl).toContain('createdAtEnd=')
    expect(callUrl).toContain('updatedAtStart=')
    expect(callUrl).toContain('updatedAtEnd=')
  })

  it('should support all new sorting options from Feature 011', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ chats: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } }),
    })

    const sortOptions = ['createdAt', 'messageCount', 'status', 'priority', 'departmentName', 'agentName', 'contactName', 'slaStatus'] as const

    for (const sortBy of sortOptions) {
      mockFetch.mockClear()

      renderHook(() => useChatView({ sortBy }), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).toContain(`sortBy=${sortBy}`)
    }
  })
})

describe('useChatViewStats', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('should return loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    const { result } = renderHook(() => useChatViewStats(), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should fetch and return stats data successfully', async () => {
    const mockStats: ChatViewStats = {
      byStatus: {
        OPENED: 5,
        CLOSED: 10,
        PICKED_UP: 3,
        BOT_CHATTING: 2,
        RESPONDED_BY_AGENT: 4,
        COMPLETING_POLL: 0,
        COMPLETED_POLL: 0,
        ABANDONED_POLL: 0,
      },
      byDepartment: {
        dept1: { name: 'Support', count: 8 },
        dept2: { name: 'Sales', count: 6 },
      },
      byAgent: {
        unassigned: 3,
        agent1: { name: 'Agent One', count: 7 },
        agent2: { name: 'Agent Two', count: 4 },
      },
      byPriority: {
        normal: 10,
        high: 5,
        urgent: 3,
        low: 2,
      },
      bySLA: {
        within: 12,
        breached: 6,
      },
      byProvider: {
        whatsapp: 10,
        telegram: 5,
        facebook: 3,
        livechat: 1,
        b2cbotapi: 1,
      },
      byMessageCount: {
        '0': 1,
        '1-5': 5,
        '6-10': 3,
        '11-20': 2,
        '20+': 1,
      },
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    })

    const { result } = renderHook(() => useChatViewStats(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockStats)
    expect(result.current.error).toBeNull()
  })

  it('should call the correct API endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        byStatus: {},
        byDepartment: {},
        byAgent: { unassigned: 0 },
        byPriority: {},
        bySLA: { within: 0, breached: 0 },
        byProvider: {},
        byMessageCount: { '0': 0, '1-5': 0, '6-10': 0, '11-20': 0, '20+': 0 },
      }),
    })

    renderHook(() => useChatViewStats(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/chats/view/stats')
  })

  it('should handle API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })

    const { result } = renderHook(() => useChatViewStats(), {
      wrapper: createWrapper(),
    })

    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy()
      },
      { timeout: 5000 }
    )

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('Failed to fetch chat view stats')
  })

  it('should handle network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useChatViewStats(), {
      wrapper: createWrapper(),
    })

    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy()
      },
      { timeout: 5000 }
    )

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeTruthy()
  })
})

describe('useChatMessages', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('should not fetch when chatId is null', () => {
    const { result } = renderHook(() => useChatMessages(null), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should fetch messages when chatId is provided', async () => {
    const mockMessages = {
      messages: [
        {
          id: 'msg1',
          chatId: 'chat1',
          text: 'Hello',
          type: 'text' as const,
          incoming: true,
          timestamp: '2025-01-15T10:00:00Z'
        },
        {
          id: 'msg2',
          chatId: 'chat1',
          text: 'Hi there!',
          type: 'text' as const,
          incoming: false,
          timestamp: '2025-01-15T10:01:00Z'
        }
      ],
      chat: {
        id: 'chat1',
        b2chatId: 'b2chat-1',
        contactName: 'John Doe',
        agentName: 'Agent Smith',
        status: 'CLOSED'
      }
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMessages,
    })

    const { result } = renderHook(() => useChatMessages('chat1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockMessages)
    expect(result.current.error).toBeNull()
    expect(mockFetch).toHaveBeenCalledWith('/api/chats/chat1/messages')
  })

  it('should handle messages API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    })

    const { result } = renderHook(() => useChatMessages('chat1'), {
      wrapper: createWrapper(),
    })

    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy()
      },
      { timeout: 5000 }
    )

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('Failed to fetch chat messages')
  })

  it('should refetch when chatId changes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [],
        chat: {
          id: 'chat1',
          b2chatId: 'b2chat-1',
          contactName: 'John Doe',
          agentName: 'Agent',
          status: 'CLOSED'
        }
      }),
    })

    const { rerender } = renderHook(
      ({ chatId }) => useChatMessages(chatId),
      {
        wrapper: createWrapper(),
        initialProps: { chatId: 'chat1' }
      }
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/chats/chat1/messages')
    })

    mockFetch.mockClear()

    rerender({ chatId: 'chat2' })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/chats/chat2/messages')
    })
  })

  it('should stop fetching when chatId becomes null', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [],
        chat: {
          id: 'chat1',
          b2chatId: 'b2chat-1',
          contactName: 'John',
          agentName: 'Agent',
          status: 'CLOSED'
        }
      }),
    })

    const { rerender, result } = renderHook(
      ({ chatId }) => useChatMessages(chatId),
      {
        wrapper: createWrapper(),
        initialProps: { chatId: 'chat1' as string | null }
      }
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    mockFetch.mockClear()

    rerender({ chatId: null })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Should not make new fetch call when chatId is null
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
