# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-10-21-sla-compliance-page/spec.md

## Overview

The SLA Compliance Page requires API endpoints to fetch pre-computed SLA metrics from the database, apply filters, and generate CSV exports. All endpoints follow RESTful conventions and return JSON responses (except CSV export which returns text/csv).

## Base URL

All API endpoints are relative to the application base URL:

```
/api/sla-compliance
```

## Authentication

All endpoints require authentication via Clerk JWT tokens. Requests must include:

```
Authorization: Bearer <jwt_token>
```

Unauthenticated requests will return `401 Unauthorized`.

## Endpoints

### 1. GET /api/sla-compliance/metrics

Retrieves aggregated SLA metrics for display in metric cards and overall compliance card.

**Purpose:** Fetch high-level compliance percentages and counts for the four SLA metrics plus overall compliance.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dateFrom` | ISO 8601 date | Yes | Start date for filter range (e.g., `2025-10-01T00:00:00Z`) |
| `dateTo` | ISO 8601 date | Yes | End date for filter range (e.g., `2025-10-31T23:59:59Z`) |
| `agentIds` | Comma-separated string | No | Filter by specific agent IDs (e.g., `agent1,agent2`) |
| `statuses` | Comma-separated string | No | Filter by chat statuses (e.g., `OPENED,PICKED_UP,CLOSED`) |
| `businessHours` | Boolean | No | Use business hours metrics (default: `true`) |

**Example Request:**

```
GET /api/sla-compliance/metrics?dateFrom=2025-10-01T00:00:00Z&dateTo=2025-10-31T23:59:59Z&businessHours=true
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "pickup": {
      "compliancePercentage": 87.2,
      "withinSLA": 143,
      "breached": 21,
      "total": 164
    },
    "firstResponse": {
      "compliancePercentage": 92.5,
      "withinSLA": 151,
      "breached": 13,
      "total": 164
    },
    "avgResponse": {
      "compliancePercentage": 95.1,
      "withinSLA": 156,
      "breached": 8,
      "total": 164
    },
    "resolution": {
      "compliancePercentage": 88.3,
      "withinSLA": 136,
      "breached": 18,
      "total": 154
    },
    "overall": {
      "compliancePercentage": 82.3,
      "compliantChats": 135,
      "nonCompliantChats": 29,
      "totalChats": 164,
      "target": 95
    }
  },
  "meta": {
    "dateFrom": "2025-10-01T00:00:00Z",
    "dateTo": "2025-10-31T23:59:59Z",
    "businessHoursMode": true,
    "appliedFilters": {
      "agentIds": [],
      "statuses": []
    }
  }
}
```

**Errors:**

- `400 Bad Request` - Invalid date format or missing required parameters
- `401 Unauthorized` - Missing or invalid authentication token
- `500 Internal Server Error` - Database or calculation error

---

### 2. GET /api/sla-compliance/agent-performance

Retrieves SLA compliance percentages grouped by agent for the performance chart.

**Purpose:** Fetch per-agent compliance data to display in the horizontal bar chart.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dateFrom` | ISO 8601 date | Yes | Start date for filter range |
| `dateTo` | ISO 8601 date | Yes | End date for filter range |
| `businessHours` | Boolean | No | Use business hours metrics (default: `true`) |

**Example Request:**

```
GET /api/sla-compliance/agent-performance?dateFrom=2025-10-01T00:00:00Z&dateTo=2025-10-31T23:59:59Z
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "agentId": "agent_abc123",
      "agentName": "Sarah Johnson",
      "totalChats": 45,
      "compliantChats": 42,
      "compliancePercentage": 93.3
    },
    {
      "agentId": "agent_xyz789",
      "agentName": "Mike Chen",
      "totalChats": 38,
      "compliantChats": 30,
      "compliancePercentage": 78.9
    }
  ],
  "meta": {
    "dateFrom": "2025-10-01T00:00:00Z",
    "dateTo": "2025-10-31T23:59:59Z",
    "businessHoursMode": true,
    "totalAgents": 12
  }
}
```

**Sorting:** Results are sorted by `compliancePercentage` descending (highest to lowest).

**Errors:**

- `400 Bad Request` - Invalid parameters
- `401 Unauthorized` - Authentication failure
- `500 Internal Server Error` - Server error

---

### 3. GET /api/sla-compliance/daily-trend

Retrieves daily aggregated SLA compliance data for the trend chart.

**Purpose:** Fetch daily compliant vs. total chat counts to display in the line chart.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dateFrom` | ISO 8601 date | Yes | Start date for filter range |
| `dateTo` | ISO 8601 date | Yes | End date for filter range |
| `agentIds` | Comma-separated string | No | Filter by specific agent IDs |
| `businessHours` | Boolean | No | Use business hours metrics (default: `true`) |

**Example Request:**

```
GET /api/sla-compliance/daily-trend?dateFrom=2025-10-01T00:00:00Z&dateTo=2025-10-31T23:59:59Z
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "date": "2025-10-01",
      "compliantChats": 12,
      "totalChats": 15,
      "compliancePercentage": 80.0
    },
    {
      "date": "2025-10-02",
      "compliantChats": 14,
      "totalChats": 16,
      "compliancePercentage": 87.5
    }
  ],
  "meta": {
    "dateFrom": "2025-10-01T00:00:00Z",
    "dateTo": "2025-10-31T23:59:59Z",
    "businessHoursMode": true,
    "aggregationPeriod": "day"
  }
}
```

**Aggregation Logic:**
- If date range ≤ 90 days: Aggregate by day
- If date range > 90 days: Aggregate by week

**Errors:**

- `400 Bad Request` - Invalid parameters
- `401 Unauthorized` - Authentication failure
- `500 Internal Server Error` - Server error

---

### 4. GET /api/sla-compliance/breaches

Retrieves list of chats that failed one or more SLA metrics.

**Purpose:** Fetch breach data to populate the SLA Breaches table with pagination and sorting.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dateFrom` | ISO 8601 date | Yes | Start date for filter range |
| `dateTo` | ISO 8601 date | Yes | End date for filter range |
| `agentIds` | Comma-separated string | No | Filter by specific agent IDs |
| `statuses` | Comma-separated string | No | Filter by chat statuses |
| `businessHours` | Boolean | No | Use business hours metrics (default: `true`) |
| `page` | Integer | No | Page number for pagination (default: `1`) |
| `limit` | Integer | No | Results per page (default: `20`, max: `100`) |
| `sortBy` | String | No | Sort column (`chatId`, `agent`, `contact`, `openedAt`) (default: `openedAt`) |
| `sortOrder` | String | No | Sort direction (`asc`, `desc`) (default: `desc`) |

**Example Request:**

```
GET /api/sla-compliance/breaches?dateFrom=2025-10-01T00:00:00Z&dateTo=2025-10-31T23:59:59Z&page=1&limit=20
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "chatId": "CH1001",
      "contact": {
        "id": "contact_123",
        "name": "John Doe",
        "phone": "+1234567890",
        "email": "john@example.com"
      },
      "agent": {
        "id": "agent_abc",
        "name": "Sarah Johnson"
      },
      "status": "CLOSED",
      "openedAt": "2025-10-15T09:00:00Z",
      "closedAt": "2025-10-15T10:30:00Z",
      "slaStatus": {
        "pickup": {
          "passed": false,
          "timeSeconds": 204,
          "target": 120
        },
        "firstResponse": {
          "passed": false,
          "timeSeconds": 492,
          "target": 300
        },
        "avgResponse": {
          "passed": true,
          "timeSeconds": 280,
          "target": 300
        },
        "resolution": {
          "passed": true,
          "timeSeconds": 5400,
          "target": 7200
        }
      },
      "breachedSLAs": ["Pickup", "First Response"],
      "messageStats": {
        "customerMessages": 8,
        "agentMessages": 5,
        "botMessages": 2
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalResults": 29,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "meta": {
    "dateFrom": "2025-10-01T00:00:00Z",
    "dateTo": "2025-10-31T23:59:59Z",
    "businessHoursMode": true
  }
}
```

**Errors:**

- `400 Bad Request` - Invalid parameters
- `401 Unauthorized` - Authentication failure
- `500 Internal Server Error` - Server error

---

### 5. GET /api/sla-compliance/breaches/:chatId

Retrieves detailed information for a single breached chat, including full conversation.

**Purpose:** Fetch complete chat details with messages for displaying in expanded table row.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chatId` | String | Yes | The chat ID to retrieve |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `businessHours` | Boolean | No | Use business hours metrics (default: `true`) |

**Example Request:**

```
GET /api/sla-compliance/breaches/CH1001?businessHours=true
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "chatId": "CH1001",
    "contact": {
      "id": "contact_123",
      "name": "John Doe",
      "phone": "+1234567890",
      "email": "john@example.com"
    },
    "agent": {
      "id": "agent_abc",
      "name": "Sarah Johnson"
    },
    "status": "CLOSED",
    "openedAt": "2025-10-15T09:00:00Z",
    "pickedUpAt": "2025-10-15T09:03:24Z",
    "closedAt": "2025-10-15T10:30:00Z",
    "slaStatus": {
      "pickup": {
        "passed": false,
        "timeSeconds": 204,
        "target": 120
      },
      "firstResponse": {
        "passed": false,
        "timeSeconds": 492,
        "target": 300
      },
      "avgResponse": {
        "passed": true,
        "timeSeconds": 280,
        "target": 300
      },
      "resolution": {
        "passed": true,
        "timeSeconds": 5400,
        "target": 7200
      }
    },
    "breachedSLAs": ["Pickup", "First Response"],
    "messageStats": {
      "customerMessages": 8,
      "agentMessages": 5,
      "botMessages": 2
    },
    "messages": [
      {
        "id": "msg_001",
        "text": "Hello, I need help with my order",
        "incoming": true,
        "broadcasted": false,
        "createdAt": "2025-10-15T09:00:12Z",
        "senderName": "John Doe",
        "messageType": "customer"
      },
      {
        "id": "msg_002",
        "text": "Hi! I'll help you with that. Can you provide your order number?",
        "incoming": false,
        "broadcasted": false,
        "createdAt": "2025-10-15T09:08:15Z",
        "senderName": "Sarah Johnson",
        "messageType": "agent"
      }
    ]
  },
  "meta": {
    "businessHoursMode": true
  }
}
```

**Errors:**

- `404 Not Found` - Chat ID does not exist or is not a breached chat
- `401 Unauthorized` - Authentication failure
- `500 Internal Server Error` - Server error

---

### 6. GET /api/sla-compliance/export

Generates and downloads a CSV file of all breached chats matching the current filters.

**Purpose:** Export breach data to CSV for reporting and review meetings.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dateFrom` | ISO 8601 date | Yes | Start date for filter range |
| `dateTo` | ISO 8601 date | Yes | End date for filter range |
| `agentIds` | Comma-separated string | No | Filter by specific agent IDs |
| `statuses` | Comma-separated string | No | Filter by chat statuses |
| `businessHours` | Boolean | No | Use business hours metrics (default: `true`) |

**Example Request:**

```
GET /api/sla-compliance/export?dateFrom=2025-10-01T00:00:00Z&dateTo=2025-10-31T23:59:59Z
```

**Response (200 OK):**

```
Content-Type: text/csv
Content-Disposition: attachment; filename="sla-breaches-2025-10-21.csv"

Chat ID,Contact Name,Agent Name,Status,Opened At,Closed At,Pickup Time (s),Pickup SLA,First Response Time (s),First Response SLA,Avg Response Time (s),Avg Response SLA,Resolution Time (s),Resolution SLA,Overall SLA,Breached SLAs
CH1001,John Doe,Sarah Johnson,CLOSED,2025-10-15 09:00:00,2025-10-15 10:30:00,204,Fail,492,Fail,280,Pass,5400,Pass,Fail,"Pickup,First Response"
CH1002,Jane Smith,Mike Chen,CLOSED,2025-10-16 14:22:00,2025-10-16 16:45:00,135,Fail,285,Pass,310,Fail,8200,Fail,Fail,"Pickup,Avg Response,Resolution"
```

**CSV Format:**

- **Filename:** `sla-breaches-{YYYY-MM-DD}.csv` where date is the export date
- **Encoding:** UTF-8
- **Delimiter:** Comma (`,`)
- **Quoting:** All text fields quoted with double quotes
- **Date Format:** `YYYY-MM-DD HH:mm:ss`

**CSV Columns (16 total):**

1. Chat ID
2. Contact Name
3. Agent Name (or "Unassigned")
4. Status
5. Opened At
6. Closed At (or "N/A")
7. Pickup Time (s) (or "N/A")
8. Pickup SLA (Pass/Fail)
9. First Response Time (s) (or "N/A")
10. First Response SLA (Pass/Fail)
11. Avg Response Time (s) (or "N/A")
12. Avg Response SLA (Pass/Fail)
13. Resolution Time (s) (or "N/A")
14. Resolution SLA (Pass/Fail)
15. Overall SLA (Pass/Fail)
16. Breached SLAs (comma-separated list)

**Limits:**

- Maximum 10,000 rows per export
- If more than 10,000 breaches, return error suggesting date range refinement

**Errors:**

- `400 Bad Request` - Invalid parameters or too many results (>10,000)
- `401 Unauthorized` - Authentication failure
- `500 Internal Server Error` - Server error

---

## Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_DATE_RANGE",
    "message": "The date range provided is invalid. dateFrom must be before dateTo.",
    "details": {
      "dateFrom": "2025-10-31T00:00:00Z",
      "dateTo": "2025-10-01T00:00:00Z"
    }
  }
}
```

**Common Error Codes:**

- `INVALID_DATE_RANGE` - Invalid or missing date parameters
- `AUTHENTICATION_FAILED` - Missing or invalid JWT token
- `UNAUTHORIZED` - User does not have permission to access resource
- `NOT_FOUND` - Requested resource does not exist
- `VALIDATION_ERROR` - Request validation failed
- `DATABASE_ERROR` - Database query or connection error
- `INTERNAL_ERROR` - Unexpected server error

## Rate Limiting

All endpoints are subject to rate limiting:

- **Limit:** 100 requests per minute per user
- **Headers:** Response includes rate limit headers
  - `X-RateLimit-Limit: 100`
  - `X-RateLimit-Remaining: 95`
  - `X-RateLimit-Reset: 1698765432` (Unix timestamp)

If rate limit exceeded:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "retryAfter": 60
    }
  }
}
```

**Response Code:** `429 Too Many Requests`

## Performance Considerations

### Caching Strategy

- **Metrics endpoint:** Cache for 5 minutes (metrics change infrequently)
- **Agent performance:** Cache for 5 minutes
- **Daily trend:** Cache for 10 minutes
- **Breaches list:** Cache for 2 minutes (users may filter frequently)
- **Breach detail:** Cache for 10 minutes (individual chat data stable)
- **CSV export:** No caching (always generate fresh)

**Cache Key Format:** `sla:{endpoint}:{hash(query_params)}`

### Database Optimization

- Use database indexes defined in [database-schema.md](./database-schema.md)
- Leverage pre-computed SLA metrics (no runtime calculation)
- Use pagination on large result sets
- Implement query result streaming for CSV exports

### Response Times

Target response times for each endpoint:

- **GET /metrics:** <500ms
- **GET /agent-performance:** <500ms
- **GET /daily-trend:** <1s
- **GET /breaches:** <1s (paginated)
- **GET /breaches/:chatId:** <300ms
- **GET /export:** <5s (depends on result size)

## Implementation Notes

### Framework & Tools

- **Framework:** Next.js 15 API Routes (`app/api/sla-compliance/`)
- **ORM:** Prisma for database queries
- **Validation:** Zod for request validation
- **Authentication:** Clerk `auth()` helper for JWT validation
- **Error Handling:** Centralized error handler middleware
- **Logging:** Pino logger for request/response logging

### Example Implementation Structure

```
app/
└── api/
    └── sla-compliance/
        ├── metrics/
        │   └── route.ts
        ├── agent-performance/
        │   └── route.ts
        ├── daily-trend/
        │   └── route.ts
        ├── breaches/
        │   ├── route.ts
        │   └── [chatId]/
        │       └── route.ts
        └── export/
            └── route.ts
```

### Request Validation Example

```typescript
import { z } from 'zod';

const metricsQuerySchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  agentIds: z.string().optional().transform(val => val?.split(',')),
  statuses: z.string().optional().transform(val => val?.split(',')),
  businessHours: z.string().optional().transform(val => val === 'true').default('true')
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const validation = metricsQuerySchema.safeParse({
    dateFrom: searchParams.get('dateFrom'),
    dateTo: searchParams.get('dateTo'),
    agentIds: searchParams.get('agentIds'),
    statuses: searchParams.get('statuses'),
    businessHours: searchParams.get('businessHours')
  });

  if (!validation.success) {
    return Response.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: validation.error.flatten()
      }
    }, { status: 400 });
  }

  // Process request...
}
```

## Testing Requirements

### Unit Tests

- Test request validation for all endpoints
- Test error handling for invalid inputs
- Test date range validation logic
- Test pagination calculations

### Integration Tests

- Test each endpoint with sample database data
- Verify response formats match specification
- Test filter combinations
- Test CSV generation with various data sets

### E2E Tests

- Test complete flow: page load → API calls → data display
- Test filtering interaction → API calls with filters
- Test CSV export download

### Load Tests

- Test with 10,000 chats in database
- Verify response times meet targets
- Test concurrent requests (10+ users)
- Verify caching reduces database load
