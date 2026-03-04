# AgentEasePro Database (Prisma/Postgres) — Schema Summary

This project uses **PostgreSQL** with **Prisma**. The source of truth for the data model is:
- server/prisma/schema.prisma

## Tenancy / Data Ownership Model
- The primary “account” entity is `Agent`.
- Most business data rows include an `agentId` foreign key back to `Agent`.
- API auth uses JWT and sets `req.agentId` (and `req.user.id`) to the authenticated agent id.

## Core Entities
### Accounts
- `Agent`
  - Key fields: `id`, `email` (unique), `name`, optional `passwordHash`, reset token fields
  - Relations: clients, properties, deals, listings, marketing blasts, tasks, events, leads, landing pages, and integrations/settings

### CRM
- `Client`
  - Owned by: `agentId`
  - Represents buyers/sellers/leads with stage, role, tags, notes
  - Relations: buyerDeals, sellerDeals, tasks, leads, savedListings, searchCriteria

- `Lead`
  - Owned by: `agentId`
  - Optional links to: `Client`, `Listing`, `LandingPage`
  - Tracks: contact info, source/priority, visit analytics, conversion status
  - Relations: `LeadActivity`, `SavedListing`, `SearchCriteria`

### Deals & Contracts
- `Property`
  - Owned by: `agentId`
  - Address + optional MLS id/tax id
  - Relation: has many `Deal`

- `Deal`
  - Owned by: `agentId`
  - Links to: `Property` (required), `Client` as buyer/seller (optional)
  - Relations: `Repc`, `Addendum[]`, `SignatureEnvelope[]`, `FormInstance[]`, `DealEvent[]`, `Task[]`

- `Repc`
  - One-to-one with `Deal` via `dealId` (unique)
  - Stores structured REPC fields + `rawJson`

- `Addendum`
  - Belongs to a `Deal`
  - Stores addendum type/title/body and labels/summary

### Listings & Marketing
- `Listing`
  - Owned by: `agentId`
  - Listing details for marketing + status/featured

- `MarketingBlast` / `BlastChannel` / `BlastHit`
  - Owned by: `agentId` (via blast)
  - Tracks multi-channel campaigns and click-through events

- `LandingPage`
  - Owned by: `agentId`
  - Optional link to `Listing`
  - Has `slug` (unique), content/style JSON, and analytics counters
  - Relations: `Lead[]`, `PageView[]`

- `PageView`
  - Tracks visits for landing pages/listings with visitorId, UTM fields, device/browser, etc.

### Tasks, Events, Automations
- `Task`
  - Owned by: `agentId`
  - Optional links: `Deal`, `Client`, `Listing`, `MarketingBlast`

- `DealEvent`
  - Owned by: `agentId` and associated to a `Deal`

- `AutomationRule`
  - Owned by: `agentId`
  - Indexed by `[agentId, eventType, isEnabled]`

- `DailyActivity`
  - Owned by: `agentId`
  - Unique per agent/day via `@@unique([agentId, date])`

### Integrations / Settings
- `AgentProfileSettings` / `AgentNotificationPrefs` / `AgentAiSettings`
  - One-to-one with Agent (unique `agentId`)

- `GoogleCalendarConnection`, `IdxConnection`, `AgentChannelConnection`
  - One-to-one or unique-per-agent-type connection records

### MLS
- `MlsListing`
  - Owned by: `agentId`
  - Unique per agent + MLS number via `@@unique([agentId, mlsNumber])`

## Key Indexes / Uniques (examples)
- `Agent.email` is unique
- `Repc.dealId` is unique (enforces 1 REPC per deal)
- `LandingPage.slug` is unique
- `DailyActivity` unique by agent/date
- Multiple `@@index([agentId])` to keep agent-scoped queries fast

## Notes for Beta Accounts
- Production data safety relies on consistently scoping queries by `agentId`.
- Heroku Postgres uses the `DATABASE_URL` config var; do not hardcode DB URLs in code.
