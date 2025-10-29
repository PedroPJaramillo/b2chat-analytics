# Spec Tasks

## Tasks

- [x] 1. Database Schema and Models Setup
  - [x] 1.1 Write tests for Prisma schema validation and database migrations
  - [x] 1.2 Update Prisma schema with new models (CustomerAnalysis, CustomerCategorization, AnalysisKPI, AnalysisExport) and enums (AnalysisStatus, CustomerIntent, JourneyStage, Sentiment, MetricType, ExportFormat)
  - [x] 1.3 Add relationships to existing models (User, Chat, Agent, Department)
  - [x] 1.4 Generate and run Prisma migration for new tables and indexes
  - [x] 1.5 Create TypeScript types for analysis domain models
  - [x] 1.6 Verify all database tests pass and migration succeeds

- [x] 2. Backend API - Analysis Trigger and Worker
  - [x] 2.1 Write unit tests for filter validation logic and route handlers
  - [x] 2.2 Create POST /api/customer-analysis route with filter validation (date range, agent IDs, department IDs)
  - [x] 2.3 Implement authorization middleware (Manager/Admin role check, department scoping)
  - [x] 2.4 Create analysis worker service with rule-based metrics calculation (response times, volumes, peak hours)
  - [x] 2.5 Implement Claude API integration for batch conversation analysis with retry logic
  - [x] 2.6 Create POST /api/customer-analysis/worker endpoint for background job processing
  - [x] 2.7 Implement rate limiting (10 requests/hour per user)
  - [x] 2.8 Verify all API tests pass and worker processes analysis correctly

- [x] 3. Backend API - Results, Status, and History
  - [x] 3.1 Write unit tests for results aggregation and status polling
  - [x] 3.2 Create GET /api/customer-analysis/:analysisId route for status polling
  - [x] 3.3 CREATE GET /api/customer-analysis/:analysisId/results route with data aggregation
  - [x] 3.4 Create GET /api/customer-analysis route for analysis history with pagination (completed in Task 2)
  - [x] 3.5 Create GET /api/customer-analysis/filter-options route for dropdown data
  - [x] 3.6 Create DELETE /api/customer-analysis/:analysisId route with authorization
  - [x] 3.7 Implement caching strategy for results (24h) and filter options (1h)
  - [x] 3.8 Verify all API tests pass and responses match specification

- [x] 4. Backend API - Export Functionality
  - [x] 4.1 Write unit tests for PDF and CSV generation logic
  - [x] 4.2 Install and configure @react-pdf/renderer dependency
  - [x] 4.3 Create PDF components (AnalysisReportDocument, CoverPage, ExecutiveSummary, sections)
  - [x] 4.4 Implement CSV generation with flat metric structure
  - [x] 4.5 Create POST /api/customer-analysis/:analysisId/export route
  - [x] 4.6 Integrate Vercel Blob storage for PDF uploads with 7-day expiry
  - [x] 4.7 Implement export cleanup job for expired files
  - [x] 4.8 Verify export tests pass and files generate correctly

- [x] 5. Frontend - Core Components and State Management
  - [x] 5.1 Write unit tests for React components and hooks
  - [x] 5.2 Create CustomerAnalysisPage component with layout structure
  - [x] 5.3 Create AnalysisFilters component with React Hook Form and Zod validation
  - [x] 5.4 Implement TanStack Query hooks (useAnalysisList, useAnalysisStatus, useAnalysisResults, useTriggerAnalysis, useExportAnalysis)
  - [x] 5.5 Create AnalysisTrigger component with loading states and error handling
  - [x] 5.6 Create AnalysisResults container with status polling logic
  - [x] 5.7 Implement skeleton loaders and error states
  - [x] 5.8 Verify all component tests pass

- [x] 6. Frontend - Dashboard Visualizations
  - [x] 6.1 Write unit tests for visualization components
  - [x] 6.2 Create CustomerInsightsView with PieChart for intent distribution and FunnelChart for journey stages
  - [x] 6.3 Create AgentPerformanceView with horizontal BarChart for response times and performance table
  - [x] 6.4 Create OperationalInsightsView with BarChart for peak time heatmap and channel distribution
  - [x] 6.5 Implement lazy loading for chart components (React.lazy + Suspense)
  - [x] 6.6 Add responsive containers and mobile-friendly layouts
  - [x] 6.7 Implement data tooltips and interactive elements
  - [x] 6.8 Verify visualization tests pass and charts render correctly

- [x] 7. Frontend - Export and Navigation
  - [x] 7.1 Write unit tests for export functionality and routing
  - [x] 7.2 Create ExportButton component with format selection (PDF/CSV)
  - [x] 7.3 Implement export download flow with progress indicators
  - [x] 7.4 Add /dashboard/customer-analysis route to Next.js app router
  - [x] 7.5 Update sidebar navigation with Customer Analysis link (Manager/Admin only)
  - [x] 7.6 Implement analysis history view with previous runs list
  - [x] 7.7 Add keyboard shortcuts and accessibility features
  - [x] 7.8 Verify navigation and export tests pass

- [x] 8. Integration Testing and Quality Assurance
  - [x] 8.1 Write Playwright end-to-end tests for complete workflow
  - [x] 8.2 Test analysis trigger → status polling → results display flow
  - [x] 8.3 Test filter interactions (date picker, agent/department select)
  - [x] 8.4 Test export generation and download for both PDF and CSV
  - [x] 8.5 Test error scenarios (invalid filters, API failures, timeout handling)
  - [x] 8.6 Test role-based authorization (Manager vs Admin access)
  - [x] 8.7 Run k6 load tests (10 concurrent analyses, 100k+ messages)
  - [x] 8.8 Verify all integration tests pass and performance meets requirements
