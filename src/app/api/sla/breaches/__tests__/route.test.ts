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
    customer: {
      findUnique: jest.fn(),
    },
    agent: {
      findUnique: jest.fn(),
    },
  },
}));

describe('GET /api/sla/breaches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Pagination', () => {
    it('should return paginated results with default page size 50', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('breaches');
      expect(data).toHaveProperty('pagination');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('pageSize');
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('totalPages');
    });

    it('should accept custom page parameter', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches?page=2');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.page).toBe(2);
    });

    it('should accept custom pageSize parameter', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches?pageSize=25');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.pageSize).toBe(25);
    });

    it('should reject invalid page number', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches?page=0');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should reject page size exceeding maximum (100)', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches?pageSize=200');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Page size');
    });
  });

  describe('Filtering', () => {
    it('should filter by date range', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches?startDate=2025-01-01&endDate=2025-01-31');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filters).toHaveProperty('startDate');
      expect(data.filters).toHaveProperty('endDate');
    });

    it('should filter by breach type (pickup)', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches?breachType=pickup');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filters).toHaveProperty('breachType');
      expect(data.filters.breachType).toBe('pickup');
    });

    it('should filter by breach type (first_response)', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches?breachType=first_response');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filters.breachType).toBe('first_response');
    });

    it('should filter by breach type (avg_response)', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches?breachType=avg_response');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filters.breachType).toBe('avg_response');
    });

    it('should filter by breach type (resolution)', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches?breachType=resolution');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filters.breachType).toBe('resolution');
    });

    it('should filter by agent ID', async () => {
      const agentId = 'agent-123';
      const url = new URL(`http://localhost:3000/api/sla/breaches?agentId=${agentId}`);
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filters).toHaveProperty('agentId');
      expect(data.filters.agentId).toBe(agentId);
    });

    it('should filter by channel', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches?channel=whatsapp');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filters).toHaveProperty('channel');
      expect(data.filters.channel).toBe('whatsapp');
    });

    it('should combine multiple filters', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches?breachType=pickup&agentId=agent-123&channel=whatsapp');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.filters.breachType).toBe('pickup');
      expect(data.filters.agentId).toBe('agent-123');
      expect(data.filters.channel).toBe('whatsapp');
    });
  });

  describe('Sorting', () => {
    it('should sort by openedAt descending by default', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('sort');
      expect(data.sort).toHaveProperty('field');
      expect(data.sort).toHaveProperty('order');
    });

    it('should accept custom sort field', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches?sortBy=resolutionTime');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sort.field).toBe('resolutionTime');
    });

    it('should accept sort order (asc/desc)', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches?sortBy=openedAt&sortOrder=asc');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sort.order).toBe('asc');
    });

    it('should reject invalid sort field', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches?sortBy=invalidField');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });
  });

  describe('Response Format', () => {
    it('should return breach data with all required fields', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('breaches');
      expect(Array.isArray(data.breaches)).toBe(true);

      if (data.breaches.length > 0) {
        const breach = data.breaches[0];
        expect(breach).toHaveProperty('chatId');
        expect(breach).toHaveProperty('openedAt');
        expect(breach).toHaveProperty('closedAt');
        expect(breach).toHaveProperty('channel');
        expect(breach).toHaveProperty('breachTypes');
        expect(breach).toHaveProperty('metrics');
      }
    });

    it('should include customer and agent information', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      if (data.breaches.length > 0) {
        const breach = data.breaches[0];
        expect(breach).toHaveProperty('customer');
        expect(breach).toHaveProperty('agent');
      }
    });

    it('should identify breached metrics', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      if (data.breaches.length > 0) {
        const breach = data.breaches[0];
        expect(breach).toHaveProperty('breachTypes');
        expect(Array.isArray(breach.breachTypes)).toBe(true);
      }
    });

    it('should include both wall clock and business hours data', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      if (data.breaches.length > 0) {
        const breach = data.breaches[0];
        expect(breach.metrics).toHaveProperty('wallClock');
        expect(breach.metrics).toHaveProperty('businessHours');
      }
    });
  });

  describe('Empty Results', () => {
    it('should handle no breaches gracefully', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches?startDate=2025-01-01&endDate=2025-01-02');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.breaches).toEqual([]);
      expect(data.pagination.total).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const { prisma } = require('@/lib/prisma');
      (prisma.chat.findMany as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const url = new URL('http://localhost:3000/api/sla/breaches');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });
  });

  describe('Performance', () => {
    it('should include query performance metadata', async () => {
      const url = new URL('http://localhost:3000/api/sla/breaches');
      const request = new NextRequest(url);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('meta');
      expect(data.meta).toHaveProperty('queryTime');
    });
  });
});
