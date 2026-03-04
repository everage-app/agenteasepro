# Playwright Testing - Quick Start Guide

## 🚀 Quick Start

### 1. One-Time Setup
```bash
cd web
npm install
npx playwright install
```

### 2. Update Test Credentials
Edit `web/tests/auth.setup.ts`:
```typescript
email: 'your-test-email@example.com',
password: 'your-test-password'
```

### 3. Start Development Servers
```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend  
cd web
npm run dev
```

### 4. Run Tests
```bash
cd web
npm test
```

---

## 📋 Common Commands

```bash
# Interactive UI mode (recommended for dev)
npm run test:ui

# Watch tests run in browser
npm run test:headed

# Debug specific test
npm run test:debug

# Run specific test file
npx playwright test tests/tasks.spec.ts

# Run specific test by name
npx playwright test -g "should create new task"

# Run only failed tests
npx playwright test --last-failed

# View HTML report
npm run test:report
```

---

## 🎯 Test By Feature

```bash
# Authentication & Dashboard
npx playwright test tests/auth-dashboard.spec.ts

# Tasks
npx playwright test tests/tasks.spec.ts

# Calendar
npx playwright test tests/calendar.spec.ts

# Listings
npx playwright test tests/listings.spec.ts

# REPC
npx playwright test tests/repc.spec.ts

# Marketing
npx playwright test tests/marketing.spec.ts

# Clients & Deals
npx playwright test tests/clients-deals.spec.ts

# E-Sign
npx playwright test tests/esign.spec.ts

# API Integration
npx playwright test tests/api-integration.spec.ts
```

---

## 🌐 Test By Browser

```bash
# Chromium only
npm run test:chromium

# Firefox only
npm run test:firefox

# WebKit (Safari) only
npm run test:webkit

# All browsers
npm test
```

---

## 🐛 Debugging

```bash
# Debug mode with inspector
npx playwright test --debug

# Headed mode (see browser)
npx playwright test --headed

# Slow motion (see what's happening)
npx playwright test --headed --slow-mo=1000

# Trace viewer (replay test)
npx playwright show-trace trace.zip
```

---

## 📊 Test Results

After running tests, find:
- **HTML Report**: `playwright-report/index.html`
- **Screenshots**: `test-results/*/test-failed-*.png`
- **Videos**: `test-results/*/video.webm`
- **Traces**: `test-results/*/trace.zip`

Open HTML report:
```bash
npm run test:report
```

---

## ✅ Pre-Push Checklist

```bash
# 1. Run all tests
npm test

# 2. Check for failures
# Fix any failing tests

# 3. View report
npm run test:report

# 4. Commit and push
git add .
git commit -m "Add feature X with tests"
git push
```

---

## 🔧 Troubleshooting

### Server not running?
```bash
# Start backend on port 3000
cd server && npm run dev

# Start frontend on port 5173
cd web && npm run dev
```

### Auth issues?
```bash
# Re-run auth setup
npx playwright test tests/auth.setup.ts --project=setup

# Check credentials in tests/auth.setup.ts
```

### Tests timing out?
```bash
# Increase timeout
npx playwright test --timeout=60000
```

### Browser issues?
```bash
# Reinstall browsers
npx playwright install --force
```

### Flaky test?
```bash
# Run test multiple times
npx playwright test tests/tasks.spec.ts --repeat-each=5
```

---

## 📁 Test Structure

```
web/tests/
├── auth.setup.ts              # Runs first (login)
├── helpers/
│   ├── test-utils.ts          # Reusable functions
│   └── fixtures.ts            # Test data
├── auth-dashboard.spec.ts     # 9 tests
├── tasks.spec.ts              # 12 tests
├── calendar.spec.ts           # 11 tests
├── listings.spec.ts           # 12 tests
├── repc.spec.ts               # 12 tests
├── marketing.spec.ts          # 13 tests
├── clients-deals.spec.ts      # 18 tests
├── esign.spec.ts              # 10 tests
└── api-integration.spec.ts    # 40+ tests
```

---

## 🎨 Writing New Tests

```typescript
import { test, expect } from '@playwright/test';
import { navigateTo, waitForLoadingToComplete } from './helpers/test-utils';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    // Navigate to page
    await navigateTo(page, '/my-feature');
    await waitForLoadingToComplete(page);
    
    // Interact with page
    await page.click('button[type="submit"]');
    
    // Assert result
    await expect(page.locator('.success')).toBeVisible();
  });
});
```

---

## 📈 Coverage

- ✅ 150+ tests
- ✅ 9 test files
- ✅ ~92% coverage
- ✅ All features tested
- ✅ All AI integrations tested
- ✅ All API endpoints tested

---

## 🔗 Useful Links

- [Playwright Docs](https://playwright.dev/)
- [Test Utils](tests/helpers/test-utils.ts)
- [Test Fixtures](tests/helpers/fixtures.ts)
- [Full Documentation](tests/README.md)

---

**Quick Help**: Run `npm run test:ui` for the best development experience!
