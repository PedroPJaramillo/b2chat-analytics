import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

// Custom metrics
const errorRate = new Rate('errors')

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '3m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.05'],   // Error rate should be less than 5%
    errors: ['rate<0.1'],             // Custom error rate
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Mock authentication token (in real scenario, you'd get this from login)
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'mock_token'

export default function () {
  // Test dashboard API endpoints
  testDashboardStats()
  testDashboardActivity()
  testAgentsAPI()
  testChatsAPI()
  testSyncAPI()

  sleep(1) // Wait 1 second between iterations
}

function testDashboardStats() {
  const response = http.get(`${BASE_URL}/api/dashboard/stats`, {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
  })

  const success = check(response, {
    'Dashboard stats status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'Dashboard stats response time < 1s': (r) => r.timings.duration < 1000,
  })

  if (!success) {
    errorRate.add(1)
  }

  // If authenticated, check response structure
  if (response.status === 200) {
    const data = JSON.parse(response.body)
    check(data, {
      'Has totalAgents': (d) => d.hasOwnProperty('totalAgents'),
      'Has totalChats': (d) => d.hasOwnProperty('totalChats'),
      'Has avgResponseTime': (d) => d.hasOwnProperty('avgResponseTime'),
      'Has satisfactionRate': (d) => d.hasOwnProperty('satisfactionRate'),
    })
  }
}

function testDashboardActivity() {
  const response = http.get(`${BASE_URL}/api/dashboard/activity`, {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
  })

  const success = check(response, {
    'Dashboard activity status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'Dashboard activity response time < 1s': (r) => r.timings.duration < 1000,
  })

  if (!success) {
    errorRate.add(1)
  }
}

function testAgentsAPI() {
  const response = http.get(`${BASE_URL}/api/agents`, {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
  })

  const success = check(response, {
    'Agents API status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'Agents API response time < 1s': (r) => r.timings.duration < 1000,
  })

  if (!success) {
    errorRate.add(1)
  }
}

function testChatsAPI() {
  const response = http.get(`${BASE_URL}/api/chats`, {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
  })

  const success = check(response, {
    'Chats API status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'Chats API response time < 2s': (r) => r.timings.duration < 2000,
  })

  if (!success) {
    errorRate.add(1)
  }
}

function testSyncAPI() {
  // Test sync status endpoint (should be fast)
  const response = http.get(`${BASE_URL}/api/sync/stats`, {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
  })

  const success = check(response, {
    'Sync stats status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'Sync stats response time < 500ms': (r) => r.timings.duration < 500,
  })

  if (!success) {
    errorRate.add(1)
  }
}

// Test scenario for concurrent sync operations
export function syncLoadTest() {
  // This would test POST /api/sync but with caution as it triggers actual sync
  // In a real scenario, you'd want to use a test environment
  console.log('Sync load test - implement carefully with test data')
}

// Export individual test scenarios
export { testDashboardStats, testDashboardActivity, testAgentsAPI, testChatsAPI }