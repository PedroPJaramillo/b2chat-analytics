import {
  getDefaultDateRange,
  validateDateRange,
  estimateChatCount,
  formatRecalculationResult,
  formatDuration,
  formatDateRange,
  estimateProcessingTime,
  formatEstimatedTime,
  getRelativeTime,
} from '../recalculation-helpers'
import { RecalculationResult } from '@/types/sla'

describe('SLA Recalculation Helpers', () => {
  describe('getDefaultDateRange', () => {
    it('should return date range for last 30 days', () => {
      const result = getDefaultDateRange()

      expect(result.startDate).toBeDefined()
      expect(result.endDate).toBeDefined()

      const start = new Date(result.startDate)
      const end = new Date(result.endDate)
      const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

      expect(diffDays).toBe(30)
    })

    it('should return valid ISO date strings', () => {
      const result = getDefaultDateRange()

      expect(() => new Date(result.startDate)).not.toThrow()
      expect(() => new Date(result.endDate)).not.toThrow()
    })
  })

  describe('validateDateRange', () => {
    it('should validate correct date range', () => {
      const startDate = new Date('2025-01-01').toISOString()
      const endDate = new Date('2025-01-31').toISOString()

      const result = validateDateRange(startDate, endDate)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject missing dates', () => {
      const result = validateDateRange(undefined, undefined)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Both start and end dates are required')
    })

    it('should reject invalid start date', () => {
      const result = validateDateRange('invalid-date', new Date().toISOString())

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid start date')
    })

    it('should reject invalid end date', () => {
      const result = validateDateRange(new Date().toISOString(), 'invalid-date')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid end date')
    })

    it('should reject start date after end date', () => {
      const startDate = new Date('2025-02-01').toISOString()
      const endDate = new Date('2025-01-01').toISOString()

      const result = validateDateRange(startDate, endDate)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Start date must be before end date')
    })

    it('should reject start date equal to end date', () => {
      const date = new Date('2025-01-01').toISOString()

      const result = validateDateRange(date, date)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Start date must be before end date')
    })

    it('should reject date range exceeding 1 year', () => {
      const startDate = new Date('2024-01-01').toISOString()
      const endDate = new Date('2025-02-01').toISOString() // More than 1 year

      const result = validateDateRange(startDate, endDate)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Date range cannot exceed 1 year (365 days)')
    })

    it('should reject future end date', () => {
      const startDate = new Date().toISOString()
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)

      const result = validateDateRange(startDate, futureDate.toISOString())

      expect(result.valid).toBe(false)
      expect(result.error).toBe('End date cannot be in the future')
    })

    it('should accept date range up to 365 days', () => {
      const startDate = new Date('2023-01-01').toISOString()
      const endDate = new Date('2023-12-31').toISOString() // 364 days (non-leap year)

      const result = validateDateRange(startDate, endDate)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })

  describe('estimateChatCount', () => {
    it('should estimate ~50 chats per day', () => {
      const startDate = new Date('2025-01-01').toISOString()
      const endDate = new Date('2025-01-11').toISOString() // 10 days

      const result = estimateChatCount(startDate, endDate)

      // 10 days * 50 chats/day = 500 (approximately)
      expect(result).toBeGreaterThanOrEqual(450)
      expect(result).toBeLessThanOrEqual(550)
    })

    it('should return at least 1 for very short ranges', () => {
      const startDate = new Date('2025-01-01T00:00:00').toISOString()
      const endDate = new Date('2025-01-01T01:00:00').toISOString() // 1 hour

      const result = estimateChatCount(startDate, endDate)

      expect(result).toBeGreaterThanOrEqual(1)
    })

    it('should estimate for 30-day range', () => {
      const { startDate, endDate } = getDefaultDateRange()

      const result = estimateChatCount(startDate, endDate)

      // 30 days * 50 chats/day = 1500 (approximately)
      expect(result).toBeGreaterThanOrEqual(1400)
      expect(result).toBeLessThanOrEqual(1600)
    })
  })

  describe('formatRecalculationResult', () => {
    it('should format successful result', () => {
      const result: RecalculationResult = {
        success: true,
        processed: 123,
        failed: 0,
        total: 123,
        duration: 5432,
        enabledMetrics: { pickup: true, firstResponse: true, avgResponse: false, resolution: false },
      }

      const formatted = formatRecalculationResult(result)

      expect(formatted).toContain('123 chats')
      expect(formatted).toContain('5s')
      expect(formatted).not.toContain('failure')
    })

    it('should format result with failures', () => {
      const result: RecalculationResult = {
        success: false,
        processed: 100,
        failed: 5,
        total: 105,
        duration: 8500,
        enabledMetrics: { pickup: true, firstResponse: true, avgResponse: false, resolution: false },
      }

      const formatted = formatRecalculationResult(result)

      expect(formatted).toContain('100 chats')
      expect(formatted).toContain('5 failures')
      expect(formatted).toContain('8s')
    })

    it('should use singular form for 1 chat', () => {
      const result: RecalculationResult = {
        success: true,
        processed: 1,
        failed: 0,
        total: 1,
        duration: 100,
        enabledMetrics: { pickup: true, firstResponse: true, avgResponse: false, resolution: false },
      }

      const formatted = formatRecalculationResult(result)

      expect(formatted).toContain('1 chat')
      expect(formatted).not.toContain('1 chats')
    })

    it('should use singular form for 1 failure', () => {
      const result: RecalculationResult = {
        success: false,
        processed: 10,
        failed: 1,
        total: 11,
        duration: 1000,
        enabledMetrics: { pickup: true, firstResponse: true, avgResponse: false, resolution: false },
      }

      const formatted = formatRecalculationResult(result)

      expect(formatted).toContain('1 failure')
      expect(formatted).not.toContain('1 failures')
    })
  })

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms')
    })

    it('should format seconds', () => {
      expect(formatDuration(5000)).toBe('5s')
      expect(formatDuration(45000)).toBe('45s')
    })

    it('should format minutes', () => {
      expect(formatDuration(60000)).toBe('1m')
      expect(formatDuration(120000)).toBe('2m')
    })

    it('should format minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s')
      expect(formatDuration(125000)).toBe('2m 5s')
    })
  })

  describe('formatDateRange', () => {
    it('should format date range', () => {
      const startDate = new Date('2025-01-01').toISOString()
      const endDate = new Date('2025-01-31').toISOString()

      const result = formatDateRange(startDate, endDate)

      expect(result).toContain('Jan')
      expect(result).toContain('2025')
      expect(result).toContain('-')
    })
  })

  describe('estimateProcessingTime', () => {
    it('should estimate 50ms per chat', () => {
      expect(estimateProcessingTime(100)).toBe(5000) // 100 * 50ms
      expect(estimateProcessingTime(1000)).toBe(50000) // 1000 * 50ms
    })

    it('should handle zero chats', () => {
      expect(estimateProcessingTime(0)).toBe(0)
    })
  })

  describe('formatEstimatedTime', () => {
    it('should format seconds', () => {
      expect(formatEstimatedTime(10)).toContain('second')
    })

    it('should format minutes for large counts', () => {
      expect(formatEstimatedTime(2000)).toContain('minute')
    })

    it('should use singular form for 1 second', () => {
      const result = formatEstimatedTime(1)
      expect(result).toContain('1 second')
      expect(result).not.toContain('seconds')
    })

    it('should use singular form for 1 minute', () => {
      const result = formatEstimatedTime(1200) // ~1 minute
      expect(result).toContain('1 minute')
      expect(result).not.toContain('minutes')
    })
  })

  describe('getRelativeTime', () => {
    it('should return "just now" for recent timestamps', () => {
      const timestamp = new Date().toISOString()
      expect(getRelativeTime(timestamp)).toBe('just now')
    })

    it('should return minutes ago', () => {
      const date = new Date()
      date.setMinutes(date.getMinutes() - 5)
      const timestamp = date.toISOString()

      expect(getRelativeTime(timestamp)).toContain('minute')
      expect(getRelativeTime(timestamp)).toContain('ago')
    })

    it('should return hours ago', () => {
      const date = new Date()
      date.setHours(date.getHours() - 3)
      const timestamp = date.toISOString()

      expect(getRelativeTime(timestamp)).toContain('hour')
      expect(getRelativeTime(timestamp)).toContain('ago')
    })

    it('should return days ago', () => {
      const date = new Date()
      date.setDate(date.getDate() - 2)
      const timestamp = date.toISOString()

      expect(getRelativeTime(timestamp)).toContain('day')
      expect(getRelativeTime(timestamp)).toContain('ago')
    })

    it('should return formatted date for old timestamps', () => {
      const date = new Date()
      date.setDate(date.getDate() - 10)
      const timestamp = date.toISOString()

      const result = getRelativeTime(timestamp)
      expect(result).toContain('on')
    })
  })
})
