# Feature 008: Configurable SLA Metrics

## Requirements

### Original User Requirements
- Enable selection of which SLA metrics determine overall SLA compliance
- Allow toggling metrics on/off through the UI
- Initially evaluate SLA based on **Pickup Time** and **First Response Time** only
- Support gradual rollout: add **Average Response Time** as the team matures
- Add **Average Response Time** configuration to the UI (currently missing)
- All metrics should still be calculated, but only enabled metrics affect overall SLA compliance

### Acceptance Criteria
- [ ] Admin can enable/disable individual SLA metrics (Pickup, First Response, Average Response, Resolution)
- [ ] Only enabled metrics determine if `overallSLA` and `overallSLABH` flags are true/false
- [ ] Default configuration has only Pickup and First Response enabled
- [ ] Average Response Time thresholds and targets are visible and configurable in UI
- [ ] All four metrics are always calculated regardless of enabled state
- [ ] Disabled metrics display in UI but don't affect compliance
- [ ] Configuration persists to database and applies to all new SLA calculations
- [ ] Existing SLA data can be recalculated with new enabled metrics configuration

## Architecture Design

### How This Feature Fits Into Existing Patterns

This feature extends the existing SLA configuration system without breaking existing functionality:

1. **Leverages Existing SLA Config System**: Uses the same `SystemSetting` table and `sla-config.ts` patterns (pattern #61, #62 from planning-agent.md)

2. **Follows SLA Calculation Flow**: Modifies existing calculation logic in `sla-calculator.ts` and `sla-calculator-full.ts` to check enabled metrics before determining overall compliance

3. **Extends Existing UI Configuration**: Builds on the current `sla-settings-section.tsx` component with additional toggle controls

4. **Maintains Dual-Mode Support**: Continues supporting both wall-clock and business hours calculations with independent enabled metric checks

### Components/Services to Create/Modify

**New Components:**
- None (extending existing components)

**Modified Components:**
1. `src/types/sla.ts` - Add `enabledMetrics` to SLA configuration schema
2. `src/lib/config/sla-config.ts` - Add enabled metrics to config management
3. `src/lib/sla/sla-calculator.ts` - Update `calculateOverallSLA` to check enabled metrics
4. `src/lib/sla/sla-calculator-full.ts` - Update both wall-clock and business hours compliance logic
5. `src/components/settings/sla-settings-section.tsx` - Add metric toggles and Average Response fields
6. `src/app/api/settings/sla/route.ts` - Handle enabled metrics in GET/PUT operations

### Integration Points with Existing Systems

1. **SLA Calculation Engine**: Core integration point - `calculateSLA()` function must respect enabled metrics
2. **SLA Metrics Dashboard**: Display should indicate which metrics are enabled/disabled
3. **SLA Recalculation API**: `/api/sla/recalculate` must use current enabled metrics config
4. **SLA Config API**: `/api/settings/sla` stores and retrieves enabled metrics
5. **Database Schema**: Uses existing `SystemSetting` table, no new tables needed

### Database Changes Required

**No migration required** - Using existing `SystemSetting` table with new keys:
- `sla.enabled_pickup` (boolean)
- `sla.enabled_first_response` (boolean)
- `sla.enabled_avg_response` (boolean)
- `sla.enabled_resolution` (boolean)

## Implementation Chunks

### Chunk 1: Update SLA Type Definitions
**Type:** Backend
**Dependencies:** None
**Effort:** Small (0.5 day)
**Files to create/modify:**
- `b2chat-analytics/src/types/sla.ts`

**Implementation Details:**
1. Add `EnabledMetrics` interface with four boolean flags
2. Update `SLAConfig` schema to include `enabledMetrics` field
3. Add Zod validation for enabled metrics object
4. Update `DEFAULT_SLA_CONFIG` to enable only pickup and firstResponse by default
5. Export new types for use in other modules

**Tests required:** No - Type definitions only

**Acceptance criteria:**
- [ ] `EnabledMetrics` interface exported with pickup, firstResponse, avgResponse, resolution flags
- [ ] `SLAConfig` includes `enabledMetrics: EnabledMetrics` field
- [ ] Default config has `enabledMetrics: { pickup: true, firstResponse: true, avgResponse: false, resolution: false }`
- [ ] Zod schema validates enabled metrics as boolean values

---

### Chunk 2: Update SLA Config Service
**Type:** Backend
**Dependencies:** Chunk 1
**Effort:** Small (0.5 day)
**Files to create/modify:**
- `b2chat-analytics/src/lib/config/sla-config.ts`

**Implementation Details:**
1. Update `getSLAConfig()` to read enabled metric settings from `SystemSetting` table
2. Update `updateSLAConfig()` to save enabled metric flags
3. Add default values (pickup=true, firstResponse=true, others=false) when settings missing
4. Ensure backward compatibility with existing installations

**Tests required:** Yes - Unit tests
- Test default enabled metrics when no config exists
- Test reading enabled metrics from database
- Test updating enabled metrics
- Test backward compatibility (missing enabled metrics defaults correctly)

**Acceptance criteria:**
- [ ] `getSLAConfig()` returns enabled metrics from database or defaults
- [ ] `updateSLAConfig()` persists enabled metrics to `SystemSetting` table with keys `sla.enabled_*`
- [ ] Missing config defaults to pickup=true, firstResponse=true, rest=false
- [ ] All tests pass

---

### Chunk 3: Update SLA Calculation Logic (Wall-Clock)
**Type:** Backend
**Dependencies:** Chunk 2
**Effort:** Small (1 day)
**Files to create/modify:**
- `b2chat-analytics/src/lib/sla/sla-calculator.ts`

**Implementation Details:**
1. Modify `calculateOverallSLA()` function to accept `enabledMetrics` parameter
2. Filter SLA compliance checks to only include enabled metrics
3. Update logic: `overallSLA = true` if ALL enabled metrics are compliant
4. If a metric is disabled, it doesn't affect overall SLA (skip in evaluation)
5. Update function signature and all call sites

**Tests required:** Yes - Comprehensive unit tests
- Test overall SLA=true when all enabled metrics compliant
- Test overall SLA=false when any enabled metric breaches
- Test disabled metrics don't affect overall SLA
- Test with only pickup enabled
- Test with only firstResponse enabled
- Test with all metrics disabled (edge case)
- Test with all metrics enabled (backward compatibility)

**Acceptance criteria:**
- [ ] `calculateOverallSLA()` accepts `enabledMetrics` parameter
- [ ] Only enabled metrics are checked for compliance
- [ ] Disabled metrics are still calculated but ignored in overall SLA
- [ ] All unit tests pass with 100% coverage for new logic

---

### Chunk 4: Update SLA Calculation Logic (Business Hours)
**Type:** Backend
**Dependencies:** Chunk 3
**Effort:** Small (1 day)
**Files to create/modify:**
- `b2chat-analytics/src/lib/sla/sla-calculator-full.ts`

**Implementation Details:**
1. Update `calculateSLAWithBusinessHours()` to use enabled metrics for both modes
2. Apply enabled metrics filter to wall-clock overall SLA calculation
3. Apply enabled metrics filter to business hours overall SLA calculation
4. Ensure both `overallSLA` and `overallSLABH` respect enabled metrics independently
5. Update all call sites in API routes

**Tests required:** Yes - Comprehensive unit tests
- Test wall-clock overall SLA respects enabled metrics
- Test business hours overall SLA respects enabled metrics
- Test both modes independently (different results possible)
- Test edge cases (all enabled, all disabled, one enabled)

**Acceptance criteria:**
- [ ] `calculateSLAWithBusinessHours()` applies enabled metrics to both wall-clock and business hours
- [ ] `overallSLA` only considers enabled metrics
- [ ] `overallSLABH` only considers enabled metrics
- [ ] All unit tests pass

---

### Chunk 5: Update SLA Settings API
**Type:** Backend
**Dependencies:** Chunk 2
**Effort:** Small (0.5 day)
**Files to create/modify:**
- `b2chat-analytics/src/app/api/settings/sla/route.ts`

**Implementation Details:**
1. Update GET handler to include enabled metrics in response
2. Update PUT handler to validate and save enabled metrics
3. Add validation: at least one metric must be enabled
4. Return 400 if no metrics enabled (prevent invalid config)
5. Follow existing authentication and error handling patterns (pattern #16, #18)

**Tests required:** Yes - API route tests
- Test GET returns enabled metrics
- Test PUT saves enabled metrics
- Test validation: reject if all metrics disabled
- Test validation: accept if at least one enabled
- Test authentication (401 for unauthenticated)

**Acceptance criteria:**
- [ ] GET `/api/settings/sla` includes `enabledMetrics` in response
- [ ] PUT `/api/settings/sla` validates and saves enabled metrics
- [ ] Returns 400 error if all metrics disabled
- [ ] All tests pass

---

### Chunk 6: Add Average Response Time to UI Form
**Type:** Frontend
**Dependencies:** Chunk 5
**Effort:** Small (0.5 day)
**Files to create/modify:**
- `b2chat-analytics/src/components/settings/sla-settings-section.tsx`

**Implementation Details:**
1. Add "Average Response Threshold" input field (1-240 minutes)
2. Add "Average Response Target" input field (0-100%)
3. Position after First Response fields, before Resolution fields
4. Add form validation for both fields
5. Wire up to React Hook Form with proper validation
6. Update form schema to include avgResponse fields

**Tests required:** Yes - Component tests
- Test Average Response fields render
- Test validation (min/max ranges)
- Test form submission includes avgResponse values
- Test reset button clears avgResponse values

**Acceptance criteria:**
- [ ] Average Response Threshold input visible (1-240 min range)
- [ ] Average Response Target input visible (0-100% range)
- [ ] Fields positioned logically in form layout
- [ ] Validation works correctly
- [ ] Component tests pass

---

### Chunk 7: Add Metric Toggle Switches to UI
**Type:** Frontend
**Dependencies:** Chunk 6
**Effort:** Medium (1 day)
**Files to create/modify:**
- `b2chat-analytics/src/components/settings/sla-settings-section.tsx`
- `b2chat-analytics/src/hooks/use-sla-settings.ts`

**Implementation Details:**
1. Add new "Active SLA Metrics" section at top of form
2. Add four toggle switches (using shadcn/ui Switch component):
   - "Pickup Time" (default: enabled)
   - "First Response Time" (default: enabled)
   - "Average Response Time" (default: disabled)
   - "Resolution Time" (default: disabled)
3. Add descriptive text: "Select which metrics determine overall SLA compliance"
4. Add visual indicators (badges showing "Active" or "Inactive")
5. Update form schema to include enabledMetrics object
6. Update `use-sla-settings` hook to handle enabled metrics in API calls
7. Add validation: at least one metric must be enabled (client-side)
8. Show helpful error message if user tries to disable all metrics

**Tests required:** Yes - Component tests
- Test toggles render with correct default states
- Test toggling switches updates form state
- Test validation prevents disabling all metrics
- Test form submission includes enabled metrics
- Test hook correctly sends/receives enabled metrics from API

**Acceptance criteria:**
- [ ] Four toggle switches render in "Active SLA Metrics" section
- [ ] Default state matches requirements (pickup + firstResponse enabled)
- [ ] Toggles are interactive and update form state
- [ ] Visual indicators show active/inactive state clearly
- [ ] Client-side validation prevents all-disabled state
- [ ] Hook integration works correctly
- [ ] All component tests pass

---

### Chunk 8: Update SLA Metrics Display Components
**Type:** Frontend
**Dependencies:** None (parallel with backend chunks)
**Effort:** Small (0.5 day)
**Files to create/modify:**
- `b2chat-analytics/src/components/sla/sla-metrics-overview.tsx`

**Implementation Details:**
1. Fetch enabled metrics from SLA config
2. Add visual indicators next to metric names:
   - Show badge "Active" for enabled metrics
   - Show badge "Inactive" (muted) for disabled metrics
3. Add tooltip explaining that inactive metrics don't affect overall SLA
4. Update metric cards to visually distinguish active vs inactive
5. Maintain all existing functionality

**Tests required:** Yes - Component tests
- Test enabled metrics show "Active" badge
- Test disabled metrics show "Inactive" badge
- Test tooltip content
- Test visual distinction between active/inactive

**Acceptance criteria:**
- [ ] Enabled metrics display "Active" badge
- [ ] Disabled metrics display "Inactive" badge
- [ ] Tooltips explain the difference
- [ ] Visual distinction is clear
- [ ] Component tests pass

---

### Chunk 9: Update SLA Recalculation to Use Enabled Metrics
**Type:** Backend
**Dependencies:** Chunks 3, 4
**Effort:** Small (0.5 day)
**Files to create/modify:**
- `b2chat-analytics/src/app/api/sla/recalculate/route.ts`

**Implementation Details:**
1. Fetch current enabled metrics config at start of recalculation
2. Pass enabled metrics to `calculateSLAWithBusinessHours()` function
3. Ensure all chats are recalculated with current enabled metrics
4. Log which metrics are enabled during recalculation (for audit trail)

**Tests required:** Yes - API route tests
- Test recalculation uses current enabled metrics config
- Test different enabled metric combinations
- Test recalculation updates overallSLA correctly based on enabled metrics

**Acceptance criteria:**
- [ ] Recalculation API fetches current enabled metrics config
- [ ] All chat SLA calculations use current enabled metrics
- [ ] `overallSLA` and `overallSLABH` updated correctly
- [ ] Logging includes which metrics are enabled
- [ ] All tests pass

---

### Chunk 10: Add Migration Documentation
**Type:** Documentation
**Dependencies:** All chunks complete
**Effort:** Small (0.5 day)
**Files to create/modify:**
- `b2chat-analytics/docs/features/feature-008-configurable-sla-metrics.md` (create)

**Implementation Details:**
1. Document the enabled metrics feature
2. Explain default configuration (pickup + firstResponse enabled)
3. Provide instructions for changing enabled metrics via UI
4. Document how to trigger recalculation after changing config
5. Include screenshots of new UI toggles
6. Add troubleshooting section

**Tests required:** No - Documentation only

**Acceptance criteria:**
- [ ] Comprehensive feature documentation created
- [ ] Default configuration documented
- [ ] UI usage instructions clear
- [ ] Recalculation process explained
- [ ] Troubleshooting section included

---

## Testing Strategy

### Unit Tests
**When:** Write alongside each chunk
**What to test:**
- Type validation (Zod schemas)
- SLA config service (get/update enabled metrics)
- SLA calculation logic (wall-clock and business hours with various enabled metric combinations)
- API routes (GET/PUT enabled metrics, validation)
- Form validation (client-side)

**Coverage target:** 100% for new logic, maintain existing coverage

### Integration Tests
**When:** After chunks 1-5 complete (backend), after chunks 6-8 complete (frontend)
**What to test:**
- End-to-end flow: Update enabled metrics → Trigger recalculation → Verify correct compliance
- Cross-service: Config service → Calculation engine → API routes
- Database persistence: Save config → Restart → Load config

### E2E Tests (Playwright)
**When:** After chunk 7 complete
**What to test:**
- Admin navigates to SLA settings page
- Toggles metrics on/off
- Saves configuration
- Views SLA dashboard showing active/inactive indicators
- Triggers recalculation
- Verifies updated compliance in dashboard

### Manual Testing Checklist
- [ ] Toggle all combinations of enabled metrics
- [ ] Verify validation prevents all-disabled state
- [ ] Save configuration and reload page (persistence check)
- [ ] Recalculate SLA with different enabled metric configs
- [ ] View SLA dashboard with various enabled metric combinations
- [ ] Check backward compatibility with existing installations (default to pickup + firstResponse)

---

## Database Changes

### Migrations Needed
**None** - Using existing `SystemSetting` table

### New Settings Keys
Add the following keys to `SystemSetting` table (automatically created on first save):

| Key | Category | Value Type | Default Value |
|-----|----------|------------|---------------|
| `sla.enabled_pickup` | `sla` | `"true"/"false"` | `"true"` |
| `sla.enabled_first_response` | `sla` | `"true"/"false"` | `"true"` |
| `sla.enabled_avg_response` | `sla` | `"true"/"false"` | `"false"` |
| `sla.enabled_resolution` | `sla` | `"true"/"false"` | `"false"` |

### Data Changes
**Recalculation Required:** Existing chats should be recalculated after initial deployment to apply new enabled metrics configuration.

**Backward Compatibility:** Installations without enabled metrics settings will default to pickup + firstResponse enabled only.

---

## API Changes

### Modified Endpoints

#### GET /api/settings/sla
**Changes:** Add `enabledMetrics` to response

**Updated Response:**
```typescript
{
  defaultThresholds: {
    pickup: number;      // minutes
    firstResponse: number;
    avgResponse: number; // NEW - now included in API
    resolution: number;
  },
  complianceTargets: {
    pickup: number;      // percentage
    firstResponse: number;
    avgResponse: number; // NEW - now included in API
    resolution: number;
  },
  enabledMetrics: {     // NEW
    pickup: boolean;
    firstResponse: boolean;
    avgResponse: boolean;
    resolution: boolean;
  },
  channelOverrides: { /* existing */ }
}
```

#### PUT /api/settings/sla
**Changes:** Accept and validate `enabledMetrics` in request body

**Updated Request:**
```typescript
{
  defaultThresholds: { /* existing */ },
  complianceTargets: { /* existing */ },
  enabledMetrics: {     // NEW
    pickup: boolean;
    firstResponse: boolean;
    avgResponse: boolean;
    resolution: boolean;
  },
  channelOverrides: { /* existing */ }
}
```

**New Validation:**
- At least one metric must be enabled (return 400 if all false)
- All boolean values required

#### POST /api/sla/recalculate
**Changes:** Uses current enabled metrics config from database

**No API signature changes** - Internal behavior updated to respect enabled metrics

---

## Integration Points

### Services Affected

1. **SLA Calculation Service** (`lib/sla/`)
   - **Impact:** Core calculation logic modified to check enabled metrics
   - **Change Type:** Internal logic update
   - **Backward Compatible:** Yes (defaults to pickup + firstResponse)

2. **SLA Config Service** (`lib/config/sla-config.ts`)
   - **Impact:** Reads/writes enabled metrics settings
   - **Change Type:** Feature addition
   - **Backward Compatible:** Yes (provides defaults)

3. **SLA Settings UI** (`components/settings/sla-settings-section.tsx`)
   - **Impact:** New toggles and Average Response fields added
   - **Change Type:** UI enhancement
   - **Backward Compatible:** Yes (new fields, existing functionality unchanged)

4. **SLA Metrics Dashboard** (`components/sla/sla-metrics-overview.tsx`)
   - **Impact:** Visual indicators for active/inactive metrics
   - **Change Type:** Display enhancement
   - **Backward Compatible:** Yes (additive only)

5. **SLA Recalculation API** (`app/api/sla/recalculate/route.ts`)
   - **Impact:** Uses enabled metrics during batch recalculation
   - **Change Type:** Internal behavior update
   - **Backward Compatible:** Yes

### External Systems
**None** - This is an internal configuration feature

---

## Rollback Plan

### How to Undo This Feature

1. **Revert Code Changes:**
   - Git revert to commit before feature deployment
   - Redeploy previous version

2. **Database Rollback:**
   - **No migration to rollback** (using existing table)
   - Delete enabled metrics settings (optional):
     ```sql
     DELETE FROM "SystemSetting"
     WHERE category = 'sla'
     AND key LIKE 'sla.enabled_%';
     ```

3. **SLA Recalculation:**
   - After rollback, trigger SLA recalculation to restore previous behavior
   - Run: `POST /api/sla/recalculate?startDate=<date>&limit=10000`

4. **Validation:**
   - Verify SLA calculations return to previous behavior
   - Check SLA metrics dashboard displays correctly
   - Confirm settings page loads without errors

### Feature Flag Considerations
**Optional Enhancement:** Consider adding `ENABLE_CONFIGURABLE_SLA_METRICS` environment variable for controlled rollout:
- If false, hide toggles in UI and use default enabled metrics (all enabled)
- If true, show full configurable interface
- Allows gradual rollout and easy emergency rollback

### Breaking Changes
**None** - This feature is backward compatible:
- Existing installations default to pickup + firstResponse enabled
- All metrics continue to be calculated
- No database schema changes
- API changes are additive only

---

## Documentation Updates

### What Documentation Needs to be Created/Updated

1. **Feature Documentation** (NEW)
   - File: `docs/features/feature-008-configurable-sla-metrics.md`
   - Content: Complete feature overview, configuration guide, troubleshooting

2. **User Guide** (UPDATE)
   - File: `docs/user-guide/sla-configuration.md`
   - Add: Section on configuring enabled metrics
   - Add: Screenshots of new toggle UI
   - Add: Explanation of active vs inactive metrics

3. **API Documentation** (UPDATE)
   - File: `docs/api/sla-endpoints.md`
   - Update: GET/PUT `/api/settings/sla` with `enabledMetrics` field
   - Add: Validation rules for enabled metrics

4. **Admin Guide** (UPDATE)
   - File: `docs/admin/sla-management.md`
   - Add: Best practices for enabling/disabling metrics
   - Add: How to recalculate SLA after config changes
   - Add: Recommended rollout strategy (start with pickup + firstResponse)

5. **Changelog** (UPDATE)
   - File: `CHANGELOG.md`
   - Add: Feature announcement with version number
   - Note: Default configuration change (not all metrics enabled)

6. **README** (UPDATE - Optional)
   - File: `README.md`
   - Add: Brief mention in features list if SLA is highlighted

---

## Success Criteria

### How to Know When Feature is Complete

#### Functional Completeness
- [ ] All 10 implementation chunks completed and tested
- [ ] All unit tests passing (100% coverage for new code)
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Manual testing checklist completed

#### User Acceptance
- [ ] Admin can toggle all four SLA metrics on/off via UI
- [ ] Average Response Time configuration visible and functional
- [ ] Form validation prevents invalid configurations (all disabled)
- [ ] Configuration persists across page reloads
- [ ] SLA dashboard shows active/inactive indicators

#### Technical Validation
- [ ] Only enabled metrics affect `overallSLA` and `overallSLABH` flags
- [ ] All four metrics still calculated regardless of enabled state
- [ ] Recalculation API uses current enabled metrics config
- [ ] Backward compatibility verified (existing installations work)
- [ ] No performance degradation in SLA calculations

#### Documentation
- [ ] All documentation updates completed
- [ ] Screenshots added to user guide
- [ ] API documentation reflects changes
- [ ] Changelog updated

### Metrics or Validation Criteria

1. **Performance:** SLA calculation time should not increase (< 100ms per chat)
2. **Accuracy:** Recalculated SLA values match expected compliance based on enabled metrics
3. **Usability:** Admin can configure enabled metrics in < 2 minutes
4. **Reliability:** Zero errors in production after deployment
5. **Adoption:** User successfully transitions from all-enabled to selective metrics

### Deployment Readiness Checklist
- [ ] Code review completed and approved
- [ ] All tests passing in CI/CD
- [ ] Documentation reviewed and approved
- [ ] Staging environment testing completed
- [ ] Rollback plan tested in staging
- [ ] Production deployment scheduled
- [ ] Monitoring and alerts configured
- [ ] Support team briefed on new feature

---

## Implementation Notes

### Recommended Implementation Order
1. **Backend First** (Chunks 1-5): Complete all backend changes and test thoroughly
2. **Frontend Next** (Chunks 6-8): Build UI after backend is stable
3. **Integration** (Chunk 9): Wire everything together
4. **Documentation** (Chunk 10): Document after feature is complete

### Parallel Development Opportunities
- Chunks 1-5 (Backend) can be developed in sequence
- Chunk 6 (Average Response UI) can start in parallel with Chunks 3-4
- Chunk 8 (Dashboard display) can start in parallel with Chunks 3-5

### Risk Mitigation
- **Risk:** Breaking existing SLA calculations
  - **Mitigation:** Comprehensive unit tests, backward compatibility tests
- **Risk:** Configuration confusion for admins
  - **Mitigation:** Clear UI labels, tooltips, validation messages
- **Risk:** Performance impact on recalculation
  - **Mitigation:** Performance testing, benchmark before/after

### Dependencies on External Systems
**None** - This is a self-contained feature within the SLA module

---

## Appendix: UI Mockup

```
┌──────────────────────────────────────────────────────────────────┐
│ SLA Configuration                                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Active SLA Metrics                                               │
│ Select which metrics determine overall SLA compliance            │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Pickup Time                        [●────] Active          │ │
│ │ Time from chat opened to agent assignment                  │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ First Response Time                [●────] Active          │ │
│ │ Time from chat opened to first agent message               │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Average Response Time              [────○] Inactive        │ │
│ │ Average time between customer messages and agent replies   │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Resolution Time                    [────○] Inactive        │ │
│ │ Total time from chat opened to chat closed                 │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Default Thresholds                                               │
│ Maximum time allowed for each metric                             │
│                                                                  │
│ Pickup Threshold:            [2] minutes        Active ●        │
│ First Response Threshold:    [5] minutes        Active ●        │
│ Avg Response Threshold:      [5] minutes        Inactive        │
│ Resolution Threshold:        [120] minutes      Inactive        │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Compliance Targets                                               │
│ Percentage of chats that should meet each threshold              │
│                                                                  │
│ Pickup Target:               [95] %             Active ●        │
│ First Response Target:       [95] %             Active ●        │
│ Avg Response Target:         [90] %             Inactive        │
│ Resolution Target:           [90] %             Inactive        │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ [Cancel]                                    [Save SLA Settings]  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

**Feature Owner:** B2Chat Development Team
**Estimated Total Effort:** 5-7 days
**Priority:** High
**Status:** Planned
