/**
 * @jest-environment node
 */

import { describe, it, expect } from '@jest/globals';
import {
  isWithinOfficeHours,
  calculateBusinessHoursBetween,
  getNextBusinessHourStart,
} from '../business-hours';
import { OfficeHoursConfig } from '@/lib/config/sla-config';

const DEFAULT_OFFICE_HOURS: OfficeHoursConfig = {
  start: '09:00',
  end: '17:00',
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri
  timezone: 'America/New_York',
};

describe('Business Hours Calculator', () => {
  describe('isWithinOfficeHours', () => {
    it('should return true for time within office hours on working day', () => {
      // Tuesday, Jan 14, 2025 at 10:00 AM EST
      const date = new Date('2025-01-14T15:00:00Z'); // 10 AM EST = 15:00 UTC

      const result = isWithinOfficeHours(date, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(true);
    });

    it('should return false for time before office hours', () => {
      // Tuesday, Jan 14, 2025 at 8:00 AM EST
      const date = new Date('2025-01-14T13:00:00Z'); // 8 AM EST = 13:00 UTC

      const result = isWithinOfficeHours(date, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(false);
    });

    it('should return false for time after office hours', () => {
      // Tuesday, Jan 14, 2025 at 6:00 PM EST
      const date = new Date('2025-01-14T23:00:00Z'); // 6 PM EST = 23:00 UTC

      const result = isWithinOfficeHours(date, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(false);
    });

    it('should return false for weekend (Saturday)', () => {
      // Saturday, Jan 18, 2025 at 10:00 AM EST
      const date = new Date('2025-01-18T15:00:00Z');

      const result = isWithinOfficeHours(date, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(false);
    });

    it('should return false for weekend (Sunday)', () => {
      // Sunday, Jan 19, 2025 at 10:00 AM EST
      const date = new Date('2025-01-19T15:00:00Z');

      const result = isWithinOfficeHours(date, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(false);
    });

    it('should return true at exact start time', () => {
      // Tuesday, Jan 14, 2025 at 9:00 AM EST
      const date = new Date('2025-01-14T14:00:00Z'); // 9 AM EST = 14:00 UTC

      const result = isWithinOfficeHours(date, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(true);
    });

    it('should return false at exact end time', () => {
      // Tuesday, Jan 14, 2025 at 5:00 PM EST
      const date = new Date('2025-01-14T22:00:00Z'); // 5 PM EST = 22:00 UTC

      const result = isWithinOfficeHours(date, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(false);
    });

    it('should handle different timezone (Pacific)', () => {
      const pacificConfig: OfficeHoursConfig = {
        start: '09:00',
        end: '17:00',
        workingDays: [1, 2, 3, 4, 5],
        timezone: 'America/Los_Angeles',
      };

      // Tuesday, Jan 14, 2025 at 10:00 AM PST
      const date = new Date('2025-01-14T18:00:00Z'); // 10 AM PST = 18:00 UTC

      const result = isWithinOfficeHours(date, pacificConfig);

      expect(result).toBe(true);
    });

    it('should handle custom working days (Mon-Sat)', () => {
      const customConfig: OfficeHoursConfig = {
        start: '09:00',
        end: '17:00',
        workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
        timezone: 'America/New_York',
      };

      // Saturday, Jan 18, 2025 at 10:00 AM EST
      const date = new Date('2025-01-18T15:00:00Z');

      const result = isWithinOfficeHours(date, customConfig);

      expect(result).toBe(true);
    });
  });

  describe('getNextBusinessHourStart', () => {
    it('should return same date if already within office hours', () => {
      // Tuesday, Jan 14, 2025 at 10:00 AM EST
      const date = new Date('2025-01-14T15:00:00Z');

      const result = getNextBusinessHourStart(date, DEFAULT_OFFICE_HOURS);

      expect(result.getTime()).toBe(date.getTime());
    });

    it('should return start of same day if before office hours', () => {
      // Tuesday, Jan 14, 2025 at 8:00 AM EST
      const date = new Date('2025-01-14T13:00:00Z');

      const result = getNextBusinessHourStart(date, DEFAULT_OFFICE_HOURS);

      // Expected: Tuesday, Jan 14, 2025 at 9:00 AM EST
      const expected = new Date('2025-01-14T14:00:00Z');
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should return start of next working day if after office hours', () => {
      // Tuesday, Jan 14, 2025 at 6:00 PM EST
      const date = new Date('2025-01-14T23:00:00Z');

      const result = getNextBusinessHourStart(date, DEFAULT_OFFICE_HOURS);

      // Expected: Wednesday, Jan 15, 2025 at 9:00 AM EST
      const expected = new Date('2025-01-15T14:00:00Z');
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should skip to Monday if on Friday evening', () => {
      // Friday, Jan 17, 2025 at 6:00 PM EST
      const date = new Date('2025-01-17T23:00:00Z');

      const result = getNextBusinessHourStart(date, DEFAULT_OFFICE_HOURS);

      // Expected: Monday, Jan 20, 2025 at 9:00 AM EST
      const expected = new Date('2025-01-20T14:00:00Z');
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should skip to Monday if on Saturday', () => {
      // Saturday, Jan 18, 2025 at 10:00 AM EST
      const date = new Date('2025-01-18T15:00:00Z');

      const result = getNextBusinessHourStart(date, DEFAULT_OFFICE_HOURS);

      // Expected: Monday, Jan 20, 2025 at 9:00 AM EST
      const expected = new Date('2025-01-20T14:00:00Z');
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should skip to Monday if on Sunday', () => {
      // Sunday, Jan 19, 2025 at 10:00 AM EST
      const date = new Date('2025-01-19T15:00:00Z');

      const result = getNextBusinessHourStart(date, DEFAULT_OFFICE_HOURS);

      // Expected: Monday, Jan 20, 2025 at 9:00 AM EST
      const expected = new Date('2025-01-20T14:00:00Z');
      expect(result.getTime()).toBe(expected.getTime());
    });
  });

  describe('calculateBusinessHoursBetween', () => {
    it('should calculate hours within same business day', () => {
      // Tuesday, Jan 14, 2025 from 10:00 AM to 2:00 PM EST (4 hours)
      const start = new Date('2025-01-14T15:00:00Z');
      const end = new Date('2025-01-14T19:00:00Z');

      const result = calculateBusinessHoursBetween(start, end, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(14400); // 4 hours in seconds
    });

    it('should exclude time before office hours', () => {
      // Tuesday, Jan 14, 2025 from 8:00 AM to 11:00 AM EST
      // Only 9:00-11:00 counts (2 hours)
      const start = new Date('2025-01-14T13:00:00Z'); // 8 AM EST
      const end = new Date('2025-01-14T16:00:00Z');   // 11 AM EST

      const result = calculateBusinessHoursBetween(start, end, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(7200); // 2 hours in seconds
    });

    it('should exclude time after office hours', () => {
      // Tuesday, Jan 14, 2025 from 4:00 PM to 6:00 PM EST
      // Only 4:00-5:00 counts (1 hour)
      const start = new Date('2025-01-14T21:00:00Z'); // 4 PM EST
      const end = new Date('2025-01-14T23:00:00Z');   // 6 PM EST

      const result = calculateBusinessHoursBetween(start, end, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(3600); // 1 hour in seconds
    });

    it('should span multiple business days', () => {
      // Tuesday, Jan 14, 2025 at 10:00 AM to Wednesday, Jan 15, 2025 at 11:00 AM EST
      // Tue: 10:00-17:00 (7 hours) + Wed: 9:00-11:00 (2 hours) = 9 hours
      const start = new Date('2025-01-14T15:00:00Z'); // Tue 10 AM EST
      const end = new Date('2025-01-15T16:00:00Z');   // Wed 11 AM EST

      const result = calculateBusinessHoursBetween(start, end, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(32400); // 9 hours in seconds
    });

    it('should skip weekends', () => {
      // Friday, Jan 17, 2025 at 10:00 AM to Monday, Jan 20, 2025 at 11:00 AM EST
      // Fri: 10:00-17:00 (7 hours) + Mon: 9:00-11:00 (2 hours) = 9 hours
      const start = new Date('2025-01-17T15:00:00Z'); // Fri 10 AM EST
      const end = new Date('2025-01-20T16:00:00Z');   // Mon 11 AM EST

      const result = calculateBusinessHoursBetween(start, end, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(32400); // 9 hours in seconds
    });

    it('should return 0 for time entirely outside business hours', () => {
      // Saturday, Jan 18, 2025 from 10:00 AM to 2:00 PM EST
      const start = new Date('2025-01-18T15:00:00Z');
      const end = new Date('2025-01-18T19:00:00Z');

      const result = calculateBusinessHoursBetween(start, end, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(0);
    });

    it('should return 0 if start equals end', () => {
      const start = new Date('2025-01-14T15:00:00Z');
      const end = new Date('2025-01-14T15:00:00Z');

      const result = calculateBusinessHoursBetween(start, end, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(0);
    });

    it('should handle full business day', () => {
      // Tuesday, Jan 14, 2025 from 9:00 AM to 5:00 PM EST (8 hours)
      const start = new Date('2025-01-14T14:00:00Z'); // 9 AM EST
      const end = new Date('2025-01-14T22:00:00Z');   // 5 PM EST

      const result = calculateBusinessHoursBetween(start, end, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(28800); // 8 hours in seconds
    });

    it('should handle multiple full business days', () => {
      // Monday, Jan 13, 2025 at 9:00 AM to Friday, Jan 17, 2025 at 5:00 PM EST
      // 5 full days × 8 hours = 40 hours
      const start = new Date('2025-01-13T14:00:00Z'); // Mon 9 AM EST
      const end = new Date('2025-01-17T22:00:00Z');   // Fri 5 PM EST

      const result = calculateBusinessHoursBetween(start, end, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(144000); // 40 hours in seconds
    });

    it('should handle partial hours with precision', () => {
      // Tuesday, Jan 14, 2025 from 10:00:00 AM to 10:30:45 AM EST
      const start = new Date('2025-01-14T15:00:00Z');
      const end = new Date('2025-01-14T15:30:45Z');

      const result = calculateBusinessHoursBetween(start, end, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(1845); // 30 minutes 45 seconds
    });

    it('should handle overnight span crossing non-working day', () => {
      // Friday, Jan 17, 2025 at 4:00 PM to Monday, Jan 20, 2025 at 10:00 AM EST
      // Fri: 16:00-17:00 (1 hour) + Mon: 9:00-10:00 (1 hour) = 2 hours
      const start = new Date('2025-01-17T21:00:00Z'); // Fri 4 PM EST
      const end = new Date('2025-01-20T15:00:00Z');   // Mon 10 AM EST

      const result = calculateBusinessHoursBetween(start, end, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(7200); // 2 hours in seconds
    });
  });

  describe('Edge Cases', () => {
    it('should handle dates at exact office hour boundaries', () => {
      // Start at 9:00 AM, end at 5:00 PM
      const start = new Date('2025-01-14T14:00:00Z'); // 9 AM EST
      const end = new Date('2025-01-14T22:00:00Z');   // 5 PM EST

      const result = calculateBusinessHoursBetween(start, end, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(28800); // Exactly 8 hours
    });

    it('should handle single-second duration within office hours', () => {
      const start = new Date('2025-01-14T15:00:00Z');
      const end = new Date('2025-01-14T15:00:01Z');

      const result = calculateBusinessHoursBetween(start, end, DEFAULT_OFFICE_HOURS);

      expect(result).toBe(1); // 1 second
    });

    it('should handle different timezones correctly (UTC)', () => {
      const utcConfig: OfficeHoursConfig = {
        start: '09:00',
        end: '17:00',
        workingDays: [1, 2, 3, 4, 5],
        timezone: 'UTC',
      };

      // 4 hours in UTC office hours
      const start = new Date('2025-01-14T10:00:00Z');
      const end = new Date('2025-01-14T14:00:00Z');

      const result = calculateBusinessHoursBetween(start, end, utcConfig);

      expect(result).toBe(14400); // 4 hours
    });

    it('should handle year boundaries', () => {
      // Friday, Dec 27, 2024 at 10:00 AM to Monday, Jan 6, 2025 at 11:00 AM EST
      // Includes New Year's weekend and regular weekend
      const start = new Date('2024-12-27T15:00:00Z'); // Fri 10 AM EST
      const end = new Date('2025-01-06T16:00:00Z');   // Mon 11 AM EST

      const result = calculateBusinessHoursBetween(start, end, DEFAULT_OFFICE_HOURS);

      // Fri Dec 27: 7h, Mon Dec 30: 8h, Tue Dec 31: 8h
      // Wed Jan 1: 8h, Thu Jan 2: 8h, Fri Jan 3: 8h
      // Mon Jan 6: 2h = 49 hours total
      expect(result).toBe(176400); // 49 hours in seconds
    });
  });
});
