# AgentEasePro Heroku Deployment Guide

## ✅ Deployment Status

### What's Been Configured

1. **Git Repository**: Initialized and committed all code
2. **Heroku App**: Connected to `agenteasepro` 
3. **Database**: PostgreSQL (essential-0 plan) provisioned
4. **Environment Variables**: 
   - `DATABASE_URL` (auto-configured by Heroku Postgres)
   - `JWT_SECRET` (production secret)
   - `NODE_ENV=production`
5. **Build Process**: heroku-postbuild configured for monorepo
6. **Release Phase**: Prisma migrations run automatically on deploy

### App URL
**https://agenteasepro-3cf0df357839.herokuapp.com**

---

## 📋 Current Build Process

The `heroku-postbuild` script in `package.json` runs:
1. Install web dependencies
2. Build React/Vite frontend
3. Install server dependencies
4. Build TypeScript backend

The `release` phase in `Procfile` runs:
1. Prisma migrate deploy
2. Prisma generate

Then the `web` dyno starts:
- `node server/dist/index.js`

---

## 🔧 Post-Deployment Steps

### 1. Seed the Database (One-time)

Run this command to populate initial data:

```powershell
heroku run "cd server && npm run seed" -a agenteasepro
```

Or seed forms:

```powershell
heroku run "cd server && npm run seed:forms" -a agenteasepro
```

### 2. Scale the Dyno (if needed)

Check current dyno status:

```powershell
heroku ps -a agenteasepro
```

Scale up if needed:

```powershell
heroku ps:scale web=1 -a agenteasepro
```

### 3. Check Logs

View real-time logs:

```powershell
heroku logs --tail -a agenteasepro
```

Check for errors:

```powershell
heroku logs --tail --level error -a agenteasepro
```

---

## 🚀 Deploying Updates

### Quick Deploy

After making changes locally:

```powershell
git add .
git commit -m "Your update message"
git push heroku master
```

### Force Push (if needed)

```powershell
git push heroku master --force
```

### Rollback to Previous Release

```powershell
heroku releases -a agenteasepro
heroku rollback v# -a agenteasepro
```

---

## 🔐 Managing Environment Variables

### View all config

```powershell
heroku config -a agenteasepro
```

### Set a variable

```powershell
heroku config:set VARIABLE_NAME=value -a agenteasepro
```

### Unset a variable

```powershell
heroku config:unset VARIABLE_NAME -a agenteasepro
```

### Add AI Provider Keys (when ready)

```powershell
heroku config:set OPENAI_API_KEY=sk-your-key-here -a agenteasepro
heroku config:set AI_PROVIDER=openai -a agenteasepro
```

---

## 🗄️ Database Management

### Open Database Console

```powershell
heroku pg:psql -a agenteasepro
```

### View Database Info

```powershell
heroku pg:info -a agenteasepro
```

### Run Migrations Manually

```powershell
heroku run "cd server && npx prisma migrate deploy" -a agenteasepro
```

### Reset Database (⚠️ DESTRUCTIVE)

```powershell
heroku pg:reset DATABASE_URL -a agenteasepro --confirm agenteasepro
heroku run "cd server && npx prisma migrate deploy" -a agenteasepro
heroku run "cd server && npm run seed" -a agenteasepro
```

### Backup Database

```powershell
heroku pg:backups:capture -a agenteasepro
heroku pg:backups:download -a agenteasepro
```

---

## 📊 Monitoring

### App Dashboard

https://dashboard.heroku.com/apps/agenteasepro

### Metrics

```powershell
heroku logs --tail -a agenteasepro
```

### Performance

Check response times and throughput:

```powershell
heroku logs --ps router -a agenteasepro
```

---

## 🐛 Troubleshooting

### Build Failed

1. Check build output:
   ```powershell
   heroku logs --tail -a agenteasepro
   ```

2. Verify engines in package.json match Heroku's supported versions

3. Test build locally:
   ```powershell
   npm install
   npm run heroku-postbuild
   ```

### App Crashes

1. Check logs:
   ```powershell
   heroku logs --tail -a agenteasepro
   ```

2. Verify all environment variables are set

3. Check dyno status:
   ```powershell
   heroku ps -a agenteasepro
   ```

4. Restart dynos:
   ```powershell
   heroku restart -a agenteasepro
   ```

### Database Issues

1. Check connection:
   ```powershell
   heroku pg:info -a agenteasepro
   ```

2. Run migrations:
   ```powershell
   heroku run "cd server && npx prisma migrate deploy" -a agenteasepro
   ```

3. Verify DATABASE_URL:
   ```powershell
   heroku config:get DATABASE_URL -a agenteasepro
   ```

---

## 💰 Cost Management

### Current Plan

- **Dyno**: Eco (free tier available with verification)
- **Database**: Essential-0 (~$5/month)

### Upgrade Options

**Dyno:**
```powershell
heroku ps:resize web=basic -a agenteasepro  # $7/month
heroku ps:resize web=standard-1x -a agenteasepro  # $25/month
```

**Database:**
```powershell
heroku addons:upgrade postgresql-asymmetrical-49844:mini  # $15/month
```

---

## 🔄 CI/CD Integration (Optional)

### GitHub Integration

1. Go to https://dashboard.heroku.com/apps/agenteasepro/deploy/github
2. Connect your GitHub repository
3. Enable automatic deploys from main/master branch
4. Optional: Enable "Wait for CI to pass before deploy"

### Manual Deploy from GitHub

```powershell
git remote add origin https://github.com/yourusername/agenteasepro.git
git push origin master
```

Then trigger deploy from Heroku dashboard or CLI.

---

## 📝 Deployment Checklist

- [x] Git repository initialized
- [x] Heroku app created and connected
- [x] PostgreSQL database provisioned
- [x] Environment variables configured
- [x] Procfile with release phase
- [x] Build scripts configured
- [ ] Initial deployment completed
- [ ] Database seeded with demo data
- [ ] App tested on production URL
- [ ] Custom domain configured (optional)
- [ ] SSL certificate verified (auto-configured)
- [ ] Monitoring alerts set up (optional)

---

## 🌐 Custom Domain (Optional)

### Add Domain

```powershell
heroku domains:add www.agenteasepro.com -a agenteasepro
heroku domains:add agenteasepro.com -a agenteasepro
```

### Get DNS Target

```powershell
heroku domains -a agenteasepro
```

Then add CNAME record in your DNS provider pointing to the Heroku DNS target.

### SSL

Heroku provides automatic SSL for custom domains (ACM). Just wait a few minutes after adding the domain.

---

## 📞 Support

- **Heroku Docs**: https://devcenter.heroku.com/
- **Status**: https://status.heroku.com/
- **Support**: https://help.heroku.com/

---

## 🎉 Next Steps

1. **Test the deployed app** at https://agenteasepro-3cf0df357839.herokuapp.com
2. **Seed the database** with demo data
3. **Set up monitoring** and alerts
4. **Configure custom domain** (if desired)
5. **Add API keys** for AI features when ready
6. **Set up GitHub integration** for automatic deploys

Your beautiful redesigned AgentEasePro is ready for the world! 🚀
