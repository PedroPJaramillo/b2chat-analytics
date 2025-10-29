import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import React from 'react'
import { useDashboardStats } from '../use-dashboard-stats'

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

describe('useDashboardStats', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('should return loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should fetch and return dashboard stats successfully', async () => {
    const mockStats = {
      totalAgents: 10,
      totalChats: 250,
      totalMessages: 1500,
      activeChats: 5,
      onlineAgents: 8,
      avgResponseTime: '2.5m',
      satisfactionRate: 92.5,
      trends: {
        agentsChange: 2,
        chatsChange: 15,
        responseTimeChange: -5,
        satisfactionChange: 3
      }
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    })

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockStats)
    expect(result.current.error).toBeNull()
  })

  it('should handle API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    })

    // Wait for error state (without checking loading first)
    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy()
      },
      { timeout: 5000 }
    )

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('Failed to fetch dashboard stats')
  })

  it('should handle network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    })

    // Wait for error state (without checking loading first)
    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy()
      },
      { timeout: 5000 }
    )

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeTruthy()
  })

  it('should refetch data when refetch is called', async () => {
    const mockStats1 = {
      totalAgents: 10,
      totalChats: 250,
      activeChats: 5
    }

    const mockStats2 = {
      totalAgents: 12,
      totalChats: 275,
      activeChats: 7
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats1,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats2,
      })

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    })

    // Wait for initial fetch
    await waitFor(() => {
      expect(result.current.data).toEqual(mockStats1)
    })

    // Refetch
    result.current.refetch()

    // Wait for refetch to complete
    await waitFor(() => {
      expect(result.current.data).toEqual(mockStats2)
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})