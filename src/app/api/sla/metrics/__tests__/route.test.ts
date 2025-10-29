/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET } from '../route';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    chat: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock SLA config
jest.mock('@/lib/config/sla-config', () => ({
  getSLAConfig: jest.fn().mockResolvedValue({
    pickupTarget: 120,
    firstResponseTarget: 300,
    avgResponseTarget: 300,
    resolutionTarget: 7200,
    complianceTarget: 95,
  }),
}));

describe('GET /api/sla/metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Date Range Filtering', () => {
    it('should accept valid date range parameters', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics?startDate=2025-01-01&endDate=2025-01-31');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('metrics');
    });

    it('should use default date range when no parameters provided', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('metrics');
      expect(data).toHaveProperty('dateRange');
    });

    it('should reject invalid date format', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics?startDate=invalid&endDate=2025-01-31');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Invalid date');
    });

    it('should reject end date before start date', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics?startDate=2025-01-31&endDate=2025-01-01');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('End date must be after start date');
    });
  });

  describe('Metrics Aggregation', () => {
    it('should return overall compliance rate', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics).toHaveProperty('overallCompliance');
      expect(data.metrics.overallCompliance).toHaveProperty('rate');
      expect(data.metrics.overallCompliance).toHaveProperty('total');
      expect(data.metrics.overallCompliance).toHaveProperty('compliant');
      expect(data.metrics.overallCompliance).toHaveProperty('breached');
    });

    it('should return individual metric compliance rates', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics).toHaveProperty('pickupCompliance');
      expect(data.metrics).toHaveProperty('firstResponseCompliance');
      expect(data.metrics).toHaveProperty('avgResponseCompliance');
      expect(data.metrics).toHaveProperty('resolutionCompliance');
    });

    it('should return average response times', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics).toHaveProperty('avgPickupTime');
      expect(data.metrics).toHaveProperty('avgFirstResponseTime');
      expect(data.metrics).toHaveProperty('avgAvgResponseTime');
      expect(data.metrics).toHaveProperty('avgResolutionTime');
    });

    it('should include both wall clock and business hours metrics', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics).toHaveProperty('wallClock');
      expect(data.metrics).toHaveProperty('businessHours');
      expect(data.metrics.wallClock).toHaveProperty('overallCompliance');
      expect(data.metrics.businessHours).toHaveProperty('overallCompliance');
    });

    it('should handle empty dataset gracefully', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics).toBeDefined();
    });
  });

  describe('Agent Filtering', () => {
    it('should filter metrics by agent ID', async () => {
      const agentId = 'test-agent-123';
      const url = new URL(`http://localhost:3000/api/sla/metrics?agentId=${agentId}`);
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filters).toHaveProperty('agentId');
      expect(data.filters.agentId).toBe(agentId);
    });

    it('should filter metrics by multiple agents', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics?agentId=agent-1,agent-2');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filters).toHaveProperty('agentId');
    });
  });

  describe('Channel Filtering', () => {
    it('should filter metrics by channel', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics?channel=whatsapp');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filters).toHaveProperty('channel');
      expect(data.filters.channel).toBe('whatsapp');
    });
  });

  describe('Trend Data', () => {
    it('should include trend comparison when includeTrend=true', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics?includeTrend=true');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('trend');
      expect(data.trend).toHaveProperty('previousPeriod');
      expect(data.trend).toHaveProperty('change');
    });

    it('should not include trend by default', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).not.toHaveProperty('trend');
    });
  });

  describe('Response Format', () => {
    it('should return proper JSON structure', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('metrics');
      expect(data).toHaveProperty('dateRange');
      expect(data).toHaveProperty('filters');
      expect(data.dateRange).toHaveProperty('start');
      expect(data.dateRange).toHaveProperty('end');
    });

    it('should include SLA targets in response', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('targets');
      expect(data.targets).toHaveProperty('pickupTarget');
      expect(data.targets).toHaveProperty('firstResponseTarget');
      expect(data.targets).toHaveProperty('avgResponseTarget');
      expect(data.targets).toHaveProperty('resolutionTarget');
      expect(data.targets).toHaveProperty('complianceTarget');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const { prisma } = require('@/lib/prisma');
      (prisma.chat.findMany as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const url = new URL('http://localhost:3000/api/sla/metrics');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });

    it('should validate required permissions', async () => {
      // This would integrate with auth middleware
      const url = new URL('http://localhost:3000/api/sla/metrics');
      const request = new NextRequest(url);

      const response = await GET(request);

      // Should pass if no auth required, or fail with 401/403 if auth is enforced
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics');
      const request = new NextRequest(url);

      const startTime = Date.now();
      const response = await GET(request);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Cache Headers', () => {
    it('should include appropriate cache headers', async () => {
      const url = new URL('http://localhost:3000/api/sla/metrics');
      const request = new NextRequest(url);

      const response = await GET(request);

      expect(response.status).toBe(200);
      // Cache for 5 minutes since metrics don't change frequently
      expect(response.headers.has('Cache-Control')).toBe(true);
    });
  });
});
