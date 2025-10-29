import { OfficeHoursConfig } from '@/lib/config/sla-config';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * Checks if a given date/time falls within configured office hours
 *
 * @param date - The date to check
 * @param config - Office hours configuration
 * @returns true if within office hours, false otherwise
 */
export function isWithinOfficeHours(date: Date, config: OfficeHoursConfig): boolean {
  // Convert UTC date to configured timezone
  const zonedDate = toZonedTime(date, config.timezone);

  // Get day of week (1 = Monday, 7 = Sunday)
  const dayOfWeek = zonedDate.getDay();
  const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert Sunday from 0 to 7

  // Check if it's a working day
  if (!config.workingDays.includes(adjustedDay)) {
    return false;
  }

  // Get current time in HH:mm format
  const currentTime = formatInTimeZone(date, config.timezone, 'HH:mm');

  // Check if within office hours (inclusive start, exclusive end)
  return currentTime >= config.start && currentTime < config.end;
}

/**
 * Gets the next business hour start time from a given date
 * If already within business hours, returns the same date
 *
 * @param date - The starting date
 * @param config - Office hours configuration
 * @returns The next business hour start time
 */
export function getNextBusinessHourStart(date: Date, config: OfficeHoursConfig): Date {
  // If already within office hours, return the same date
  if (isWithinOfficeHours(date, config)) {
    return date;
  }

  // Convert to zoned time for calculations
  const zonedDate = toZonedTime(date, config.timezone);

  // Get day of week (1 = Monday, 7 = Sunday)
  let dayOfWeek = zonedDate.getDay();
  let adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;

  // Get current time in HH:mm format
  const currentTime = formatInTimeZone(date, config.timezone, 'HH:mm');

  // Create a new date for the next business hour start
  const nextBusinessDay = new Date(zonedDate);

  // If before office hours on a working day, use today's start time
  if (config.workingDays.includes(adjustedDay) && currentTime < config.start) {
    const [hours, minutes] = config.start.split(':').map(Number);
    nextBusinessDay.setHours(hours, minutes, 0, 0);
    return fromZonedTime(nextBusinessDay, config.timezone);
  }

  // Otherwise, find the next working day
  let daysToAdd = 1;
  while (daysToAdd <= 7) {
    nextBusinessDay.setDate(zonedDate.getDate() + daysToAdd);
    dayOfWeek = nextBusinessDay.getDay();
    adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;

    if (config.workingDays.includes(adjustedDay)) {
      // Set to start of office hours
      const [hours, minutes] = config.start.split(':').map(Number);
      nextBusinessDay.setHours(hours, minutes, 0, 0);
      return fromZonedTime(nextBusinessDay, config.timezone);
    }

    daysToAdd++;
  }

  // Fallback (should never reach here if config is valid)
  return date;
}

/**
 * Calculates business hours (in seconds) between two dates
 * Only counts time that falls within configured office hours and working days
 *
 * @param startDate - The start date/time
 * @param endDate - The end date/time
 * @param config - Office hours configuration
 * @returns Business hours in seconds
 */
export function calculateBusinessHoursBetween(
  startDate: Date,
  endDate: Date,
  config: OfficeHoursConfig
): number {
  if (startDate.getTime() >= endDate.getTime()) {
    return 0;
  }

  let totalSeconds = 0;
  let currentDate = new Date(startDate);

  // Iterate through each day
  while (currentDate < endDate) {
    const zonedCurrent = toZonedTime(currentDate, config.timezone);

    // Get day of week
    const dayOfWeek = zonedCurrent.getDay();
    const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;

    // Check if it's a working day
    if (config.workingDays.includes(adjustedDay)) {
      // Parse office hours
      const [startHour, startMin] = config.start.split(':').map(Number);
      const [endHour, endMin] = config.end.split(':').map(Number);

      // Create start and end times for this day in the configured timezone
      const dayStart = new Date(zonedCurrent);
      dayStart.setHours(startHour, startMin, 0, 0);
      const dayStartUTC = fromZonedTime(dayStart, config.timezone);

      const dayEnd = new Date(zonedCurrent);
      dayEnd.setHours(endHour, endMin, 0, 0);
      const dayEndUTC = fromZonedTime(dayEnd, config.timezone);

      // Calculate the overlap between [currentDate, endDate] and [dayStart, dayEnd]
      const overlapStart = currentDate < dayStartUTC ? dayStartUTC : currentDate;
      const overlapEnd = endDate < dayEndUTC ? endDate : dayEndUTC;

      if (overlapStart < overlapEnd) {
        const overlapSeconds = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 1000);
        totalSeconds += overlapSeconds;
      }
    }

    // Move to next day
    const zonedNext = toZonedTime(currentDate, config.timezone);
    zonedNext.setDate(zonedNext.getDate() + 1);
    zonedNext.setHours(0, 0, 0, 0);
    currentDate = fromZonedTime(zonedNext, config.timezone);
  }

  return totalSeconds;
}

/**
 * Calculates business hours pickup time
 *
 * @param openedAt - When the chat was opened
 * @param firstAgentAssignedAt - When first agent was assigned
 * @param config - Office hours configuration
 * @returns Business hours in seconds, or null if not picked up
 */
export function calculatePickupTimeBH(
  openedAt: Date,
  firstAgentAssignedAt: Date | null,
  config: OfficeHoursConfig
): number | null {
  if (!firstAgentAssignedAt) {
    return null;
  }

  return calculateBusinessHoursBetween(openedAt, firstAgentAssignedAt, config);
}

/**
 * Calculates business hours first response time
 *
 * @param openedAt - When the chat was opened
 * @param firstAgentMessageAt - When first agent message was sent
 * @param config - Office hours configuration
 * @returns Business hours in seconds, or null if no response
 */
export function calculateFirstResponseTimeBH(
  openedAt: Date,
  firstAgentMessageAt: Date | null,
  config: OfficeHoursConfig
): number | null {
  if (!firstAgentMessageAt) {
    return null;
  }

  return calculateBusinessHoursBetween(openedAt, firstAgentMessageAt, config);
}

/**
 * Calculates business hours average response time
 *
 * @param messages - Array of messages with role and timestamp
 * @param config - Office hours configuration
 * @returns Average business hours response time in seconds, or null if no responses
 */
export function calculateAvgResponseTimeBH(
  messages: Array<{ role: 'customer' | 'agent' | 'system'; createdAt: Date }>,
  config: OfficeHoursConfig
): number | null {
  if (messages.length === 0) {
    return null;
  }

  const responseTimes: number[] = [];
  let lastCustomerMessageTime: Date | null = null;

  for (const message of messages) {
    if (message.role === 'customer') {
      lastCustomerMessageTime = message.createdAt;
    } else if (message.role === 'agent' && lastCustomerMessageTime) {
      const responseTimeSec = calculateBusinessHoursBetween(
        lastCustomerMessageTime,
        message.createdAt,
        config
      );
      responseTimes.push(responseTimeSec);
      lastCustomerMessageTime = null;
    }
  }

  if (responseTimes.length === 0) {
    return null;
  }

  const sum = responseTimes.reduce((acc, time) => acc + time, 0);
  return sum / responseTimes.length;
}

/**
 * Calculates business hours resolution time
 *
 * @param openedAt - When the chat was opened
 * @param closedAt - When the chat was closed
 * @param config - Office hours configuration
 * @returns Business hours in seconds, or null if not closed
 */
export function calculateResolutionTimeBH(
  openedAt: Date,
  closedAt: Date | null,
  config: OfficeHoursConfig
): number | null {
  if (!closedAt) {
    return null;
  }

  return calculateBusinessHoursBetween(openedAt, closedAt, config);
}
