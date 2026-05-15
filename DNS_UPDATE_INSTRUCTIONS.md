# DNS Update Instructions for AgentEasePro

## Current Status
✅ Marketing site deployed to: https://agenteasepro-marketing-52f7137382f6.herokuapp.com/
✅ Domains added to Heroku marketing app
✅ SSL certificates provisioned

## DNS Changes Required

### At GoDaddy (or your DNS provider):

### 1. Root Domain: agenteasepro.com
**Current Configuration:**
- Type: A Records
- Values: 76.223.105.230, 13.248.243.5

**New Configuration:**
- **Remove:** Both A records
- **Add:** ALIAS or ANAME record
- **Target:** `floating-slug-vvdwdvzx7ze7xl7zxrem0cbp.herokudns.com`
- **TTL:** 3600 (1 hour)

> **Note:** If GoDaddy doesn't support ALIAS/ANAME records, use their "@ CNAME flattening" feature or contact support. Alternatively, you can add an A record, but you'll need to get the IP from Heroku support.

### 2. WWW Subdomain: www.agenteasepro.com
**Current Configuration:**
- Type: CNAME
- Value: agenteasepro.com

**New Configuration:**
- **Update:** CNAME record
- **Target:** `primal-baryonyx-kxq41tjeta5uwat604l9wpp5.herokudns.com`
- **TTL:** 3600 (1 hour)

### 3. App Subdomain: app.agenteasepro.com
**Current Configuration:**
- Type: CNAME
- Value: infinite-mandrill-7qpi6fk8yg72zxp0ruv88erp.herokudns.com

**New Configuration:**
- **No changes needed** - Keep as is!

### 4. Internal Subdomain: internal.agenteasepro.com
**Current Configuration:**
- Type: CNAME
- Value: skeletal-corn-2gqkw0n1ovahlex6baj8usi9.herokudns.com

**New Configuration:**
- **No changes needed** - Keep as is!

## After DNS Update

1. **Wait for propagation** (up to 1 hour with TTL 3600)
2. **Test URLs:**
   - https://agenteasepro.com → Should show marketing site
   - https://www.agenteasepro.com → Should show marketing site
   - https://app.agenteasepro.com → Should show main app (unchanged)

3. **Verify SSL certificates:**
   - All URLs should have valid SSL (padlock icon)
   - Heroku automatically provisions SSL for custom domains

## Quick Test Commands

```bash
# Check DNS propagation
nslookup agenteasepro.com
nslookup www.agenteasepro.com
nslookup app.agenteasepro.com

# Test HTTP response
curl -I https://agenteasepro.com
curl -I https://www.agenteasepro.com
curl -I https://app.agenteasepro.com
```

## Heroku App URLs

- **Marketing site:** https://agenteasepro-marketing-52f7137382f6.herokuapp.com/
- **Main app:** https://agenteasepro-3cf0df357839.herokuapp.com/

## Rollback Plan

If issues occur:
1. Revert DNS changes to previous values
2. Wait for propagation
3. Debug and try again

## Support

- Heroku DNS docs: https://devcenter.heroku.com/articles/custom-domains
- GoDaddy CNAME flattening: https://www.godaddy.com/help/cname-flattening-overview-19904
