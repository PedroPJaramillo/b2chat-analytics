import { renderHook, waitFor } from '@testing-library/react'
import { useSLARecalculation } from '../use-sla-recalculation'
import { RecalculationResult } from '@/types/sla'

// Mock fetch
global.fetch = jest.fn()

describe('useSLARecalculation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useSLARecalculation())

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.result).toBe(null)
    expect(typeof result.current.recalculate).toBe('function')
  })

  it('should set loading state during recalculation', async () => {
    const mockResult: RecalculationResult = {
      success: true,
      processed: 100,
      failed: 0,
      total: 100,
      duration: 5000,
      enabledMetrics: { pickup: true, firstResponse: true, avgResponse: false, resolution: false },
    }

    ;(global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => mockResult,
            })
          }, 100)
        })
    )

    const { result } = renderHook(() => useSLARecalculation())

    const recalculatePromise = result.current.recalculate({
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    })

    // Should be loading immediately
    expect(result.current.loading).toBe(true)

    await recalculatePromise

    // Should not be loading after completion
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  it('should successfully recalculate with default parameters', async () => {
    const mockResult: RecalculationResult = {
      success: true,
      processed: 123,
      failed: 0,
      total: 123,
      duration: 5432,
      enabledMetrics: { pickup: true, firstResponse: true, avgResponse: false, resolution: false },
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResult,
    })

    const { result } = renderHook(() => useSLARecalculation())

    const returnedResult = await result.current.recalculate({})

    expect(returnedResult).toEqual(mockResult)
    expect(result.current.result).toEqual(mockResult)
    expect(result.current.error).toBe(null)
  })

  it('should build correct query parameters', async () => {
    const mockResult: RecalculationResult = {
      success: true,
      processed: 50,
      failed: 0,
      total: 50,
      duration: 2000,
      enabledMetrics: { pickup: true, firstResponse: true, avgResponse: false, resolution: false },
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResult,
    })

    const { result } = renderHook(() => useSLARecalculation())

    await result.current.recalculate({
      startDate: '2025-01-01T00:00:00.000Z',
      endDate: '2025-01-31T23:59:59.999Z',
      limit: 500,
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sla/recalculate?'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    )

    const callUrl = (global.fetch as jest.Mock).mock.calls[0][0]
    expect(callUrl).toContain('startDate=2025-01-01T00%3A00%3A00.000Z')
    expect(callUrl).toContain('endDate=2025-01-31T23%3A59%3A59.999Z')
    expect(callUrl).toContain('limit=500')
  })

  it('should handle API errors', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'Database connection failed' }),
    })

    const { result } = renderHook(() => useSLARecalculation())

    await expect(result.current.recalculate({})).rejects.toThrow('Database connection failed')

    await waitFor(() => {
      expect(result.current.error).not.toBe(null)
      expect(result.current.error?.message).toBe('Database connection failed')
      expect(result.current.result).toBe(null)
    })
  })

  it('should handle network errors', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useSLARecalculation())

    await expect(result.current.recalculate({})).rejects.toThrow('Network error')

    await waitFor(() => {
      expect(result.current.error).not.toBe(null)
      expect(result.current.error?.message).toBe('Network error')
    })
  })

  it('should handle 401 Unauthorized', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Unauthorized' }),
    })

    const { result } = renderHook(() => useSLARecalculation())

    await expect(result.current.recalculate({})).rejects.toThrow('Unauthorized')
  })

  it('should handle 403 Forbidden (non-admin)', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Forbidden',
      json: async () => ({ error: 'Forbidden: Admin role required' }),
    })

    const { result } = renderHook(() => useSLARecalculation())

    await expect(result.current.recalculate({})).rejects.toThrow('Forbidden: Admin role required')
  })

  it('should handle 429 Rate Limit Exceeded', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Too Many Requests',
      json: async () => ({ error: 'Rate limit exceeded', retryAfter: 3600 }),
    })

    const { result } = renderHook(() => useSLARecalculation())

    await expect(result.current.recalculate({})).rejects.toThrow('Rate limit exceeded')
  })

  it('should handle partial success with errors', async () => {
    const mockResult: RecalculationResult = {
      success: false,
      processed: 95,
      failed: 5,
      total: 100,
      duration: 8000,
      enabledMetrics: { pickup: true, firstResponse: true, avgResponse: false, resolution: false },
      errors: [
        { chatId: 'chat-1', error: 'Missing message data' },
        { chatId: 'chat-2', error: 'Invalid timestamp' },
        { chatId: 'chat-3', error: 'Database constraint' },
        { chatId: 'chat-4', error: 'Calculation timeout' },
        { chatId: 'chat-5', error: 'Unknown error' },
      ],
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResult,
    })

    const { result } = renderHook(() => useSLARecalculation())

    const returnedResult = await result.current.recalculate({})

    expect(returnedResult.success).toBe(false)
    expect(returnedResult.processed).toBe(95)
    expect(returnedResult.failed).toBe(5)
    expect(returnedResult.errors).toHaveLength(5)
    expect(result.current.result).toEqual(mockResult)
  })

  it('should clear previous results on new recalculation', async () => {
    const firstResult: RecalculationResult = {
      success: true,
      processed: 50,
      failed: 0,
      total: 50,
      duration: 2000,
      enabledMetrics: { pickup: true, firstResponse: true, avgResponse: false, resolution: false },
    }

    const secondResult: RecalculationResult = {
      success: true,
      processed: 100,
      failed: 0,
      total: 100,
      duration: 4000,
      enabledMetrics: { pickup: true, firstResponse: true, avgResponse: false, resolution: false },
    }

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => firstResult,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => secondResult,
      })

    const { result } = renderHook(() => useSLARecalculation())

    // First recalculation
    await result.current.recalculate({})
    expect(result.current.result).toEqual(firstResult)

    // Second recalculation should clear previous result
    const secondPromise = result.current.recalculate({})

    // Result should be null while loading
    await waitFor(() => {
      expect(result.current.result).toBe(null)
    })

    await secondPromise

    // Result should be updated
    await waitFor(() => {
      expect(result.current.result).toEqual(secondResult)
    })
  })

  it('should handle malformed JSON response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: async () => {
        throw new Error('Invalid JSON')
      },
    })

    const { result } = renderHook(() => useSLARecalculation())

    await expect(result.current.recalculate({})).rejects.toThrow('Recalculation failed: Bad Request')
  })

  it('should include chatId in query params when provided', async () => {
    const mockResult: RecalculationResult = {
      success: true,
      processed: 1,
      failed: 0,
      total: 1,
      duration: 100,
      enabledMetrics: { pickup: true, firstResponse: true, avgResponse: false, resolution: false },
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResult,
    })

    const { result } = renderHook(() => useSLARecalculation())

    await result.current.recalculate({
      chatId: 'chat-123',
    })

    const callUrl = (global.fetch as jest.Mock).mock.calls[0][0]
    expect(callUrl).toContain('chatId=chat-123')
  })

  it('should not include undefined parameters in query string', async () => {
    const mockResult: RecalculationResult = {
      success: true,
      processed: 100,
      failed: 0,
      total: 100,
      duration: 5000,
      enabledMetrics: { pickup: true, firstResponse: true, avgResponse: false, resolution: false },
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResult,
    })

    const { result } = renderHook(() => useSLARecalculation())

    await result.current.recalculate({
      startDate: '2025-01-01',
      // endDate is undefined
    })

    const callUrl = (global.fetch as jest.Mock).mock.calls[0][0]
    expect(callUrl).toContain('startDate=2025-01-01')
    expect(callUrl).not.toContain('endDate')
    expect(callUrl).not.toContain('undefined')
  })
})
