# AgentEase Pro — Client Demo Runbook (E‑Sign + All Forms)

## Goal
Run a polished, repeatable client demo that shows:
1. Clear all-page sign/initial guidance in packet PDFs
2. Rich property context (address/MLS/price/parties)
3. Fast signer completion flow with audit proof
4. Form readiness across REPC + addendum/disclosures

## Environment
- Production URL: `https://agenteasepro-3cf0df357839.herokuapp.com`
- Auth mode:
  - Production: `/api/auth/demo-login`
  - Local/dev: `/api/auth/dev-login`

## Part A — Generate Live Signing Links (REPC, 2 signers)
Use this script to generate fresh signer links and packet PDF URLs:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\generate_demo_esign_links.ps1
```

Optional params:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\generate_demo_esign_links.ps1 `
  -BuyerEmail "bephomes@gmail.com" `
  -SellerEmail "demo-seller@agentease.com"
```

Output:
- JSON file in `logs/demo-signing-links-*.json`
- Includes:
  - `signingUrl` for each signer
  - `packetPdfUrl` for each signer (tokenized, public signer packet)

## Part B — Demo Script (what to show live)
1. Open buyer `signingUrl`.
2. Call out the page metadata strip on each page (property/form/MLS/price/page count).
3. Scroll across pages and show `INITIAL HERE` tabs appear on every page.
4. On signature page, show `SIGN HERE` and initials with role clarity.
5. Confirm packet details card (address, MLS, purchase price, buyer/seller).
6. Complete signer acknowledgement + typed legal name + submit.
7. Show success screen with audit hash.
8. Repeat with seller link to show role-aware highlighting.

## Part C — “All Forms” Readiness Proof
Run template preview smoke check:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke_test_all_forms_preview.ps1
```

Expected:
- `OK  REPC`
- `OK  REPC_ADDENDUM`
- `OK  WIRE_FRAUD_ADVISORY`
- `All templates OK`

## Should you create demo forms for all?
Yes — for best client presentation quality:
- Always demo one live REPC signing packet (buyer + seller).
- Also keep one static PDF preview ready for each addendum/disclosure form to show breadth.
- If you want live signing for ADDENDUM too, ensure the chosen deal has an addendum record first.

## Troubleshooting
- No REPC-backed deal found:
  - Create/save REPC on any deal, then rerun `generate_demo_esign_links.ps1`.
- Link expired:
  - Re-run script to issue fresh links.
- Signer says layout looks cramped:
  - Ask them to use `Open PDF in new tab` in signer page.

## Presenter Notes (30-second value pitch)
- “Every page is guided, not just the signature page.”
- “Clients always see address and deal context while signing.”
- “We track viewed/completed status and produce audit-proof completion hashes.”
