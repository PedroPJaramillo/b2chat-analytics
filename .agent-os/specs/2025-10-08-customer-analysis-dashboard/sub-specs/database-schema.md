# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-10-08-customer-analysis-dashboard/spec.md

## Overview

This schema introduces four new tables to support customer service analysis functionality: `CustomerAnalysis` for storing analysis job metadata, `CustomerCategorization` for AI-powered conversation categorizations, `AnalysisKPI` for storing calculated metrics, and `AnalysisExport` for tracking generated reports.

## New Tables

### 1. CustomerAnalysis

Stores metadata for each analysis job triggered by managers.

```prisma
model CustomerAnalysis {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Job metadata
  status          AnalysisStatus @default(PENDING)
  triggeredBy     String   // User.id who triggered the analysis
  triggeredByUser User     @relation(fields: [triggeredBy], references: [id])

  // Filter parameters (stored as JSON for flexibility)
  filters         Json     // { dateStart, dateEnd, agentIds?, departmentIds?, contactIds? }

  // Results summary
  totalChatsAnalyzed      Int      @default(0)
  totalMessagesAnalyzed   Int      @default(0)
  aiAnalysisCount         Int      @default(0) // How many AI categorizations performed

  // Processing metadata
  startedAt       DateTime?
  completedAt     DateTime?
  errorMessage    String?  @db.Text
  processingTimeMs Int?    // Duration in milliseconds

  // Relationships
  categorizations CustomerCategorization[]
  kpis            AnalysisKPI[]
  exports         AnalysisExport[]

  @@index([triggeredBy, createdAt])
  @@index([status, createdAt])
  @@map("customer_analyses")
}

enum AnalysisStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  PARTIAL // Some data processed, some failed
}
```

**Rationale:**
- `filters` as JSON allows flexible filter combinations without schema changes
- `status` enum enables job lifecycle tracking and UI state management
- Indexes on `triggeredBy` and `status` optimize manager's analysis history queries
- Processing metadata enables performance monitoring and debugging

### 2. CustomerCategorization

Stores AI-powered categorizations for individual chats.

```prisma
model CustomerCategorization {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())

  // Foreign keys
  analysisId      String
  analysis        CustomerAnalysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)

  chatId          String
  chat            Chat     @relation(fields: [chatId], references: [id], onDelete: Cascade)

  // AI-powered categorizations
  customerIntent  CustomerIntent?
  journeyStage    JourneyStage?
  sentiment       Sentiment?

  // Agent quality assessment
  agentQualityScore Int?   // 1-10 scale

  // AI reasoning (for debugging/validation)
  reasoningNotes  String?  @db.Text

  // Metadata
  confidenceScore Float?   // 0.0-1.0 AI confidence level

  @@unique([analysisId, chatId]) // One categorization per chat per analysis
  @@index([analysisId, customerIntent])
  @@index([analysisId, journeyStage])
  @@index([chatId])
  @@map("customer_categorizations")
}

enum CustomerIntent {
  PROJECT_INFO      // Inquiries about El Bosque, Majagua, La Colina projects
  PAYMENT           // Payment-related questions, financial documentation
  LEGAL             // Escrituras, certificates, legal documentation
  POST_PURCHASE     // Post-purchase support, delivery queries
  OTHER             // Uncategorized or mixed intent
}

enum JourneyStage {
  PROSPECT          // Initial inquiry, information seeking
  ACTIVE_BUYER      // Discussing payments, documentation
  POST_PURCHASE     // Escrituras, delivery, post-sale support
}

enum Sentiment {
  POSITIVE          // "Muchas gracias", "Con mucho gusto"
  NEUTRAL           // Information exchange
  FRICTION          // Payment surprises, process confusion
}
```

**Rationale:**
- Separate table from `Chat` to avoid polluting core chat model with analysis-specific data
- `onDelete: Cascade` ensures cleanup when chats or analyses are deleted
- Unique constraint prevents duplicate categorizations for same chat in same analysis
- `confidenceScore` enables filtering low-confidence AI predictions
- Indexes on intent and journey stage optimize dashboard aggregation queries

### 3. AnalysisKPI

Stores calculated metrics (rule-based and aggregated AI results).

```prisma
model AnalysisKPI {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())

  // Foreign key
  analysisId      String
  analysis        CustomerAnalysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)

  // KPI identification
  metricType      MetricType
  metricName      String   // e.g., "first_response_p50", "customer_intent_distribution"

  // Value storage (flexible for different metric types)
  numericValue    Float?   // For numeric metrics (response times, counts)
  stringValue     String?  // For categorical metrics (e.g., "project_info")
  jsonValue       Json?    // For complex metrics (distributions, time series)

  // Optional dimensions
  agentId         String?  // If metric is agent-specific
  agent           Agent?   @relation(fields: [agentId], references: [id])

  departmentId    String?  // If metric is department-specific
  department      Department? @relation(fields: [departmentId], references: [id])

  category        String?  // Group related metrics (e.g., "performance", "customer_analysis")

  @@index([analysisId, metricType])
  @@index([analysisId, category])
  @@index([agentId, metricType])
  @@map("analysis_kpis")
}

enum MetricType {
  RESPONSE_TIME       // First response time, average handling time
  VOLUME              // Message counts, chat counts
  PEAK_TIME           // Messages by hour/day
  CUSTOMER_INTENT     // Intent distribution percentages
  JOURNEY_STAGE       // Journey stage distribution
  SENTIMENT           // Sentiment distribution
  AGENT_QUALITY       // Agent quality scores
  CHANNEL_USAGE       // Text vs voice vs media distribution
}
```

**Rationale:**
- Flexible value storage (numeric/string/JSON) accommodates diverse metric types
- `category` field enables grouping related KPIs for dashboard sections
- Optional `agentId` and `departmentId` enable drilldown analysis
- Indexes optimize filtering and grouping queries for dashboard visualizations
- Separate from `CustomerAnalysis` to enable efficient querying of specific metrics

**Example KPI Records:**
```typescript
// Response time metric
{
  metricType: "RESPONSE_TIME",
  metricName: "first_response_p50",
  numericValue: 180000, // 3 minutes in ms
  agentId: "agent-123",
  category: "performance"
}

// Intent distribution metric
{
  metricType: "CUSTOMER_INTENT",
  metricName: "intent_distribution",
  jsonValue: {
    "PROJECT_INFO": 0.60,
    "PAYMENT": 0.20,
    "LEGAL": 0.15,
    "POST_PURCHASE": 0.05
  },
  category: "customer_analysis"
}

// Peak time metric
{
  metricType: "PEAK_TIME",
  metricName: "messages_by_hour",
  jsonValue: {
    "9": 145,
    "10": 178,
    "11": 162,
    // ... other hours
  },
  category: "operational"
}
```

### 4. AnalysisExport

Tracks generated export files (PDF/CSV reports).

```prisma
model AnalysisExport {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())

  // Foreign key
  analysisId      String
  analysis        CustomerAnalysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)

  // Export metadata
  format          ExportFormat
  fileName        String

  // Vercel Blob storage
  blobUrl         String?  // Signed URL for PDF files
  blobKey         String?  // Blob storage key for cleanup

  // Export details
  generatedBy     String   // User.id who requested export
  generatedByUser User     @relation(fields: [generatedBy], references: [id])

  fileSizeBytes   Int?
  expiresAt       DateTime? // For auto-cleanup (7 days)

  @@index([analysisId, createdAt])
  @@index([generatedBy, createdAt])
  @@index([expiresAt]) // For cleanup job
  @@map("analysis_exports")
}

enum ExportFormat {
  PDF
  CSV
}
```

**Rationale:**
- Tracks export history for audit and re-download capabilities
- `expiresAt` enables automated cleanup of old blob files
- `blobKey` stored for programmatic deletion from Vercel Blob
- Indexes optimize user's export history queries and cleanup jobs

## Modified Tables

### User Model Extension

Add relationship to track analysis jobs and exports.

```prisma
model User {
  // ... existing fields ...

  // New relationships
  triggeredAnalyses   CustomerAnalysis[] @relation("TriggeredAnalyses")
  generatedExports    AnalysisExport[]   @relation("GeneratedExports")
}
```

### Chat Model Extension

Add relationship to categorizations.

```prisma
model Chat {
  // ... existing fields ...

  // New relationship
  categorizations CustomerCategorization[]
}
```

### Agent Model Extension

Add relationship to KPIs.

```prisma
model Agent {
  // ... existing fields ...

  // New relationship
  kpis AnalysisKPI[]
}
```

### Department Model Extension

Add relationship to KPIs.

```prisma
model Department {
  // ... existing fields ...

  // New relationship
  kpis AnalysisKPI[]
}
```

## Migration Strategy

### Migration File Structure

```prisma
// migration: create_customer_analysis_tables

-- 1. Create enums
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL');
CREATE TYPE "CustomerIntent" AS ENUM ('PROJECT_INFO', 'PAYMENT', 'LEGAL', 'POST_PURCHASE', 'OTHER');
CREATE TYPE "JourneyStage" AS ENUM ('PROSPECT', 'ACTIVE_BUYER', 'POST_PURCHASE');
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'FRICTION');
CREATE TYPE "MetricType" AS ENUM ('RESPONSE_TIME', 'VOLUME', 'PEAK_TIME', 'CUSTOMER_INTENT', 'JOURNEY_STAGE', 'SENTIMENT', 'AGENT_QUALITY', 'CHANNEL_USAGE');
CREATE TYPE "ExportFormat" AS ENUM ('PDF', 'CSV');

-- 2. Create CustomerAnalysis table
CREATE TABLE "customer_analyses" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
  "triggeredBy" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "totalChatsAnalyzed" INTEGER NOT NULL DEFAULT 0,
  "totalMessagesAnalyzed" INTEGER NOT NULL DEFAULT 0,
  "aiAnalysisCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "processingTimeMs" INTEGER,
  FOREIGN KEY ("triggeredBy") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "customer_analyses_triggeredBy_createdAt_idx" ON "customer_analyses"("triggeredBy", "createdAt");
CREATE INDEX "customer_analyses_status_createdAt_idx" ON "customer_analyses"("status", "createdAt");

-- 3. Create CustomerCategorization table
CREATE TABLE "customer_categorizations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "analysisId" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "customerIntent" "CustomerIntent",
  "journeyStage" "JourneyStage",
  "sentiment" "Sentiment",
  "agentQualityScore" INTEGER,
  "reasoningNotes" TEXT,
  "confidenceScore" DOUBLE PRECISION,
  FOREIGN KEY ("analysisId") REFERENCES "customer_analyses"("id") ON DELETE CASCADE,
  FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "customer_categorizations_analysisId_chatId_key" ON "customer_categorizations"("analysisId", "chatId");
CREATE INDEX "customer_categorizations_analysisId_customerIntent_idx" ON "customer_categorizations"("analysisId", "customerIntent");
CREATE INDEX "customer_categorizations_analysisId_journeyStage_idx" ON "customer_categorizations"("analysisId", "journeyStage");
CREATE INDEX "customer_categorizations_chatId_idx" ON "customer_categorizations"("chatId");

-- 4. Create AnalysisKPI table
CREATE TABLE "analysis_kpis" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "analysisId" TEXT NOT NULL,
  "metricType" "MetricType" NOT NULL,
  "metricName" TEXT NOT NULL,
  "numericValue" DOUBLE PRECISION,
  "stringValue" TEXT,
  "jsonValue" JSONB,
  "agentId" TEXT,
  "departmentId" TEXT,
  "category" TEXT,
  FOREIGN KEY ("analysisId") REFERENCES "customer_analyses"("id") ON DELETE CASCADE,
  FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL,
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL
);

CREATE INDEX "analysis_kpis_analysisId_metricType_idx" ON "analysis_kpis"("analysisId", "metricType");
CREATE INDEX "analysis_kpis_analysisId_category_idx" ON "analysis_kpis"("analysisId", "category");
CREATE INDEX "analysis_kpis_agentId_metricType_idx" ON "analysis_kpis"("agentId", "metricType");

-- 5. Create AnalysisExport table
CREATE TABLE "analysis_exports" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "analysisId" TEXT NOT NULL,
  "format" "ExportFormat" NOT NULL,
  "fileName" TEXT NOT NULL,
  "blobUrl" TEXT,
  "blobKey" TEXT,
  "generatedBy" TEXT NOT NULL,
  "fileSizeBytes" INTEGER,
  "expiresAt" TIMESTAMP(3),
  FOREIGN KEY ("analysisId") REFERENCES "customer_analyses"("id") ON DELETE CASCADE,
  FOREIGN KEY ("generatedBy") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "analysis_exports_analysisId_createdAt_idx" ON "analysis_exports"("analysisId", "createdAt");
CREATE INDEX "analysis_exports_generatedBy_createdAt_idx" ON "analysis_exports"("generatedBy", "createdAt");
CREATE INDEX "analysis_exports_expiresAt_idx" ON "analysis_exports"("expiresAt");
```

### Rollback Strategy

```sql
-- Rollback migration (if needed)
DROP TABLE IF EXISTS "analysis_exports";
DROP TABLE IF EXISTS "analysis_kpis";
DROP TABLE IF EXISTS "customer_categorizations";
DROP TABLE IF EXISTS "customer_analyses";

DROP TYPE IF EXISTS "ExportFormat";
DROP TYPE IF EXISTS "MetricType";
DROP TYPE IF EXISTS "Sentiment";
DROP TYPE IF EXISTS "JourneyStage";
DROP TYPE IF EXISTS "CustomerIntent";
DROP TYPE IF EXISTS "AnalysisStatus";
```

## Data Integrity Considerations

### Cascade Deletions
- **CustomerAnalysis deleted** → Cascade delete categorizations, KPIs, and exports
- **Chat deleted** → Cascade delete categorizations (analysis results become stale but preserved)
- **Agent/Department deleted** → Set NULL in KPIs (metrics preserved for historical analysis)

### Constraints
- **Unique constraint** on `(analysisId, chatId)` prevents duplicate categorizations
- **Foreign key constraints** ensure referential integrity
- **NOT NULL constraints** on critical fields (status, triggeredBy, filters)

### Performance Considerations
- **Indexes** on foreign keys optimize JOIN operations
- **Composite indexes** on frequently filtered columns (e.g., `triggeredBy + createdAt`)
- **JSONB columns** for flexible data storage with PostgreSQL JSON query support
- **Text columns** for large content (errorMessage, reasoningNotes)

## Cleanup Jobs

### Automated Cleanup Strategy

**Expired Exports Cleanup (Daily Cron Job):**
```typescript
// Delete exports older than 7 days
const expiredExports = await prisma.analysisExport.findMany({
  where: { expiresAt: { lte: new Date() } },
  select: { id: true, blobKey: true }
});

// Delete from Vercel Blob
for (const exp of expiredExports) {
  if (exp.blobKey) await del(exp.blobKey);
}

// Delete database records
await prisma.analysisExport.deleteMany({
  where: { id: { in: expiredExports.map(e => e.id) } }
});
```

**Old Analysis Cleanup (Optional):**
- Archive or delete analysis jobs older than 90 days
- Preserve KPI summaries for long-term trend analysis
- Implement soft delete if historical data needed

## Testing Considerations

### Database Tests
- **Schema validation:** Verify all constraints and indexes created
- **Cascade deletion:** Test that deleting CustomerAnalysis removes related records
- **Unique constraints:** Verify duplicate categorization prevention
- **Index performance:** Benchmark query performance with 10k+ analysis records
- **JSON queries:** Test filtering/aggregating JSONB fields efficiently

### Data Migration Tests
- **Fresh install:** Test schema creation on new database
- **Existing data:** Test migration on database with existing chats/agents
- **Rollback:** Verify clean rollback without data loss to existing tables
