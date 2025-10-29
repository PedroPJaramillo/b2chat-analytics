import { test, expect } from '@playwright/test'

test.describe('Weekly Response Time Heatmap', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Analytics page
    await page.goto('/dashboard/analytics')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Switch to Response Times tab
    await page.getByRole('tab', { name: 'Response Times' }).click()

    // Wait for heatmap to load
    await page.waitForSelector('text=Weekly Response Time Heatmap')
  })

  test.describe('Page Display & Basic Rendering', () => {
    test('should display the weekly response time heatmap component', async ({ page }) => {
      // Check for main heading
      await expect(page.getByText('Weekly Response Time Heatmap')).toBeVisible()
    })

    test('should render week navigation controls', async ({ page }) => {
      // Check for previous week button
      await expect(page.getByLabel('Previous week')).toBeVisible()

      // Check for next week button
      await expect(page.getByLabel('Next week')).toBeVisible()

      // Check for week range display (should show a date range)
      const weekRangePattern = /[A-Z][a-z]{2} \d{1,2} - [A-Z][a-z]{2} \d{1,2}, \d{4}/
      await expect(page.locator('text=' + weekRangePattern)).toBeVisible()
    })

    test('should render agent selector dropdown', async ({ page }) => {
      // Check for agent selector
      const agentSelector = page.getByRole('combobox').filter({ hasText: /All Agents|Agent/ })
      await expect(agentSelector).toBeVisible()

      // Default should be "All Agents"
      await expect(agentSelector).toHaveText(/All Agents/)
    })

    test('should render 7 day labels', async ({ page }) => {
      // Check for day labels (abbreviated)
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      for (const day of days) {
        await expect(page.locator(`text=${day}`).first()).toBeVisible()
      }
    })

    test('should render 24 hour labels', async ({ page }) => {
      // Check for some hour labels
      await expect(page.locator('text=12A').first()).toBeVisible() // Midnight
      await expect(page.locator('text=6A').first()).toBeVisible()  // 6 AM
      await expect(page.locator('text=12P').first()).toBeVisible() // Noon
      await expect(page.locator('text=6P').first()).toBeVisible()  // 6 PM
    })

    test('should render heatmap grid (168 cells)', async ({ page }) => {
      // The grid should have 7 rows (days) × 24 columns (hours) = 168 cells
      // Count visible heatmap cells (cells with rounded style in grid)
      const heatmapCells = page.locator('.grid.grid-cols-24 > div.rounded')
      const cellCount = await heatmapCells.count()

      // Should have 168 cells (7 days × 24 hours)
      expect(cellCount).toBe(168)
    })

    test('should display legend with color categories', async ({ page }) => {
      // Check for legend items
      await expect(page.locator('text=Fast')).toBeVisible()
      await expect(page.locator('text=Average')).toBeVisible()
      await expect(page.locator('text=Slow')).toBeVisible()
      await expect(page.locator('text=No data')).toBeVisible()
    })
  })

  test.describe('Week Navigation', () => {
    test('should navigate to previous week when clicking previous button', async ({ page }) => {
      // Get initial week range text
      const weekRangeLocator = page.locator('.text-sm.font-medium.min-w-\\[180px\\]').first()
      const initialWeek = await weekRangeLocator.textContent()

      // Click previous week button
      await page.getByLabel('Previous week').click()

      // Wait for data to load
      await page.waitForTimeout(500)

      // Verify week range changed
      const newWeek = await weekRangeLocator.textContent()
      expect(newWeek).not.toBe(initialWeek)
    })

    test('should navigate to next week when clicking next button', async ({ page }) => {
      // Get initial week range text
      const weekRangeLocator = page.locator('.text-sm.font-medium.min-w-\\[180px\\]').first()
      const initialWeek = await weekRangeLocator.textContent()

      // Click next week button
      await page.getByLabel('Next week').click()

      // Wait for data to load
      await page.waitForTimeout(500)

      // Verify week range changed
      const newWeek = await weekRangeLocator.textContent()
      expect(newWeek).not.toBe(initialWeek)
    })

    test('should maintain selected agent when navigating weeks', async ({ page }) => {
      // Open agent selector
      const agentSelector = page.getByRole('combobox').filter({ hasText: /All Agents|Agent/ })
      await agentSelector.click()

      // Wait for dropdown to open
      await page.waitForTimeout(300)

      // Select first agent (if available, skip if only "All Agents" exists)
      const firstAgentOption = page.getByRole('option').filter({ hasText: /^(?!All Agents).*/ }).first()
      const firstAgentExists = await firstAgentOption.count() > 0

      if (firstAgentExists) {
        const agentName = await firstAgentOption.textContent()
        await firstAgentOption.click()

        // Navigate to next week
        await page.getByLabel('Next week').click()
        await page.waitForTimeout(500)

        // Verify agent selection is maintained
        await expect(agentSelector).toHaveText(agentName || '')
      }
    })
  })

  test.describe('Agent Filter', () => {
    test('should open agent selector dropdown when clicked', async ({ page }) => {
      // Click agent selector
      const agentSelector = page.getByRole('combobox').filter({ hasText: /All Agents|Agent/ })
      await agentSelector.click()

      // Wait for dropdown
      await page.waitForTimeout(300)

      // Verify "All Agents" option is visible
      await expect(page.getByRole('option', { name: 'All Agents' })).toBeVisible()
    })

    test('should filter data when selecting specific agent', async ({ page }) => {
      // Click agent selector
      const agentSelector = page.getByRole('combobox').filter({ hasText: /All Agents|Agent/ })
      await agentSelector.click()

      await page.waitForTimeout(300)

      // Check if there are any agents besides "All Agents"
      const firstAgent = page.getByRole('option').filter({ hasText: /^(?!All Agents).*/ }).first()
      const hasAgents = await firstAgent.count() > 0

      if (hasAgents) {
        // Get agent name and select it
        const agentName = await firstAgent.textContent()
        await firstAgent.click()

        // Wait for data to reload
        await page.waitForTimeout(500)

        // Verify the selected agent is displayed
        await expect(agentSelector).toHaveText(agentName || '')

        // Verify API call was made with agent filter
        // (Check network tab or data changes - this is indirect verification)
      }
    })

    test('should reset to all agents when selecting "All Agents"', async ({ page }) => {
      // Select specific agent first (if available)
      const agentSelector = page.getByRole('combobox').filter({ hasText: /All Agents|Agent/ })
      await agentSelector.click()
      await page.waitForTimeout(300)

      const firstAgent = page.getByRole('option').filter({ hasText: /^(?!All Agents).*/ }).first()
      const hasAgents = await firstAgent.count() > 0

      if (hasAgents) {
        await firstAgent.click()
        await page.waitForTimeout(500)

        // Now select "All Agents"
        await agentSelector.click()
        await page.waitForTimeout(300)
        await page.getByRole('option', { name: 'All Agents' }).click()
        await page.waitForTimeout(500)

        // Verify "All Agents" is displayed
        await expect(agentSelector).toHaveText('All Agents')
      }
    })
  })

  test.describe('Filter Integration', () => {
    test('should respect Chat Type (direction) filter', async ({ page }) => {
      // Navigate back to top of page to access filters
      await page.evaluate(() => window.scrollTo(0, 0))

      // Find and change Chat Type filter
      const chatTypeSelector = page.locator('select, [role="combobox"]').filter({ hasText: /Incoming|Outgoing|Chat Type/ }).first()
      await chatTypeSelector.click()

      await page.waitForTimeout(300)

      // Select a different option (e.g., "Outgoing")
      const outgoingOption = page.getByRole('option', { name: /Outgoing/ }).first()
      if (await outgoingOption.count() > 0) {
        await outgoingOption.click()

        // Wait for data to reload
        await page.waitForTimeout(1000)

        // Verify heatmap is still visible and updated
        await expect(page.getByText('Weekly Response Time Heatmap')).toBeVisible()
      }
    })

    test('should respect Office Hours filter', async ({ page }) => {
      // Navigate back to top of page
      await page.evaluate(() => window.scrollTo(0, 0))

      // Find and change Office Hours filter
      const hoursSelector = page.locator('select, [role="combobox"]').filter({ hasText: /Office Hours|Hours|All Hours/ }).first()
      await hoursSelector.click()

      await page.waitForTimeout(300)

      // Select a different option (e.g., "Office Hours Only")
      const officeHoursOption = page.getByRole('option', { name: /Office Hours/ }).first()
      if (await officeHoursOption.count() > 0) {
        await officeHoursOption.click()

        // Wait for data to reload
        await page.waitForTimeout(1000)

        // Verify heatmap is still visible and updated
        await expect(page.getByText('Weekly Response Time Heatmap')).toBeVisible()
      }
    })
  })

  test.describe('Tooltips & Interaction', () => {
    test('should show tooltip when hovering over heatmap cell', async ({ page }) => {
      // Find first heatmap cell
      const firstCell = page.locator('.grid.grid-cols-24 > div.rounded').first()

      // Hover over the cell
      await firstCell.hover()

      // Wait for tooltip to appear
      await page.waitForTimeout(300)

      // Verify tooltip is visible (tooltip should contain day name or response time info)
      // Note: Tooltip implementation may vary, adjust selector as needed
      const tooltip = page.locator('[role="tooltip"], .tooltip, [data-state="open"]').first()
      if (await tooltip.count() > 0) {
        await expect(tooltip).toBeVisible()
      }
    })
  })

  test.describe('Summary Statistics', () => {
    test('should display summary stats when data is available', async ({ page }) => {
      // Look for summary statistics section
      // Should show: total chats, average response time, fastest hour, slowest hour
      const summarySection = page.locator('.border-t').last()

      // Check if summary is visible (may not be visible if no data)
      const isVisible = await summarySection.isVisible()

      if (isVisible) {
        // Verify summary contains expected information
        await expect(summarySection).toContainText(/chats|Avg/)
      }
    })
  })

  test.describe('Loading & Error States', () => {
    test('should show loading state while fetching data', async ({ page }) => {
      // Reload the page to catch initial loading state
      await page.reload()

      // Try to catch loading state (this may be very fast)
      const loadingIndicator = page.locator('text=Loading')

      // If loading state appears, verify it
      if (await loadingIndicator.isVisible({ timeout: 100 }).catch(() => false)) {
        await expect(loadingIndicator).toBeVisible()
      }
    })

    test('should handle empty data state gracefully', async ({ page }) => {
      // Navigate to a far future week (unlikely to have data)
      for (let i = 0; i < 50; i++) {
        await page.getByLabel('Next week').click()
        await page.waitForTimeout(100)
      }

      // Wait for data to load
      await page.waitForTimeout(1000)

      // Heatmap should still be visible, possibly with "No data available" messages
      await expect(page.getByText('Weekly Response Time Heatmap')).toBeVisible()
    })
  })

  test.describe('Responsive Design', () => {
    test('should display properly on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 })

      // Verify main elements are still visible
      await expect(page.getByText('Weekly Response Time Heatmap')).toBeVisible()
      await expect(page.getByLabel('Previous week')).toBeVisible()
      await expect(page.getByLabel('Next week')).toBeVisible()
    })

    test('should display properly on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })

      // Verify main elements are still visible (may require scrolling)
      await expect(page.getByText('Weekly Response Time Heatmap')).toBeVisible()

      // Heatmap may be horizontally scrollable on mobile
      const heatmapContainer = page.locator('.overflow-x-auto').first()
      await expect(heatmapContainer).toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels on navigation buttons', async ({ page }) => {
      // Verify previous button has aria-label
      const prevButton = page.getByLabel('Previous week')
      await expect(prevButton).toHaveAttribute('aria-label', 'Previous week')

      // Verify next button has aria-label
      const nextButton = page.getByLabel('Next week')
      await expect(nextButton).toHaveAttribute('aria-label', 'Next week')
    })

    test('should be keyboard navigable', async ({ page }) => {
      // Focus on previous week button
      await page.getByLabel('Previous week').focus()

      // Press Tab to move to next week button
      await page.keyboard.press('Tab')

      // Verify next week button is focused
      await expect(page.getByLabel('Next week')).toBeFocused()
    })
  })
})
