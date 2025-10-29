# Spec Requirements Document

> Spec: Response Time Heatmap Drill-Down Investigation
> Created: 2025-10-16

## Overview

Implement a drill-down investigation feature that enables customer service managers to click on any cell in the weekly response time heatmap to view detailed statistics and navigate to individual chats for that specific time slot. This feature transforms the heatmap from a visualization-only tool into an interactive investigation interface that helps managers identify root causes of performance issues and take targeted action.

## User Stories

### Story 1: Manager Investigates Slow Time Slot

As a customer service manager, I want to click on a red (slow) cell in the weekly response time heatmap to see detailed statistics about that specific day and hour, so that I can understand what caused the poor performance.

**Detailed Workflow:**
The manager is reviewing the weekly response time heatmap and notices Tuesday 2-3 PM shows a red cell indicating slow response times (average 8.5 minutes). They click on this cell, and a dialog immediately appears showing: 15 total chats during that hour, average response time of 8.5 minutes (compared to weekly average of 3.2 minutes), distribution showing 8 resolved chats and 7 still pending, and a breakdown by agent revealing that Agent Carlos handled 8 chats with 12-minute average while Agent Maria handled 7 chats with 4.5-minute average. The manager also sees a list of the 5 slowest chats from that hour, with the slowest taking 18 minutes to first response. This reveals that Carlos was likely overwhelmed during that time slot.

### Story 2: Manager Drills Down to Individual Chats

As a customer service manager, I want to navigate from the time slot summary to the full chat list filtered to that specific time period, so that I can review individual conversations and understand the context.

**Detailed Workflow:**
After viewing the Tuesday 2-3 PM summary dialog, the manager clicks the "View All Chats" button. The system navigates to the Chat Management page with filters automatically applied: date range set to Tuesday October 15, 2025 2:00 PM - 3:00 PM, sorted by response time (slowest first). The manager now sees the complete list of 15 chats from that time slot, can click into individual conversations to read messages, see customer details, and identify that several chats were complex technical support issues requiring longer investigation times. Armed with this context, the manager can provide coaching to Agent Carlos on handling high-complexity situations during peak hours.

### Story 3: Manager Tracks Agent-Specific Performance Issues

As a customer service manager, I want to view drill-down statistics filtered by a specific agent when investigating their weekly performance heatmap, so that I can provide targeted coaching based on their specific time slot patterns.

**Detailed Workflow:**
The manager selects "Agent: Carlos Rivera" from the heatmap agent filter to view Carlos's weekly pattern. They notice Wednesday 10-11 AM shows consistently slow response times. Clicking this cell shows the drill-down dialog filtered only to Carlos's chats during that hour: 6 chats total, 9.2-minute average response time, and all 6 chats came from the WhatsApp channel. The manager realizes Carlos may need additional training on the WhatsApp interface or that Wednesday mornings have a surge in complex WhatsApp inquiries requiring process improvements.

## Spec Scope

1. **Interactive Heatmap Cells** - Make all heatmap cells clickable with cursor pointer indication, passing day, hour, and current agent filter to drill-down handler.

2. **Drill-Down Summary Dialog** - shadcn Dialog component showing time slot summary (total chats, average response time, comparison to weekly average), chat distribution by status, agent performance breakdown, and list of 5-10 slowest chats with response times and customer names.

3. **Drill-Down API Endpoint** - New endpoint `GET /api/analytics/response-time-drilldown` accepting weekStart, dayOfWeek, hour, agentId (optional), direction filter, and office hours filter parameters, returning aggregated statistics and slowest chat details.

4. **Navigation to Chat Management** - "View All Chats" button in dialog that navigates to Chat Management page with pre-applied filters for the specific time slot (custom date range, agent filter if applicable) and sorted by response time slowest-first.

5. **Custom React Query Hook** - Create `use-response-time-drilldown.ts` hook following established pattern (like `use-weekly-response-times.ts`) for data fetching with loading, error, and refetch states.

## Out of Scope

- Real-time automated alerts when time slots exceed thresholds (may be added in future)
- Export functionality for drill-down data (can use existing chat export)
- Direct messaging or task assignment to agents from the drill-down dialog
- Drill-down for other analytics visualizations beyond the weekly heatmap (this is specific to response time heatmap only)
- Historical comparison across multiple weeks within the drill-down dialog
- Chat preview or inline message viewing (users navigate to Chat Management for full details)

## Expected Deliverable

1. **Clickable Heatmap** - All cells in the weekly response time heatmap are clickable and open the drill-down dialog with loading states when clicked.

2. **Functional Drill-Down Dialog** - Dialog displays accurate statistics for the selected time slot including total chats, average response time, chat distribution, agent breakdown, and slowest chat list, all using shadcn/ui components (Dialog, Card, Badge, Button, Table).

3. **Working Navigation** - "View All Chats" button successfully navigates to Chat Management page with correct filters pre-applied (date range, agent, sorted by response time) and displays the expected chats from that time slot.
