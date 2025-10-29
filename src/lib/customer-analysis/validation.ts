/**
 * Validation utilities for customer analysis filters and requests
 */

import type { AnalysisFilters } from '@/types/customer-analysis'

export interface ValidationResult {
  isValid: boolean
  error?: string
}

const MAX_DATE_RANGE_DAYS = 90
const MAX_AGENT_IDS = 50
const MAX_DEPARTMENT_IDS = 20
const MAX_CONTACT_IDS = 100

/**
 * Validates a date range for analysis
 */
export function validateDateRange(
  dateStart: string,
  dateEnd: string
): ValidationResult {
  // Check required fields
  if (!dateStart || dateStart.trim() === '') {
    return { isValid: false, error: 'dateStart is required' }
  }

  if (!dateEnd || dateEnd.trim() === '') {
    return { isValid: false, error: 'dateEnd is required' }
  }

  // Parse dates
  const startDate = new Date(dateStart)
  const endDate = new Date(dateEnd)

  // Validate date formats
  if (isNaN(startDate.getTime())) {
    return { isValid: false, error: 'Invalid date format for dateStart' }
  }

  if (isNaN(endDate.getTime())) {
    return { isValid: false, error: 'Invalid date format for dateEnd' }
  }

  // Check that end date is after or equal to start date
  if (endDate < startDate) {
    return {
      isValid: false,
      error: 'dateEnd must be after or equal to dateStart',
    }
  }

  // Check max date range (90 days)
  const daysDiff = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysDiff > MAX_DATE_RANGE_DAYS) {
    return {
      isValid: false,
      error: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days. Provided range: ${daysDiff} days.`,
    }
  }

  return { isValid: true }
}

/**
 * Validates an array of IDs
 */
function validateIdArray(
  ids: unknown,
  fieldName: string,
  maxLength: number
): ValidationResult {
  if (!Array.isArray(ids)) {
    return { isValid: false, error: `${fieldName} must be an array` }
  }

  if (ids.length === 0) {
    return { isValid: false, error: `${fieldName} cannot be empty` }
  }

  if (ids.length > maxLength) {
    return {
      isValid: false,
      error: `${fieldName} cannot exceed ${maxLength} items`,
    }
  }

  if (!ids.every((id) => typeof id === 'string')) {
    return { isValid: false, error: `${fieldName} must contain only strings` }
  }

  return { isValid: true }
}

/**
 * Validates complete analysis filters
 */
export function validateAnalysisFilters(
  filters: AnalysisFilters
): ValidationResult {
  // Validate date range
  const dateValidation = validateDateRange(filters.dateStart, filters.dateEnd)
  if (!dateValidation.isValid) {
    return dateValidation
  }

  // Validate optional agentIds
  if (filters.agentIds !== undefined) {
    const agentValidation = validateIdArray(
      filters.agentIds,
      'agentIds',
      MAX_AGENT_IDS
    )
    if (!agentValidation.isValid) {
      return agentValidation
    }
  }

  // Validate optional departmentIds
  if (filters.departmentIds !== undefined) {
    const deptValidation = validateIdArray(
      filters.departmentIds,
      'departmentIds',
      MAX_DEPARTMENT_IDS
    )
    if (!deptValidation.isValid) {
      return deptValidation
    }
  }

  // Validate optional contactIds
  if (filters.contactIds !== undefined) {
    const contactValidation = validateIdArray(
      filters.contactIds,
      'contactIds',
      MAX_CONTACT_IDS
    )
    if (!contactValidation.isValid) {
      return contactValidation
    }
  }

  return { isValid: true }
}

/**
 * Checks if user has permission to access specific departments
 */
export function validateDepartmentAccess(
  requestedDepartmentIds: string[] | undefined,
  userDepartmentIds: string[],
  isAdmin: boolean
): ValidationResult {
  // Admins can access all departments
  if (isAdmin) {
    return { isValid: true }
  }

  // If no departments requested, allow (will use user's departments by default)
  if (!requestedDepartmentIds || requestedDepartmentIds.length === 0) {
    return { isValid: true }
  }

  // Check if all requested departments are in user's allowed departments
  const unauthorizedDepts = requestedDepartmentIds.filter(
    (deptId) => !userDepartmentIds.includes(deptId)
  )

  if (unauthorizedDepts.length > 0) {
    return {
      isValid: false,
      error: `Access denied to departments: ${unauthorizedDepts.join(', ')}`,
    }
  }

  return { isValid: true }
}

/**
 * Estimates processing time based on data volume
 */
export function estimateProcessingTime(
  chatCount: number,
  messageCount: number
): number {
  // Base time: 5 seconds
  // + 0.05 seconds per chat
  // + 0.002 seconds per message
  const baseTime = 5
  const chatTime = chatCount * 0.05
  const messageTime = messageCount * 0.002

  return Math.ceil(baseTime + chatTime + messageTime)
}
