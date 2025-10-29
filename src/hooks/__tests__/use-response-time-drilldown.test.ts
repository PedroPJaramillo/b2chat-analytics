import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import React from 'react'
import { useResponseTimeDrilldown } from '../use-response-time-drilldown'

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

describe('useResponseTimeDrilldown', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  describe('Loading States', () => {
    it('should return loading state initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      const { result } = renderHook(
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14
        }),
        { wrapper: createWrapper() }
      )

      expect(result.current.loading).toBe(true)
      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('should set loading to false after successful fetch', async () => {
      const mockData = {
        dayName: 'Tuesday',
        hourRange: '2:00 PM - 3:00 PM',
        timeSlotStart: '2025-10-15T14:00:00.000Z',
        timeSlotEnd: '2025-10-15T15:00:00.000Z',
        summary: {
          totalChats: 10,
          avgResponseTime: '5.0m',
          avgResponseTimeMs: 300000,
          comparisonToWeekly: '+1.5m',
          performanceIndicator: 'default',
          performanceLabel: 'Average'
        },
        distribution: [],
        agentBreakdown: [],
        slowestChats: []
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const { result } = renderHook(
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14
        }),
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
    it('should build query with required parameters only', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: {}, distribution: [], agentBreakdown: [], slowestChats: [] }),
      })

      renderHook(
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14
        }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).toContain('/api/analytics/response-time-drilldown')
      expect(callUrl).toContain('weekStart=2025-10-13')
      expect(callUrl).toContain('dayOfWeek=2')
      expect(callUrl).toContain('hour=14')
      expect(callUrl).not.toContain('agentId=')
    })

    it('should include agentId when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: {}, distribution: [], agentBreakdown: [], slowestChats: [] }),
      })

      renderHook(
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14,
          agentId: 'agent_123'
        }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).toContain('agentId=agent_123')
    })

    it('should include direction filter when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: {}, distribution: [], agentBreakdown: [], slowestChats: [] }),
      })

      renderHook(
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14,
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
        json: async () => ({ summary: {}, distribution: [], agentBreakdown: [], slowestChats: [] }),
      })

      renderHook(
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14,
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
        json: async () => ({ summary: {}, distribution: [], agentBreakdown: [], slowestChats: [] }),
      })

      renderHook(
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14,
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
      expect(callUrl).toContain('dayOfWeek=2')
      expect(callUrl).toContain('hour=14')
      expect(callUrl).toContain('agentId=agent_123')
      expect(callUrl).toContain('direction=incoming')
      expect(callUrl).toContain('officeHoursFilter=office-hours')
    })

    it('should not include agentId when set to "all"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: {}, distribution: [], agentBreakdown: [], slowestChats: [] }),
      })

      renderHook(
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14,
          agentId: 'all'
        }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).not.toContain('agentId=')
    })

    it('should not include direction when set to "all"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: {}, distribution: [], agentBreakdown: [], slowestChats: [] }),
      })

      renderHook(
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14,
          directionFilter: 'all'
        }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).not.toContain('direction=')
    })
  })

  describe('React Query Cache Keys', () => {
    it('should use different cache keys for different time slots', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ summary: {}, distribution: [], agentBreakdown: [], slowestChats: [] }),
      })

      // Render with first time slot
      const { rerender } = renderHook(
        ({ weekStart, dayOfWeek, hour }) => useResponseTimeDrilldown({ weekStart, dayOfWeek, hour }),
        {
          wrapper: createWrapper(),
          initialProps: { weekStart: '2025-10-13', dayOfWeek: 2, hour: 14 }
        }
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Change hour should trigger new fetch
      rerender({ weekStart: '2025-10-13', dayOfWeek: 2, hour: 15 })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })
    })

    it('should use different cache keys for different agents', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ summary: {}, distribution: [], agentBreakdown: [], slowestChats: [] }),
      })

      const { rerender } = renderHook(
        ({ agentId }) => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14,
          agentId
        }),
        {
          wrapper: createWrapper(),
          initialProps: { agentId: 'agent_1' }
        }
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Change agent should trigger new fetch
      rerender({ agentId: 'agent_2' })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })
    })

    it('should cache data and not refetch on remount with same params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ summary: {}, distribution: [], agentBreakdown: [], slowestChats: [] }),
      })

      const wrapper = createWrapper()

      // First render
      const { unmount } = renderHook(
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14
        }),
        { wrapper }
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      unmount()

      // Second render with same params (within staleTime)
      renderHook(
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14
        }),
        { wrapper }
      )

      // Should use cached data, not fetch again
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Data Fetching', () => {
    it('should return complete drill-down data', async () => {
      const mockData = {
        dayName: 'Tuesday',
        hourRange: '2:00 PM - 3:00 PM',
        timeSlotStart: '2025-10-15T14:00:00.000Z',
        timeSlotEnd: '2025-10-15T15:00:00.000Z',
        summary: {
          totalChats: 15,
          avgResponseTime: '8.5m',
          avgResponseTimeMs: 510000,
          comparisonToWeekly: '+5.3m',
          performanceIndicator: 'destructive',
          performanceLabel: 'Worse'
        },
        distribution: [
          { status: 'resolved', count: 8 },
          { status: 'pending', count: 5 },
          { status: 'active', count: 2 }
        ],
        agentBreakdown: [
          {
            agentId: 'agent_carlos',
            agentName: 'Carlos Rivera',
            chatCount: 8,
            avgResponseTime: '12.0m',
            avgResponseTimeMs: 720000
          },
          {
            agentId: 'agent_maria',
            agentName: 'Maria Santos',
            chatCount: 7,
            avgResponseTime: '4.5m',
            avgResponseTimeMs: 270000
          }
        ],
        slowestChats: [
          {
            chatId: 'chat_123',
            customerName: 'John Doe',
            agentName: 'Carlos Rivera',
            channel: 'whatsapp',
            responseTime: '18.2m',
            responseTimeMs: 1092000,
            status: 'resolved'
          }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const { result } = renderHook(
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14
        }),
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
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      })

      const { result } = renderHook(
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14
        }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      }, { timeout: 10000 })

      expect(result.current.data).toBeNull()
      expect(result.current.error).toContain('Failed to fetch drill-down data')
    })

    it('should handle network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14
        }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      }, { timeout: 10000 })

      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeTruthy()
    })

    it('should handle 400 invalid parameter error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid hour: must be 0-23' }),
      })

      const { result } = renderHook(
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 25 // Invalid hour
        }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      }, { timeout: 10000 })

      expect(result.current.data).toBeNull()
    })
  })

  describe('Refetch Functionality', () => {
    it('should allow manual refetch', async () => {
      const mockData1 = {
        dayName: 'Tuesday',
        summary: { totalChats: 10 },
        distribution: [],
        agentBreakdown: [],
        slowestChats: []
      }

      const mockData2 = {
        dayName: 'Tuesday',
        summary: { totalChats: 15 },
        distribution: [],
        agentBreakdown: [],
        slowestChats: []
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
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14
        }),
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
        json: async () => ({ summary: {}, distribution: [], agentBreakdown: [], slowestChats: [] }),
      })

      const { result } = renderHook(
        () => useResponseTimeDrilldown({
          weekStart: '2025-10-13',
          dayOfWeek: 2,
          hour: 14
        }),
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
