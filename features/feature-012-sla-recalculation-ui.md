# Feature 012: SLA Recalculation UI and Maintenance Tools

## Requirements

### Original User Requirements
- Add functionality to recalculate SLA metrics from the SLA config menu
- Allow users to trigger SLA recalculation after changing SLA configuration (thresholds, priority/channel overrides)
- Provide visibility into recalculation progress and results
- Support both quick recalculation (last 30 days) and custom date range selection

### Acceptance Criteria
- [ ] Users can trigger SLA recalculation with one click using default parameters (30 days, 1000 limit)
- [ ] Advanced users can specify custom date ranges and limits for recalculation
- [ ] System warns users to save configuration changes before recalculating
- [ ] Users receive confirmation dialog before expensive recalculation operations
- [ ] System displays loading state during recalculation with progress indication
- [ ] Users see success notification with summary (chats processed, duration)
- [ ] System shows detailed error information if recalculation fails
- [ ] Last recalculation timestamp and results are displayed for reference
- [ ] Recalculation uses the currently saved SLA configuration from database
- [ ] All recalculations are logged for audit trail

### Business Value
- Enables users to immediately apply SLA configuration changes to historical data
- Reduces manual intervention and support requests for SLA updates
- Provides transparency and confidence in SLA metric accuracy
- Supports data integrity and compliance requirements

## Architecture Design

### How This Feature Fits Into Existing App Patterns

This feature integrates with the existing SLA Settings UI (Pattern #39-41) and extends it with maintenance capabilities. It follows the established patterns:

1. **Settings Page Pattern** (Pattern #27-29): Extends `/dashboard/settings/sla` page with new maintenance section
2. **API Integration Pattern** (Pattern #15-21): Uses existing `/api/sla/recalculate` endpoint with proper auth and validation
3. **Form + Action Pattern**: Separates configuration editing (existing) from maintenance actions (new)
4. **Confirmation Dialog Pattern**: Adds user confirmation before expensive operations (Pattern #60)
5. **Audit Logging Pattern** (Pattern #36): All recalculations logged to audit trail

### Components/Services Created/Modified

**Modified:**
- `src/components/settings/sla-settings-section.tsx` - Add maintenance section with recalculate UI
- `src/hooks/use-sla-settings.ts` - Add recalculation function to existing hook
- `src/types/sla.ts` - Add recalculation result types

**Created:**
- `src/components/settings/sla-recalculation-dialog.tsx` - Confirmation dialog with date range options
- `src/components/settings/sla-recalculation-result.tsx` - Results display component
- `src/hooks/use-sla-recalculation.ts` - Hook for recalculation API calls
- `src/lib/sla/recalculation-helpers.ts` - Date range calculation and validation helpers

### Integration Points With Existing Systems

1. **SLA Configuration System** (Pattern #33-38):
   - Reads configuration from `SystemSettings` table
   - Uses same SLA calculation logic as sync engine
   - Respects enabled metrics flags

2. **Audit System** (Pattern #36):
   - Logs all recalculation operations
   - Includes user, date range, results in audit log
   - Enables compliance and troubleshooting

3. **Authentication System** (Pattern #16, #30):
   - Requires Admin role for recalculation
   - Uses Clerk auth middleware
   - Validates permissions server-side

4. **Toast Notification System**:
   - Success notifications using existing toast pattern
   - Error alerts with detailed information

5. **Data Sync System** (Pattern #34-38):
   - Uses same SLA calculation functions as sync engine
   - Ensures consistency between sync and recalculation

### Database Changes Required

**No new tables or columns required** - this feature uses existing infrastructure:

- Reads from: `SystemSetting` (SLA config), `Chat` (data to recalculate), `Message` (for calculations)
- Writes to: `Chat` (updated SLA metrics), `AuditLog` (operation tracking)
- Uses existing: `/api/sla/recalculate` endpoint (already implemented)

## Implementation Chunks

### Chunk 1: Add Recalculation Hook and Types

**Type:** Frontend
**Dependencies:** None
**Estimated Effort:** Small (0.5 day)

**Files to create:**
- `src/hooks/use-sla-recalculation.ts`
- `src/lib/sla/recalculation-helpers.ts`

**Files to modify:**
- `src/types/sla.ts` (add RecalculationRequest, RecalculationResult types)

**Implementation details:**
1. Create `useSLARecalculation` hook with:
   - `recalculate()` function that calls `POST /api/sla/recalculate`
   - `loading`, `error`, `result` state
   - Uses TanStack Query mutation pattern (Pattern #17)

2. Create helper functions in `recalculation-helpers.ts`:
   - `getDefaultDateRange()` - Returns { startDate: 30 days ago, endDate: now }
   - `validateDateRange(start, end)` - Validates dates are valid and start < end
   - `estimateChatCount(start, end)` - Rough estimate based on date range
   - `formatRecalculationResult(result)` - Formats result for display

3. Add TypeScript types:
```typescript
export interface RecalculationRequest {
  startDate?: string
  endDate?: string
  chatId?: string
  limit?: number
}

export interface RecalculationResult {
  success: boolean
  processed: number
  failed: number
  total: number
  duration: number
  enabledMetrics: {
    pickup: boolean
    firstResponse: boolean
    avgResponse: boolean
    resolution: boolean
  }
  errors?: Array<{
    chatId: string
    error: string
  }>
}

export interface LastRecalculation {
  timestamp: string
  processed: number
  failed: number
  duration: number
}
```

**Tests required:** Yes - Unit tests
- Test `useSLARecalculation` hook with mocked API responses
- Test `getDefaultDateRange()` returns correct 30-day range
- Test `validateDateRange()` catches invalid inputs
- Test `estimateChatCount()` returns reasonable estimates
- Test `formatRecalculationResult()` formats data correctly

**Acceptance criteria:**
- [ ] Hook successfully calls recalculation API with correct parameters
- [ ] Helper functions handle edge cases (invalid dates, null values)
- [ ] Types are properly exported and used throughout
- [ ] All unit tests pass (coverage > 80%)

---

### Chunk 2: Create Confirmation Dialog Component

**Type:** Frontend
**Dependencies:** Chunk 1 must be completed
**Estimated Effort:** Small (0.5 day)

**Files to create:**
- `src/components/settings/sla-recalculation-dialog.tsx`
- `src/components/settings/__tests__/sla-recalculation-dialog.test.tsx`

**Implementation details:**
1. Create dialog component using shadcn/ui Dialog (Pattern #40-41)
2. Include:
   - Clear title: "Recalculate SLA Metrics?"
   - Explanation of what will happen
   - Date range display (start/end dates)
   - Estimated chat count
   - Estimated duration
   - Warning message if high chat count
   - Cancel and Recalculate buttons

3. Props interface:
```typescript
interface SLARecalculationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (request: RecalculationRequest) => void
  request: RecalculationRequest
  loading?: boolean
}
```

4. Use existing shadcn components:
   - `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`
   - `Button` with loading states
   - `Alert` for warnings

**Tests required:** Yes - React Testing Library
- Test dialog renders with correct information
- Test cancel button closes dialog
- Test recalculate button calls onConfirm
- Test loading state disables buttons
- Test warning appears for large date ranges

**Acceptance criteria:**
- [ ] Dialog displays date range and estimated impact clearly
- [ ] Cancel and confirm buttons work correctly
- [ ] Loading state prevents duplicate submissions
- [ ] Component follows existing dialog patterns
- [ ] All component tests pass

---

### Chunk 3: Create Results Display Component

**Type:** Frontend
**Dependencies:** Chunk 1 must be completed
**Estimated Effort:** Small (0.5 day)

**Files to create:**
- `src/components/settings/sla-recalculation-result.tsx`
- `src/components/settings/__tests__/sla-recalculation-result.test.tsx`

**Implementation details:**
1. Create two display modes:
   - **Compact mode**: For last recalculation info (timestamp + summary)
   - **Detailed mode**: For current operation results (full breakdown)

2. Compact mode shows:
   - "Last recalculation: X hours/days ago"
   - "Processed X chats, Y failed"
   - Small badge/icon indicating success/partial

3. Detailed mode shows (in Alert component):
   - Success: Green alert with checkmark, summary stats
   - Partial success: Yellow alert with warning, stats + error list
   - Failure: Red alert with X icon, error message

4. Props interface:
```typescript
interface SLARecalculationResultProps {
  result: RecalculationResult | null
  lastRecalculation?: LastRecalculation | null
  mode: 'compact' | 'detailed'
  onDismiss?: () => void
}
```

5. Use components:
   - `Alert`, `AlertTitle`, `AlertDescription` for detailed results
   - `Badge` for compact mode status
   - `Button` for dismiss action
   - Lucide icons: `CheckCircle2`, `AlertTriangle`, `XCircle`, `Clock`

**Tests required:** Yes - React Testing Library
- Test compact mode renders last recalculation info
- Test detailed mode shows success alert correctly
- Test detailed mode shows error list for failures
- Test dismiss button works
- Test renders nothing when no data

**Acceptance criteria:**
- [ ] Compact mode displays concise summary
- [ ] Detailed mode shows all relevant information
- [ ] Error details are clearly visible
- [ ] Component is accessible (ARIA labels)
- [ ] All component tests pass

---

### Chunk 4: Add Advanced Options Collapsible Section

**Type:** Frontend
**Dependencies:** Chunk 1 must be completed
**Estimated Effort:** Small (1 day)

**Files to create:**
- `src/components/settings/sla-recalculation-advanced.tsx`
- `src/components/settings/__tests__/sla-recalculation-advanced.test.tsx`

**Implementation details:**
1. Create collapsible section (Pattern #40-41) using shadcn Collapsible
2. Include form fields:
   - Start Date: Date picker (shadcn Calendar)
   - End Date: Date picker
   - Max Chats: Number input (1-10000 range)
   - Estimated count display
   - Validation error messages

3. Form state management:
   - Uses React Hook Form (Pattern #39)
   - Zod schema for validation
   - Default values from `getDefaultDateRange()`

4. Validation rules:
   - Start date must be before end date
   - Date range max 1 year
   - Max chats between 1-10000
   - Display helpful error messages

5. Props interface:
```typescript
interface SLARecalculationAdvancedProps {
  defaultRequest: RecalculationRequest
  onRequestChange: (request: RecalculationRequest) => void
  disabled?: boolean
}
```

**Tests required:** Yes - React Testing Library
- Test collapsible opens/closes correctly
- Test date pickers update request
- Test validation catches invalid ranges
- Test max chats input respects limits
- Test disabled state works

**Acceptance criteria:**
- [ ] Collapsible section follows existing UI patterns
- [ ] Date pickers work correctly with timezone handling
- [ ] Form validation provides clear feedback
- [ ] Changes update parent component state
- [ ] All form tests pass

---

### Chunk 5: Integrate into SLA Settings Page

**Type:** Frontend
**Dependencies:** Chunks 1, 2, 3, 4 must be completed
**Estimated Effort:** Medium (1 day)

**Files to modify:**
- `src/components/settings/sla-settings-section.tsx`
- `src/hooks/use-sla-settings.ts`

**Implementation details:**
1. Add new "SLA Maintenance" section to settings page after action buttons
2. Section includes:
   - Heading: "SLA Maintenance" with wrench icon
   - Description: "Recalculate SLA metrics to apply configuration changes to existing chats."
   - Warning alert if form has unsaved changes (`isDirty`)
   - Last recalculation display (compact mode)
   - "Recalculate Last 30 Days" button
   - Advanced options collapsible
   - Results display (detailed mode) when operation completes

3. Add state management:
```typescript
const [showDialog, setShowDialog] = useState(false)
const [request, setRequest] = useState<RecalculationRequest>(getDefaultDateRange())
const [lastResult, setLastResult] = useState<RecalculationResult | null>(null)
const [lastRecalculation, setLastRecalculation] = useState<LastRecalculation | null>(null)

const { recalculate, loading: recalculating } = useSLARecalculation()
```

4. Add handlers:
```typescript
const handleQuickRecalculate = () => {
  setRequest(getDefaultDateRange())
  setShowDialog(true)
}

const handleAdvancedRecalculate = (customRequest: RecalculationRequest) => {
  setRequest(customRequest)
  setShowDialog(true)
}

const handleConfirmRecalculation = async () => {
  const result = await recalculate(request)
  if (result.success) {
    toast.success(`Successfully recalculated ${result.processed} chats`)
    setLastRecalculation({
      timestamp: new Date().toISOString(),
      processed: result.processed,
      failed: result.failed,
      duration: result.duration
    })
    // Store in localStorage for persistence
    localStorage.setItem('lastSLARecalculation', JSON.stringify(lastRecalculation))
  }
  setLastResult(result)
  setShowDialog(false)
}
```

5. Load last recalculation from localStorage on mount:
```typescript
useEffect(() => {
  const stored = localStorage.getItem('lastSLARecalculation')
  if (stored) {
    try {
      setLastRecalculation(JSON.parse(stored))
    } catch (e) {
      // Ignore invalid stored data
    }
  }
}, [])
```

6. UI layout structure:
```tsx
{/* Existing settings sections */}

<Separator className="my-6" />

{/* NEW: SLA Maintenance Section */}
<div className="space-y-4">
  <div className="flex items-center gap-2">
    <Wrench className="h-5 w-5" />
    <h3 className="text-lg font-semibold">SLA Maintenance</h3>
  </div>

  <p className="text-sm text-muted-foreground">
    Recalculate SLA metrics to apply configuration changes to existing chats.
  </p>

  {isDirty && (
    <Alert variant="warning">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Unsaved Changes</AlertTitle>
      <AlertDescription>
        Save your configuration changes first to recalculate with the new settings.
      </AlertDescription>
    </Alert>
  )}

  {lastRecalculation && (
    <SLARecalculationResult
      lastRecalculation={lastRecalculation}
      mode="compact"
    />
  )}

  <div className="flex items-center gap-4">
    <Button
      type="button"
      variant="outline"
      onClick={handleQuickRecalculate}
      disabled={isDirty || recalculating}
    >
      {recalculating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Recalculating...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          Recalculate Last 30 Days
        </>
      )}
    </Button>
  </div>

  <SLARecalculationAdvanced
    defaultRequest={request}
    onRequestChange={setRequest}
    disabled={isDirty || recalculating}
  />

  {lastResult && (
    <SLARecalculationResult
      result={lastResult}
      mode="detailed"
      onDismiss={() => setLastResult(null)}
    />
  )}
</div>

<SLARecalculationDialog
  open={showDialog}
  onOpenChange={setShowDialog}
  onConfirm={handleConfirmRecalculation}
  request={request}
  loading={recalculating}
/>
```

**Tests required:** Yes - Integration tests
- Test maintenance section renders correctly
- Test unsaved changes warning appears when form is dirty
- Test quick recalculate button opens dialog
- Test advanced options modify request correctly
- Test successful recalculation shows result and updates last recalculation
- Test failed recalculation shows error details
- Test last recalculation persists across page reloads

**Acceptance criteria:**
- [ ] Maintenance section is visually separated from settings
- [ ] Unsaved changes warning works correctly
- [ ] Quick recalculate uses default 30-day range
- [ ] Advanced options allow custom date ranges
- [ ] Results display properly after operation
- [ ] Last recalculation persists in localStorage
- [ ] All integration tests pass

---

### Chunk 6: Add Permission and Rate Limiting Checks

**Type:** Backend
**Dependencies:** None (parallel with frontend chunks)
**Estimated Effort:** Small (0.5 day)

**Files to modify:**
- `src/app/api/sla/recalculate/route.ts`

**Implementation details:**
1. Add Admin role check (Pattern #16, #30):
```typescript
const { userId, sessionClaims } = await auth()
if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const userRole = sessionClaims?.metadata?.role
if (userRole !== 'admin') {
  return NextResponse.json(
    { error: 'Forbidden: Admin role required for SLA recalculation' },
    { status: 403 }
  )
}
```

2. Add rate limiting (Pattern #57):
```typescript
// Add to rate-limit.ts config
export const RATE_LIMIT_CONFIGS = {
  // ... existing configs
  recalculate: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 recalculations per hour per user
  },
}

// In route.ts
const rateLimitResult = await checkRateLimit(userId, 'recalculate')
if (!rateLimitResult.allowed) {
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      retryAfter: rateLimitResult.retryAfter
    },
    {
      status: 429,
      headers: {
        'Retry-After': rateLimitResult.retryAfter.toString(),
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': '0',
      }
    }
  )
}
```

3. Add audit logging (Pattern #36):
```typescript
await auditLogger.log({
  event: 'SLA_RECALCULATION_STARTED',
  userId,
  severity: 'MEDIUM',
  metadata: {
    startDate: request.startDate,
    endDate: request.endDate,
    limit: request.limit,
    estimatedChats: estimatedCount,
  },
  correlationId: headers.get('x-correlation-id'),
})

// After processing
await auditLogger.log({
  event: 'SLA_RECALCULATION_COMPLETED',
  userId,
  severity: result.failed > 0 ? 'HIGH' : 'LOW',
  metadata: {
    processed: result.processed,
    failed: result.failed,
    duration: result.duration,
    errorCount: result.errors?.length || 0,
  },
  correlationId: headers.get('x-correlation-id'),
})
```

4. Add parameter validation improvements:
```typescript
// Validate date range
if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
  return NextResponse.json(
    { error: 'Start date must be before end date' },
    { status: 400 }
  )
}

// Validate date range not too large (max 1 year)
if (startDate && endDate) {
  const daysDiff = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  if (daysDiff > 365) {
    return NextResponse.json(
      { error: 'Date range cannot exceed 1 year' },
      { status: 400 }
    )
  }
}

// Validate limit
const limitNum = parseInt(limit || '1000')
if (isNaN(limitNum) || limitNum < 1 || limitNum > 10000) {
  return NextResponse.json(
    { error: 'Limit must be between 1 and 10000' },
    { status: 400 }
  )
}
```

**Tests required:** Yes - API route tests (Pattern #22-23)
- Test 401 returned for unauthenticated requests
- Test 403 returned for non-admin users
- Test 429 returned when rate limit exceeded
- Test 400 returned for invalid parameters
- Test audit logs created for successful/failed operations

**Acceptance criteria:**
- [ ] Only admin users can trigger recalculation
- [ ] Rate limiting prevents abuse (5 per hour)
- [ ] All operations are logged to audit trail
- [ ] Parameter validation provides clear error messages
- [ ] All API tests pass

---

### Chunk 7: Add Progress Estimation and Monitoring

**Type:** Backend
**Dependencies:** Chunk 6 must be completed
**Estimated Effort:** Small (0.5 day)

**Files to modify:**
- `src/app/api/sla/recalculate/route.ts`

**Implementation details:**
1. Add progress callback to provide status updates:
```typescript
interface RecalculationProgress {
  processed: number
  total: number
  currentBatch: number
  totalBatches: number
  estimatedTimeRemaining: number
}

// In route handler
let progress: RecalculationProgress = {
  processed: 0,
  total: chatsToProcess.length,
  currentBatch: 0,
  totalBatches: Math.ceil(chatsToProcess.length / BATCH_SIZE),
  estimatedTimeRemaining: 0,
}

// During batch processing
for (let i = 0; i < chatsToProcess.length; i += BATCH_SIZE) {
  const batchStartTime = Date.now()
  const batch = chatsToProcess.slice(i, i + BATCH_SIZE)

  progress.currentBatch++
  progress.processed = i

  // Log progress for monitoring
  logger.info('SLA recalculation progress', {
    progress,
    userId,
    correlationId: headers.get('x-correlation-id'),
  })

  // Process batch...

  // Update estimated time
  const batchDuration = Date.now() - batchStartTime
  const avgTimePerBatch = batchDuration // Can calculate average across all batches
  progress.estimatedTimeRemaining = avgTimePerBatch * (progress.totalBatches - progress.currentBatch)
}
```

2. Add error recovery and partial success handling:
```typescript
const errors: Array<{ chatId: string; error: string }> = []
let processed = 0
let failed = 0

for (const chat of batch) {
  try {
    // Calculate and update SLA metrics
    await updateChatSLAMetrics(chat)
    processed++
  } catch (error) {
    failed++
    errors.push({
      chatId: chat.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    logger.error('Failed to recalculate SLA for chat', {
      chatId: chat.id,
      error: error instanceof Error ? error.message : error,
      userId,
    })
    // Continue processing other chats (error-tolerant)
  }
}

// Return result with errors
return NextResponse.json({
  success: failed === 0,
  processed,
  failed,
  total: chatsToProcess.length,
  duration: Date.now() - startTime,
  enabledMetrics,
  errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limit to 10 errors
})
```

3. Add database transaction for atomic batch updates:
```typescript
await prisma.$transaction(
  batch.map(chat => {
    const metrics = calculateAllSLAMetricsWithBusinessHours(/* ... */)
    return prisma.chat.update({
      where: { id: chat.id },
      data: {
        timeToPickup: metrics.timeToPickup,
        firstResponseTime: metrics.firstResponseTime,
        // ... all other SLA fields
      },
    })
  })
)
```

**Tests required:** Yes - API route tests
- Test progress is logged during processing
- Test partial success returns correct counts
- Test errors are captured and returned
- Test batch processing completes with mixed success/failure
- Test transaction rollback on database errors

**Acceptance criteria:**
- [ ] Progress is logged for monitoring
- [ ] Errors are captured without stopping processing
- [ ] Partial success returns detailed error information
- [ ] Database updates are atomic per batch
- [ ] All tests pass

---

### Chunk 8: Documentation and Help Text

**Type:** Documentation
**Dependencies:** All implementation chunks completed
**Estimated Effort:** Small (0.5 day)

**Files to create:**
- Update `docs/sla-calculation-guide.md` with recalculation section

**Files to modify:**
- `src/components/settings/sla-settings-section.tsx` (add help text)

**Implementation details:**
1. Add "Recalculation" section to SLA calculation guide:
   - When to recalculate
   - How recalculation works
   - Best practices
   - Troubleshooting common issues

2. Add tooltip/help icons throughout UI:
   - Next to "Recalculate Last 30 Days" button
   - In advanced options section
   - Help text explaining impact

3. Add inline help text:
```tsx
<p className="text-sm text-muted-foreground">
  Recalculation applies your current SLA configuration to existing chats.
  This is useful after changing thresholds, enabling/disabling metrics,
  or modifying priority/channel overrides.
</p>

<Alert>
  <Info className="h-4 w-4" />
  <AlertTitle>When to Recalculate</AlertTitle>
  <AlertDescription>
    • After changing SLA thresholds<br/>
    • After modifying priority or channel overrides<br/>
    • After enabling/disabling metrics<br/>
    • To ensure historical data accuracy
  </AlertDescription>
</Alert>
```

4. Add user guide section for:
   - Understanding recalculation scope
   - Choosing date ranges
   - Interpreting results
   - What to do if errors occur

**Tests required:** No

**Acceptance criteria:**
- [ ] Documentation is clear and comprehensive
- [ ] Help text provides actionable guidance
- [ ] Common questions are answered
- [ ] Examples are included

## Testing Strategy

### Unit Tests
- **When:** During Chunks 1, 2, 3, 4 (immediately after component creation)
- **What to test:**
  - Hook functions (`useSLARecalculation`, `use-sla-settings` extensions)
  - Helper functions (date validation, estimation, formatting)
  - Component rendering and interactions
  - Form validation logic
- **Coverage target:** >80% for all new code

### Integration Tests
- **When:** During Chunk 5 (after UI integration)
- **What to test:**
  - Complete user flow: open settings → recalculate → view results
  - State management across components
  - localStorage persistence
  - Error handling end-to-end
- **Coverage target:** All critical user paths

### API Tests
- **When:** During Chunks 6, 7 (backend changes)
- **What to test:**
  - Authentication and authorization
  - Rate limiting
  - Parameter validation
  - Batch processing
  - Error handling
  - Audit logging
- **Coverage target:** 100% of error cases, >90% overall

### E2E Tests (Optional - Post-Launch)
- Full user journey from login to recalculation completion
- Visual regression testing for new UI sections
- Performance testing for large date ranges

### Manual Testing Checklist
- [ ] Test with no unsaved changes
- [ ] Test with unsaved changes (should warn)
- [ ] Test quick recalculate (30 days)
- [ ] Test custom date range (various ranges)
- [ ] Test with invalid date ranges
- [ ] Test with very large date ranges (365 days)
- [ ] Test success scenario (all chats processed)
- [ ] Test partial failure scenario (some chats failed)
- [ ] Test complete failure scenario
- [ ] Test rate limiting (try 6 times in 1 hour)
- [ ] Test as non-admin user (should fail)
- [ ] Test localStorage persistence across page refresh
- [ ] Test mobile responsive layout

## Database Changes

**No migrations required** - this feature uses existing infrastructure:

- `SystemSetting` table (already exists) - stores SLA configuration
- `Chat` table (already exists) - stores SLA metrics to be updated
- `AuditLog` table (already exists) - stores recalculation operations
- `/api/sla/recalculate` endpoint (already exists) - handles recalculation logic

## API Changes

### No New Endpoints Required

This feature uses the existing endpoint:
- `POST /api/sla/recalculate` (already implemented)

### Modified Endpoint Behavior

**Enhancements to existing endpoint:**

1. **Added Admin Authorization** (Chunk 6):
```typescript
// Before: No explicit admin check
// After: Requires admin role via sessionClaims
if (userRole !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

2. **Added Rate Limiting** (Chunk 6):
```typescript
// Before: No rate limiting
// After: 5 recalculations per hour per user
const rateLimitResult = await checkRateLimit(userId, 'recalculate')
```

3. **Enhanced Parameter Validation** (Chunk 6):
```typescript
// Before: Basic validation
// After: Comprehensive validation
- Start date < end date
- Date range <= 1 year
- Limit between 1-10000
- ISO date format validation
```

4. **Added Audit Logging** (Chunk 6):
```typescript
// Before: Only logs via slaLogger
// After: Also logs to AuditLog table
await auditLogger.log({
  event: 'SLA_RECALCULATION_STARTED',
  // ... metadata
})
```

5. **Enhanced Progress Logging** (Chunk 7):
```typescript
// Before: Minimal logging
// After: Detailed progress logs per batch
logger.info('SLA recalculation progress', { progress, ... })
```

6. **Improved Error Handling** (Chunk 7):
```typescript
// Before: Fails on first error
// After: Continues processing, returns partial success
return {
  success: failed === 0,
  processed: 123,
  failed: 4,
  errors: [/* up to 10 errors */]
}
```

## Integration Points

### Services Affected

1. **SLA Settings UI** (`src/components/settings/sla-settings-section.tsx`):
   - **Impact:** Adds new maintenance section
   - **Integration:** New section appears below existing settings
   - **Data flow:** Reads saved config, triggers recalculation, displays results

2. **SLA Configuration API** (`/api/settings/sla`):
   - **Impact:** None - read-only access
   - **Integration:** Recalculation reads config from this API
   - **Data flow:** Config → Recalculation API

3. **SLA Recalculation API** (`/api/sla/recalculate`):
   - **Impact:** Enhanced with new validations and logging
   - **Integration:** Called by new UI components
   - **Data flow:** UI → API → Database → UI (results)

4. **Audit System** (`src/lib/audit/audit.ts`):
   - **Impact:** New event types added
   - **Integration:** Logs all recalculation operations
   - **Data flow:** API → AuditLogger → Database

5. **Rate Limiting System** (`src/lib/security/rate-limit.ts`):
   - **Impact:** New rate limit config for recalculation
   - **Integration:** Protects recalculation endpoint
   - **Data flow:** API → Rate Limiter → Allow/Deny

6. **Toast Notification System**:
   - **Impact:** None - uses existing toast API
   - **Integration:** Shows success/error messages
   - **Data flow:** API result → Toast display

### External Systems

**None** - this is a purely internal feature with no external API dependencies.

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  User Actions                                            │
├─────────────────────────────────────────────────────────┤
│  1. User opens SLA Settings                             │
│  2. User saves configuration changes                     │
│  3. User clicks "Recalculate Last 30 Days"              │
│  4. User configures advanced options (optional)         │
│  5. User confirms recalculation in dialog               │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  Frontend Processing                                     │
├─────────────────────────────────────────────────────────┤
│  • Generate RecalculationRequest object                 │
│  • Validate date range (client-side)                    │
│  • Show confirmation dialog                             │
│  • Set loading state                                    │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  API Request (POST /api/sla/recalculate)                │
├─────────────────────────────────────────────────────────┤
│  • Authenticate user (Clerk)                            │
│  • Check admin role                                     │
│  • Check rate limit (5/hour)                            │
│  • Validate parameters                                  │
│  • Log to audit trail (STARTED)                         │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  Database Operations                                     │
├─────────────────────────────────────────────────────────┤
│  • Load SLA config from SystemSetting                   │
│  • Load office hours config                             │
│  • Load enabled metrics flags                           │
│  • Query chats in date range                            │
│  • Process in batches (100 per batch)                   │
│  • For each chat:                                       │
│    - Calculate SLA metrics                              │
│    - Update chat record                                 │
│    - Log calculation (SLA logger)                       │
│  • Track errors (continue on failure)                   │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  Response Processing                                     │
├─────────────────────────────────────────────────────────┤
│  • Log to audit trail (COMPLETED)                       │
│  • Return RecalculationResult                           │
│    - processed count                                    │
│    - failed count                                       │
│    - duration                                           │
│    - enabled metrics                                    │
│    - error list (if any)                                │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  UI Updates                                             │
├─────────────────────────────────────────────────────────┤
│  • Show success toast / error alert                     │
│  • Display detailed results                             │
│  • Update last recalculation info                       │
│  • Save to localStorage                                 │
│  • Clear loading state                                  │
└─────────────────────────────────────────────────────────┘
```

## Rollback Plan

### Feature Removal

If this feature needs to be rolled back:

1. **Frontend Rollback** (Low Risk):
   ```bash
   # Revert src/components/settings/sla-settings-section.tsx
   git revert <commit-hash>

   # Remove new files
   rm src/components/settings/sla-recalculation-*.tsx
   rm src/hooks/use-sla-recalculation.ts
   rm src/lib/sla/recalculation-helpers.ts
   ```

2. **Backend Rollback** (Medium Risk):
   ```bash
   # Revert API changes to restore original validation
   git revert <commit-hash>

   # Remove rate limit config for recalculation
   # Edit src/lib/security/rate-limit.ts manually
   ```

3. **No Database Rollback Required**:
   - No new tables or columns created
   - No data migrations performed
   - Existing SLA calculations remain valid
   - Audit logs preserved for compliance

### Rollback Impact Assessment

| Component | Risk | Impact | Recovery Time |
|-----------|------|--------|---------------|
| UI Components | Low | Users lose recalculation button | < 1 hour |
| API Enhancements | Low | Reverts to original validation | < 1 hour |
| Rate Limiting | Low | Removes rate limit protection | < 30 min |
| Audit Logs | None | Historical logs preserved | N/A |
| SLA Calculations | None | No change to calculation logic | N/A |

### Rollback Procedure

1. **Immediate actions** (if critical bug found):
   - Comment out maintenance section in UI (1-line change)
   - Deploy emergency hotfix
   - Investigate issue

2. **Full rollback** (if feature is problematic):
   - Revert frontend changes (Chunks 1-5)
   - Revert backend changes (Chunks 6-7)
   - Test existing SLA functionality still works
   - Deploy

3. **Partial rollback** (if only UI is problematic):
   - Revert only frontend changes
   - Keep backend enhancements (improved validation, logging)
   - Users can still use API directly if needed

### Feature Flag Consideration

**Recommendation:** Add feature flag for easier rollback:

```typescript
// In .env
ENABLE_SLA_RECALCULATION_UI=true

// In sla-settings-section.tsx
const showRecalculationUI = process.env.NEXT_PUBLIC_ENABLE_SLA_RECALCULATION_UI === 'true'

{showRecalculationUI && (
  <div>
    {/* Maintenance section */}
  </div>
)}
```

This allows instant disable without code deployment.

## Database Rollback Procedures

**Not applicable** - no database changes made by this feature.

## Feature Flag Considerations

### Recommended Feature Flag

```typescript
// Environment variable
NEXT_PUBLIC_ENABLE_SLA_RECALCULATION_UI=true

// Usage in code
const isRecalculationEnabled = process.env.NEXT_PUBLIC_ENABLE_SLA_RECALCULATION_UI === 'true'

// Conditionally render
{isRecalculationEnabled && <SLAMaintenanceSection />}
```

### Benefits
- Instant enable/disable without deployment
- Safe rollout to beta users first
- Easy A/B testing
- Emergency kill switch

### Feature Flag Lifecycle
1. **Development:** Flag always on
2. **Staging:** Flag always on for testing
3. **Production (Week 1):** Flag off, enable for admins only
4. **Production (Week 2-3):** Flag on, monitor for issues
5. **Production (Week 4+):** Remove flag, feature fully released

## Documentation Updates

### Documentation to Create

1. **Feature Documentation** (this file):
   - ✅ `features/feature-012-sla-recalculation-ui.md`

2. **User Guide** (Chunk 8):
   - Update `docs/sla-calculation-guide.md`
   - Add "Recalculation" section
   - Include screenshots (post-implementation)

3. **API Documentation** (Chunk 6):
   - Update API reference for enhanced `/api/sla/recalculate` endpoint
   - Document new validations and rate limits
   - Include example requests/responses

### Documentation to Update

1. **README.md**:
   - Add SLA Recalculation to features list
   - Update "Admin Features" section

2. **CHANGELOG.md**:
   - Add entry for Feature 012
   - List all changes and improvements

3. **Admin Guide** (if exists):
   - Add section on SLA maintenance
   - Best practices for recalculation timing

### Documentation Sections to Add

**In docs/sla-calculation-guide.md:**

```markdown
## SLA Recalculation

### When to Recalculate

Recalculation is necessary when:
- SLA thresholds are changed (pickup time, first response time, etc.)
- Priority overrides are added, modified, or removed
- Channel overrides are added, modified, or removed
- Metrics are enabled or disabled
- Business hours configuration changes

### How Recalculation Works

1. Reads current SLA configuration from database
2. Queries chats in specified date range
3. Processes chats in batches of 100
4. For each chat:
   - Recalculates all enabled SLA metrics
   - Applies new thresholds and overrides
   - Updates chat record with new values
   - Logs calculation for audit trail
5. Returns summary with processed/failed counts

### Best Practices

- **Save configuration first:** Always save changes before recalculating
- **Start with small ranges:** Test with 7-day range before larger periods
- **Monitor results:** Check for errors in the results display
- **Off-peak hours:** Run large recalculations during low-traffic times
- **Incremental approach:** Recalculate in smaller date ranges if large operations fail

### Troubleshooting

**Problem:** Recalculation button is disabled
- **Solution:** Save configuration changes first, or clear unsaved changes

**Problem:** Rate limit error (429)
- **Solution:** Wait 1 hour between recalculation attempts (max 5 per hour)

**Problem:** Some chats failed to recalculate
- **Solution:** Check error details in results. Common causes:
  - Missing message data
  - Invalid timestamps
  - Database constraints
- **Action:** Retry for failed chats or investigate data issues

**Problem:** Large date range times out
- **Solution:** Break into smaller ranges (e.g., 30-day increments)
```

## Success Criteria

### Feature Complete When

- [ ] All 8 implementation chunks completed and tested
- [ ] All unit tests passing (>80% coverage)
- [ ] All integration tests passing
- [ ] All API tests passing (>90% coverage)
- [ ] Manual testing checklist completed
- [ ] Documentation updated and reviewed
- [ ] Code reviewed by peer
- [ ] Feature flag implemented and tested
- [ ] Staging deployment successful
- [ ] Production deployment planned

### User Acceptance Criteria

- [ ] Admin users can access recalculation functionality
- [ ] Non-admin users cannot trigger recalculation
- [ ] Unsaved config changes trigger warning
- [ ] Quick recalculate (30 days) works with one click
- [ ] Advanced options allow custom date ranges
- [ ] Confirmation dialog explains impact clearly
- [ ] Loading state shows during processing
- [ ] Success notification appears with summary
- [ ] Error details are visible if failures occur
- [ ] Last recalculation info persists across sessions

### Performance Criteria

- [ ] Recalculation completes in <30 seconds for 1000 chats
- [ ] UI remains responsive during operation
- [ ] No memory leaks in long-running recalculations
- [ ] Batch processing prevents database overload
- [ ] Rate limiting prevents abuse

### Quality Criteria

- [ ] Code follows project conventions (Pattern #1-65)
- [ ] TypeScript types are comprehensive
- [ ] Error handling is robust
- [ ] Logging provides troubleshooting information
- [ ] UI is accessible (ARIA, keyboard navigation)
- [ ] Mobile responsive design
- [ ] Consistent with existing settings UI

## Metrics & Validation

### Success Metrics (Post-Launch)

Track these metrics after feature launch:

1. **Adoption Rate**:
   - % of admins who use recalculation feature within 30 days
   - Target: >50%

2. **Usage Frequency**:
   - Number of recalculations per week
   - Target: 2-5 per week (indicates active config management)

3. **Success Rate**:
   - % of recalculations that complete without errors
   - Target: >95%

4. **User Satisfaction**:
   - Survey admin users on feature usefulness
   - Target: 4/5 stars or higher

5. **Support Ticket Reduction**:
   - Reduction in tickets related to "SLA not updating"
   - Target: -50% in 60 days

### Validation Criteria

**Technical Validation:**
- [ ] All tests green in CI/CD pipeline
- [ ] No TypeScript compilation errors
- [ ] No console errors in browser
- [ ] Lighthouse score >90 (no performance regression)
- [ ] No security vulnerabilities reported

**User Validation:**
- [ ] Feature walkthrough with product owner
- [ ] Beta test with 2-3 admin users
- [ ] User feedback collected and incorporated
- [ ] Help documentation tested with real users

**Data Validation:**
- [ ] Recalculated values match expected results
- [ ] Audit logs contain complete information
- [ ] No data corruption or loss
- [ ] Database performance remains stable

## Risk Assessment

### High Risk Areas

1. **Database Performance** (Medium Risk):
   - **Risk:** Large recalculations could slow database
   - **Mitigation:**
     - Batch processing (100 chats per batch)
     - Limit max chats to 10,000
     - Recommend off-peak hours for large operations
     - Add database indexes if needed
   - **Monitoring:** Track query performance in logs

2. **Rate Limiting Bypass** (Low Risk):
   - **Risk:** Users could bypass rate limits with multiple accounts
   - **Mitigation:**
     - Admin-only feature (limited user base)
     - Audit logging tracks all operations
     - IP-based rate limiting as backup
   - **Monitoring:** Review audit logs weekly

3. **Incomplete Recalculation** (Medium Risk):
   - **Risk:** Partial failure leaves some chats with old values
   - **Mitigation:**
     - Error-tolerant processing (continues on failure)
     - Return detailed error list
     - Allow retry for specific date ranges
     - Provide chat ID list for manual investigation
   - **Monitoring:** Track failure rate in metrics

### Low Risk Areas

1. **UI Bugs** (Low Risk):
   - **Risk:** Visual glitches or broken interactions
   - **Mitigation:**
     - Comprehensive component tests
     - Manual testing checklist
     - Feature flag for easy disable
   - **Monitoring:** User feedback, Sentry error tracking

2. **Documentation Gaps** (Low Risk):
   - **Risk:** Users don't understand how to use feature
   - **Mitigation:**
     - Inline help text in UI
     - Comprehensive user guide
     - Tooltips on complex options
   - **Monitoring:** Support ticket volume

### Risk Mitigation Summary

| Risk | Probability | Impact | Mitigation | Owner |
|------|------------|--------|------------|-------|
| Database slowdown | Medium | High | Batch processing, limits | Backend Dev |
| Rate limit bypass | Low | Medium | Admin-only, audit logs | Security |
| Partial failure | Medium | Medium | Error tolerance, retry | Backend Dev |
| UI bugs | Low | Low | Testing, feature flag | Frontend Dev |
| Doc gaps | Low | Low | Help text, guides | Tech Writer |

## Implementation Timeline

### Estimated Timeline: 4.5 days (1 week with testing/review)

**Day 1:**
- Chunk 1: Recalculation hook and types (0.5 day)
- Chunk 2: Confirmation dialog component (0.5 day)

**Day 2:**
- Chunk 3: Results display component (0.5 day)
- Chunk 4: Advanced options section (1 day, partially complete)

**Day 3:**
- Chunk 4: Advanced options (complete)
- Chunk 5: Integration into settings page (1 day, partially complete)

**Day 4:**
- Chunk 5: Integration (complete)
- Chunk 6: Backend permissions and rate limiting (0.5 day)
- Chunk 7: Progress monitoring (0.5 day)

**Day 5:**
- Chunk 8: Documentation (0.5 day)
- Testing and bug fixes (0.5 day)
- Code review and deployment (remainder)

### Parallel Development Opportunities

**Can develop in parallel:**
- Chunks 1-4 (all frontend components)
- Chunks 6-7 (backend enhancements)
- Chunk 8 (documentation)

**Must be sequential:**
- Chunk 5 depends on Chunks 1-4 (requires all components)
- Testing depends on all implementation chunks

**Recommended approach:**
1. Start frontend (Chunks 1-4) and backend (Chunks 6-7) simultaneously
2. Different developers can work on each chunk in parallel
3. Integrate (Chunk 5) after all components ready
4. Final polish and documentation (Chunk 8)

### Resource Requirements

- **Frontend Developer:** 2.5 days (Chunks 1-5)
- **Backend Developer:** 1 day (Chunks 6-7)
- **Tech Writer:** 0.5 day (Chunk 8)
- **QA Engineer:** 1 day (testing all chunks)
- **Code Reviewer:** 0.5 day (review all code)

**Total effort:** ~5.5 person-days

## Dependencies

### Internal Dependencies

1. **Existing SLA Recalculation API** (Required):
   - `POST /api/sla/recalculate` must be functional
   - Located at: `src/app/api/sla/recalculate/route.ts`
   - Status: ✅ Already implemented

2. **SLA Settings Page** (Required):
   - Base settings UI must exist
   - Located at: `src/components/settings/sla-settings-section.tsx`
   - Status: ✅ Already implemented

3. **Toast Notification System** (Required):
   - For success/error messages
   - Status: ✅ Part of shadcn/ui setup

4. **Audit Logging System** (Required):
   - `AuditLogger` for tracking operations
   - Located at: `src/lib/audit/audit.ts`
   - Status: ✅ Already implemented

5. **Rate Limiting System** (Required):
   - `checkRateLimit()` function
   - Located at: `src/lib/security/rate-limit.ts`
   - Status: ✅ Already implemented

### External Dependencies

**None** - all dependencies are internal to the B2Chat Analytics application.

### Library Dependencies

**No new libraries required** - uses existing dependencies:

- ✅ `@tanstack/react-query` (data fetching)
- ✅ `react-hook-form` (form management)
- ✅ `zod` (validation)
- ✅ `date-fns` (date manipulation)
- ✅ `lucide-react` (icons)
- ✅ `shadcn/ui` components (Dialog, Alert, Button, etc.)

### Version Requirements

**Compatible with:**
- ✅ Next.js 15
- ✅ React 18+
- ✅ TypeScript 5+
- ✅ Node.js 18+

---

## Implementation Notes

### Key Design Decisions

1. **Maintenance Section Location**: Decided to place recalculation UI in separate "SLA Maintenance" section below settings rather than inline with action buttons to:
   - Clearly separate configuration from maintenance actions
   - Provide space for future maintenance features
   - Reduce cognitive load on settings form

2. **Confirmation Dialog**: Required for all recalculations (even quick 30-day) to:
   - Prevent accidental clicks
   - Educate users about impact
   - Build trust through transparency

3. **localStorage for Last Recalculation**: Chose client-side storage over database because:
   - Personal preference, not business data
   - Reduces API calls
   - Acceptable if lost (not critical)
   - Simple implementation

4. **Advanced Options as Collapsible**: Keeps UI simple for 80% of users (quick recalculate) while providing power features for advanced users

5. **Error Tolerance**: Continue processing on errors rather than fail-fast because:
   - Better user experience (partial success > complete failure)
   - Isolated errors shouldn't block batch
   - Users can retry failed chats specifically

### Technical Constraints

1. **Rate Limiting**: 5 recalculations per hour prevents database overload but may frustrate users during initial config. Consider increasing to 10/hour.

2. **Batch Size**: 100 chats per batch balances performance and transaction size. May need tuning based on server capacity.

3. **Max Date Range**: 1 year limit prevents extreme operations. Users must run multiple operations for longer periods.

4. **Admin-Only**: Non-admin users cannot recalculate, even for their own team's chats. This prevents confusion but may require delegation in large orgs.

### Future Enhancements

**Phase 2 (Future):**
- Schedule automatic recalculations (cron job)
- Recalculate specific chat IDs from CSV upload
- Export recalculation results to CSV
- Real-time progress bar (WebSocket updates)
- Email notification when large recalculation completes
- Undo last recalculation (restore previous values)
- Recalculation history with filterable log

**Not in scope for this feature:**
- Bulk operations from chat view (recalculate selected chats)
- Automated recalculation on config save
- Recalculation preview (show impact before committing)

---

## Appendix

### Related Features

- Feature 011: Chat View Enhanced Filters and Columns
- Feature 0XX: SLA Configuration Management (if exists)
- Feature 0XX: Audit Log Viewer (if exists)

### Reference Documents

- `docs/sla-calculation-guide.md` - SLA calculation logic
- `b2chat-analytics/hypr-framework/context/planning-agent.md` - Planning patterns
- `b2chat-analytics/hypr-framework/context/frontend-agent.md` - Frontend patterns
- `b2chat-analytics/hypr-framework/context/backend-agent.md` - Backend patterns

### Code Examples

**Example useSLARecalculation Hook:**
```typescript
export function useSLARecalculation() {
  const [result, setResult] = useState<RecalculationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const recalculate = useCallback(async (request: RecalculationRequest) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (request.startDate) params.set('startDate', request.startDate)
      if (request.endDate) params.set('endDate', request.endDate)
      if (request.chatId) params.set('chatId', request.chatId)
      if (request.limit) params.set('limit', request.limit.toString())

      const response = await fetch(`/api/sla/recalculate?${params}`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`Recalculation failed: ${response.statusText}`)
      }

      const data: RecalculationResult = await response.json()
      setResult(data)
      return data
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  return { recalculate, result, loading, error }
}
```

---

**Document Version:** 1.0
**Created:** 2025-10-29
**Last Updated:** 2025-10-29
**Status:** Ready for Implementation
**Approved By:** Pending
