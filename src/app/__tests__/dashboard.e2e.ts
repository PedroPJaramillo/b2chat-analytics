import { test, expect } from '@playwright/test'

test.describe('Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication - you may need to adjust this based on your Clerk setup
    await page.goto('/')
  })

  test('should load dashboard and display key metrics', async ({ page }) => {
    await page.goto('/dashboard')

    // Wait for dashboard to load
    await expect(page.locator('h2:has-text("Dashboard")')).toBeVisible()

    // Check for key metric cards
    await expect(page.locator('text=Total Agents')).toBeVisible()
    await expect(page.locator('text=Active Chats')).toBeVisible()
    await expect(page.locator('text=Avg Response Time')).toBeVisible()
    await expect(page.locator('text=Satisfaction Rate')).toBeVisible()

    // Check for tabs
    await expect(page.locator('text=Overview')).toBeVisible()
    await expect(page.locator('text=Analytics')).toBeVisible()
  })

  test('should navigate to analytics tab', async ({ page }) => {
    await page.goto('/dashboard')

    // Click on Analytics tab
    await page.click('text=Analytics')

    // Wait for analytics content to load
    await expect(page.locator('text=Performance Metrics')).toBeVisible()
  })

  test('should display no data state when no sync has been run', async ({ page }) => {
    await page.goto('/dashboard')

    // Look for "No Data" badge or similar indicator
    const noDataIndicator = page.locator('text=No Data - Run B2Chat Sync')
    if (await noDataIndicator.isVisible()) {
      await expect(noDataIndicator).toBeVisible()
    }
  })

  test('should navigate to sync page from dashboard', async ({ page }) => {
    await page.goto('/dashboard')

    // Navigate to sync page (could be via menu or direct link)
    await page.goto('/dashboard/sync')

    // Verify sync page loads
    await expect(page.locator('text=Data Synchronization')).toBeVisible()
    await expect(page.locator('text=B2Chat API Status')).toBeVisible()
  })

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/dashboard')

    // Check that dashboard is still accessible
    await expect(page.locator('h2:has-text("Dashboard")')).toBeVisible()

    // Check that metric cards stack properly on mobile
    const metricCards = page.locator('[data-testid="metric-card"]')
    if (await metricCards.first().isVisible()) {
      const firstCard = metricCards.first()
      const secondCard = metricCards.nth(1)

      const firstCardBox = await firstCard.boundingBox()
      const secondCardBox = await secondCard.boundingBox()

      // Cards should stack vertically on mobile
      expect(firstCardBox?.y).toBeLessThan(secondCardBox?.y || 0)
    }
  })

  test('should handle loading states gracefully', async ({ page }) => {
    // Intercept API calls to simulate slow response
    await page.route('/api/dashboard/stats', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.continue()
    })

    await page.goto('/dashboard')

    // Check for loading indicators
    const loadingIndicators = page.locator('.animate-pulse, [data-testid="skeleton"]')
    if (await loadingIndicators.first().isVisible()) {
      await expect(loadingIndicators.first()).toBeVisible()
    }
  })

  test('should show error state on API failure', async ({ page }) => {
    // Intercept API calls to return error
    await page.route('/api/dashboard/stats', route => {
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    })

    await page.goto('/dashboard')

    // Look for error indicators
    // This might be error messages, retry buttons, or error boundaries
    // Adjust based on your error handling implementation
  })

  test('should navigate between dashboard sections', async ({ page }) => {
    await page.goto('/dashboard')

    // Test navigation to different dashboard sections
    const sections = [
      { name: 'Analytics', path: '/dashboard/analytics' },
      { name: 'Chats', path: '/dashboard/chats' },
      { name: 'Agents', path: '/dashboard/agents' },
      { name: 'Sync', path: '/dashboard/sync' }
    ]

    for (const section of sections) {
      await page.goto(section.path)

      // Wait for the page to load and check for specific content
      await page.waitForLoadState('networkidle')

      // Verify URL
      expect(page.url()).toContain(section.path)
    }
  })
})