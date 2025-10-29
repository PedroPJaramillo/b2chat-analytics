import type { HolidayConfig, CustomHoliday } from "@/types/holidays"
import { getPresetHolidays } from "@/types/holidays"

/**
 * Check if a given date is a holiday
 */
export function isHoliday(date: Date, config: HolidayConfig): boolean {
  if (!config.enabled) {
    return false
  }

  const dateString = formatDateToYYYYMMDD(date)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const monthDay = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

  // Check custom holidays
  for (const holiday of config.customHolidays) {
    if (holiday.recurring) {
      // For recurring holidays, check month-day only
      const holidayMonthDay = holiday.date.substring(5) // Extract MM-DD
      if (holidayMonthDay === monthDay) {
        return true
      }
    } else {
      // For non-recurring, check exact date
      if (holiday.date === dateString) {
        return true
      }
    }
  }

  // Check preset holidays
  if (config.presetHolidays?.enabled) {
    const presetHolidays = getPresetHolidays(config.presetHolidays.countryCode)
    for (const holiday of presetHolidays) {
      if (holiday.recurring) {
        const holidayMonthDay = holiday.date.substring(5)
        if (holidayMonthDay === monthDay) {
          return true
        }
      } else {
        if (holiday.date === dateString) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Get all holidays in a date range
 */
export function getHolidaysInRange(
  startDate: Date,
  endDate: Date,
  config: HolidayConfig
): Array<CustomHoliday & { date: string }> {
  if (!config.enabled) {
    return []
  }

  const holidays: Array<CustomHoliday & { date: string }> = []
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    const dateString = formatDateToYYYYMMDD(currentDate)
    const month = currentDate.getMonth() + 1
    const day = currentDate.getDate()
    const monthDay = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

    // Check custom holidays
    for (const holiday of config.customHolidays) {
      if (holiday.recurring) {
        const holidayMonthDay = holiday.date.substring(5)
        if (holidayMonthDay === monthDay) {
          holidays.push({ ...holiday, date: dateString })
        }
      } else {
        if (holiday.date === dateString) {
          holidays.push({ ...holiday, date: dateString })
        }
      }
    }

    // Check preset holidays
    if (config.presetHolidays?.enabled) {
      const presetHolidays = getPresetHolidays(config.presetHolidays.countryCode)
      for (const holiday of presetHolidays) {
        if (holiday.recurring) {
          const holidayMonthDay = holiday.date.substring(5)
          if (holidayMonthDay === monthDay) {
            holidays.push({ ...holiday, date: dateString })
          }
        } else {
          if (holiday.date === dateString) {
            holidays.push({ ...holiday, date: dateString })
          }
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  // Remove duplicates
  const uniqueHolidays = holidays.filter(
    (holiday, index, self) =>
      index === self.findIndex((h) => h.date === holiday.date && h.name === holiday.name)
  )

  return uniqueHolidays
}

/**
 * Format date to YYYY-MM-DD string
 */
export function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Get holiday name for a specific date (if it's a holiday)
 */
export function getHolidayName(date: Date, config: HolidayConfig): string | null {
  if (!config.enabled) {
    return null
  }

  const dateString = formatDateToYYYYMMDD(date)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const monthDay = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

  // Check custom holidays
  for (const holiday of config.customHolidays) {
    if (holiday.recurring) {
      const holidayMonthDay = holiday.date.substring(5)
      if (holidayMonthDay === monthDay) {
        return holiday.name
      }
    } else {
      if (holiday.date === dateString) {
        return holiday.name
      }
    }
  }

  // Check preset holidays
  if (config.presetHolidays?.enabled) {
    const presetHolidays = getPresetHolidays(config.presetHolidays.countryCode)
    for (const holiday of presetHolidays) {
      if (holiday.recurring) {
        const holidayMonthDay = holiday.date.substring(5)
        if (holidayMonthDay === monthDay) {
          return holiday.name
        }
      } else {
        if (holiday.date === dateString) {
          return holiday.name
        }
      }
    }
  }

  return null
}

/**
 * Count holidays in a date range
 */
export function countHolidaysInRange(
  startDate: Date,
  endDate: Date,
  config: HolidayConfig
): number {
  return getHolidaysInRange(startDate, endDate, config).length
}