/**
 * Unit tests for customer analysis filter validation
 */

import { describe, it, expect } from '@jest/globals'
import { validateAnalysisFilters, validateDateRange } from '../validation'

describe('Customer Analysis Validation', () => {
  describe('validateDateRange', () => {
    it('should accept valid date range', () => {
      const result = validateDateRange('2025-09-01', '2025-10-08')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject when dateStart is missing', () => {
      const result = validateDateRange('', '2025-10-08')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('dateStart is required')
    })

    it('should reject when dateEnd is missing', () => {
      const result = validateDateRange('2025-09-01', '')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('dateEnd is required')
    })

    it('should reject when dateEnd is before dateStart', () => {
      const result = validateDateRange('2025-10-08', '2025-09-01')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('dateEnd must be after or equal to dateStart')
    })

    it('should reject when date range exceeds 90 days', () => {
      const result = validateDateRange('2025-01-01', '2025-05-01')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Date range cannot exceed 90 days')
    })

    it('should accept date range of exactly 90 days', () => {
      const result = validateDateRange('2025-01-01', '2025-04-01')
      expect(result.isValid).toBe(true)
    })

    it('should reject invalid date formats', () => {
      const result = validateDateRange('invalid-date', '2025-10-08')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Invalid date format for dateStart')
    })
  })

  describe('validateAnalysisFilters', () => {
    it('should accept valid filters with required fields only', () => {
      const result = validateAnalysisFilters({
        dateStart: '2025-09-01',
        dateEnd: '2025-10-08',
      })

      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should accept valid filters with optional agentIds', () => {
      const result = validateAnalysisFilters({
        dateStart: '2025-09-01',
        dateEnd: '2025-10-08',
        agentIds: ['agent-1', 'agent-2'],
      })

      expect(result.isValid).toBe(true)
    })

    it('should accept valid filters with optional departmentIds', () => {
      const result = validateAnalysisFilters({
        dateStart: '2025-09-01',
        dateEnd: '2025-10-08',
        departmentIds: ['dept-1'],
      })

      expect(result.isValid).toBe(true)
    })

    it('should accept valid filters with all optional fields', () => {
      const result = validateAnalysisFilters({
        dateStart: '2025-09-01',
        dateEnd: '2025-10-08',
        agentIds: ['agent-1'],
        departmentIds: ['dept-1'],
        contactIds: ['contact-1'],
      })

      expect(result.isValid).toBe(true)
    })

    it('should reject when agentIds is not an array', () => {
      const result = validateAnalysisFilters({
        dateStart: '2025-09-01',
        dateEnd: '2025-10-08',
        agentIds: 'not-an-array' as any,
      })

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('agentIds must be an array')
    })

    it('should reject when agentIds contains non-string values', () => {
      const result = validateAnalysisFilters({
        dateStart: '2025-09-01',
        dateEnd: '2025-10-08',
        agentIds: [123, 'agent-2'] as any,
      })

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('agentIds must contain only strings')
    })

    it('should reject when departmentIds is not an array', () => {
      const result = validateAnalysisFilters({
        dateStart: '2025-09-01',
        dateEnd: '2025-10-08',
        departmentIds: 'not-an-array' as any,
      })

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('departmentIds must be an array')
    })

    it('should reject empty agentIds array', () => {
      const result = validateAnalysisFilters({
        dateStart: '2025-09-01',
        dateEnd: '2025-10-08',
        agentIds: [],
      })

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('agentIds cannot be empty')
    })

    it('should reject too many agentIds (over 50)', () => {
      const manyAgents = Array.from({ length: 51 }, (_, i) => `agent-${i}`)
      const result = validateAnalysisFilters({
        dateStart: '2025-09-01',
        dateEnd: '2025-10-08',
        agentIds: manyAgents,
      })

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('agentIds cannot exceed 50 items')
    })

    it('should propagate date range validation errors', () => {
      const result = validateAnalysisFilters({
        dateStart: '2025-10-08',
        dateEnd: '2025-09-01',
      })

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('dateEnd must be after or equal to dateStart')
    })
  })
})
