# Spec Requirements Document

> Spec: Weekly Response Time Heatmap with Agent Filter
> Created: 2025-10-16

## Overview

Enable week-by-week response time visibility with agent-level filtering to identify performance patterns across 7 days and 24 hours. This feature helps managers optimize agent scheduling, identify coaching opportunities, and spot staffing gaps by revealing when specific agents (or teams) perform best or worst throughout the week.

## User Stories

### Identifying Optimal Agent Performance Times

As a customer service manager, I want to view an individual agent's response times across a full week in an hour-by-hour heatmap, so that I can identify when they perform best and schedule them accordingly.

**Workflow**: Manager selects a specific agent from the dropdown filter, chooses the week to analyze, and immediately sees a 7×24 grid showing that agent's average response times for each hour of each day. Green cells show peak performance hours (fast responses), while red cells reveal struggle periods (slow responses). Gray cells indicate time slots when the agent had no assigned chats.

**Problem Solved**: Eliminates guesswork in agent scheduling by revealing data-driven patterns. Managers can optimize shifts to align agent schedules with their natural performance peaks, and provide targeted coaching for consistently slow time periods.

### Comparing Week-Over-Week Performance

As a customer service manager, I want to navigate between different weeks using a date picker, so that I can compare how response time patterns change over time and measure improvement initiatives.

**Workflow**: Manager uses week navigation controls to jump between weeks (previous/next arrows or date picker). They can quickly flip through Week 1, Week 2, Week 3 to spot trends like "response times improving on Monday mornings" or "Friday afternoons consistently showing red cells."

**Problem Solved**: Provides visibility into whether performance improvement initiatives (training, schedule changes, new processes) are actually working. Managers can measure before/after impact of changes they've made to team operations.

### Spotting Staffing Gaps

As a customer service manager, I want to see the aggregated team view (All Agents) of the weekly heatmap, so that I can identify time slots where the entire team struggles and plan additional staffing.

**Workflow**: Manager keeps the default "All Agents" filter selected and reviews the heatmap. They notice that every Thursday between 2PM-5PM shows red cells (slow response times), indicating understaffing during peak volume. They can then adjust staffing plans to add coverage during those specific hours.

**Problem Solved**: Reveals systemic understaffing issues that might not be obvious from average metrics alone. Enables proactive capacity planning to prevent SLA violations during predictable high-volume periods.

## Spec Scope

1. **7×24 Heatmap Grid** - Visual grid with 7 rows (Sun-Sat) and 24 columns (12AM-11PM) showing 168 individual time slots with color-coded response time performance.

2. **Week Selection Control** - Date picker allowing users to select any week (by choosing the week start date), with previous/next week navigation arrows for quick browsing.

3. **Agent Filter Dropdown** - Dropdown selector showing "All Agents" (default aggregate view) plus list of all active agents, enabling quick switching between team view and individual agent analysis.

4. **Color-Coded Performance Cells** - Each cell uses color coding: green for fast responses (bottom 33rd percentile), yellow for average (middle 33rd-66th percentile), red for slow (top 33rd percentile), and gray for no data available.

5. **Interactive Tooltips** - Hovering over any cell displays detailed information: day of week, hour, exact average response time, and number of chats handled in that time slot. Empty cells show "No data available."

6. **Filter Integration** - Respects and works in combination with existing Chat Type (direction: incoming/outgoing) and Office Hours filters from the main analytics page.

7. **Replace Current Heatmap** - This new weekly heatmap replaces the existing single-day hourly heatmap on the Response Times tab, providing more comprehensive temporal visibility.

## Out of Scope

- Multi-week overlay comparison (showing 2+ weeks simultaneously)
- Multi-agent overlay comparison (showing multiple agents on same grid)
- Export/download heatmap as image or PDF
- Historical trend indicators or arrows showing week-over-week changes
- Department-level filtering (only agent-level or all-agents aggregate)
- Custom date range selection (locked to full calendar weeks)
- Real-time live updates (uses standard React Query refresh intervals)
- Mobile-optimized condensed view (assumes desktop/tablet screen size)

## Expected Deliverable

1. **Functional Weekly Heatmap** - A working 7×24 response time heatmap displayed on the Response Times tab of the Analytics dashboard, showing accurate data calculated from the database.

2. **Week Navigation Works** - Users can select any week using the date picker, and navigate forward/backward using arrow buttons, with the heatmap data updating to reflect the selected week.

3. **Agent Filtering Works** - Users can select "All Agents" or any individual agent from the dropdown, and the heatmap immediately updates to show only that agent's data (or aggregated data for all agents).

4. **Accurate Tooltips** - All 168 cells display correct tooltips when hovered, showing day name, hour, average response time, and chat count. Empty time slots show "No data available" message.

5. **Filter Integration** - The heatmap correctly respects the Chat Type (direction) filter and Office Hours filter selections from the main analytics page, combining all three filters properly.
