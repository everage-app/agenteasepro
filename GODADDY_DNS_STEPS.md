# GoDaddy DNS Update - Step by Step

## Current Problem
- agenteasepro.com is showing GoDaddy's "Launching Soon" page
- DNS is pointing to old WebsiteBuilder instead of Heroku marketing site

## Exact Steps to Fix

### Step 1: Delete Old Records

1. **Delete the WebsiteBuilder Site (Type A)**
   - Click the **trash icon** on the first row
   - Confirm deletion

### Step 2: Add New Root Domain Records

**Choose ONE of these options:**

#### OPTION A: Using CNAME (Preferred if GoDaddy allows it)
1. Click **"Add"** button
2. Type: `CNAME`
3. Name: `@` (this represents the root domain)
4. Value: `floating-slug-vvdwdvzx7ze7xl7zxrem0cbp.herokudns.com`
5. TTL: `1 Hour`
6. Click **Save**

#### OPTION B: Using A Records (If CNAME @ doesn't work)
If GoDaddy won't let you use @ with CNAME, add these 4 A records:

**A Record 1:**
- Type: `A`
- Name: `@`
- Value: `76.223.57.73`
- TTL: `1 Hour`

**A Record 2:**
- Type: `A`
- Name: `@`
- Value: `3.33.241.96`
- TTL: `1 Hour`

**A Record 3:**
- Type: `A`
- Name: `@`
- Value: `13.248.213.92`
- TTL: `1 Hour`

**A Record 4:**
- Type: `A`
- Name: `@`
- Value: `15.197.149.68`
- TTL: `1 Hour`

### Step 3: Update WWW Record

1. Click **Edit** (pencil icon) on the `www` CNAME record
2. Change the value from `agenteasepro.com` to:
   ```
   primal-baryonyx-kxq41tjeta5uwat604l9wpp5.herokudns.com
   ```
3. Click **Save**

### Step 4: Verify Other Records (Don't Change These)

✅ **app** CNAME should stay as: `infinite-mandrill-7qpi6fk8yg72zxp0ruv88erp.herokudns.com`
✅ **internal** CNAME should stay as: `skeletal-corn-2gqkw0n1ovahlex6baj8usi9.herokudns.com`

## After Saving

1. **Wait 5-10 minutes** for DNS propagation (with 1 hour TTL, it could take up to 1 hour max)
2. **Clear your browser cache** or try incognito mode
3. **Test the URLs:**
   - https://agenteasepro.com → Should show your new marketing site
   - https://www.agenteasepro.com → Should show your new marketing site
   - https://app.agenteasepro.com → Should still work (main app)

## Troubleshooting

If agenteasepro.com still shows the old page after 10 minutes:
1. Clear browser cache (Ctrl+F5)
2. Try a different browser or incognito mode
3. Check DNS propagation: https://dnschecker.org/#A/agenteasepro.com
4. Wait the full hour for TTL to expire

## Expected Final DNS Configuration

| Type  | Name     | Value/Target                                          |
|-------|----------|-------------------------------------------------------|
| A     | @        | 76.223.57.73, 3.33.241.96, 13.248.213.92, 15.197.149.68 |
| CNAME | www      | primal-baryonyx-kxq41tjeta5uwat604l9wpp5.herokudns.com |
| CNAME | app      | infinite-mandrill-7qpi6fk8yg72zxp0ruv88erp.herokudns.com |
| CNAME | internal | skeletal-corn-2gqkw0n1ovahlex6baj8usi9.herokudns.com |

## Quick Verification Commands

Once you've made the changes, run these in PowerShell:

```powershell
# Check if DNS is updated
nslookup agenteasepro.com

# Test HTTP response
curl -I https://agenteasepro.com
```

You should see the Heroku IP addresses in the nslookup results.
