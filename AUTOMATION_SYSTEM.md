# AgentEasePro - Automation & Workflows v1
## Implementation Guide

### 🎯 Overview

We've implemented a comprehensive automation and workflow engine inspired by tools like n8n, specifically designed for real estate workflows. The system automatically creates tasks, schedules follow-ups, and manages client touchpoints when key events occur.

---

## 🏗️ Architecture

### Event-Driven System
```
Business Action → Event Dispatcher → Load Rules → Execute Actions → Create Tasks
```

### Key Components

1. **Event Dispatcher** (`server/src/automation/runner.ts`)
   - Receives automation events from business logic
   - Loads enabled automation rules
   - Executes configured actions

2. **AI Service** (`server/src/automation/aiService.ts`)
   - OpenAI integration for smart task suggestions
   - Falls back to default templates if no API key
   - Generates context-aware tasks for listings and deals

3. **Automation Rules** (Database model)
   - Stored in PostgreSQL via Prisma
   - JSON configuration for actions
   - Per-agent enable/disable toggle

4. **API Layer** (`server/src/routes/automations.ts`)
   - List rules: GET `/api/automations`
   - Seed defaults: POST `/api/automations/seed`
   - Toggle rule: PATCH `/api/automations/:id/toggle`

5. **UI** (`web/src/features/automations/AutomationsPage.tsx`)
   - View all automation rules
   - Toggle rules on/off
   - Grouped by event type with visual indicators

---

## 📦 Database Schema

### New Models

```prisma
model AutomationRule {
  id        String                 @id @default(cuid())
  agentId   String
  agent     Agent                  @relation(fields: [agentId], references: [id])
  name      String
  eventType AutomationEventType
  isEnabled Boolean                @default(true)
  config    Json
  createdAt DateTime               @default(now())
  updatedAt DateTime               @updatedAt

  @@index([agentId, eventType, isEnabled])
}

enum AutomationEventType {
  LISTING_CREATED
  DEAL_CREATED
  REPC_CREATED
  MARKETING_BLAST_SENT
  CLIENT_STAGE_CHANGED
}
```

### Updated Enums

```prisma
enum TaskCreatedFrom {
  MANUAL
  AI_SUGGESTED
  SYSTEM
  AUTOMATION  // NEW
}
```

---

## ⚡ Automation Workflows

### 1. Listing Created → Marketing Tasks

**Trigger**: When a new listing is created via POST `/api/listings`

**Default Actions**:
- ✅ "Review listing photos and property remarks" (due today)
- ✅ "Prepare 'Just Listed' email blast" (due in 1 day)
- ✅ "Plan first open house" (due in 3 days)

**AI-Enhanced** (when OpenAI key is configured):
- Additional context-aware tasks based on property details
- Smart suggestions like "Update MLS remarks", "Post on Instagram"

**Code Integration**:
```typescript
// server/src/routes/listings.ts
await dispatchAutomationEvent({
  type: 'LISTING_CREATED',
  listingId: listing.id,
  agentId: req.agentId,
});
```

---

### 2. Deal/REPC Created → Contract Timeline Tasks

**Trigger**: When a new deal is created via POST `/api/deals`

**Default Actions**:
- ✅ "Welcome client and review timeline" (due in 1 day)
- ✅ "Remind client about inspection deadline" (3 days before due diligence)
- ✅ "Confirm lender docs are complete" (5 days before financing deadline)
- ✅ "Prepare closing packet" (3 days before settlement)

**AI-Enhanced**:
- Analyzes all key dates from REPC
- Suggests additional milestone tasks
- Customizes reminders based on deal specifics

**Code Integration**:
```typescript
// server/src/routes/deals.ts
await dispatchAutomationEvent({
  type: 'DEAL_CREATED',
  dealId: deal.id,
  agentId: req.agentId,
});
```

---

### 3. Marketing Blast Sent → Follow-Up Tasks

**Trigger**: When a marketing blast is sent via POST `/api/marketing/blasts/:id/send`

**Default Actions**:
- ✅ "Review clicks & replies from [blast title]" (due in 1 day)
- ✅ "Call warm leads from [blast title]" (due in 2 days)

**Future Enhancements**:
- Track click metrics and create tasks for hot leads
- Auto-prioritize follow-ups based on engagement

**Code Integration**:
```typescript
// server/src/routes/marketing.ts
await dispatchAutomationEvent({
  type: 'MARKETING_BLAST_SENT',
  blastId: blast.id,
  agentId: req.agentId,
});
```

---

### 4. Client Stage Changed → Referral Touch Sequence

**Trigger**: When a client moves to "PAST_CLIENT" or "REFERRING_CLIENT" stage via PUT `/api/clients/:id`

**Default Actions** (Buffini-style touchpoints):
- ✅ "Call [client name] to check in" (due in 7 days)
- ✅ "Send handwritten note to [client name]" (due in 14 days)
- ✅ "Pop-by visit to [client name]" (due in 30 days)

**Task Categories**:
- Tasks categorized as CALL, NOTE, POPBY
- Integrates with "Win the Day" daily goals tracking
- Shows up in Priority Action Center

**Code Integration**:
```typescript
// server/src/routes/clients.ts
if (stageChanged) {
  await dispatchAutomationEvent({
    type: 'CLIENT_STAGE_CHANGED',
    clientId: client.id,
    agentId: req.agentId,
    fromStage: oldStage,
    toStage: client.stage,
  });
}
```

---

## 🤖 AI Integration

### OpenAI Setup

1. **Add API Key**:
   ```bash
   # .env file
   OPENAI_API_KEY=sk-...your-key...
   ```

2. **Model Used**: `gpt-4o-mini` (cost-effective, fast)

3. **Safety Features**:
   - No hardcoded keys
   - Graceful fallback to default templates
   - Error handling with console warnings

### AI-Powered Features

**Listing Task Suggestions**:
```typescript
await suggestListingTasks({
  listingAddress: '123 Main St, Salt Lake City, UT',
  price: 450000,
  beds: 3,
  baths: 2,
});
// Returns: Array of smart task suggestions with due dates
```

**Deal Task Suggestions**:
```typescript
await suggestDealTasksFromDates({
  keyDates: {
    dueDiligence: '2025-11-25',
    financing: '2025-12-10',
    settlement: '2025-12-20',
  },
  dealTitle: '123 Main St - Smith Purchase',
});
// Returns: Context-aware tasks tied to specific dates
```

---

## 🎨 User Interface

### Automations Page

**Location**: `/automations` (⚡ Automations in nav bar)

**Features**:
- 📋 **List all rules** - Grouped by event type
- 🎛️ **Toggle switches** - Enable/disable rules individually
- 🏷️ **Visual indicators** - Color-coded badges for each event type
- 🤖 **AI badges** - Shows which rules use AI enhancement
- 📝 **Empty state** - One-click "Create Default Automations" button

**Event Type Colors**:
- 🏠 **Listing Created**: Emerald gradient
- 📋 **Deal Created**: Blue gradient
- 📧 **Marketing Blast Sent**: Violet gradient
- 👤 **Client Stage Changed**: Amber gradient

**Toggle Behavior**:
- Instant toggle without page reload
- Visual feedback (switch animation)
- Changes apply immediately to new events

---

## 🚀 Deployment Steps

### 1. Database Migration

```bash
cd server
npx prisma db push --accept-data-loss
```

This adds:
- `AutomationRule` table
- `AutomationEventType` enum
- Updates `TaskCreatedFrom` enum

### 2. Generate Prisma Client

```bash
cd server
npx prisma generate
```

⚠️ **Important**: If the server is running, stop it first to avoid file locking issues on Windows.

### 3. Install Dependencies

```bash
cd server
npm install openai
```

### 4. Environment Variables

```bash
# Optional: Add to .env for AI features
OPENAI_API_KEY=sk-...your-key...

# If not provided, automations work with default templates
```

### 5. Restart Servers

```bash
# Backend
cd server
npm run dev

# Frontend
cd web
npm run dev
```

### 6. Seed Default Rules

**Via UI**:
1. Navigate to `/automations`
2. Click "Create Default Automations"

**Via API**:
```bash
curl -X POST http://localhost:3000/api/automations/seed \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

This creates 6 default rules:
- 2 for listings (default + AI)
- 2 for deals (default + AI)
- 1 for marketing blasts
- 1 for client stage changes

---

## 🧪 Testing the System

### Test Workflow 1: Create a Listing

1. **Action**: Create a new listing via `/listings`
2. **Expected**: Navigate to `/tasks`
3. **Result**: See 3 new tasks auto-created:
   - "Review listing photos..." (TODAY, HIGH priority)
   - "Prepare 'Just Listed' email..." (THIS_WEEK)
   - "Plan first open house..." (THIS_WEEK)
4. **Badge**: Tasks show "createdFrom: AUTOMATION"

### Test Workflow 2: Create a Deal

1. **Action**: Create a new deal via `/deals/new`
2. **Include**: REPC with key dates (due diligence, financing, settlement)
3. **Expected**: Navigate to `/tasks`
4. **Result**: See 4+ new tasks:
   - "Welcome client and review timeline" (TODAY)
   - "Remind client about inspection" (3 days before due diligence)
   - "Confirm lender docs" (5 days before financing)
   - "Prepare closing packet" (3 days before settlement)

### Test Workflow 3: Send Marketing Blast

1. **Action**: Create and send a blast via `/marketing`
2. **Expected**: Navigate to `/tasks`
3. **Result**: See 2 follow-up tasks:
   - "Review clicks & replies..." (due tomorrow)
   - "Call warm leads..." (due in 2 days)

### Test Workflow 4: Move Client to Past Client

1. **Action**: Edit a client and change stage to "PAST_CLIENT"
2. **Expected**: Navigate to `/tasks`
3. **Result**: See 3 referral touchpoint tasks:
   - "Call [name] to check in" (CALL category, 7 days out)
   - "Send handwritten note..." (NOTE category, 14 days out)
   - "Pop-by visit..." (POPBY category, 30 days out)
4. **Integration**: These tasks count toward "Win the Day" daily goals

---

## 📊 Default Automation Rules

When you seed default rules, you get:

| Rule Name | Event Type | Enabled | AI |
|-----------|------------|---------|-----|
| New Listing → Auto-create Marketing Tasks | LISTING_CREATED | ✅ Yes | ❌ No |
| New Listing → AI-Enhanced Task Suggestions | LISTING_CREATED | ❌ No* | ✅ Yes |
| New Deal/REPC → Key Date Tasks | DEAL_CREATED | ✅ Yes | ❌ No |
| New Deal/REPC → AI-Enhanced Contract Tasks | DEAL_CREATED | ❌ No* | ✅ Yes |
| Marketing Blast Sent → Follow-up Tasks | MARKETING_BLAST_SENT | ✅ Yes | ❌ No |
| Client → Past Client → Referral Touch Sequence | CLIENT_STAGE_CHANGED | ✅ Yes | ❌ No |

*AI-powered rules are disabled by default until you add `OPENAI_API_KEY` to your environment.

---

## 🔧 Configuration

### Rule Config Schema

Rules are stored with JSON configuration:

```typescript
{
  actions: [
    {
      action: 'CREATE_TASKS',
      template: 'NEW_LISTING_DEFAULT',
      useAI: false
    }
  ]
}
```

### Supported Actions

1. **CREATE_TASKS**
   - template: 'NEW_LISTING_DEFAULT' | 'NEW_LISTING_AI' | 'BLAST_FOLLOWUP'
   - useAI: boolean (optional)

2. **SCHEDULE_DEAL_TASKS**
   - useKeyDates: boolean
   - useAI: boolean (optional)

3. **CREATE_REFERRAL_TOUCH_SEQUENCE**
   - sequenceType: 'PAST_CLIENT' | 'REFERRING_CLIENT'

4. **INCREMENT_METRICS** (placeholder for future analytics)
   - kind: string

---

## 📝 Task Fields Set by Automations

When automations create tasks, they set:

- `agentId`: Owner of the task
- `title`: Descriptive title with context (e.g., listing address, client name)
- `description`: Additional details
- `category`: GENERAL | CONTRACT | MARKETING | CALL | NOTE | POPBY | EVENT
- `status`: Always 'OPEN'
- `priority`: HIGH for urgent, NORMAL otherwise
- `bucket`: TODAY | THIS_WEEK | LATER
- `dueAt`: Calculated due date
- `createdFrom`: 'AUTOMATION' or 'AI_SUGGESTED'
- `listingId` | `dealId` | `clientId` | `marketingBlastId`: Related entity

---

## 🎯 Benefits for Agents

### Time Savings
- **No manual task creation** for repetitive workflows
- **Automatic deadline tracking** for contracts
- **Built-in follow-up sequences** for referral cultivation

### Consistency
- **Never miss a touchpoint** with past clients
- **Standard workflows** applied to every listing/deal
- **Referral Maker methodology** built into the system

### Intelligence
- **AI-powered suggestions** when enabled
- **Context-aware tasks** based on property/deal details
- **Smart scheduling** relative to key dates

### Integration
- Tasks appear in **Priority Action Center**
- **Win the Day** tracking for referral activities
- **Task categories** for better organization

---

## 🔮 Future Enhancements

### Phase 2 (Planned)
- **Visual Workflow Builder** - Drag-and-drop rule creation
- **Conditional Logic** - If/then branches in workflows
- **Multi-step Sequences** - Complex automation chains
- **Template Library** - Pre-built workflows for common scenarios
- **Analytics Dashboard** - Track automation effectiveness

### Phase 3 (Ideas)
- **Zapier Integration** - Connect to external tools
- **Webhook Support** - Trigger automations from external events
- **Custom Actions** - User-defined automation actions
- **Team Workflows** - Share automation rules across team
- **A/B Testing** - Compare different automation strategies

---

## 🐛 Troubleshooting

### "Property 'automationRule' does not exist on PrismaClient"

**Solution**: Regenerate Prisma client
```bash
cd server
npx prisma generate
```

If server is running, stop it first:
```bash
# Windows PowerShell
Get-Process -Name node | Where-Object {$_.Path -like "*AgentEasePro*"} | Stop-Process -Force
```

### Tasks not being created

**Check**:
1. Is the rule enabled in `/automations`?
2. Check server console for errors
3. Verify event is being dispatched (look for `[Automation]` logs)

### AI suggestions not working

**Check**:
1. Is `OPENAI_API_KEY` set in `.env`?
2. Is the AI-enhanced rule enabled?
3. Check server logs for OpenAI API errors
4. Verify API key has sufficient quota

### Rule toggle not persisting

**Check**:
1. Browser console for API errors
2. Verify JWT token is valid
3. Check server logs for database errors

---

## 📚 File Reference

### Backend Files Created/Modified

**New Files**:
- `server/src/automation/types.ts` - TypeScript types for automation system
- `server/src/automation/aiService.ts` - OpenAI integration for smart suggestions
- `server/src/automation/runner.ts` - Main automation dispatcher and workflow executor
- `server/src/automation/seed.ts` - Default rule seeder and helpers
- `server/src/routes/automations.ts` - API endpoints for automation management

**Modified Files**:
- `server/prisma/schema.prisma` - Added AutomationRule model and enums
- `server/src/index.ts` - Registered `/api/automations` route
- `server/src/routes/listings.ts` - Dispatch LISTING_CREATED event
- `server/src/routes/deals.ts` - Dispatch DEAL_CREATED event
- `server/src/routes/marketing.ts` - Dispatch MARKETING_BLAST_SENT event
- `server/src/routes/clients.ts` - Dispatch CLIENT_STAGE_CHANGED event

### Frontend Files Created/Modified

**New Files**:
- `web/src/features/automations/AutomationsPage.tsx` - Automation management UI

**Modified Files**:
- `web/src/App.tsx` - Added `/automations` route
- `web/src/components/layout/AppShell.tsx` - Added "⚡ Automations" nav link

---

## ✅ Summary

You now have a production-ready automation system that:

✨ **Automatically creates tasks** when listings are created, deals close, blasts are sent, or clients change stages

🤖 **Optionally uses AI** to generate smart, context-aware task suggestions

🎛️ **Fully manageable** via UI - toggle rules on/off without code changes

🔗 **Deeply integrated** with existing features - Priority Action Center, Win the Day, Task categories

🚀 **Scalable foundation** for future workflow enhancements

**Next Steps**: Deploy to Heroku, seed default rules, and test each workflow! 🎉
