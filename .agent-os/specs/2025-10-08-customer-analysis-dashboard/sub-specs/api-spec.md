# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-10-08-customer-analysis-dashboard/spec.md

## Overview

This specification defines the API endpoints required for the Customer Service Analysis Dashboard, including analysis triggering, status polling, results retrieval, and export generation. All endpoints follow RESTful conventions and return JSON responses.

## Base URL

```
/api/customer-analysis
```

## Authentication & Authorization

All endpoints require authentication via Clerk JWT tokens and role-based authorization:

- **Required Roles:** `Manager` or `Admin`
- **Data Scoping:** Managers only access data from their assigned departments
- **Headers:**
  ```
  Authorization: Bearer <clerk_jwt_token>
  Content-Type: application/json
  ```

## Endpoints

### 1. Trigger Analysis

Creates a new customer service analysis job with specified filters.

**Endpoint:** `POST /api/customer-analysis`

**Purpose:** Trigger a new analysis job that processes chat data based on filter criteria and performs AI-powered categorization and rule-based metric calculations.

**Request Body:**
```typescript
interface TriggerAnalysisRequest {
  filters: {
    dateStart: string;      // ISO 8601 date (e.g., "2025-09-01")
    dateEnd: string;        // ISO 8601 date (e.g., "2025-10-08")
    agentIds?: string[];    // Optional: Filter by specific agents
    departmentIds?: string[]; // Optional: Filter by departments
    contactIds?: string[];  // Optional: Filter by specific customers
  };
}
```

**Validation Rules:**
- `dateStart` and `dateEnd` are required
- `dateEnd` must be >= `dateStart`
- Maximum date range: 90 days
- If user is Manager role, `departmentIds` must be subset of their assigned departments
- All IDs must be valid UUIDs

**Response (Success):**
```typescript
interface TriggerAnalysisResponse {
  analysisId: string;     // CUID of created CustomerAnalysis record
  status: "PENDING";
  estimatedProcessingTime: number; // Estimated seconds based on data volume
  message: string;
}
```

**Example Response:**
```json
{
  "analysisId": "clxyz123abc456",
  "status": "PENDING",
  "estimatedProcessingTime": 45,
  "message": "Analysis job created successfully. Processing 1,234 chats with 5,678 messages."
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `INVALID_DATE_RANGE` | Date range validation failed |
| 400 | `MISSING_REQUIRED_FIELDS` | Required fields not provided |
| 401 | `UNAUTHORIZED` | No valid authentication token |
| 403 | `FORBIDDEN_ROLE` | User role not Manager/Admin |
| 403 | `FORBIDDEN_DEPARTMENT` | Manager accessing unauthorized department |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many analysis requests (max 10/hour) |

---

### 2. Get Analysis Status

Polls the status of a running or completed analysis job.

**Endpoint:** `GET /api/customer-analysis/:analysisId`

**Purpose:** Check analysis job progress and retrieve metadata for UI state management (loading indicators, completion detection).

**Parameters:**
- `analysisId` (path parameter) - CUID of the analysis job

**Response (Processing):**
```typescript
interface AnalysisStatusResponse {
  id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "PARTIAL";
  progress?: {
    chatsProcessed: number;
    totalChats: number;
    percentComplete: number; // 0-100
  };
  startedAt?: string;       // ISO 8601 timestamp
  completedAt?: string;     // ISO 8601 timestamp
  errorMessage?: string;    // Only if FAILED status
  filters: {
    dateStart: string;
    dateEnd: string;
    agentIds?: string[];
    departmentIds?: string[];
  };
}
```

**Example Response (Completed):**
```json
{
  "id": "clxyz123abc456",
  "status": "COMPLETED",
  "startedAt": "2025-10-08T14:30:00Z",
  "completedAt": "2025-10-08T14:31:23Z",
  "filters": {
    "dateStart": "2025-09-01",
    "dateEnd": "2025-10-08",
    "departmentIds": ["dept-sales-001"]
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 404 | `ANALYSIS_NOT_FOUND` | Invalid analysisId or unauthorized access |
| 401 | `UNAUTHORIZED` | No valid authentication token |

---

### 3. Get Analysis Results

Retrieves complete analysis results including categorizations and KPIs.

**Endpoint:** `GET /api/customer-analysis/:analysisId/results`

**Purpose:** Fetch all data needed to populate the dashboard visualizations and tables after analysis completes.

**Parameters:**
- `analysisId` (path parameter) - CUID of the analysis job

**Query Parameters (Optional):**
```typescript
interface ResultsQueryParams {
  section?: "customer_insights" | "agent_performance" | "operational_insights"; // Filter to specific section
  agentId?: string; // Filter KPIs to specific agent
}
```

**Response:**
```typescript
interface AnalysisResultsResponse {
  analysisId: string;
  status: "COMPLETED" | "PARTIAL";
  summary: {
    totalChatsAnalyzed: number;
    totalMessagesAnalyzed: number;
    aiAnalysisCount: number;
    dateRange: {
      start: string;
      end: string;
    };
  };
  customerInsights: {
    intentDistribution: {
      PROJECT_INFO: number;       // Percentage (0-1)
      PAYMENT: number;
      LEGAL: number;
      POST_PURCHASE: number;
      OTHER: number;
    };
    journeyStageDistribution: {
      PROSPECT: number;
      ACTIVE_BUYER: number;
      POST_PURCHASE: number;
    };
    sentimentDistribution: {
      POSITIVE: number;
      NEUTRAL: number;
      FRICTION: number;
    };
  };
  agentPerformance: {
    byAgent: Array<{
      agentId: string;
      agentName: string;
      metrics: {
        totalChats: number;
        totalMessages: number;
        firstResponseTime: {
          average: number;  // milliseconds
          p50: number;
          p90: number;
          p95: number;
        };
        averageHandlingTime: number; // milliseconds
        qualityScore: {
          average: number;  // 1-10 scale
          distribution: Record<number, number>; // score → count
        };
      };
    }>;
    topPerformers: Array<{
      agentId: string;
      agentName: string;
      metric: string;     // "fastest_response" | "highest_quality" | "most_chats"
      value: number;
    }>;
  };
  operationalInsights: {
    peakTimes: {
      byHour: Record<string, number>;  // "0"-"23" → message count
      byDayOfWeek: Record<string, number>; // "Mon"-"Sun" → message count
    };
    channelDistribution: {
      text: number;
      voice: number;
      media: number;
    };
    commonPainPoints: Array<{
      category: string;
      description: string;
      frequency: number;   // Number of occurrences
      exampleChatIds: string[]; // Sample chat IDs
    }>;
  };
}
```

**Example Response (Abbreviated):**
```json
{
  "analysisId": "clxyz123abc456",
  "status": "COMPLETED",
  "summary": {
    "totalChatsAnalyzed": 1234,
    "totalMessagesAnalyzed": 5678,
    "aiAnalysisCount": 1234,
    "dateRange": { "start": "2025-09-01", "end": "2025-10-08" }
  },
  "customerInsights": {
    "intentDistribution": {
      "PROJECT_INFO": 0.60,
      "PAYMENT": 0.20,
      "LEGAL": 0.15,
      "POST_PURCHASE": 0.05,
      "OTHER": 0.00
    }
  },
  "agentPerformance": {
    "byAgent": [
      {
        "agentId": "agent-001",
        "agentName": "Vanessa Palacio",
        "metrics": {
          "totalChats": 450,
          "totalMessages": 1890,
          "firstResponseTime": {
            "average": 240000,
            "p50": 180000,
            "p90": 420000,
            "p95": 600000
          },
          "qualityScore": { "average": 8.5 }
        }
      }
    ]
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 404 | `ANALYSIS_NOT_FOUND` | Invalid analysisId |
| 400 | `ANALYSIS_NOT_COMPLETED` | Status is PENDING/PROCESSING/FAILED |
| 401 | `UNAUTHORIZED` | No valid authentication token |

---

### 4. Get Analysis History

Retrieves list of previous analysis jobs for the authenticated user.

**Endpoint:** `GET /api/customer-analysis`

**Purpose:** Show managers their analysis history for re-accessing previous reports.

**Query Parameters:**
```typescript
interface AnalysisHistoryQueryParams {
  limit?: number;   // Default: 20, Max: 100
  offset?: number;  // Default: 0
  status?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "PARTIAL";
}
```

**Response:**
```typescript
interface AnalysisHistoryResponse {
  analyses: Array<{
    id: string;
    createdAt: string;    // ISO 8601
    status: AnalysisStatus;
    filters: {
      dateStart: string;
      dateEnd: string;
      agentIds?: string[];
      departmentIds?: string[];
    };
    summary: {
      totalChatsAnalyzed: number;
      totalMessagesAnalyzed: number;
    };
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}
```

**Example Response:**
```json
{
  "analyses": [
    {
      "id": "clxyz123abc456",
      "createdAt": "2025-10-08T14:30:00Z",
      "status": "COMPLETED",
      "filters": {
        "dateStart": "2025-09-01",
        "dateEnd": "2025-10-08",
        "departmentIds": ["dept-sales-001"]
      },
      "summary": {
        "totalChatsAnalyzed": 1234,
        "totalMessagesAnalyzed": 5678
      }
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 20,
    "offset": 0
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `UNAUTHORIZED` | No valid authentication token |

---

### 5. Export Analysis Report

Generates and downloads an export file (PDF or CSV) for a completed analysis.

**Endpoint:** `POST /api/customer-analysis/:analysisId/export`

**Purpose:** Create downloadable reports for sharing with stakeholders or offline review.

**Request Body:**
```typescript
interface ExportAnalysisRequest {
  format: "PDF" | "CSV";
  options?: {
    includeSections?: ("customer_insights" | "agent_performance" | "operational_insights")[];
    anonymizeCustomers?: boolean; // Redact customer names (default: false)
  };
}
```

**Response (Success):**
```typescript
interface ExportAnalysisResponse {
  exportId: string;       // CUID of AnalysisExport record
  format: "PDF" | "CSV";
  fileName: string;       // e.g., "customer-analysis-2025-10-08.pdf"
  downloadUrl: string;    // Signed URL for Vercel Blob (PDF) or direct download (CSV)
  expiresAt: string;      // ISO 8601 timestamp (7 days from now for PDF)
  fileSizeBytes: number;
}
```

**Example Response:**
```json
{
  "exportId": "clexp789xyz",
  "format": "PDF",
  "fileName": "customer-analysis-2025-10-08.pdf",
  "downloadUrl": "https://blob.vercel-storage.com/...",
  "expiresAt": "2025-10-15T14:35:00Z",
  "fileSizeBytes": 245678
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 404 | `ANALYSIS_NOT_FOUND` | Invalid analysisId |
| 400 | `ANALYSIS_NOT_COMPLETED` | Cannot export incomplete analysis |
| 400 | `INVALID_FORMAT` | Format must be PDF or CSV |
| 401 | `UNAUTHORIZED` | No valid authentication token |
| 500 | `EXPORT_GENERATION_FAILED` | PDF/CSV generation error |

---

### 6. Get Filter Options

Retrieves available filter options (agents, departments) for the filter dropdowns.

**Endpoint:** `GET /api/customer-analysis/filter-options`

**Purpose:** Populate filter dropdown menus with available agents and departments based on user permissions.

**Response:**
```typescript
interface FilterOptionsResponse {
  agents: Array<{
    id: string;
    name: string;
    departmentId: string;
    departmentName: string;
  }>;
  departments: Array<{
    id: string;
    name: string;
  }>;
  dateRangeLimits: {
    earliestChatDate: string; // ISO 8601 date
    latestChatDate: string;   // ISO 8601 date
    maxRangeDays: number;     // 90 days
  };
}
```

**Example Response:**
```json
{
  "agents": [
    {
      "id": "agent-001",
      "name": "Vanessa Palacio",
      "departmentId": "dept-sales-001",
      "departmentName": "Sales"
    },
    {
      "id": "agent-002",
      "name": "Dahyana Rodríguez",
      "departmentId": "dept-sales-001",
      "departmentName": "Sales"
    }
  ],
  "departments": [
    {
      "id": "dept-sales-001",
      "name": "Sales"
    }
  ],
  "dateRangeLimits": {
    "earliestChatDate": "2024-01-01",
    "latestChatDate": "2025-10-08",
    "maxRangeDays": 90
  }
}
```

**Authorization:**
- Managers only see agents/departments they have access to
- Admins see all agents/departments

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `UNAUTHORIZED` | No valid authentication token |

---

### 7. Delete Analysis

Deletes an analysis job and all related data (categorizations, KPIs, exports).

**Endpoint:** `DELETE /api/customer-analysis/:analysisId`

**Purpose:** Allow managers to clean up old or failed analysis jobs.

**Response:**
```typescript
interface DeleteAnalysisResponse {
  message: string;
  deletedRecords: {
    categorizations: number;
    kpis: number;
    exports: number;
  };
}
```

**Example Response:**
```json
{
  "message": "Analysis deleted successfully",
  "deletedRecords": {
    "categorizations": 1234,
    "kpis": 87,
    "exports": 2
  }
}
```

**Authorization:**
- Users can only delete their own analysis jobs
- Admins can delete any analysis job

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 404 | `ANALYSIS_NOT_FOUND` | Invalid analysisId |
| 403 | `FORBIDDEN` | User doesn't own this analysis (non-admin) |
| 401 | `UNAUTHORIZED` | No valid authentication token |

---

## Background Job Processing

### Analysis Worker Implementation

The analysis processing is handled by a serverless function that runs asynchronously:

**Worker Flow:**
1. Fetch analysis job from database
2. Update status to `PROCESSING`, set `startedAt`
3. Query chats and messages based on filters
4. Process in batches:
   - Calculate rule-based metrics (response times, volumes)
   - Send message batches to Claude API for categorization
   - Store results progressively in database
5. Update status to `COMPLETED`, set `completedAt` and `processingTimeMs`
6. Handle errors by setting status to `FAILED` or `PARTIAL`

**Endpoint (Internal):** `POST /api/customer-analysis/worker`

**Triggered by:** Background job queue (Vercel cron or manual trigger)

**Request Body:**
```typescript
interface AnalysisWorkerRequest {
  analysisId: string;
}
```

This endpoint is not exposed to frontend; it's invoked by the backend when creating a new analysis job.

---

## Rate Limiting

To prevent abuse and manage Claude API costs:

- **Analysis Trigger:** Max 10 requests per hour per user
- **Results Retrieval:** Max 100 requests per hour per user
- **Exports:** Max 20 exports per day per user

Rate limit headers included in all responses:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1728405600
```

---

## Error Response Format

All error responses follow this consistent format:

```typescript
interface ErrorResponse {
  error: {
    code: string;        // Machine-readable error code
    message: string;     // Human-readable error message
    details?: any;       // Optional additional context
    timestamp: string;   // ISO 8601 timestamp
  };
}
```

**Example:**
```json
{
  "error": {
    "code": "INVALID_DATE_RANGE",
    "message": "Date range cannot exceed 90 days. Provided range: 120 days.",
    "details": {
      "dateStart": "2025-01-01",
      "dateEnd": "2025-04-30",
      "maxDays": 90
    },
    "timestamp": "2025-10-08T14:35:42Z"
  }
}
```

---

## Caching Strategy

**Analysis Results:**
- Cache completed results for 24 hours
- Cache key: `analysis:${analysisId}:results`
- Invalidate on analysis deletion

**Filter Options:**
- Cache for 1 hour
- Cache key: `analysis:filter-options:${userId}`
- Invalidate on new agent/department creation

**Implementation:** Use Vercel KV or in-memory cache with TTL

---

## Monitoring & Logging

**Metrics to Track:**
- Analysis job duration (p50, p90, p99)
- Claude API success rate per analysis
- Export generation success rate
- API endpoint latency

**Logs to Capture (Pino + Sentry):**
- Analysis trigger events (user, filters, estimated volume)
- Worker processing start/complete events
- Claude API request/response logs (sanitized)
- Export generation events
- Error events with full stack traces

---

## Testing Strategy

### API Tests (Playwright/Jest)

**Integration Tests:**
- Test complete flow: trigger → poll status → fetch results
- Test filter validation (invalid dates, unauthorized departments)
- Test role-based authorization (Manager vs Admin access)
- Test export generation (PDF and CSV)
- Test rate limiting enforcement

**Unit Tests:**
- Test filter validation logic
- Test KPI aggregation functions
- Test Claude API response parsing
- Test error handling for all edge cases

**Load Tests (k6):**
- Simulate 20 concurrent analysis triggers
- Test worker performance with 10k+ messages
- Verify database query performance under load
