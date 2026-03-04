# Contributing Guide (Website-Only)

This repository is for **AGENTEASEPRO.com marketing pages only**.

## Scope Rules (Must Follow)

1. Keep this repo focused on website content, layout, legal pages, and marketing UX.
2. Do **not** add or mirror app-internal pages here (settings, deals, dashboard, CRM screens, etc.).
3. Any app redirect/CTA must use `src/config/externalLinks.ts`.
4. App links must point to app root only: `https://app.agenteasepro.com`.
5. Do not add deep app routes (example: `/settings`, `/deals`, `/clients`, etc.).

## Allowed vs Not Allowed

### Allowed
- Website pages and sections (home, pricing, legal, contact)
- Marketing copy updates
- Styling and responsiveness improvements for website pages
- CTA updates that still use `EXTERNAL_LINKS.appEntry`

### Not Allowed
- Importing app code into this repo
- Building app feature pages in this repo
- Deep links into app internals
- App business logic or settings/deals workflows

## Before Opening a PR

Run:

```bash
npm run lint
npm run build
```

Expected result:
- Boundary check passes
- Build succeeds

## Quick Reviewer Checklist

- [ ] Change is website-only
- [ ] No app-internal routes were introduced
- [ ] Any app URL uses `src/config/externalLinks.ts`
- [ ] No deep links under `app.agenteasepro.com/...`
- [ ] Build and lint pass
