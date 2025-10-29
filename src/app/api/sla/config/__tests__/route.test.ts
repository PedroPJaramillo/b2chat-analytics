/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// Mock dependencies
jest.mock('@/lib/config/sla-config');
jest.mock('@/lib/prisma');
jest.mock('@/lib/sla/sla-logger');

describe('GET /api/sla/config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return current SLA configuration', async () => {
    const url = new URL('http://localhost:3000/api/sla/config');
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('sla');
    expect(data).toHaveProperty('officeHours');
  });

  it('should return SLA targets', async () => {
    const url = new URL('http://localhost:3000/api/sla/config');
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sla).toHaveProperty('pickupTarget');
    expect(data.sla).toHaveProperty('firstResponseTarget');
    expect(data.sla).toHaveProperty('avgResponseTarget');
    expect(data.sla).toHaveProperty('resolutionTarget');
    expect(data.sla).toHaveProperty('complianceTarget');
  });

  it('should return office hours configuration', async () => {
    const url = new URL('http://localhost:3000/api/sla/config');
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.officeHours).toHaveProperty('start');
    expect(data.officeHours).toHaveProperty('end');
    expect(data.officeHours).toHaveProperty('workingDays');
    expect(data.officeHours).toHaveProperty('timezone');
  });

  it('should handle errors gracefully', async () => {
    const { getSLAConfig } = require('@/lib/config/sla-config');
    (getSLAConfig as jest.Mock).mockRejectedValueOnce(new Error('Config error'));

    const url = new URL('http://localhost:3000/api/sla/config');
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error');
  });
});

describe('POST /api/sla/config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SLA Target Updates', () => {
    it('should update pickup target', async () => {
      const url = new URL('http://localhost:3000/api/sla/config');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          sla: {
            pickupTarget: 180, // 3 minutes
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success');
      expect(data.success).toBe(true);
    });

    it('should update multiple SLA targets', async () => {
      const url = new URL('http://localhost:3000/api/sla/config');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          sla: {
            pickupTarget: 180,
            firstResponseTarget: 360,
            avgResponseTarget: 360,
            resolutionTarget: 10800,
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('updated');
    });

    it('should validate SLA targets are positive numbers', async () => {
      const url = new URL('http://localhost:3000/api/sla/config');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          sla: {
            pickupTarget: -1,
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('must be positive');
    });

    it('should validate compliance target is between 0-100', async () => {
      const url = new URL('http://localhost:3000/api/sla/config');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          sla: {
            complianceTarget: 150,
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('between 0 and 100');
    });
  });

  describe('Office Hours Updates', () => {
    it('should update office hours start time', async () => {
      const url = new URL('http://localhost:3000/api/sla/config');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          officeHours: {
            start: '08:00',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should update office hours end time', async () => {
      const url = new URL('http://localhost:3000/api/sla/config');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          officeHours: {
            end: '18:00',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should update working days', async () => {
      const url = new URL('http://localhost:3000/api/sla/config');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          officeHours: {
            workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should update timezone', async () => {
      const url = new URL('http://localhost:3000/api/sla/config');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          officeHours: {
            timezone: 'America/Los_Angeles',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should validate time format (HH:mm)', async () => {
      const url = new URL('http://localhost:3000/api/sla/config');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          officeHours: {
            start: '25:00', // Invalid hour
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should validate end time is after start time', async () => {
      const url = new URL('http://localhost:3000/api/sla/config');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          officeHours: {
            start: '17:00',
            end: '09:00',
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('End time must be after start time');
    });

    it('should validate working days array', async () => {
      const url = new URL('http://localhost:3000/api/sla/config');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          officeHours: {
            workingDays: [0, 8], // Invalid day numbers
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });
  });

  describe('Logging', () => {
    it('should log configuration changes', async () => {
      const { slaLogger } = require('@/lib/sla/sla-logger');

      const url = new URL('http://localhost:3000/api/sla/config');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          sla: {
            pickupTarget: 180,
          },
        }),
      });

      await POST(request);

      expect(slaLogger.logConfigChange).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing request body', async () => {
      const url = new URL('http://localhost:3000/api/sla/config');
      const request = new NextRequest(url, {
        method: 'POST',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should handle invalid JSON', async () => {
      const url = new URL('http://localhost:3000/api/sla/config');
      const request = new NextRequest(url, {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should handle database errors', async () => {
      const { prisma } = require('@/lib/prisma');
      (prisma.systemSetting.update as jest.Mock).mockRejectedValueOnce(
        new Error('Database error')
      );

      const url = new URL('http://localhost:3000/api/sla/config');
      const request = new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          sla: {
            pickupTarget: 180,
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });
  });
});
