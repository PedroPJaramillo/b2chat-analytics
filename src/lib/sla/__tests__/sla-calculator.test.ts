/**
 * @jest-environment node
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculatePickupTime,
  calculateFirstResponseTime,
  calculateAvgResponseTime,
  calculateResolutionTime,
  calculateSLACompliance,
  calculateAllSLAMetrics,
} from '../sla-calculator';

describe('SLA Calculator - Wall Clock Time', () => {
  describe('calculatePickupTime', () => {
    it('should calculate time from chat opened to first agent assignment', () => {
      const openedAt = new Date('2025-01-15T10:00:00Z');
      const firstAgentAssignedAt = new Date('2025-01-15T10:01:30Z');

      const result = calculatePickupTime(openedAt, firstAgentAssignedAt);

      expect(result).toBe(90); // 1 minute 30 seconds
    });

    it('should return null if chat was never picked up', () => {
      const openedAt = new Date('2025-01-15T10:00:00Z');

      const result = calculatePickupTime(openedAt, null);

      expect(result).toBeNull();
    });

    it('should return 0 if picked up at the exact same time', () => {
      const openedAt = new Date('2025-01-15T10:00:00Z');
      const firstAgentAssignedAt = new Date('2025-01-15T10:00:00Z');

      const result = calculatePickupTime(openedAt, firstAgentAssignedAt);

      expect(result).toBe(0);
    });

    it('should handle times spanning multiple hours', () => {
      const openedAt = new Date('2025-01-15T10:00:00Z');
      const firstAgentAssignedAt = new Date('2025-01-15T12:30:45Z');

      const result = calculatePickupTime(openedAt, firstAgentAssignedAt);

      expect(result).toBe(9045); // 2 hours 30 minutes 45 seconds
    });
  });

  describe('calculateFirstResponseTime', () => {
    it('should calculate time from chat opened to first agent message', () => {
      const openedAt = new Date('2025-01-15T10:00:00Z');
      const firstAgentMessageAt = new Date('2025-01-15T10:04:30Z');

      const result = calculateFirstResponseTime(openedAt, firstAgentMessageAt);

      expect(result).toBe(270); // 4 minutes 30 seconds
    });

    it('should return null if no agent message sent', () => {
      const openedAt = new Date('2025-01-15T10:00:00Z');

      const result = calculateFirstResponseTime(openedAt, null);

      expect(result).toBeNull();
    });

    it('should handle same-second response', () => {
      const openedAt = new Date('2025-01-15T10:00:00Z');
      const firstAgentMessageAt = new Date('2025-01-15T10:00:00Z');

      const result = calculateFirstResponseTime(openedAt, firstAgentMessageAt);

      expect(result).toBe(0);
    });

    it('should handle response time across days', () => {
      const openedAt = new Date('2025-01-15T23:55:00Z');
      const firstAgentMessageAt = new Date('2025-01-16T00:10:00Z');

      const result = calculateFirstResponseTime(openedAt, firstAgentMessageAt);

      expect(result).toBe(900); // 15 minutes
    });
  });

  describe('calculateAvgResponseTime', () => {
    it('should calculate average time between customer and agent messages', () => {
      const messages = [
        { role: 'customer', createdAt: new Date('2025-01-15T10:00:00Z') },
        { role: 'agent', createdAt: new Date('2025-01-15T10:02:00Z') },    // 2 min
        { role: 'customer', createdAt: new Date('2025-01-15T10:03:00Z') },
        { role: 'agent', createdAt: new Date('2025-01-15T10:07:00Z') },    // 4 min
        { role: 'customer', createdAt: new Date('2025-01-15T10:08:00Z') },
        { role: 'agent', createdAt: new Date('2025-01-15T10:14:00Z') },    // 6 min
      ];

      const result = calculateAvgResponseTime(messages);

      expect(result).toBe(240); // (120 + 240 + 360) / 3 = 240 seconds (4 minutes)
    });

    it('should return null if no agent responses', () => {
      const messages = [
        { role: 'customer', createdAt: new Date('2025-01-15T10:00:00Z') },
        { role: 'customer', createdAt: new Date('2025-01-15T10:01:00Z') },
      ];

      const result = calculateAvgResponseTime(messages);

      expect(result).toBeNull();
    });

    it('should handle single response', () => {
      const messages = [
        { role: 'customer', createdAt: new Date('2025-01-15T10:00:00Z') },
        { role: 'agent', createdAt: new Date('2025-01-15T10:03:00Z') },
      ];

      const result = calculateAvgResponseTime(messages);

      expect(result).toBe(180); // 3 minutes
    });

    it('should ignore consecutive agent messages', () => {
      const messages = [
        { role: 'customer', createdAt: new Date('2025-01-15T10:00:00Z') },
        { role: 'agent', createdAt: new Date('2025-01-15T10:02:00Z') },    // 2 min - counted
        { role: 'agent', createdAt: new Date('2025-01-15T10:03:00Z') },    // ignored
        { role: 'customer', createdAt: new Date('2025-01-15T10:04:00Z') },
        { role: 'agent', createdAt: new Date('2025-01-15T10:08:00Z') },    // 4 min - counted
      ];

      const result = calculateAvgResponseTime(messages);

      expect(result).toBe(180); // (120 + 240) / 2 = 180 seconds
    });

    it('should handle empty message array', () => {
      const result = calculateAvgResponseTime([]);

      expect(result).toBeNull();
    });

    it('should return result as float with proper precision', () => {
      const messages = [
        { role: 'customer', createdAt: new Date('2025-01-15T10:00:00Z') },
        { role: 'agent', createdAt: new Date('2025-01-15T10:02:30Z') },    // 150 sec
        { role: 'customer', createdAt: new Date('2025-01-15T10:03:00Z') },
        { role: 'agent', createdAt: new Date('2025-01-15T10:05:45Z') },    // 165 sec
      ];

      const result = calculateAvgResponseTime(messages);

      expect(result).toBe(157.5); // (150 + 165) / 2 = 157.5
    });
  });

  describe('calculateResolutionTime', () => {
    it('should calculate time from chat opened to closed', () => {
      const openedAt = new Date('2025-01-15T10:00:00Z');
      const closedAt = new Date('2025-01-15T11:30:00Z');

      const result = calculateResolutionTime(openedAt, closedAt);

      expect(result).toBe(5400); // 1 hour 30 minutes
    });

    it('should return null if chat is still open', () => {
      const openedAt = new Date('2025-01-15T10:00:00Z');

      const result = calculateResolutionTime(openedAt, null);

      expect(result).toBeNull();
    });

    it('should handle resolution spanning multiple days', () => {
      const openedAt = new Date('2025-01-15T10:00:00Z');
      const closedAt = new Date('2025-01-17T10:00:00Z');

      const result = calculateResolutionTime(openedAt, closedAt);

      expect(result).toBe(172800); // 48 hours
    });

    it('should handle same-second resolution', () => {
      const openedAt = new Date('2025-01-15T10:00:00Z');
      const closedAt = new Date('2025-01-15T10:00:00Z');

      const result = calculateResolutionTime(openedAt, closedAt);

      expect(result).toBe(0);
    });
  });

  describe('calculateSLACompliance', () => {
    it('should return true when actual time meets target', () => {
      const actualTime = 100;
      const targetTime = 120;

      const result = calculateSLACompliance(actualTime, targetTime);

      expect(result).toBe(true);
    });

    it('should return false when actual time exceeds target', () => {
      const actualTime = 150;
      const targetTime = 120;

      const result = calculateSLACompliance(actualTime, targetTime);

      expect(result).toBe(false);
    });

    it('should return true when actual time equals target exactly', () => {
      const actualTime = 120;
      const targetTime = 120;

      const result = calculateSLACompliance(actualTime, targetTime);

      expect(result).toBe(true);
    });

    it('should return null when actual time is null', () => {
      const actualTime = null;
      const targetTime = 120;

      const result = calculateSLACompliance(actualTime, targetTime);

      expect(result).toBeNull();
    });

    it('should handle zero values', () => {
      const actualTime = 0;
      const targetTime = 120;

      const result = calculateSLACompliance(actualTime, targetTime);

      expect(result).toBe(true);
    });
  });

  describe('calculateAllSLAMetrics', () => {
    it('should calculate all SLA metrics for a complete chat', () => {
      const chatData = {
        openedAt: new Date('2025-01-15T10:00:00Z'),
        firstAgentAssignedAt: new Date('2025-01-15T10:01:00Z'),
        closedAt: new Date('2025-01-15T12:00:00Z'),
        messages: [
          { role: 'customer', createdAt: new Date('2025-01-15T10:00:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-15T10:03:00Z') },
          { role: 'customer', createdAt: new Date('2025-01-15T10:05:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-15T10:09:00Z') },
        ],
      };

      const slaConfig = {
        pickupTarget: 120,        // 2 minutes
        firstResponseTarget: 300, // 5 minutes
        avgResponseTarget: 300,   // 5 minutes
        resolutionTarget: 7200,   // 2 hours
        complianceTarget: 95,
      };

      const result = calculateAllSLAMetrics(chatData, slaConfig);

      expect(result.timeToPickup).toBe(60);           // 1 minute
      expect(result.firstResponseTime).toBe(180);     // 3 minutes
      expect(result.avgResponseTime).toBe(210);       // (180 + 240) / 2 = 210
      expect(result.resolutionTime).toBe(7200);       // 2 hours
      expect(result.pickupSLA).toBe(true);            // 60 <= 120
      expect(result.firstResponseSLA).toBe(true);     // 180 <= 300
      expect(result.avgResponseSLA).toBe(true);       // 210 <= 300
      expect(result.resolutionSLA).toBe(true);        // 7200 <= 7200
      expect(result.overallSLA).toBe(true);           // all true
    });

    it('should mark overallSLA as false if any metric fails', () => {
      const chatData = {
        openedAt: new Date('2025-01-15T10:00:00Z'),
        firstAgentAssignedAt: new Date('2025-01-15T10:05:00Z'), // Too slow
        closedAt: new Date('2025-01-15T12:00:00Z'),
        messages: [
          { role: 'customer', createdAt: new Date('2025-01-15T10:00:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-15T10:10:00Z') },
        ],
      };

      const slaConfig = {
        pickupTarget: 120,        // 2 minutes
        firstResponseTarget: 300, // 5 minutes
        avgResponseTarget: 300,   // 5 minutes
        resolutionTarget: 7200,   // 2 hours
        complianceTarget: 95,
      };

      const result = calculateAllSLAMetrics(chatData, slaConfig);

      expect(result.pickupSLA).toBe(false);          // 300 > 120
      expect(result.firstResponseSLA).toBe(false);   // 600 > 300
      expect(result.overallSLA).toBe(false);
    });

    it('should handle incomplete chats with null values', () => {
      const chatData = {
        openedAt: new Date('2025-01-15T10:00:00Z'),
        firstAgentAssignedAt: null,
        closedAt: null,
        messages: [],
      };

      const slaConfig = {
        pickupTarget: 120,
        firstResponseTarget: 300,
        avgResponseTarget: 300,
        resolutionTarget: 7200,
        complianceTarget: 95,
      };

      const result = calculateAllSLAMetrics(chatData, slaConfig);

      expect(result.timeToPickup).toBeNull();
      expect(result.firstResponseTime).toBeNull();
      expect(result.avgResponseTime).toBeNull();
      expect(result.resolutionTime).toBeNull();
      expect(result.pickupSLA).toBeNull();
      expect(result.firstResponseSLA).toBeNull();
      expect(result.avgResponseSLA).toBeNull();
      expect(result.resolutionSLA).toBeNull();
      expect(result.overallSLA).toBeNull();
    });

    it('should calculate overallSLA as null if any individual SLA is null', () => {
      const chatData = {
        openedAt: new Date('2025-01-15T10:00:00Z'),
        firstAgentAssignedAt: new Date('2025-01-15T10:01:00Z'),
        closedAt: null, // Still open
        messages: [
          { role: 'customer', createdAt: new Date('2025-01-15T10:00:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-15T10:02:00Z') },
        ],
      };

      const slaConfig = {
        pickupTarget: 120,
        firstResponseTarget: 300,
        avgResponseTarget: 300,
        resolutionTarget: 7200,
        complianceTarget: 95,
      };

      const result = calculateAllSLAMetrics(chatData, slaConfig);

      expect(result.pickupSLA).toBe(true);
      expect(result.firstResponseSLA).toBe(true);
      expect(result.resolutionSLA).toBeNull();       // Chat not closed
      expect(result.overallSLA).toBeNull();          // Cannot determine overall
    });

    describe('Enabled Metrics Feature', () => {
      const chatData = {
        openedAt: new Date('2025-01-15T10:00:00Z'),
        firstAgentAssignedAt: new Date('2025-01-15T10:05:00Z'), // 5 min - fails pickup
        closedAt: new Date('2025-01-15T12:00:00Z'),
        messages: [
          { role: 'customer', createdAt: new Date('2025-01-15T10:00:00Z') },
          { role: 'agent', createdAt: new Date('2025-01-15T10:03:00Z') }, // 3 min - passes
        ],
      };

      const slaConfig = {
        pickupTarget: 120,        // 2 minutes
        firstResponseTarget: 300, // 5 minutes
        avgResponseTarget: 300,   // 5 minutes
        resolutionTarget: 7200,   // 2 hours
        complianceTarget: 95,
      };

      it('should only check enabled metrics for overall SLA (pickup + firstResponse)', () => {
        const enabledMetrics = {
          pickup: true,
          firstResponse: true,
          avgResponse: false,
          resolution: false,
        };

        const result = calculateAllSLAMetrics(chatData, slaConfig, enabledMetrics);

        // Pickup fails (300 > 120), so overall should be false
        expect(result.pickupSLA).toBe(false);
        expect(result.firstResponseSLA).toBe(true);
        expect(result.overallSLA).toBe(false);
      });

      it('should ignore disabled metrics in overall SLA calculation', () => {
        const enabledMetrics = {
          pickup: false,          // Disabled - will fail but shouldn't count
          firstResponse: true,    // Enabled - passes
          avgResponse: false,
          resolution: false,
        };

        const result = calculateAllSLAMetrics(chatData, slaConfig, enabledMetrics);

        // Even though pickup fails, it's disabled, so overall should be true
        expect(result.pickupSLA).toBe(false);
        expect(result.firstResponseSLA).toBe(true);
        expect(result.overallSLA).toBe(true);
      });

      it('should handle all metrics enabled (backward compatibility)', () => {
        const enabledMetrics = {
          pickup: true,
          firstResponse: true,
          avgResponse: true,
          resolution: true,
        };

        const result = calculateAllSLAMetrics(chatData, slaConfig, enabledMetrics);

        // Pickup fails, so overall should be false
        expect(result.overallSLA).toBe(false);
      });

      it('should handle only one metric enabled', () => {
        const enabledMetrics = {
          pickup: false,
          firstResponse: true,
          avgResponse: false,
          resolution: false,
        };

        const result = calculateAllSLAMetrics(chatData, slaConfig, enabledMetrics);

        // Only firstResponse is enabled and it passes
        expect(result.overallSLA).toBe(true);
      });

      it('should return null for overall SLA if no metrics enabled', () => {
        const enabledMetrics = {
          pickup: false,
          firstResponse: false,
          avgResponse: false,
          resolution: false,
        };

        const result = calculateAllSLAMetrics(chatData, slaConfig, enabledMetrics);

        // No metrics enabled - overall SLA is null
        expect(result.overallSLA).toBeNull();
      });

      it('should return null if enabled metric value is null', () => {
        const incompleteChatData = {
          openedAt: new Date('2025-01-15T10:00:00Z'),
          firstAgentAssignedAt: null, // Not picked up yet
          closedAt: null,
          messages: [],
        };

        const enabledMetrics = {
          pickup: true,
          firstResponse: false,
          avgResponse: false,
          resolution: false,
        };

        const result = calculateAllSLAMetrics(incompleteChatData, slaConfig, enabledMetrics);

        // Pickup is enabled but null, so overall is null
        expect(result.pickupSLA).toBeNull();
        expect(result.overallSLA).toBeNull();
      });

      it('should use default (all enabled) when enabledMetrics not provided', () => {
        const result = calculateAllSLAMetrics(chatData, slaConfig);

        // Default behavior: all metrics enabled, pickup fails
        expect(result.overallSLA).toBe(false);
      });
    });
  });
});
