# Spec Tasks

## Tasks

- [ ] 1. Create API endpoint for weekly response time data
  - [ ] 1.1 Write tests for `/api/analytics/weekly-response-times` endpoint
  - [ ] 1.2 Create route file `src/app/api/analytics/weekly-response-times/route.ts`
  - [ ] 1.3 Implement query parameter parsing (weekStart, agentId, direction, officeHoursFilter)
  - [ ] 1.4 Implement database query with day-of-week and hour grouping
  - [ ] 1.5 Add direction filter integration using existing directionWhere logic
  - [ ] 1.6 Add office hours filter integration using isWithinOfficeHours helper
  - [ ] 1.7 Implement 168-item array generation (fill missing slots with count=0)
  - [ ] 1.8 Add response formatting and summary calculations
  - [ ] 1.9 Verify all tests pass and API returns correct data structure

- [ ] 2. Create custom hook for weekly response time data fetching
  - [ ] 2.1 Write tests for `useWeeklyResponseTimes` hook
  - [ ] 2.2 Create hook file `src/hooks/use-weekly-response-times.ts`
  - [ ] 2.3 Implement React Query integration with proper cache keys
  - [ ] 2.4 Add TypeScript interfaces for request/response data
  - [ ] 2.5 Configure staleTime (5 min) and cacheTime (15 min)
  - [ ] 2.6 Implement error handling and loading states
  - [ ] 2.7 Verify all tests pass

- [ ] 3. Enhance ResponseTimeHeatmap component with weekly mode
  - [ ] 3.1 Write tests for enhanced ResponseTimeHeatmap component
  - [ ] 3.2 Add week picker control using react-day-picker (Calendar component)
  - [ ] 3.3 Add agent selector dropdown using Select component
  - [ ] 3.4 Implement helper functions (getMostRecentMonday, getWeekEnd, navigation handlers)
  - [ ] 3.5 Add state management for selectedWeekStart and selectedAgentId
  - [ ] 3.6 Integrate useWeeklyResponseTimes hook with filter props
  - [ ] 3.7 Update grid layout to 7 rows (days) × 24 columns (hours)
  - [ ] 3.8 Add day-of-week labels (Sun, Mon, Tue, Wed, Thu, Fri, Sat)
  - [ ] 3.9 Update hour labels to single row (12A-11P)
  - [ ] 3.10 Update tooltip content to show day name, hour, avg time, chat count
  - [ ] 3.11 Verify all tests pass

- [ ] 4. Integrate weekly heatmap into Analytics page
  - [ ] 4.1 Update `src/app/dashboard/analytics/page.tsx` to use enhanced heatmap
  - [ ] 4.2 Pass directionFilter and officeHoursFilter props to component
  - [ ] 4.3 Verify heatmap appears on Response Times tab
  - [ ] 4.4 Test interaction with existing filters (direction, office hours)
  - [ ] 4.5 Verify responsive design on different screen sizes

- [ ] 5. End-to-end testing and performance validation
  - [ ] 5.1 Write E2E test for weekly heatmap functionality
  - [ ] 5.2 Test week navigation (previous/next buttons, date picker)
  - [ ] 5.3 Test agent filter dropdown (All Agents + individual agents)
  - [ ] 5.4 Test combined filters (week + agent + direction + office hours)
  - [ ] 5.5 Test empty state (week with no data shows gray cells)
  - [ ] 5.6 Validate API response time (< 500ms target)
  - [ ] 5.7 Test with realistic dataset (1K-10K chats)
  - [ ] 5.8 Verify all E2E tests pass
