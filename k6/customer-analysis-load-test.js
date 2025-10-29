/**
 * K6 Load Test for Customer Analysis API
 * Tests performance under concurrent load
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

// Custom metrics
const errorRate = new Rate('errors')

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 5 },  // Ramp up to 5 users
    { duration: '1m', target: 10 },  // Ramp up to 10 users
    { duration: '2m', target: 10 },  // Stay at 10 users
    { duration: '30s', target: 0 },  // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests should be below 5s
    http_req_failed: ['rate<0.1'],     // Less than 10% error rate
    errors: ['rate<0.1'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Mock authentication token (replace with actual auth in real test)
const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  // Add your auth headers here
  // 'Authorization': 'Bearer YOUR_TOKEN',
}

export default function () {
  // Test 1: Get filter options
  const filterOptionsRes = http.get(
    `${BASE_URL}/api/customer-analysis/filter-options`,
    { headers: AUTH_HEADERS }
  )

  check(filterOptionsRes, {
    'filter options status is 200': (r) => r.status === 200,
    'filter options has agents': (r) => {
      try {
        const body = JSON.parse(r.body)
        return Array.isArray(body.agents)
      } catch {
        return false
      }
    },
  }) || errorRate.add(1)

  sleep(1)

  // Test 2: Trigger analysis
  const triggerPayload = {
    filters: {
      dateStart: '2025-09-01',
      dateEnd: '2025-10-08',
      agentIds: [],
      departmentIds: [],
    },
  }

  const triggerRes = http.post(
    `${BASE_URL}/api/customer-analysis`,
    JSON.stringify(triggerPayload),
    { headers: AUTH_HEADERS }
  )

  const triggerSuccess = check(triggerRes, {
    'trigger status is 200 or 429': (r) => r.status === 200 || r.status === 429, // 429 is rate limit
    'trigger returns analysisId or rate limit': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.analysisId || body.error === 'RATE_LIMIT_EXCEEDED'
      } catch {
        return false
      }
    },
  })

  if (!triggerSuccess) {
    errorRate.add(1)
  }

  let analysisId
  if (triggerRes.status === 200) {
    try {
      analysisId = JSON.parse(triggerRes.body).analysisId
    } catch (e) {
      console.error('Failed to parse trigger response:', e)
    }
  }

  sleep(2)

  // Test 3: Poll status (if we got an analysis ID)
  if (analysisId) {
    for (let i = 0; i < 3; i++) {
      const statusRes = http.get(
        `${BASE_URL}/api/customer-analysis/${analysisId}`,
        { headers: AUTH_HEADERS }
      )

      check(statusRes, {
        'status check is 200': (r) => r.status === 200,
        'status has valid state': (r) => {
          try {
            const body = JSON.parse(r.body)
            return ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL'].includes(body.status)
          } catch {
            return false
          }
        },
      }) || errorRate.add(1)

      sleep(1)

      // Check if completed
      try {
        const status = JSON.parse(statusRes.body).status
        if (status === 'COMPLETED' || status === 'FAILED') {
          break
        }
      } catch (e) {
        // Continue polling
      }
    }
  }

  sleep(1)

  // Test 4: Get analysis history
  const historyRes = http.get(
    `${BASE_URL}/api/customer-analysis?page=1&limit=10`,
    { headers: AUTH_HEADERS }
  )

  check(historyRes, {
    'history status is 200': (r) => r.status === 200,
    'history has analyses array': (r) => {
      try {
        const body = JSON.parse(r.body)
        return Array.isArray(body.analyses)
      } catch {
        return false
      }
    },
  }) || errorRate.add(1)

  sleep(2)
}

// Setup function (runs once per VU before tests)
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`)
  console.log('Test will simulate 10 concurrent users triggering analyses')
  console.log('Expected duration: ~4 minutes')
}

// Teardown function (runs once after all tests)
export function teardown(data) {
  console.log('Load test completed')
}
