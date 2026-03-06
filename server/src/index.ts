import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { requestIdMiddleware, securityHeadersMiddleware, suspiciousActivityDetector } from './middleware/security';
import rateLimit from 'express-rate-limit';

// Note: this repo keeps environment variables at the monorepo root.
// In dev __dirname is server/src; in prod it's server/dist.
// Load root first for monorepo consistency, then allow server/.env as fallback.
dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });
dotenv.config({ path: path.join(__dirname, '../.env') });

// ── Production startup guard ──────────────────────────────────────────
if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
  const jwtSecret = process.env.JWT_SECRET || '';
  const placeholders = ['dev-secret', 'dev-secret-please-change-32-characters', 'replace-with-secure-secret', ''];
  if (placeholders.includes(jwtSecret)) {
    console.error('FATAL: JWT_SECRET must be set to a strong, unique value in production.');
    process.exit(1);
  }
  if (jwtSecret.length < 32) {
    console.error('FATAL: JWT_SECRET must be at least 32 characters in production.');
    process.exit(1);
  }
}

import { json, urlencoded } from 'express';
import { router as authRouter } from './routes/auth';
import { router as agentsRouter } from './routes/agents';
import { router as clientsRouter } from './routes/clients';
import { router as propertiesRouter } from './routes/properties';
import { router as dealsRouter } from './routes/deals';
import { router as repcRouter } from './routes/repc';
import { router as addendumsRouter } from './routes/addendums';
import { router as listingsRouter } from './routes/listings';
import { router as marketingRouter } from './routes/marketing';
import { processDueScheduledMassEmails } from './routes/marketing';
import { withLock } from './services/distributedLock';
import { registerBlastClick } from './services/marketingService';
import { router as esignRouter } from './routes/esign';
import { router as esignPublicRouter } from './routes/esignPublic';
import { router as formsRouter } from './routes/forms';
import { router as aiRouter } from './routes/ai';
import { router as calendarRouter } from './routes/calendar';
import { router as tasksRouter } from './routes/tasks';
import { router as mlsRouter } from './routes/mls';
import { router as contractsRouter } from './routes/contracts';
import { router as channelConnectionsRouter } from './routes/channelConnections';
import dailyActivityRouter from './routes/dailyActivity';
import automationsRouter from './routes/automations';
import { router as teamsRouter } from './routes/teams';
import { router as searchRouter } from './routes/search';
import { router as priorityActionsRouter } from './routes/priorityActions';
import { router as settingsRouter } from './routes/settings';
import leadsRouter from './routes/leads';
import landingPagesRouter from './routes/landingPages';
import publicLandingPagesRouter from './routes/publicLandingPages';
import { router as propertySearchRouter } from './routes/propertySearch';
import billingRouter, { webhookHandler } from './routes/billing';
import reportingRouter from './routes/reporting';
import { authMiddleware } from './middleware/auth';
import { router as internalRouter } from './routes/internal';
import { router as telemetryRouter } from './routes/telemetry';
import { router as supportRouter } from './routes/support';
import leadIntegrationsRouter from './routes/leadIntegrations';
import { sendgridEventsWebhookHandler, sendgridInboundParseHandler } from './routes/sendgridWebhook';
import { router as oauthRouter } from './routes/oauth';
import { router as contactEmailRouter } from './routes/contactEmail';
import { prisma } from './lib/prisma';
import { errorHandler } from './lib/apiResponse';

const app = express();
const sendgridInboundUpload = multer({
  limits: {
    files: 0,
    fields: 40,
    parts: 40,
    fieldNameSize: 100,
    fieldSize: 256 * 1024,
  },
});

const recentServerErrorFingerprints = new Map<string, number>();
const SERVER_ERROR_DEDUPE_WINDOW_MS = 60 * 1000;

function cleanupServerErrorFingerprints(now = Date.now()) {
  for (const [key, timestamp] of recentServerErrorFingerprints.entries()) {
    if (now - timestamp > SERVER_ERROR_DEDUPE_WINDOW_MS) {
      recentServerErrorFingerprints.delete(key);
    }
  }
}

// ── Security headers ────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", 'https://api.openai.com'],
      frameSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow loading cross-origin images
}));

// ── CORS ────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
if (process.env.NODE_ENV !== 'production' || allowedOrigins.length === 0) {
  // Dev: allow all origins
  allowedOrigins.push('http://localhost:5173', 'http://localhost:5174', 'http://localhost:3001');
}
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests (no origin header) or whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Security middleware ─────────────────────────────────────────────
app.use(requestIdMiddleware);
app.use(securityHeadersMiddleware);
app.use(suspiciousActivityDetector);

// ── Global API rate limiting ────────────────────────────────────────
const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,            // 300 requests per minute per IP for authenticated APIs
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks, webhooks, and static files
    return req.path === '/health' || req.path === '/api/health'
      || req.path === '/api/billing/webhook'
      || req.path.startsWith('/api/integrations/')
      || !req.path.startsWith('/api/');
  },
  message: { error: 'Too many requests, please try again later.' },
});
app.use(globalApiLimiter);

// Stripe webhook - raw body needed, no auth (must be registered BEFORE json())
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), webhookHandler);

// SendGrid Event Webhook - raw body needed for signature verification, no auth.
app.post(
  '/api/integrations/sendgrid/events',
  express.raw({ type: 'application/json' }),
  sendgridEventsWebhookHandler,
);

// SendGrid Inbound Parse - multipart/form-data payload for contact replies, no auth.
app.post('/api/integrations/sendgrid/inbound', sendgridInboundUpload.none(), sendgridInboundParseHandler);

app.use(json({ limit: '12mb' }));
app.use(urlencoded({ extended: true, limit: '12mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Convenience health endpoint under /api for tools/tests that only hit the API base path.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/agents', authMiddleware, agentsRouter);
app.use('/api/clients', authMiddleware, clientsRouter);
app.use('/api/properties', authMiddleware, propertiesRouter);
app.use('/api/deals', authMiddleware, dealsRouter);
app.use('/api/repc', authMiddleware, repcRouter);
app.use('/api/addendums', authMiddleware, addendumsRouter);
app.use('/api/listings', authMiddleware, listingsRouter);
app.use('/api/marketing', authMiddleware, marketingRouter);
app.use('/api/esign', authMiddleware, esignRouter);
app.use('/api/esign-public', esignPublicRouter);
app.use('/api/forms', authMiddleware, formsRouter);
app.use('/api/ai', authMiddleware, aiRouter);
app.use('/api/calendar', authMiddleware, calendarRouter);
app.use('/api/tasks', authMiddleware, tasksRouter);
app.use('/api/mls', authMiddleware, mlsRouter);
app.use('/api/contracts', authMiddleware, contractsRouter);
app.use('/api/channels', authMiddleware, channelConnectionsRouter);
app.use('/api/daily-activity', authMiddleware, dailyActivityRouter);
app.use('/api/automations', authMiddleware, automationsRouter);
app.use('/api/teams', authMiddleware, teamsRouter);
app.use('/api/search', authMiddleware, searchRouter);
app.use('/api/priority-actions', authMiddleware, priorityActionsRouter);
app.use('/api/settings', authMiddleware, settingsRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/landing-pages', authMiddleware, landingPagesRouter);
app.use('/api/sites', publicLandingPagesRouter); // Public - no auth required
app.use('/api/search', authMiddleware, propertySearchRouter);
app.use('/api/billing', authMiddleware, billingRouter);
app.use('/api/reporting', authMiddleware, reportingRouter);
app.use('/api/internal', authMiddleware, internalRouter);
app.use('/api/telemetry', authMiddleware, telemetryRouter);
app.use('/api/contact-email', contactEmailRouter);
app.use('/api/support', authMiddleware, supportRouter);
app.use('/api/integrations', leadIntegrationsRouter); // Public webhook endpoints
app.use('/api/oauth', oauthRouter); // OAuth routes - callbacks are public, connect endpoints use auth

// Serve uploaded assets (logos, imports, etc.)
// In dev __dirname is server/src; in prod use a writable temp dir.
const uploadsBaseDir = process.env.NODE_ENV === 'production'
  ? path.join(process.env.TMPDIR || process.env.TMP || '/tmp', 'agentease-uploads')
  : path.join(__dirname, '../uploads');
try {
  fs.mkdirSync(uploadsBaseDir, { recursive: true });
} catch (err) {
  console.warn('Unable to ensure uploads dir exists:', err);
}
app.use('/uploads', express.static(uploadsBaseDir));

// Stripe webhook - raw body needed, no auth
app.get('/go/:shortCode', async (req, res) => {
  try {
    const target = await registerBlastClick(req.params.shortCode, {
      ip: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
    if (!target) {
      return res.redirect(302, '/dashboard');
    }
    return res.redirect(302, target);
  } catch (err) {
    console.error('Short link error', err);
    return res.redirect(302, '/dashboard');
  }
});

// Capture server errors (best-effort). Avoids taking down responses if telemetry write fails.
app.use(async (err: any, req: any, res: any, next: any) => {
  try {
    const status = res?.statusCode && res.statusCode >= 400 ? res.statusCode : 500;
    const message = (err && (err.message || String(err))) || 'Unknown error';
    const trimmedMessage = String(message).slice(0, 2000);
    const pathValue = typeof req?.path === 'string' ? req.path.slice(0, 300) : undefined;
    const stackValue = err?.stack ? String(err.stack).slice(0, 12000) : undefined;
    console.error('Unhandled server error', { status, path: req?.path, message });

    cleanupServerErrorFingerprints();
    const fingerprint = [req?.agentId || '', status, req?.method || '', pathValue || '', trimmedMessage].join('|');
    const now = Date.now();
    const existing = recentServerErrorFingerprints.get(fingerprint);
    if (existing && now - existing <= SERVER_ERROR_DEDUPE_WINDOW_MS) {
      return next(err);
    }

    await prisma.internalError.create({
      data: {
        agentId: req?.agentId || null,
        source: 'server',
        message: trimmedMessage,
        stack: stackValue,
        path: pathValue,
        meta: {
          method: req?.method,
          status,
        },
      },
    });

    recentServerErrorFingerprints.set(fingerprint, now);
  } catch {
    // Swallow telemetry failures.
  }

  return next(err);
});

// In dev mode, __dirname is src/, in production it's dist/
const distPath = __dirname.endsWith('src') 
  ? path.join(__dirname, '../dist/public')
  : path.join(__dirname, 'public');
console.log('Static files directory:', distPath);
// Block access to dotfiles (e.g., /.git) for security.
app.use((req, res, next) => {
  if (req.path.startsWith('/.')) {
    return res.status(404).send('Not found');
  }
  return next();
});
app.use(express.static(distPath, { dotfiles: 'ignore' }));

// Global error handler (must be after all routes, before SPA fallback)
app.use('/api', errorHandler);

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(port, () => {
  console.log(`AgentEasePro API listening on port ${port}`);

  setTimeout(() => {
    withLock('scheduled-mass-emails', () => processDueScheduledMassEmails(), 55_000).catch((err) => {
      console.error('Initial scheduled mass email processing failed', err);
    });
  }, 15000);

  setInterval(() => {
    withLock('scheduled-mass-emails', () => processDueScheduledMassEmails(), 55_000).catch((err) => {
      console.error('Scheduled mass email processing failed', err);
    });
  }, 60 * 1000);
});
