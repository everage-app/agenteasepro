# AgentEasePro

AgentEasePro is a modern web platform that helps Utah real estate agents draft and manage REPCs and addenda, collect e-signatures, track deals, and market listings from one place.

## Legal Disclaimer

This tool helps you organize data for the official Utah REPC and related addendums. It does **not** provide legal advice and does **not** modify the legal language of the official Utah forms. The official, state-approved PDFs control in all cases.

Always verify the generated summaries and data against the official Utah REPC and consult a licensed Utah real-estate attorney and your broker before using this in any real transaction.

## Monorepo Structure

- `server`: Node 20, TypeScript, Express, Prisma, PostgreSQL API.
- `web`: React + TypeScript + Vite + Tailwind client.
- `contracts/templates`: Place the official Utah REPC and REPC Addendum PDFs here.

## Heroku

The app is designed to be deployed on Heroku. Backend serves the built frontend from `server/dist/public`.

## Getting Started (local)

1. Copy `.env.example` to `.env` at the root and set `DATABASE_URL` and `JWT_SECRET`.
	- Root `.env` is for server secrets/config (for example `DATABASE_URL`, `JWT_SECRET`, API keys).
	- `web/.env` or `web/.env.local` is for Vite client variables (for example `VITE_API_URL=http://localhost:3001`).
2. Install dependencies and run dev servers (once server and web are scaffolded):

```bash
npm install
npm run dev
```

Details on API routes, Prisma schema, and frontend flows are in the respective `server` and `web` folders.

### Running the full stack locally

Open two terminals from the repository root:

```bash
# API (runs on http://localhost:3001)
cd server
npm install
npm run dev

# Web client (runs on http://localhost:5174 and proxies API calls)
cd ../web
npm install
npm run dev
```

Or from the repository root, run both together:

```bash
npm install
npm run dev
```

### SendGrid for e-sign email

Local e-sign email delivery uses the server env loaded from the repository root `.env`.

Required root `.env` values:

```env
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@agentease.com
```

Optional but recommended:

```env
ESIGN_TRACKING_EMAIL=esign@agenteasepro.com
SENDGRID_ALLOWED_FROM_DOMAINS=
```

After changing email env, restart the API server. To validate that e-sign emails are actually sending, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\generate_demo_esign_links.ps1 -BaseUrl "http://localhost:5174" -BuyerEmail "your-test@example.com" -RequireEmails
```

That command now fails loudly if the envelope is created but SendGrid delivery is not configured or not succeeding.

### MLS autofill workflow

1. From the dashboard, use the **MLS# Autofill** card to sync an MLS number. The backend fetches `utahrealestate.com/<MLS#>` on-demand, scoped to the signed-in agent, and caches results for six hours.
2. Navigate to a REPC from any deal. A green banner appears when MLS data is available; click **Apply MLS Prefill** to populate purchase price, city, state, ZIP, and property description fields.
3. Adjust any remaining terms, then continue with smart prompts, guided mode, or e-sign as usual.
