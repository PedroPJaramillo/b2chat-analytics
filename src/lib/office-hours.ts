import type { OfficeHoursConfig, DaySchedule } from "@/types/office-hours"
import type { HolidayConfig } from "@/types/holidays"
import { isHoliday } from "./holidays"

// Day of week mapping
const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const

/**
 * Check if a given date/time is within office hours
 */
export function isWithinOfficeHours(
  date: Date,
  config: OfficeHoursConfig,
  holidayConfig?: HolidayConfig
): boolean {
  if (!config.enabled) {
    return true // If office hours are disabled, all times are "within" hours
  }

  // Check if it's a holiday
  if (holidayConfig && isHoliday(date, holidayConfig)) {
    return false // Holidays are not office hours
  }

  // Get the day of week
  const dayIndex = date.getDay()
  const dayName = daysOfWeek[dayIndex]
  const daySchedule = config.schedule[dayName]

  if (!daySchedule.enabled) {
    return false // This day is not a working day
  }

  // Parse the time from the date
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const currentTime = hours * 60 + minutes // Convert to minutes since midnight

  // Parse start and end times
  const [startHour, startMin] = daySchedule.start.split(":").map(Number)
  const [endHour, endMin] = daySchedule.end.split(":").map(Number)
  const startTime = startHour * 60 + startMin
  const endTime = endHour * 60 + endMin

  return currentTime >= startTime && currentTime <= endTime
}

/**
 * Get the next business day (accounting for weekends and holidays)
 */
export function getNextBusinessDay(
  date: Date,
  config: OfficeHoursConfig,
  holidayConfig?: HolidayConfig
): Date {
  if (!config.enabled) {
    return new Date(date) // If office hours disabled, return same date
  }

  let nextDay = new Date(date)
  nextDay.setHours(0, 0, 0, 0)
  nextDay.setDate(nextDay.getDate() + 1)

  // Keep searching for next business day (max 30 days to prevent infinite loop)
  let attempts = 0
  while (attempts < 30) {
    const dayIndex = nextDay.getDay()
    const dayName = daysOfWeek[dayIndex]
    const daySchedule = config.schedule[dayName]

    // Check if this day is enabled and not a holiday
    if (
      daySchedule.enabled &&
      (!holidayConfig || !isHoliday(nextDay, holidayConfig))
    ) {
      return nextDay
    }

    nextDay.setDate(nextDay.getDate() + 1)
    attempts++
  }

  return nextDay // Return whatever we have after 30 days
}

/**
 * Calculate business hours between two dates
 * Returns the number of minutes within office hours
 */
export function calculateBusinessHours(
  startDate: Date,
  endDate: Date,
  config: OfficeHoursConfig,
  holidayConfig?: HolidayConfig
): number {
  if (!config.enabled) {
    // If office hours disabled, return total time
    return Math.max(0, endDate.getTime() - startDate.getTime()) / 60000 // Convert to minutes
  }

  let totalMinutes = 0
  let currentDate = new Date(startDate)

  // Iterate through each day
  while (currentDate < endDate) {
    const dayIndex = currentDate.getDay()
    const dayName = daysOfWeek[dayIndex]
    const daySchedule = config.schedule[dayName]

    // Skip if day is not enabled or is a holiday
    if (
      !daySchedule.enabled ||
      (holidayConfig && isHoliday(currentDate, holidayConfig))
    ) {
      currentDate.setDate(currentDate.getDate() + 1)
      currentDate.setHours(0, 0, 0, 0)
      continue
    }

    // Parse business hours for this day
    const [startHour, startMin] = daySchedule.start.split(":").map(Number)
    const [endHour, endMin] = daySchedule.end.split(":").map(Number)

    // Create date objects for business hours boundaries
    const businessStart = new Date(currentDate)
    businessStart.setHours(startHour, startMin, 0, 0)

    const businessEnd = new Date(currentDate)
    businessEnd.setHours(endHour, endMin, 0, 0)

    // Calculate overlap with our time range
    const overlapStart = new Date(Math.max(currentDate.getTime(), businessStart.getTime()))
    const overlapEnd = new Date(Math.min(endDate.getTime(), businessEnd.getTime()))

    if (overlapStart < overlapEnd) {
      totalMinutes += (overlapEnd.getTime() - overlapStart.getTime()) / 60000
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1)
    currentDate.setHours(0, 0, 0, 0)
  }

  return Math.max(0, totalMinutes)
}

/**
 * Get a human-readable description of the schedule
 */
export function getScheduleDescription(config: OfficeHoursConfig): string {
  if (!config.enabled) {
    return "24/7 (Office hours not configured)"
  }

  const enabledDays = Object.entries(config.schedule)
    .filter(([_, schedule]) => schedule.enabled)
    .map(([day]) => day.charAt(0).toUpperCase() + day.slice(1))

  if (enabledDays.length === 7) {
    return "24/7"
  }

  if (enabledDays.length === 0) {
    return "No business hours configured"
  }

  // Get most common time range
  const timeRanges = Object.values(config.schedule)
    .filter(schedule => schedule.enabled)
    .map(schedule => `${schedule.start}-${schedule.end}`)

  const mostCommonRange = timeRanges.reduce((acc, range) => {
    acc[range] = (acc[range] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const commonRange = Object.entries(mostCommonRange).sort((a, b) => b[1] - a[1])[0]?.[0]

  return `${enabledDays.join(", ")} ${commonRange || ""}`
}

/**
 * Check if a date falls on a weekend (based on config)
 */
export function isWeekend(date: Date, config: OfficeHoursConfig): boolean {
  const dayIndex = date.getDay()
  const dayName = daysOfWeek[dayIndex]
  return !config.schedule[dayName].enabled
}