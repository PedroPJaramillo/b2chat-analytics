# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-10-08-customer-analysis-dashboard/spec.md

## Technical Requirements

### 1. Frontend Components

#### Dashboard Page Structure
- **Route:** `/dashboard/customer-analysis`
- **Layout:** Full-width dashboard layout with sidebar navigation integration
- **Components:**
  - `CustomerAnalysisPage` - Main container component
  - `AnalysisFilters` - Filter panel (date range, agent select, department select)
  - `AnalysisTrigger` - Button to start analysis with loading states
  - `AnalysisResults` - Results container with tabs for different views
  - `CustomerInsightsView` - Customer journey & intent visualizations
  - `AgentPerformanceView` - Agent metrics table and charts
  - `OperationalInsightsView` - Peak time heatmaps and patterns
  - `ExportButton` - Export functionality (PDF/CSV)

#### State Management
- **TanStack Query** for server state management
- Queries:
  - `useAnalysisList` - Fetch previous analysis runs
  - `useAnalysisResults` - Fetch specific analysis results
  - `useAnalysisStatus` - Poll analysis job status
- Mutations:
  - `useTriggerAnalysis` - Trigger new analysis
  - `useExportAnalysis` - Generate export file

#### Visualizations (Recharts)
- **Peak Time Heatmap:** `ResponsiveContainer` with custom `BarChart` showing message volume by hour
- **Customer Intent Distribution:** `PieChart` with percentages
- **Agent Performance Comparison:** Horizontal `BarChart` with p50/p90 response time bars
- **Journey Stage Funnel:** `FunnelChart` showing prospect → buyer → post-purchase flow
- **Trend Lines:** `LineChart` for time-series analysis (if multiple date ranges analyzed)

#### Form Handling
- **React Hook Form** with Zod schema validation for filter inputs
- Schema validation:
  - Date range: Required, start date < end date, max 90 days
  - Agent IDs: Optional array of UUIDs
  - Department IDs: Optional array of UUIDs

### 2. Backend API Implementation

#### Analysis Processing Flow
1. **API Route receives trigger request** → Validates filters and user permissions
2. **Create AnalysisJob record** → Store in database with status "pending"
3. **Queue background job** → Use Vercel serverless function with extended timeout
4. **Background worker:**
   - Fetch filtered chats and messages from database
   - Process rule-based metrics (response times, volumes, peak hours)
   - Batch messages to Claude API for AI analysis
   - Store results in database tables
   - Update job status to "completed"
5. **Frontend polls job status** → Display results when ready

#### AI Analysis Strategy (Claude API)

**Batch Processing Approach:**
- Group messages into conversation contexts (per chat)
- Send batches of 10-20 conversations per Claude API call
- Use structured prompts requesting JSON responses

**Prompt Structure for Customer Analysis:**
```typescript
interface ClaudeAnalysisPrompt {
  conversations: Array<{
    chatId: string;
    messages: Array<{ sender: string; content: string; timestamp: string }>;
  }>;
  analysisRequest: {
    categorizeIntent: boolean; // project info, payment, legal, post-purchase
    identifyJourneyStage: boolean; // prospect, active buyer, post-purchase
    assessSentiment: boolean; // positive, neutral, friction
    evaluateAgentQuality: boolean; // response completeness, professionalism
  };
}
```

**Response Schema:**
```typescript
interface ClaudeAnalysisResponse {
  conversations: Array<{
    chatId: string;
    customerIntent: "project_info" | "payment" | "legal" | "post_purchase" | "other";
    journeyStage: "prospect" | "active_buyer" | "post_purchase";
    sentiment: "positive" | "neutral" | "friction";
    agentQualityScore: number; // 1-10
    reasoningNotes: string;
  }>;
}
```

**Rate Limiting & Error Handling:**
- Implement queue system to respect Claude API rate limits
- Retry failed API calls with exponential backoff (max 3 retries)
- Store partial results if analysis partially succeeds
- Log all Claude API errors to Sentry

#### Rule-Based Metrics Calculation

**Response Time Metrics:**
```typescript
interface ResponseTimeMetrics {
  firstResponseTime: {
    average: number; // milliseconds
    p50: number;
    p90: number;
    p95: number;
  };
  averageHandlingTime: number; // total conversation duration / message count
  responseTimesByHour: Record<string, number>; // hour → avg response time
}
```

**Volume Metrics:**
```typescript
interface VolumeMetrics {
  totalChats: number;
  totalMessages: number;
  messagesByAgent: Record<string, number>; // agentId → count
  messagesByHour: Record<string, number>; // hour (0-23) → count
  channelDistribution: {
    text: number;
    voice: number; // count voice note messages
    media: number; // images, PDFs
  };
}
```

**Peak Time Analysis:**
- Aggregate messages by hour of day (0-23)
- Aggregate messages by day of week (Mon-Sun)
- Calculate concurrent chat counts per agent

### 3. Database Operations

#### Analysis Job Lifecycle
- **Create:** Insert `CustomerAnalysis` record with status "pending"
- **Update:** Update status to "processing" when worker starts
- **Complete:** Update status to "completed" with result counts
- **Error:** Update status to "failed" with error message

#### Efficient Queries
- **Filter chats:** Use indexed queries on `createdAt`, `agentId`, `departmentId`
- **Fetch messages:** Join `Message` table with pagination (1000 messages per batch)
- **Store categorizations:** Bulk insert `CustomerCategorization` records
- **Store KPIs:** Bulk insert `AnalysisKPI` records with metric type indexing

#### Caching Strategy
- Cache analysis results for 24 hours (using same filters = return cached)
- Cache filter options (agent lists, department lists) for 1 hour
- Invalidate cache when new chats/messages synced

### 4. Export Functionality

#### PDF Generation (Vercel Blob + PDF Library)
- **Library:** Use `@react-pdf/renderer` for PDF generation
- **Components:**
  - `AnalysisReportDocument` - Root PDF document
  - `CoverPage` - Title, filters, date range, logo
  - `ExecutiveSummary` - Key metrics highlights
  - `CustomerInsightsSection` - Intent distribution, journey stages
  - `AgentPerformanceSection` - Performance table with charts
  - `OperationalInsightsSection` - Peak times, pain points
- **Storage:** Upload to Vercel Blob, return signed URL
- **Cleanup:** Delete blob files after 7 days

#### CSV Generation
- **Structure:** Flat table with one row per metric
- **Columns:** `metric_type`, `metric_name`, `value`, `agent_id`, `category`
- **Example Rows:**
  - `response_time, first_response_p50, 180000, agent-123, performance`
  - `customer_intent, project_info, 0.60, -, customer_analysis`
- **Download:** Stream CSV directly without blob storage

### 5. Performance Optimization

#### Background Job Processing
- Use Vercel serverless functions with max timeout (60 seconds for Pro plan)
- If analysis exceeds timeout, implement job chunking:
  - Process 1000 chats per chunk
  - Store chunk results progressively
  - Frontend shows "X% complete" progress indicator

#### Database Query Optimization
- Create composite indexes on `Chat` table: `(createdAt, agentId, departmentId)`
- Create index on `Message` table: `(chatId, createdAt)`
- Use `SELECT` only needed columns (avoid `SELECT *`)
- Implement cursor-based pagination for large result sets

#### Frontend Performance
- Lazy load chart components (React.lazy + Suspense)
- Virtualize large tables (TanStack Table virtual scrolling)
- Debounce filter changes (500ms) to avoid excessive API calls
- Show skeleton loaders during data fetching

### 6. Security & Authorization

#### Permission Requirements
- **Role Check:** Only "Manager" and "Admin" roles can access dashboard
- **Data Scoping:** Managers only see data from their assigned departments
- **Clerk Metadata:** Check `publicMetadata.role` and `publicMetadata.departmentIds`

#### API Route Protection
```typescript
// Example middleware check
const session = await auth();
if (!session?.userId) return new Response("Unauthorized", { status: 401 });

const user = await db.user.findUnique({ where: { clerkId: session.userId } });
if (!["Manager", "Admin"].includes(user.role)) {
  return new Response("Forbidden", { status: 403 });
}
```

#### Data Privacy
- Anonymize customer names in exports (optional setting)
- Redact sensitive information (payment details, addresses) in AI prompts
- Log all analysis triggers for audit trail

### 7. Error Handling & Monitoring

#### Error Scenarios
- **Claude API failures:** Graceful degradation (show rule-based metrics only)
- **Timeout errors:** Save partial results, notify user to reduce date range
- **Database errors:** Log to Sentry, show user-friendly error message
- **Invalid filters:** Validate on frontend + backend, show specific error

#### Monitoring (Sentry + Pino)
- Track analysis job duration (alert if > 30 seconds)
- Track Claude API success rate (alert if < 95%)
- Track export generation failures
- Log filter combinations used (analytics for feature usage)

### 8. Testing Strategy

#### Unit Tests (Jest)
- Test metric calculation functions (response times, volumes)
- Test Claude API response parsing
- Test filter validation logic
- Test CSV generation formatting

#### Integration Tests (Playwright)
- Test complete analysis workflow (trigger → poll → view results)
- Test filter interactions (select agents, date ranges)
- Test export downloads (verify file creation)
- Test error states (no data, API failures)

#### Load Tests (k6)
- Simulate 10 concurrent analysis requests
- Verify database query performance with 100k+ messages
- Test Claude API batch processing efficiency

## External Dependencies

No new external dependencies are required. The implementation will use existing libraries already in the tech stack:

- **AI Integration:** Existing Claude API integration (already configured)
- **PDF Generation:** `@react-pdf/renderer` (to be installed)
- **Date Handling:** Existing `date-fns` library
- **Charts:** Existing `recharts` library
- **State Management:** Existing TanStack Query
- **Database:** Existing Prisma ORM

**Justification for @react-pdf/renderer:**
This is the standard React library for generating PDFs with JSX syntax, ensuring consistent styling with our existing React components. Alternative libraries (jsPDF, PDFKit) require imperative APIs that are harder to maintain.
