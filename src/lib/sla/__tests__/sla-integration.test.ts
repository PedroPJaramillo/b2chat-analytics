/**
 * @jest-environment node
 */

import { describe, it, expect } from '@jest/globals';
import { calculateAllSLAMetricsWithBusinessHours } from '../sla-calculator-full';
import type { ChatData } from '../sla-calculator';
import type { SLAConfig, OfficeHoursConfig } from '@/lib/config/sla-config';

const DEFAULT_SLA_CONFIG: SLAConfig = {
  pickupTarget: 120,        // 2 minutes
  firstResponseTarget: 300, // 5 minutes
  avgResponseTarget: 300,   // 5 minutes
  resolutionTarget: 7200,   // 2 hours
  complianceTarget: 95,
};

const DEFAULT_OFFICE_HOURS: OfficeHoursConfig = {
  start: '09:00',
  end: '17:00',
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri
  timezone: 'America/New_York',
};

describe('SLA Calculation Engine - Integration Tests', () => {
  describe('Complete Chat Flow - Business Hours', () => {
    it('should calculate all metrics for a chat within business hours', () => {
      // Tuesday, Jan 14, 2025 - all within business hours
      const chatData: ChatData = {
        openedAt: new Date('2025-01-14T14:00:00Z'),           // 9:00 AM EST
        firstAgentAssignedAt: new Date('2025-01-14T14:01:00Z'), // 9:01 AM EST (1 min)
        closedAt: new Date('2025-01-14T15:00:00Z'),           // 10:00 AM EST (1 hour)
        messages: [
          { role: 'customer', createdAt: new Date('2025-01-14T14:00:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-14T14:03:00Z') },    // 3 min response
          { role: 'customer', createdAt: new Date('2025-01-14T14:10:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-14T14:14:00Z') },    // 4 min response
        ],
      };

      const result = calculateAllSLAMetricsWithBusinessHours(
        chatData,
        DEFAULT_SLA_CONFIG,
        DEFAULT_OFFICE_HOURS
      );

      // Wall clock metrics
      expect(result.timeToPickup).toBe(60);         // 1 minute
      expect(result.firstResponseTime).toBe(180);   // 3 minutes
      expect(result.avgResponseTime).toBe(210);     // (180 + 240) / 2
      expect(result.resolutionTime).toBe(3600);     // 1 hour

      // Wall clock compliance (all should pass)
      expect(result.pickupSLA).toBe(true);
      expect(result.firstResponseSLA).toBe(true);
      expect(result.avgResponseSLA).toBe(true);
      expect(result.resolutionSLA).toBe(true);
      expect(result.overallSLA).toBe(true);

      // Business hours metrics (same as wall clock since all within hours)
      expect(result.timeToPickupBH).toBe(60);
      expect(result.firstResponseTimeBH).toBe(180);
      expect(result.avgResponseTimeBH).toBe(210);
      expect(result.resolutionTimeBH).toBe(3600);

      // Business hours compliance
      expect(result.pickupSLABH).toBe(true);
      expect(result.firstResponseSLABH).toBe(true);
      expect(result.avgResponseSLABH).toBe(true);
      expect(result.resolutionSLABH).toBe(true);
      expect(result.overallSLABH).toBe(true);
    });

    it('should calculate different metrics for chat spanning after-hours', () => {
      // Chat opened at 4 PM EST, closed next day at 10 AM EST
      // Wall clock: 18 hours, Business hours: 1h (4-5pm) + 1h (9-10am) = 2h
      const chatData: ChatData = {
        openedAt: new Date('2025-01-14T21:00:00Z'),           // 4:00 PM EST
        firstAgentAssignedAt: new Date('2025-01-14T21:05:00Z'), // 4:05 PM EST (5 min wall, 5 min BH)
        closedAt: new Date('2025-01-15T15:00:00Z'),           // 10:00 AM EST next day
        messages: [
          { role: 'customer', createdAt: new Date('2025-01-14T21:00:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-14T21:10:00Z') },    // 10 min wall, 10 min BH
          { role: 'customer', createdAt: new Date('2025-01-15T14:00:00Z') }, // 9 AM next day
          { role: 'agent', createdAt: new Date('2025-01-15T14:30:00Z') },    // 30 min wall, 30 min BH
        ],
      };

      const result = calculateAllSLAMetricsWithBusinessHours(
        chatData,
        DEFAULT_SLA_CONFIG,
        DEFAULT_OFFICE_HOURS
      );

      // Wall clock metrics
      expect(result.timeToPickup).toBe(300);         // 5 minutes
      expect(result.firstResponseTime).toBe(600);    // 10 minutes
      expect(result.resolutionTime).toBe(64800);     // 18 hours

      // Wall clock compliance
      expect(result.pickupSLA).toBe(false);          // 300 > 120
      expect(result.firstResponseSLA).toBe(false);   // 600 > 300
      expect(result.resolutionSLA).toBe(false);      // 64800 > 7200
      expect(result.overallSLA).toBe(false);

      // Business hours metrics (much lower)
      expect(result.timeToPickupBH).toBe(300);       // 5 minutes (within 4-5pm window)
      expect(result.firstResponseTimeBH).toBe(600);  // 10 minutes
      expect(result.resolutionTimeBH).toBe(7200);    // 2 hours (1h on Tue + 1h on Wed)

      // Business hours compliance
      expect(result.pickupSLABH).toBe(false);        // 300 > 120
      expect(result.firstResponseSLABH).toBe(false); // 600 > 300
      expect(result.resolutionSLABH).toBe(true);     // 7200 <= 7200 (exactly at target)
    });

    it('should handle chat opened over weekend', () => {
      // Friday evening to Monday morning
      const chatData: ChatData = {
        openedAt: new Date('2025-01-17T22:00:00Z'),           // Fri 5:00 PM EST
        firstAgentAssignedAt: new Date('2025-01-20T14:30:00Z'), // Mon 9:30 AM EST
        closedAt: new Date('2025-01-20T16:00:00Z'),           // Mon 11:00 AM EST
        messages: [
          { role: 'customer', createdAt: new Date('2025-01-17T22:00:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-20T15:00:00Z') },    // Mon 10:00 AM
        ],
      };

      const result = calculateAllSLAMetricsWithBusinessHours(
        chatData,
        DEFAULT_SLA_CONFIG,
        DEFAULT_OFFICE_HOURS
      );

      // Wall clock: 66 hours (Fri 5pm to Mon 11am)
      expect(result.resolutionTime).toBe(237600);    // 66 hours in seconds

      // Business hours: Only Monday 9:00-11:00 = 2 hours
      expect(result.resolutionTimeBH).toBe(7200);    // 2 hours

      // Wall clock fails
      expect(result.resolutionSLA).toBe(false);

      // Business hours passes (exactly at target)
      expect(result.resolutionSLABH).toBe(true);
    });
  });

  describe('Breach Detection Scenarios', () => {
    it('should detect pickup SLA breach', () => {
      const chatData: ChatData = {
        openedAt: new Date('2025-01-14T14:00:00Z'),
        firstAgentAssignedAt: new Date('2025-01-14T14:05:00Z'), // 5 minutes - too slow
        closedAt: new Date('2025-01-14T15:00:00Z'),
        messages: [
          { role: 'customer', createdAt: new Date('2025-01-14T14:00:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-14T14:10:00Z') },
        ],
      };

      const result = calculateAllSLAMetricsWithBusinessHours(
        chatData,
        DEFAULT_SLA_CONFIG,
        DEFAULT_OFFICE_HOURS
      );

      expect(result.timeToPickup).toBe(300);       // 5 minutes
      expect(result.pickupSLA).toBe(false);        // 300 > 120
      expect(result.overallSLA).toBe(false);       // Breach detected
    });

    it('should detect first response SLA breach', () => {
      const chatData: ChatData = {
        openedAt: new Date('2025-01-14T14:00:00Z'),
        firstAgentAssignedAt: new Date('2025-01-14T14:01:00Z'),
        closedAt: new Date('2025-01-14T15:00:00Z'),
        messages: [
          { role: 'customer', createdAt: new Date('2025-01-14T14:00:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-14T14:07:00Z') }, // 7 minutes - too slow
        ],
      };

      const result = calculateAllSLAMetricsWithBusinessHours(
        chatData,
        DEFAULT_SLA_CONFIG,
        DEFAULT_OFFICE_HOURS
      );

      expect(result.firstResponseTime).toBe(420);   // 7 minutes
      expect(result.firstResponseSLA).toBe(false);  // 420 > 300
      expect(result.overallSLA).toBe(false);
    });

    it('should detect avg response SLA breach', () => {
      const chatData: ChatData = {
        openedAt: new Date('2025-01-14T14:00:00Z'),
        firstAgentAssignedAt: new Date('2025-01-14T14:01:00Z'),
        closedAt: new Date('2025-01-14T15:00:00Z'),
        messages: [
          { role: 'customer', createdAt: new Date('2025-01-14T14:00:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-14T14:02:00Z') },    // 2 min - good
          { role: 'customer', createdAt: new Date('2025-01-14T14:05:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-14T14:15:00Z') },    // 10 min - bad
        ],
      };

      const result = calculateAllSLAMetricsWithBusinessHours(
        chatData,
        DEFAULT_SLA_CONFIG,
        DEFAULT_OFFICE_HOURS
      );

      expect(result.avgResponseTime).toBe(360);     // (120 + 600) / 2 = 360
      expect(result.avgResponseSLA).toBe(false);    // 360 > 300
      expect(result.overallSLA).toBe(false);
    });

    it('should detect resolution SLA breach', () => {
      const chatData: ChatData = {
        openedAt: new Date('2025-01-14T14:00:00Z'),
        firstAgentAssignedAt: new Date('2025-01-14T14:01:00Z'),
        closedAt: new Date('2025-01-14T17:00:00Z'),           // 3 hours later - too slow
        messages: [
          { role: 'customer', createdAt: new Date('2025-01-14T14:00:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-14T14:02:00Z') },
        ],
      };

      const result = calculateAllSLAMetricsWithBusinessHours(
        chatData,
        DEFAULT_SLA_CONFIG,
        DEFAULT_OFFICE_HOURS
      );

      expect(result.resolutionTime).toBe(10800);    // 3 hours
      expect(result.resolutionSLA).toBe(false);     // 10800 > 7200
      expect(result.overallSLA).toBe(false);
    });

    it('should detect multiple SLA breaches', () => {
      const chatData: ChatData = {
        openedAt: new Date('2025-01-14T14:00:00Z'),
        firstAgentAssignedAt: new Date('2025-01-14T14:10:00Z'), // 10 min - breach
        closedAt: new Date('2025-01-14T18:00:00Z'),            // 4 hours - breach
        messages: [
          { role: 'customer', createdAt: new Date('2025-01-14T14:00:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-14T14:15:00Z') },   // 15 min - breach
        ],
      };

      const result = calculateAllSLAMetricsWithBusinessHours(
        chatData,
        DEFAULT_SLA_CONFIG,
        DEFAULT_OFFICE_HOURS
      );

      expect(result.pickupSLA).toBe(false);         // 600 > 120
      expect(result.firstResponseSLA).toBe(false);  // 900 > 300
      expect(result.resolutionSLA).toBe(false);     // 14400 > 7200
      expect(result.overallSLA).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle chat with no agent assignment', () => {
      const chatData: ChatData = {
        openedAt: new Date('2025-01-14T14:00:00Z'),
        firstAgentAssignedAt: null,
        closedAt: null,
        messages: [
          { role: 'customer', createdAt: new Date('2025-01-14T14:00:00Z') },
        ],
      };

      const result = calculateAllSLAMetricsWithBusinessHours(
        chatData,
        DEFAULT_SLA_CONFIG,
        DEFAULT_OFFICE_HOURS
      );

      expect(result.timeToPickup).toBeNull();
      expect(result.firstResponseTime).toBeNull();
      expect(result.avgResponseTime).toBeNull();
      expect(result.resolutionTime).toBeNull();
      expect(result.overallSLA).toBeNull();
      expect(result.overallSLABH).toBeNull();
    });

    it('should handle chat with no messages', () => {
      const chatData: ChatData = {
        openedAt: new Date('2025-01-14T14:00:00Z'),
        firstAgentAssignedAt: new Date('2025-01-14T14:01:00Z'),
        closedAt: new Date('2025-01-14T15:00:00Z'),
        messages: [],
      };

      const result = calculateAllSLAMetricsWithBusinessHours(
        chatData,
        DEFAULT_SLA_CONFIG,
        DEFAULT_OFFICE_HOURS
      );

      expect(result.timeToPickup).toBe(60);
      expect(result.firstResponseTime).toBeNull();    // No messages
      expect(result.avgResponseTime).toBeNull();      // No messages
      expect(result.resolutionTime).toBe(3600);
      expect(result.overallSLA).toBeNull();           // Can't determine without all metrics
    });

    it('should handle instant responses (0 seconds)', () => {
      const timestamp = new Date('2025-01-14T14:00:00Z');
      const chatData: ChatData = {
        openedAt: timestamp,
        firstAgentAssignedAt: timestamp,
        closedAt: timestamp,
        messages: [
          { role: 'customer', createdAt: timestamp },
          { role: 'agent', createdAt: timestamp },
        ],
      };

      const result = calculateAllSLAMetricsWithBusinessHours(
        chatData,
        DEFAULT_SLA_CONFIG,
        DEFAULT_OFFICE_HOURS
      );

      expect(result.timeToPickup).toBe(0);
      expect(result.firstResponseTime).toBe(0);
      expect(result.avgResponseTime).toBe(0);
      expect(result.resolutionTime).toBe(0);
      expect(result.overallSLA).toBe(true);           // All at 0, which meets SLA
    });

    it('should handle chat at exact SLA boundary', () => {
      const chatData: ChatData = {
        openedAt: new Date('2025-01-14T14:00:00Z'),
        firstAgentAssignedAt: new Date('2025-01-14T14:02:00Z'),   // Exactly 120 seconds
        closedAt: new Date('2025-01-14T16:00:00Z'),               // Exactly 7200 seconds
        messages: [
          { role: 'customer', createdAt: new Date('2025-01-14T14:00:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-14T14:05:00Z') },     // Exactly 300 seconds
        ],
      };

      const result = calculateAllSLAMetricsWithBusinessHours(
        chatData,
        DEFAULT_SLA_CONFIG,
        DEFAULT_OFFICE_HOURS
      );

      expect(result.timeToPickup).toBe(120);
      expect(result.firstResponseTime).toBe(300);
      expect(result.resolutionTime).toBe(7200);
      expect(result.pickupSLA).toBe(true);            // 120 <= 120 (inclusive)
      expect(result.firstResponseSLA).toBe(true);     // 300 <= 300
      expect(result.resolutionSLA).toBe(true);        // 7200 <= 7200
      expect(result.overallSLA).toBe(true);
    });
  });

  describe('Custom Office Hours Scenarios', () => {
    it('should handle 24/7 office hours', () => {
      const alwaysOnConfig: OfficeHoursConfig = {
        start: '00:00',
        end: '23:59',
        workingDays: [1, 2, 3, 4, 5, 6, 7], // Every day
        timezone: 'America/New_York',
      };

      const chatData: ChatData = {
        openedAt: new Date('2025-01-18T03:00:00Z'),    // Saturday 10 PM EST
        firstAgentAssignedAt: new Date('2025-01-18T03:05:00Z'),
        closedAt: new Date('2025-01-18T05:00:00Z'),
        messages: [
          { role: 'customer', createdAt: new Date('2025-01-18T03:00:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-18T03:10:00Z') },
        ],
      };

      const result = calculateAllSLAMetricsWithBusinessHours(
        chatData,
        DEFAULT_SLA_CONFIG,
        alwaysOnConfig
      );

      // Business hours should be very close to wall clock for 24/7 operation
      // Note: Small difference due to end time being 23:59 instead of 24:00
      expect(result.timeToPickupBH).toBe(result.timeToPickup);
      expect(result.firstResponseTimeBH).toBe(result.firstResponseTime);
      expect(result.resolutionTimeBH).toBeGreaterThan(7000);  // Close to wall clock (7200)
      expect(result.resolutionTimeBH).toBeLessThanOrEqual(result.resolutionTime!);
    });

    it('should handle different timezone (Pacific)', () => {
      const pacificConfig: OfficeHoursConfig = {
        start: '09:00',
        end: '17:00',
        workingDays: [1, 2, 3, 4, 5],
        timezone: 'America/Los_Angeles',
      };

      // Tuesday at 9 AM PST = 12 PM EST = 17:00 UTC
      const chatData: ChatData = {
        openedAt: new Date('2025-01-14T17:00:00Z'),
        firstAgentAssignedAt: new Date('2025-01-14T17:05:00Z'),
        closedAt: new Date('2025-01-14T18:00:00Z'),
        messages: [
          { role: 'customer', createdAt: new Date('2025-01-14T17:00:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-14T17:10:00Z') },
        ],
      };

      const result = calculateAllSLAMetricsWithBusinessHours(
        chatData,
        DEFAULT_SLA_CONFIG,
        pacificConfig
      );

      // Should count as business hours in Pacific timezone
      expect(result.timeToPickupBH).toBe(300);
      expect(result.resolutionTimeBH).toBe(3600);
    });
  });
});
