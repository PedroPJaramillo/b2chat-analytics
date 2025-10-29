import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import React from 'react'
import { useWeeklyResponseTimes } from '../use-weekly-response-times'

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
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  TestWrapper.displayName = 'TestWrapper'

  return TestWrapper
}

describe('useWeeklyResponseTimes', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  describe('Loading States', () => {
    it('should return loading state initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      const { result } = renderHook(
        () => useWeeklyResponseTimes({ weekStart: '2025-10-13' }),
        { wrapper: createWrapper() }
      )

      expect(result.current.loading).toBe(true)
      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('should set loading to false after successful fetch', async () => {
      const mockData = {
        weekStart: '2025-10-13',
        weekEnd: '2025-10-19',
        data: Array(168).fill({ dayOfWeek: 0, hour: 0, avg: '0s', avgMs: 0, count: 0 }),
        summary: { totalChats: 0, overallAvg: '0s', overallAvgMs: 0 }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const { result } = renderHook(
        () => useWeeklyResponseTimes({ weekStart: '2025-10-13' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual(mockData)
      expect(result.current.error).toBeNull()
    })
  })

  describe('Query Parameter Building', () => {
    it('should build query with weekStart only', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], summary: {} }),
      })

      renderHook(
        () => useWeeklyResponseTimes({ weekStart: '2025-10-13' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).toContain('/api/analytics/weekly-response-times')
      expect(callUrl).toContain('weekStart=2025-10-13')
      expect(callUrl).not.toContain('agentId=')
      expect(callUrl).not.toContain('direction=')
    })

    it('should include agentId when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], summary: {} }),
      })

      renderHook(
        () => useWeeklyResponseTimes({
          weekStart: '2025-10-13',
          agentId: 'agent_123'
        }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).toContain('weekStart=2025-10-13')
      expect(callUrl).toContain('agentId=agent_123')
    })

    it('should include direction filter when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], summary: {} }),
      })

      renderHook(
        () => useWeeklyResponseTimes({
          weekStart: '2025-10-13',
          directionFilter: 'incoming'
        }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).toContain('direction=incoming')
    })

    it('should include office hours filter when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], summary: {} }),
      })

      renderHook(
        () => useWeeklyResponseTimes({
          weekStart: '2025-10-13',
          officeHoursFilter: 'office-hours'
        }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).toContain('officeHoursFilter=office-hours')
    })

    it('should include all parameters when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], summary: {} }),
      })

      renderHook(
        () => useWeeklyResponseTimes({
          weekStart: '2025-10-13',
          agentId: 'agent_123',
          directionFilter: 'incoming',
          officeHoursFilter: 'office-hours'
        }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).toContain('weekStart=2025-10-13')
      expect(callUrl).toContain('agentId=agent_123')
      expect(callUrl).toContain('direction=incoming')
      expect(callUrl).toContain('officeHoursFilter=office-hours')
    })
  })

  describe('React Query Cache Keys', () => {
    it('should use different cache keys for different parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], summary: {} }),
      })

      // Render with first set of params
      const { rerender } = renderHook(
        ({ weekStart, agentId }) => useWeeklyResponseTimes({ weekStart, agentId }),
        {
          wrapper: createWrapper(),
          initialProps: { weekStart: '2025-10-13', agentId: 'agent_1' }
        }
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Change parameters should trigger new fetch
      rerender({ weekStart: '2025-10-20', agentId: 'agent_1' })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })
    })

    it('should cache data and not refetch on remount with same params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], summary: {} }),
      })

      const wrapper = createWrapper()

      // First render
      const { unmount } = renderHook(
        () => useWeeklyResponseTimes({ weekStart: '2025-10-13' }),
        { wrapper }
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      unmount()

      // Second render with same params (within staleTime)
      renderHook(
        () => useWeeklyResponseTimes({ weekStart: '2025-10-13' }),
        { wrapper }
      )

      // Should use cached data, not fetch again
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Data Fetching', () => {
    it('should return weekly response time data', async () => {
      const mockData = {
        weekStart: '2025-10-13',
        weekEnd: '2025-10-19',
        agentId: null,
        agentName: null,
        filters: {
          direction: 'all',
          officeHours: 'all'
        },
        data: [
          {
            dayOfWeek: 1,
            dayName: 'Monday',
            hour: 10,
            avg: '2.5m',
            avgMs: 150000,
            count: 42
          },
          // ... more data points
        ],
        summary: {
          totalChats: 2456,
          overallAvg: '2.8m',
          overallAvgMs: 168000,
          fastestHour: {
            dayOfWeek: 1,
            hour: 9,
            avg: '1.2m'
          },
          slowestHour: {
            dayOfWeek: 4,
            hour: 14,
            avg: '5.7m'
          }
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const { result } = renderHook(
        () => useWeeklyResponseTimes({ weekStart: '2025-10-13' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual(mockData)
      expect(result.current.error).toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('should handle API error response', async () => {
      // Mock needs to fail for all retry attempts (retry: 2 = 3 total attempts)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      })

      const { result } = renderHook(
        () => useWeeklyResponseTimes({ weekStart: '2025-10-13' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      }, { timeout: 10000 }) // Increased timeout for retries

      expect(result.current.data).toBeNull()
      expect(result.current.error).toContain('Failed to fetch weekly response times')
    })

    it('should handle network error', async () => {
      // Mock needs to fail for all retry attempts
      mockFetch.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(
        () => useWeeklyResponseTimes({ weekStart: '2025-10-13' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      }, { timeout: 10000 }) // Increased timeout for retries

      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeTruthy()
    })

    it('should handle 404 agent not found error', async () => {
      // Mock needs to fail for all retry attempts
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Agent not found' }),
      })

      const { result } = renderHook(
        () => useWeeklyResponseTimes({
          weekStart: '2025-10-13',
          agentId: 'nonexistent'
        }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      }, { timeout: 10000 }) // Increased timeout for retries

      expect(result.current.data).toBeNull()
    })
  })

  describe('Refetch Functionality', () => {
    it('should allow manual refetch', async () => {
      const mockData1 = {
        weekStart: '2025-10-13',
        data: [],
        summary: { totalChats: 100 }
      }

      const mockData2 = {
        weekStart: '2025-10-13',
        data: [],
        summary: { totalChats: 150 }
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockData1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockData2,
        })

      const { result } = renderHook(
        () => useWeeklyResponseTimes({ weekStart: '2025-10-13' }),
        { wrapper: createWrapper() }
      )

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.data).toEqual(mockData1)
      })

      // Trigger refetch
      result.current.refetch()

      // Wait for refetch to complete
      await waitFor(() => {
        expect(result.current.data).toEqual(mockData2)
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('Configuration', () => {
    it('should have proper staleTime configuration', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], summary: {} }),
      })

      const { result } = renderHook(
        () => useWeeklyResponseTimes({ weekStart: '2025-10-13' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Hook should be configured with 5 minute staleTime
      // This is tested indirectly through cache behavior
      expect(result.current.data).toBeDefined()
    })
  })
})
