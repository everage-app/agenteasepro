# AgentEasePro Marketing Site - Deployment Guide

## Overview

The marketing site lives in `/landing` and is deployed separately from the main app at `app.agenteasepro.com`.

**URLs:**
- Marketing site: https://agenteasepro.com (root domain + www)
- Main app: https://app.agenteasepro.com (Heroku)

## Build for Production

```bash
cd landing
npm install
npm run build
```

This creates an optimized production build in `landing/dist/`

## Deployment Options

### Option 1: Netlify (Recommended)

1. **Install Netlify CLI** (if not already installed):
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy from landing directory**:
   ```bash
   cd landing
   npm run build
   netlify deploy --prod --dir=dist
   ```

3. **Configure Netlify**:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: 18 or higher

4. **Update DNS** (in your domain registrar):
   - Remove current A records for `agenteasepro.com`
   - Add Netlify's DNS records (provided after deployment)
   - Update `www.agenteasepro.com` CNAME to point to Netlify
   - Keep `app.agenteasepro.com` CNAME pointing to Heroku

### Option 2: Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Deploy from landing directory**:
   ```bash
   cd landing
   npm run build
   vercel --prod
   ```

3. **Configure Vercel**:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Root directory: `landing`

4. **Update DNS**:
   - Point `agenteasepro.com` and `www.agenteasepro.com` to Vercel
   - Keep `app.agenteasepro.com` pointing to Heroku

### Option 3: Heroku (Static Site)

1. **Create new Heroku app** for marketing site:
   ```bash
   heroku create agenteasepro-marketing
   ```

2. **Add buildpack**:
   ```bash
   heroku buildpacks:set heroku/nodejs
   heroku buildpacks:add heroku-community/static
   ```

3. **Create static.json** in landing directory:
   ```json
   {
     "root": "dist",
     "clean_urls": true,
     "routes": {
       "/**": "index.html"
     }
   }
   ```

4. **Deploy**:
   ```bash
   git subtree push --prefix landing heroku main
   ```

5. **Update DNS**:
   - Point `agenteasepro.com` and `www.agenteasepro.com` to new Heroku app
   - Keep `app.agenteasepro.com` pointing to main app

## DNS Configuration

**Current DNS (GoDaddy):**
- `agenteasepro.com` → AWS Global Accelerator (76.223.105.230, 13.248.243.5)
- `www.agenteasepro.com` → CNAME to agenteasepro.com
- `app.agenteasepro.com` → Heroku (infinite-mandrill-7qpi6fk8yg72zxp0ruv88erp.herokudns.com)

**After Marketing Site Deployment:**
- `agenteasepro.com` → Netlify/Vercel (update A records)
- `www.agenteasepro.com` → Netlify/Vercel (update CNAME)
- `app.agenteasepro.com` → Keep pointing to Heroku (DO NOT CHANGE)

## Testing Before DNS Change

Test the built site locally:
```bash
cd landing
npm run build
npx serve dist
```

Opens on http://localhost:3000 (or next available port)

## Rollback Plan

If issues arise after DNS change:
1. Revert DNS records to previous values
2. Wait for propagation (up to 1 hour with TTL 3600)
3. Debug marketing site issues
4. Re-deploy when ready

## Post-Deployment Checklist

- [ ] Marketing site loads at https://agenteasepro.com
- [ ] `www.agenteasepro.com` redirects to `agenteasepro.com`
- [ ] All sections render correctly
- [ ] Navigation anchor links work
- [ ] Mobile menu works
- [ ] All CTAs point to https://app.agenteasepro.com
- [ ] Main app still accessible at https://app.agenteasepro.com
- [ ] SSL certificate valid for both domains

## Environment Variables

None needed for marketing site (static build).

## Monitoring

- Monitor Netlify/Vercel analytics for traffic
- Check Google Analytics (if configured)
- Monitor Heroku logs for main app: `heroku logs --tail -a agenteasepro`

## Support

- Marketing site issues: hello@agenteasepro.com
- Main app issues: Check Heroku logs
