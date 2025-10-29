# SLA Compliance Page - User Guide

> Version: 1.0
> Last Updated: 2025-10-21

## Overview

The SLA Compliance Page provides comprehensive visibility into service level agreement performance across your customer support operations. Monitor compliance rates, investigate breaches, and track trends over time.

---

## Accessing the SLA Page

1. Log into B2Chat Analytics
2. Click **"SLA Compliance"** in the sidebar navigation
3. The dashboard will load with the last 30 days of data

---

## Understanding the Dashboard

### Top Metrics (4 Cards)

#### 1. Overall SLA Compliance
- **What it shows:** Percentage of chats that met all SLA targets
- **Color coding:**
  - 🟢 Green: At or above target (excellent)
  - 🟡 Yellow: Within 10% of target (warning)
  - 🔴 Red: Below target minus 10% (critical)
- **Details shown:**
  - Compliance percentage
  - Number of compliant chats
  - Total chats analyzed
  - Target threshold

#### 2. SLA Breaches
- **What it shows:** Total number of chats that failed to meet SLA
- **Details shown:**
  - Total breach count
  - Percentage of total chats
  - "Needs attention" indicator when breaches occur

#### 3. Avg First Response Time
- **What it shows:** Average time to send first agent message
- **Details shown:**
  - Average duration (e.g., "3m 45s")
  - Target time
  - Percentage within target

#### 4. Avg Resolution Time
- **What it shows:** Average time to close a chat
- **Details shown:**
  - Average duration (e.g., "1h 30m")
  - Target time
  - Percentage within target

### Detailed Metrics (2 Panels)

#### Pickup Time Performance
- Average pickup time
- Target pickup time
- Compliance rate

#### Avg Response Time Performance
- Average response time across all agent replies
- Target response time
- Compliance rate

---

## Time Modes

### Wall Clock Time
- Measures actual elapsed time from start to finish
- Includes nights, weekends, and holidays
- Example: Chat opened Friday 5 PM, closed Monday 9 AM = 64 hours

### Business Hours Only
- Measures time during configured office hours only
- Excludes nights, weekends, and non-working hours
- Example: Same chat = 2 hours (Friday 5-5 PM + Monday 9-10 AM)

**To switch modes:**
- Click the "Wall Clock Time" or "Business Hours Only" tab
- All metrics update instantly

---

## Compliance Trend Chart

### What it Shows
- Daily compliance rates over the selected date range
- 5 lines on the chart:
  - **Bold line (Overall):** Overall SLA compliance
  - **Green (Pickup):** Pickup time compliance
  - **Blue (First Response):** First response compliance
  - **Purple (Avg Response):** Average response compliance
  - **Amber (Resolution):** Resolution time compliance
  - **Dashed line:** Your compliance target

### How to Use
- **Hover over points** to see exact percentages
- **Identify trends** in compliance over time
- **Spot problem days** where compliance dropped
- **Compare metrics** to see which SLA is underperforming

---

## Breaches Investigation Table

### Table Columns

1. **Date:** When the chat was opened
2. **Customer:** Name and phone number
3. **Agent:** Name and email
4. **Channel:** Communication channel (WhatsApp, Webchat, etc.)
5. **Breach Types:** Which SLA metrics were breached (colored badges)
6. **Resolution Time:** How long the chat took (color-coded if breached)
7. **Actions:** View chat button

### Filtering Breaches

**By Breach Type:**
1. Click the dropdown at the top right
2. Select:
   - All Breaches
   - Pickup (chats picked up too slowly)
   - First Response (first reply too slow)
   - Avg Response (slow average response time)
   - Resolution (took too long to resolve)

### Sorting Breaches

**Click column headers to sort:**
- **Date:** Most recent first or oldest first
- **Resolution Time:** Longest or shortest first

### Viewing Chat Details

1. Click any row in the table
2. You'll be redirected to the full chat conversation
3. Review messages and timelines
4. Identify what caused the SLA breach

### Pagination

- **Default:** 50 breaches per page
- **Navigation:** Use Previous/Next buttons
- **Page indicator:** Shows current page and total pages
- **Results counter:** Shows "1 to 50 of 125 results"

---

## Date Range Selection

### Preset Ranges

Quick select options:
- **Today:** Current day only
- **Last 7 Days:** Past week
- **Last 30 Days:** Past month (default)
- **Last 90 Days:** Past quarter (maximum)
- **Custom Range:** Pick specific dates

### Custom Date Range

1. Select "Custom Range" from dropdown
2. Click the date range button
3. Calendar picker appears
4. Click start date, then end date
5. Click outside to apply

**Limitations:**
- Maximum 90-day range
- Cannot select future dates
- Must select both start and end dates

---

## Auto-Refresh

### Enabling Auto-Refresh

1. Click the **"Auto-refresh OFF"** button
2. Button changes to **"Auto-refresh ON"** with spinning icon
3. Data refreshes every 30 seconds automatically

### Manual Refresh

- Click the **"Refresh"** button anytime
- Loads latest data immediately
- Toast notification confirms refresh

---

## Reading SLA Metrics

### Duration Format

Durations are shown in human-readable format:
- **Seconds:** "45s"
- **Minutes:** "3m 45s"
- **Hours:** "1h 30m"
- **Days:** "2d 3h"

### Percentage Format

Percentages show one decimal place:
- "95.5%"
- "88.2%"
- "100.0%"

### Color Meanings

**Status Indicators:**
- 🟢 **Green:** Good performance (at or above target)
- 🟡 **Yellow:** Warning (close to target but acceptable)
- 🔴 **Red:** Critical (below acceptable threshold)

**Breach Badges:**
- 🔴 **Red (Destructive):** Pickup and First Response breaches
- ⚪ **Gray (Secondary):** Average Response breaches
- ⚫ **Default:** Resolution breaches

---

## Common Scenarios

### Scenario 1: Investigating Why Compliance is Low

1. Check the **Overall SLA Compliance card**
2. Look at **Avg First Response** and **Avg Resolution** cards
3. Identify which metric is failing most
4. View the **Compliance Trend Chart** to see when it started
5. Filter the **Breaches Table** by that metric type
6. Click through breaches to find patterns

### Scenario 2: Monitoring Daily Performance

1. Set date range to **"Today"**
2. Enable **Auto-refresh**
3. Watch metrics update every 30 seconds
4. Check breaches table for new issues
5. Click breaches to investigate in real-time

### Scenario 3: Analyzing a Specific Agent

1. Scroll to **Breaches Table**
2. Look at the **Agent** column
3. Manually scan for specific agent
4. Count their breaches
5. Click rows to see their response patterns

*(Note: Agent filtering will be added in a future update)*

### Scenario 4: Comparing Weekday vs Weekend Performance

1. Set date range to **Last 30 Days**
2. Switch to **Business Hours Only** mode
3. Compare overall compliance
4. Switch back to **Wall Clock Time**
5. Note the difference in compliance rates

---

## Tips & Best Practices

### For Managers

1. **Check daily** to catch issues early
2. **Use Business Hours mode** for fair agent evaluation
3. **Filter by breach type** to focus improvement efforts
4. **Watch the trend chart** for early warning signs
5. **Set a routine** for reviewing breaches

### For Team Leads

1. **Monitor Auto-refresh** during peak hours
2. **Investigate clusters** of breaches on specific days
3. **Click through to chats** to understand context
4. **Note patterns** in breach types
5. **Use date ranges** to measure improvement over time

### For Analysts

1. **Export breach data** (upcoming feature) for deeper analysis
2. **Compare Wall Clock vs Business Hours** for insights
3. **Track trend lines** to measure interventions
4. **Cross-reference** with staffing levels
5. **Document patterns** for process improvement

---

## Keyboard Shortcuts

*(To be implemented in future update)*

---

## Mobile Access

The SLA Compliance Page is **fully responsive**:

- **Mobile (< 768px):** Single column layout
- **Tablet (768px - 1024px):** 2-column layout
- **Desktop (> 1024px):** 4-column layout

All features work on mobile, though the table may require horizontal scrolling.

---

## Troubleshooting

### Problem: No data showing

**Solutions:**
1. Check your date range selection
2. Ensure chats exist in that period
3. Verify you have proper permissions
4. Try refreshing the page

### Problem: Metrics seem incorrect

**Solutions:**
1. Verify the time mode (Wall Clock vs Business Hours)
2. Check configuration settings
3. Wait for auto-refresh cycle
4. Try manual refresh

### Problem: Breaches table empty

**Solutions:**
1. Check breach type filter (might be too restrictive)
2. Expand date range
3. Verify SLA targets aren't too lenient
4. Check if all chats are compliant (good news!)

### Problem: Page loads slowly

**Solutions:**
1. Reduce date range (try 30 days instead of 90)
2. Disable auto-refresh temporarily
3. Check your internet connection
4. Clear browser cache

---

## Glossary

**SLA (Service Level Agreement):** A commitment to respond and resolve customer issues within specific timeframes

**Pickup Time:** Time from chat opening to agent assignment

**First Response Time:** Time from chat opening to first agent message

**Avg Response Time:** Average time between customer messages and agent replies

**Resolution Time:** Total time from chat opening to closure

**Compliance Rate:** Percentage of chats meeting SLA targets

**Breach:** A chat that failed to meet one or more SLA targets

**Wall Clock Time:** Actual elapsed time including all hours

**Business Hours:** Time during configured working hours only

**Office Hours:** Configured working hours (e.g., 9 AM - 5 PM)

**Working Days:** Configured working days (e.g., Monday-Friday)

---

## Getting Help

For questions or issues:

1. Contact your B2Chat administrator
2. Check the integration guide (for technical staff)
3. Review this user guide
4. Submit a support ticket

---

## What's Next?

Upcoming features:
- Agent-specific filtering
- Breach data export (CSV)
- Custom compliance targets per channel
- Holiday calendar integration
- Email alerts for breaches
- Historical comparison views

---

**User Guide Version: 1.0** - Updated 2025-10-21

For the latest version of this guide, check the documentation repository.
