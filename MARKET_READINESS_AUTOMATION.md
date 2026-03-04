# Automated Market Readiness Audit

This repo includes an automated scanner that generates a market-readiness scorecard from the current codebase.

## Run

```bash
npm run audit:market-readiness
```

## Output

The command writes both latest and timestamped reports to:

- `audits/market-readiness/latest.md`
- `audits/market-readiness/latest.json`
- `audits/market-readiness/market-readiness-<timestamp>.md`
- `audits/market-readiness/market-readiness-<timestamp>.json`

## What it checks

- Frontend route and module inventory
- Backend route inventory
- Capability scorecard across:
  - CRM/pipeline
  - Contracts + e-sign
  - MLS/IDX/search
  - Marketing/automations
  - AI assistance
  - Integrations/webhooks
  - Lead routing signals
  - Mobile readiness signals
  - Security/compliance signals
  - Observability/testing signals

## How to use in release workflow

1. Run `npm run audit:market-readiness`
2. Review `audits/market-readiness/latest.md`
3. Resolve P0 items marked non-Strong before broad production rollout
4. Keep timestamped reports as a historical readiness trail

## Notes

- This scan is evidence-based and keyword-driven; it does not replace full QA/UAT.
- Pair it with Playwright and production smoke tests for release decisions.
