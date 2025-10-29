# Spec Requirements Document

> Spec: SLA Compliance Page
> Created: 2025-10-21

## Overview

Build a comprehensive SLA Compliance analytics page that enables customer service managers to track, analyze, and improve service level agreement adherence across all customer support chats. The page will provide real-time insights into four core SLA metrics (pickup time, first response time, average response time, and resolution time), identify breaches, compare agent performance, and enable detailed investigation of individual chat failures.

## User Stories

### Story 1: Monitor Overall SLA Health

As a customer service manager, I want to quickly assess overall SLA compliance at a glance, so that I can understand if we're meeting our service commitments without diving into detailed data.

**Workflow:** Manager opens the SLA Compliance page and immediately sees large metric cards showing percentage compliance for each of the four SLA targets (pickup, first response, average response, resolution), plus an overall compliance score. Color coding (green/yellow/red) provides instant visual feedback on performance status.

### Story 2: Investigate SLA Breaches

As a customer service manager, I want to drill down into specific chats that missed SLA targets, so that I can understand what went wrong and coach agents or fix process issues.

**Workflow:** Manager scrolls to the SLA Breaches table, which lists all non-compliant chats with clear indicators showing which specific SLAs were missed. They click to expand a chat row and see the full conversation timeline, message counts, and exact performance metrics, allowing them to identify root causes like slow pickup times or delayed agent responses.

### Story 3: Compare Agent SLA Performance

As a customer service manager, I want to see which agents consistently meet or miss SLA targets, so that I can recognize top performers and provide targeted coaching to those who need improvement.

**Workflow:** Manager reviews the "SLA Compliance by Agent" horizontal bar chart, which ranks agents by their overall compliance percentage. They can quickly identify top performers (green bars, 90%+) and those needing support (red bars, <70%). Clicking on a bar filters the entire page to show only that agent's data for deeper analysis.

## Spec Scope

1. **Four Core SLA Metrics Dashboard** - Display compliance percentages, pass/fail counts, and targets for pickup time (<2min), first response time (<5min), average response time (<5min), and resolution time (<2hrs).

2. **Overall Compliance Tracking** - Show aggregate compliance percentage for chats meeting ALL four SLA targets, with color-coded status indicators and configurable target thresholds (default 95%).

3. **Agent Performance Comparison** - Horizontal bar chart ranking agents by SLA compliance percentage, with color coding and click-to-filter functionality.

4. **Daily Compliance Trend Analysis** - Line chart showing daily compliant vs. total chats over time, enabling trend identification and historical analysis.

5. **SLA Breach Investigation Table** - Expandable table listing all non-compliant chats with breach indicators, detailed metrics, and full conversation display for root cause analysis.

6. **Business Hours vs. Wall Clock Toggle** - Allow switching between calculating SLAs using only office hours versus 24/7 elapsed time.

7. **Breach Data Export** - CSV export functionality for breach data including all metrics and breach details for reporting and review meetings.

## Out of Scope

- Real-time live monitoring and auto-refresh (initial version uses manual refresh)
- Automated alerts or notifications when SLA breaches occur
- Custom SLA targets per agent, department, or channel
- SLA exception marking or override functionality
- Scheduled email reports
- Predictive analytics or forecasting
- Industry benchmarking comparisons
- Historical month-over-month comparison views
- Configuration of SLA targets within the UI (uses hardcoded defaults initially)

## Expected Deliverable

1. **Functional SLA Compliance Page** - Navigate to /sla-compliance and see all metric cards, charts, and breach table displaying accurate data calculated from imported B2Chat chat history.

2. **Interactive Breach Investigation** - Click on any row in the breach table to expand and view the full conversation with color-coded chat bubbles (customer/agent/bot), exact SLA times, and pass/fail status for all four metrics.

3. **Working Business Hours Toggle** - Toggle between business hours and wall clock calculations, with all metrics recalculating and updating correctly to reflect the selected mode.

4. **Responsive Design Across Devices** - Page functions properly on desktop (4-column layout), tablet (2-column), and mobile (1-column) with appropriate responsive adjustments to charts and tables.

5. **CSV Export Functionality** - Click "Export Breaches" button to download a CSV file containing all currently filtered breach data with all relevant columns (Chat ID, Contact, Agent, all SLA metrics and statuses).
