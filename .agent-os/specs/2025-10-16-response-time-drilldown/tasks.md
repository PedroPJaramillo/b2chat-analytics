# Spec Tasks

## Tasks

- [ ] 1. Create API endpoint for drill-down data
  - [ ] 1.1 Write tests for `/api/analytics/response-time-drilldown` endpoint
  - [ ] 1.2 Create route file `src/app/api/analytics/response-time-drilldown/route.ts`
  - [ ] 1.3 Implement query parameter validation (weekStart, dayOfWeek, hour)
  - [ ] 1.4 Implement time slot calculation and Prisma queries
  - [ ] 1.5 Implement weekly average comparison logic
  - [ ] 1.6 Implement response formatting with all required fields
  - [ ] 1.7 Add error handling for all edge cases
  - [ ] 1.8 Verify all tests pass

- [ ] 2. Create React Query hook for drill-down data fetching
  - [ ] 2.1 Write tests for `use-response-time-drilldown` hook
  - [ ] 2.2 Create TypeScript interfaces in hook file
  - [ ] 2.3 Create `src/hooks/use-response-time-drilldown.ts` following `use-weekly-response-times.ts` pattern
  - [ ] 2.4 Implement fetch function with proper query parameters
  - [ ] 2.5 Implement useQuery hook with proper caching strategy
  - [ ] 2.6 Verify all tests pass

- [ ] 3. Create drill-down dialog component
  - [ ] 3.1 Write tests for ResponseTimeDrillDownDialog component
  - [ ] 3.2 Create `src/components/analytics/response-time-drill-down-dialog.tsx`
  - [ ] 3.3 Implement dialog structure using shadcn Dialog components
  - [ ] 3.4 Implement summary stats card section
  - [ ] 3.5 Implement chat distribution section
  - [ ] 3.6 Implement agent breakdown table (conditional rendering)
  - [ ] 3.7 Implement slowest chats table
  - [ ] 3.8 Implement "View All Chats" navigation button
  - [ ] 3.9 Add loading states with Skeleton components
  - [ ] 3.10 Add error handling UI
  - [ ] 3.11 Verify all tests pass

- [ ] 4. Make heatmap cells interactive and integrate dialog
  - [ ] 4.1 Write tests for heatmap cell click interactions
  - [ ] 4.2 Add click handler state management to weekly-response-time-heatmap component
  - [ ] 4.3 Add onClick handler to heatmap cell divs
  - [ ] 4.4 Add cursor-pointer styling to clickable cells
  - [ ] 4.5 Import and integrate ResponseTimeDrillDownDialog component
  - [ ] 4.6 Pass drill-down context to dialog component
  - [ ] 4.7 Verify all tests pass

- [ ] 5. Extend Chat Management page for drill-down navigation
  - [ ] 5.1 Write tests for URL parameter handling in Chat Management page
  - [ ] 5.2 Add 'responseTime' to SortBy type in `src/types/filters.ts`
  - [ ] 5.3 Add customDateRange field to ChatFilters interface
  - [ ] 5.4 Update `src/app/dashboard/chats/page.tsx` to read URL search params
  - [ ] 5.5 Implement custom date range filter application
  - [ ] 5.6 Implement response time sorting in chats API route
  - [ ] 5.7 Test end-to-end navigation from heatmap to chats page
  - [ ] 5.8 Verify all tests pass
