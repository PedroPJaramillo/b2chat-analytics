# Customer Analysis E2E Tests

This directory contains end-to-end tests for the Customer Analysis Dashboard feature.

## Test Coverage

### Functional Tests (`customer-analysis.spec.ts`)

1. **Page Display & Navigation**
   - Page loads correctly
   - Tabs are visible and functional
   - Sidebar navigation link present
   - Keyboard shortcuts (Ctrl+N, Ctrl+H)

2. **Filter Interactions**
   - Date picker functionality
   - Department filter (if available)
   - Agent filter (if available)
   - Form validation

3. **Analysis History**
   - History list displays
   - Empty state handling
   - Analysis selection

4. **Export Functionality**
   - Export button visibility
   - PDF/CSV format options
   - Download flow

5. **Error Handling**
   - Network failure scenarios
   - Empty states
   - Validation errors

6. **Accessibility**
   - Heading structure
   - Form labels
   - Keyboard navigation
   - ARIA attributes

7. **Responsive Design**
   - Mobile viewport support
   - Tablet viewport support

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run specific test file
```bash
npx playwright test e2e/customer-analysis.spec.ts
```

### Run in headed mode (see browser)
```bash
npx playwright test --headed
```

### Run in debug mode
```bash
npx playwright test --debug
```

### Generate test report
```bash
npx playwright test --reporter=html
npx playwright show-report
```

## Load Testing

### K6 Load Test (`k6/customer-analysis-load-test.js`)

Tests the API performance under concurrent load:
- Simulates 10 concurrent users
- Tests all major endpoints
- Measures response times and error rates

### Run load test
```bash
# Install k6 first: https://k6.io/docs/get-started/installation/
k6 run k6/customer-analysis-load-test.js
```

### Custom load test with environment variable
```bash
BASE_URL=https://your-production-url.com k6 run k6/customer-analysis-load-test.js
```

## Test Scenarios

### Happy Path
1. User navigates to Customer Analysis page
2. User selects date range and filters
3. User triggers analysis
4. System processes analysis (status polling)
5. User views results in tabs
6. User exports report as PDF/CSV

### Error Scenarios
1. Invalid date range (> 90 days)
2. Network failures during trigger
3. Rate limiting (> 10 requests/hour)
4. Incomplete/failed analysis
5. Export failures

### Role-Based Access
1. Manager access (department-scoped)
2. Admin access (full access)
3. Unauthorized users (redirect)

## Performance Requirements

| Metric | Target | Measured By |
|--------|--------|-------------|
| Analysis Trigger | < 2s | K6 load test |
| Status Poll | < 500ms | K6 load test |
| Results Load | < 3s | K6 load test |
| Export Generation (PDF) | < 10s | Manual/E2E |
| Export Generation (CSV) | < 2s | Manual/E2E |
| Concurrent Analyses | 10+ | K6 load test |

## Browser Compatibility

Tests run on:
- Chromium (Chrome/Edge)
- Firefox
- WebKit (Safari)

Configured in `playwright.config.ts`

## CI/CD Integration

Add to your CI pipeline:
```yaml
# Example GitHub Actions
- name: Run E2E Tests
  run: npx playwright test

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Troubleshooting

### Tests failing locally
1. Ensure dev server is running: `npm run dev`
2. Check database is seeded with test data
3. Verify authentication is configured

### Tests timing out
1. Increase timeout in `playwright.config.ts`
2. Check network speed
3. Verify API responses are not blocked

### Rate limiting in tests
1. Use different test accounts
2. Clear rate limit cache between runs
3. Adjust rate limits in test environment
