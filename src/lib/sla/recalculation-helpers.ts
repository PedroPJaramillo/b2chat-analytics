import { RecalculationRequest, RecalculationResult } from '@/types/sla'

/**
 * Get default date range for recalculation (last 30 days)
 */
export function getDefaultDateRange(): Required<Pick<RecalculationRequest, 'startDate' | 'endDate'>> {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  }
}

/**
 * Validate date range for recalculation
 */
export function validateDateRange(
  startDate: string | undefined,
  endDate: string | undefined
): { valid: boolean; error?: string } {
  if (!startDate || !endDate) {
    return { valid: false, error: 'Both start and end dates are required' }
  }

  const start = new Date(startDate)
  const end = new Date(endDate)

  // Check if dates are valid
  if (isNaN(start.getTime())) {
    return { valid: false, error: 'Invalid start date' }
  }

  if (isNaN(end.getTime())) {
    return { valid: false, error: 'Invalid end date' }
  }

  // Check if start is before end
  if (start >= end) {
    return { valid: false, error: 'Start date must be before end date' }
  }

  // Check if date range is not too large (max 1 year)
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  if (daysDiff > 365) {
    return { valid: false, error: 'Date range cannot exceed 1 year (365 days)' }
  }

  // Check if dates are not in the future
  const now = new Date()
  if (end > now) {
    return { valid: false, error: 'End date cannot be in the future' }
  }

  return { valid: true }
}

/**
 * Estimate chat count based on date range
 * This is a rough estimate: ~50 chats per day on average
 */
export function estimateChatCount(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  // Average of 50 chats per day (rough estimate)
  const AVERAGE_CHATS_PER_DAY = 50
  const estimate = daysDiff * AVERAGE_CHATS_PER_DAY

  // Return rounded estimate
  return Math.max(1, Math.round(estimate))
}

/**
 * Format recalculation result for display
 */
export function formatRecalculationResult(result: RecalculationResult): string {
  const { processed, failed, duration } = result

  if (failed === 0) {
    return `Successfully recalculated ${processed} chat${processed === 1 ? '' : 's'} in ${formatDuration(duration)}`
  } else {
    return `Processed ${processed} chat${processed === 1 ? '' : 's'} with ${failed} failure${failed === 1 ? '' : 's'} in ${formatDuration(duration)}`
  }
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }

  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (remainingSeconds === 0) {
    return `${minutes}m`
  }

  return `${minutes}m ${remainingSeconds}s`
}

/**
 * Format date range for display
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }

  const startStr = start.toLocaleDateString('en-US', options)
  const endStr = end.toLocaleDateString('en-US', options)

  return `${startStr} - ${endStr}`
}

/**
 * Calculate estimated processing time based on chat count
 * Rough estimate: 50ms per chat
 */
export function estimateProcessingTime(chatCount: number): number {
  const MS_PER_CHAT = 50
  return chatCount * MS_PER_CHAT
}

/**
 * Format estimated processing time for display
 */
export function formatEstimatedTime(chatCount: number): string {
  const ms = estimateProcessingTime(chatCount)
  const seconds = Math.ceil(ms / 1000)

  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? '' : 's'}`
  }

  const minutes = Math.ceil(seconds / 60)
  return `${minutes} minute${minutes === 1 ? '' : 's'}`
}

/**
 * Get relative time string (e.g., "2 hours ago", "3 days ago")
 */
export function getRelativeTime(timestamp: string): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) {
    return 'just now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  } else {
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }
    return `on ${date.toLocaleDateString('en-US', options)}`
  }
}
