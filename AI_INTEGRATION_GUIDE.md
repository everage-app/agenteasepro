# AI Integration Quick Guide

## Remaining Integrations (Copy-Paste Ready)

### 1. Tasks Page Integration

**File:** `web/src/features/tasks/TasksPage.tsx`

```tsx
import { TasksAISuggest } from '../../components/ai/TasksAISuggest';

// Add inside your TasksPage component, before the tasks list:
<div className="mb-6">
  <TasksAISuggest
    onCreateTask={async (task) => {
      // Create task using your existing API call
      await api.post('/tasks', {
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        dueAt: task.dueInDays 
          ? new Date(Date.now() + task.dueInDays * 24 * 60 * 60 * 1000)
          : null,
      });
      // Refresh tasks list
      loadTasks();
    }}
  />
</div>
```

---

### 2. Calendar Page Integration

**File:** `web/src/features/calendar/CalendarPage.tsx`

```tsx
import { AIDailyPlan } from '../../components/ai/AIDailyPlan';

// Add to Calendar day view or sidebar:
<div className="mb-6">
  <AIDailyPlan />
</div>
```

**Note:** The AIDailyPlan component automatically fetches today's plan. For custom dates, you'd need to modify the component or create a wrapper.

---

### 3. Listings Page Integration

**File:** `web/src/features/listings/ListingsPage.tsx` or `ListingEditor.tsx`

```tsx
import { ListingAIDescription } from '../../components/ai/ListingAIDescription';

// Add inside listing editor form:
<div className="mb-6">
  <ListingAIDescription
    listingId={listingId}
    onApply={(description, type) => {
      // Update form field with generated description
      if (type === 'short') {
        setShortDescription(description);
      } else {
        setLongDescription(description);
      }
    }}
  />
</div>
```

---

### 4. Marketing Page Integration

**File:** `web/src/features/marketing/MarketingPage.tsx` or `BlastCreatePage.tsx`

```tsx
import { MarketingAICopy } from '../../components/ai/MarketingAICopy';

// Add inside blast creation form:
<div className="mb-6">
  <MarketingAICopy
    blastType="new_listing" // or 'open_house', 'price_drop', 'just_sold', 'general'
    propertyData={selectedProperty}
    onApply={(copy) => {
      // Update form fields with generated copy
      setEmailSubject(copy.emailSubject);
      setEmailBody(copy.emailBody);
      setSocialCaption(copy.socialCaption);
    }}
  />
</div>
```

---

## Testing Checklist

### Backend Setup
```bash
# 1. Add to server/.env
OPENAI_API_KEY=sk-your-key-here

# 2. Restart server
cd server
npm run dev
```

### Test Each Component

#### Dashboard AI Daily Plan
1. Navigate to `/` (dashboard)
2. Look for "AI Daily Plan" card
3. Click "Build my plan"
4. Verify actions load with urgency indicators
5. Test click navigation to related records
6. Test collapse/expand functionality

#### REPC AI Assistant
1. Navigate to REPC wizard (e.g., `/repc/:dealId`)
2. Fill in some form fields
3. Look for "AgentEasePro AI" card
4. Click "Review my REPC"
5. Verify suggestions, missing fields, next steps appear
6. Test collapse/expand

#### Tasks AI Suggest
1. Navigate to Tasks page
2. Look for "AI Task Suggestions" card
3. Click "Suggest tasks"
4. Verify tasks load grouped by category
5. Test "Create task" button functionality

#### Listing AI Description
1. Navigate to Listing editor
2. Look for "AI Description Writer" card
3. Click "Generate description"
4. Test tab switching (Short/Long)
5. Verify highlights display
6. Test "Use this description" button

#### Marketing AI Copy
1. Navigate to Marketing blast creation
2. Look for "AI Marketing Copy" card
3. Click "Draft marketing copy"
4. Test tab switching (Email/Social)
5. Verify email subject + body + social caption
6. Test "Use this copy" button

---

## Common Integration Patterns

### Loading State
All components handle loading internally with spinner UI.

### Error Handling
All components show error messages with "Try again" button.

### Collapsible Panels
All components support collapse/expand to save screen space.

### Apply/Copy Actions
Most components offer:
- **Apply** - Updates parent form fields
- **Copy** - Copies to clipboard
- **Regenerate** - Fetches new suggestions
- **Clear** - Resets component state

---

## Customization Tips

### Change AI Parameters
Edit `server/src/services/aiAssistantService.ts`:

```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  temperature: 0.8,        // ← Adjust creativity (0.0-2.0)
  max_tokens: 500,         // ← Adjust length
  // ...
});
```

### Add More Context
Edit API endpoints in `server/src/routes/ai.ts`:

```typescript
// Add more data to AI context
const listing = await prisma.listing.findUnique({
  where: { id: listingId },
  include: {
    property: true,
    agent: true,        // ← Add agent data
    marketingBlasts: true, // ← Add related blasts
  },
});
```

### Change Component Styles
All components use TailwindCSS classes. Find the component file and adjust:

```tsx
// Change gradient colors
className="bg-gradient-to-br from-blue-500 to-cyan-400"
//                              ↑ Change these

// Change border/glow
className="border-blue-500/30"  // ← Adjust color/opacity
```

---

## Deployment Checklist

### Before Deploying to Heroku

1. **Verify Builds**
```bash
cd server
npm run build

cd ../web
npm run build
```

2. **Check Environment Variables**
```bash
heroku config:set OPENAI_API_KEY=sk-your-key-here --app agenteasepro
```

3. **Test Locally with Production Build**
```bash
cd server
NODE_ENV=production npm start
```

4. **Deploy**
```bash
git add .
git commit -m "feat: Add AI assistant integrations to Dashboard and REPC"
git push heroku main
```

5. **Verify Deployment**
- Visit https://app.agenteasepro.com
- Test Dashboard AI Daily Plan
- Test REPC AI Assistant
- Check browser console for errors
- Monitor Heroku logs: `heroku logs --tail --app agenteasepro`

---

## Troubleshooting

### "Failed to get suggestions"
- **Check:** OPENAI_API_KEY is set in environment
- **Check:** Server logs for OpenAI errors
- **Check:** OpenAI account has credits

### "Cannot read property of undefined"
- **Check:** Prisma query includes all needed relations
- **Check:** Schema matches expected data structure
- **Check:** Fallback responses are properly formatted

### TypeScript Errors
- **Check:** Enum values match Prisma schema
- **Check:** Import statements are correct
- **Check:** Component props match interface definitions

### "Module not found"
- **Check:** File paths use correct casing
- **Check:** Import statements include file extensions where needed
- **Check:** Components are exported correctly

---

## Performance Optimization

### Reduce Bundle Size
Consider lazy loading AI components:

```tsx
import { lazy, Suspense } from 'react';

const AIDailyPlan = lazy(() => import('../../components/ai/AIDailyPlan'));

// In component:
<Suspense fallback={<div>Loading AI...</div>}>
  <AIDailyPlan />
</Suspense>
```

### Cache AI Responses
Add caching layer in `aiAssistantService.ts`:

```typescript
const cache = new Map<string, { data: any; timestamp: number }>();

function getCached(key: string, ttl = 300000) { // 5 min TTL
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  return null;
}
```

### Monitor Costs
Track OpenAI usage:

```typescript
// In aiAssistantService.ts after each call:
console.log('OpenAI tokens used:', completion.usage?.total_tokens);
```

---

## Need Help?

Common issues and solutions documented in `AI_INTEGRATION_SUMMARY.md`

For OpenAI API issues: https://platform.openai.com/docs
For Prisma issues: https://www.prisma.io/docs
For React issues: https://react.dev

---

**Last Updated:** January 2025
