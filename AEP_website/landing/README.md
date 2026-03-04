# AgentEasePro Marketing Site

Marketing website for AgentEasePro at https://agenteasepro.com

## Tech Stack

- **Vite 7.2.4** - Build tool and dev server
- **React 18** - UI framework
- **TypeScript** - Type safety
- **TailwindCSS 3** - Styling with custom glass morphism utilities

## Design System

- **Background**: Dark slate-950
- **Glass morphism**: `backdrop-blur-xl`, `bg-white/5`, `border-white/10`
- **Gradients**: Blue-500 → Cyan-400 → Amber-400
- **Typography**: Bold headlines with gradient text effects
- **Responsive**: Mobile-first with hamburger menu

## Development

```bash
npm install
npm run dev
```

Dev server runs on http://localhost:5174

## Build

```bash
npm run build
```

Production build outputs to `dist/`

## Deployment

The marketing site is deployed separately from the main app:

- **Marketing site**: https://agenteasepro.com (this repo)
- **Main app**: https://app.agenteasepro.com (Heroku)

## Website Boundary (Important)

This codebase is for AGENTEASEPRO.com marketing pages only.

- Keep product, pricing, legal, and marketing content in this repo.
- Do not add app internal routes (settings, deals, dashboard, etc.) here.
- All app links must use `src/config/externalLinks.ts` and point to app root only.
- A boundary check runs during `npm run build` and `npm run lint`.

If you want to update website copy using app information, do it manually by editing website content in this repo (no shared app-page code).

### Deploy to Netlify

1. Build the site: `npm run build`
2. Deploy the `dist/` folder to Netlify
3. Update DNS: Point `agenteasepro.com` and `www.agenteasepro.com` to Netlify

### Deploy to Vercel

1. Build the site: `npm run build`
2. Deploy the `dist/` folder to Vercel
3. Update DNS: Point `agenteasepro.com` and `www.agenteasepro.com` to Vercel

## Structure

```
landing/
├── src/
│   ├── components/
│   │   ├── Layout/
│   │   │   └── SiteShell.tsx      # Main nav shell
│   │   └── sections/
│   │       ├── Hero.tsx            # Hero with mock dashboard
│   │       ├── ProblemSolution.tsx # Old way vs AgentEasePro way
│   │       ├── FeaturesGrid.tsx    # 4 feature cards
│   │       ├── HowItWorks.tsx      # 3-step timeline
│   │       ├── ForUtahAgents.tsx   # Utah-specific section
│   │       ├── Pricing.tsx         # Founding agent pricing
│   │       ├── CTA.tsx             # Final conversion CTA
│   │       └── Footer.tsx          # Footer with links
│   ├── App.tsx                     # Root component
│   ├── index.css                   # Tailwind imports + glass utilities
│   └── main.tsx                    # React entry point
├── index.html
├── tailwind.config.js              # Tailwind configuration
├── postcss.config.js
├── vite.config.ts
└── package.json
```

## Sections

1. **Hero**: Two-column hero with badge, headline, CTAs, and mock app preview
2. **Problem/Solution**: Side-by-side cards showing "old way" vs "AgentEasePro way"
3. **Features Grid**: 4 feature cards (REPC automation, client OS, listings hub, task OS)
4. **How It Works**: 3-step timeline with gradient connections
5. **For Utah Agents**: Utah-specific positioning and benefits
6. **AI Assistant**: Smart help features explained in plain language with 3 mini bullets
7. **Pricing**: Production-ready pricing with simple, clear messaging
8. **CTA**: Final conversion section with gradient card
9. **Footer**: Logo, nav links, legal links, copyright

## CTAs

All CTAs point to the app entry:
- **Get started** → https://app.agenteasepro.com
- **Log in** → https://app.agenteasepro.com
- **Talk to us** → mailto:hello@agenteasepro.com

## Navigation

Smooth scroll anchor links:
- Product → #product (Hero)
- Workflows → #workflows (Features)
- For Utah agents → #utah
- Pricing → #pricing

Mobile menu with hamburger toggle for small screens
