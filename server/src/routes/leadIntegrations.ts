import { Router } from 'express';
import { LeadPriority, LeadSource } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const normalizeToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const parseLeadSource = (raw: unknown): LeadSource | undefined => {
  if (!raw) return undefined;
  const t = normalizeToken(String(raw));
  if (!t) return undefined;
  const asEnumKey = t.toUpperCase();
  if ((LeadSource as any)[asEnumKey]) return (LeadSource as any)[asEnumKey] as LeadSource;
  const aliases: Record<string, LeadSource> = {
    website: LeadSource.WEBSITE,
    web: LeadSource.WEBSITE,
    landing_page: LeadSource.LANDING_PAGE,
    landingpage: LeadSource.LANDING_PAGE,
    zillow: LeadSource.ZILLOW,
    realtor_com: LeadSource.REALTOR_COM,
    realtor: LeadSource.REALTOR_COM,
    facebook: LeadSource.FACEBOOK,
    fb: LeadSource.FACEBOOK,
    instagram: LeadSource.INSTAGRAM,
    ig: LeadSource.INSTAGRAM,
    google_ads: LeadSource.GOOGLE_ADS,
    google: LeadSource.GOOGLE_ADS,
    email: LeadSource.EMAIL,
    direct: LeadSource.DIRECT,
    referral: LeadSource.REFERRAL,
    referred: LeadSource.REFERRAL,
    other: LeadSource.OTHER,
  };
  return aliases[t];
};

const parseLeadPriority = (raw: unknown): LeadPriority | undefined => {
  if (!raw) return undefined;
  const t = normalizeToken(String(raw));
  if (!t) return undefined;
  const asEnumKey = t.toUpperCase();
  if ((LeadPriority as any)[asEnumKey]) return (LeadPriority as any)[asEnumKey] as LeadPriority;
  const aliases: Record<string, LeadPriority> = {
    hot: LeadPriority.HOT,
    warm: LeadPriority.WARM,
    cold: LeadPriority.COLD,
    dead: LeadPriority.DEAD,
    junk: LeadPriority.DEAD,
    lost: LeadPriority.DEAD,
  };
  return aliases[t];
};

const freeEmailDomains = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'aol.com',
  'live.com',
]);

const computeSpamScore = (payload: {
  email?: string;
  phone?: string;
  notes?: string;
  name?: string;
}) => {
  let score = 0;
  if (!payload.phone) score += 2;
  if (!payload.notes || payload.notes.trim().length < 10) score += 1;
  if (payload.email) {
    const domain = payload.email.split('@')[1] || '';
    if (freeEmailDomains.has(domain)) score += 1;
  } else {
    score += 2;
  }
  if (payload.name && payload.name.split(' ').length === 1) score += 1;
  return Math.min(score, 10);
};

const computeAiScore = (payload: {
  phone?: string;
  email?: string;
  notes?: string;
  sourceLabel?: string;
}) => {
  let score = 40;
  if (payload.phone) score += 20;
  if (payload.email) score += 10;
  if (payload.notes && payload.notes.trim().length > 20) score += 10;
  if (payload.sourceLabel) score += 10;
  return Math.max(0, Math.min(100, score));
};

const verifyHcaptcha = async (secret: string, token: string, ip?: string) => {
  const params = new URLSearchParams();
  params.set('secret', secret);
  params.set('response', token);
  if (ip) params.set('remoteip', ip);

  const resp = await fetch('https://hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!resp.ok) return false;
  const json = (await resp.json()) as { success?: boolean };
  return Boolean(json.success);
};

const webhookSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(120).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().max(40).optional(),
    source: z.any().optional(),
    sourceLabel: z.string().trim().max(80).optional(),
    priority: z.any().optional(),
    notes: z.string().trim().max(5000).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).optional(),
    websiteUrl: z.string().trim().max(200).optional(),
    listingId: z.string().trim().min(1).optional(),
    landingPageId: z.string().trim().min(1).optional(),
    utmData: z.record(z.any()).optional(),
    metadata: z.record(z.any()).optional(),
    honey: z.string().trim().max(120).optional(),
  })
  .strict();

const getWebhookToken = (req: any) => {
  const headerToken = req.get('x-agentease-token') || req.get('x-agent-ease-token');
  const auth = req.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : undefined;
  return headerToken || req.query?.token || req.body?.token || bearer;
};

router.post('/website-leads', async (req, res) => {
  try {
    const ipKey = String(req.ip || 'unknown');
    const now = Date.now();
    const limiter = rateLimitMap.get(ipKey);
    if (!limiter || limiter.resetAt < now) {
      rateLimitMap.set(ipKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    } else {
      limiter.count += 1;
      if (limiter.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Too many requests' });
      }
    }

    const token = getWebhookToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing webhook token' });
    }

    const parsed = webhookSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid lead payload' });
    }

    if (parsed.data.honey) {
      return res.status(200).json({ status: 'ok' });
    }

    const connection = await prisma.agentChannelConnection.findFirst({
      where: {
        type: 'WEBSITE',
        config: {
          path: ['webhookToken'],
          equals: token,
        },
      },
    });

    if (!connection) {
      return res.status(401).json({ error: 'Invalid webhook token' });
    }

    const agentId = connection.agentId;
    const config = (connection.config || {}) as any;
    const data = parsed.data;

    const parsedSource = parseLeadSource(data.source) ?? LeadSource.WEBSITE;
    const parsedPriority = parseLeadPriority(data.priority) ?? LeadPriority.WARM;

    let firstName = data.firstName?.trim() || '';
    let lastName = data.lastName?.trim() || '';
    if ((!firstName || !lastName) && data.name) {
      const parts = data.name.trim().split(' ').filter(Boolean);
      firstName = firstName || parts[0] || 'Lead';
      lastName = lastName || parts.slice(1).join(' ') || 'Website';
    }
    if (!firstName) firstName = 'Lead';
    if (!lastName) lastName = 'Website';

    const normalizedEmail = data.email?.trim().toLowerCase();
    const normalizedPhone = data.phone?.trim() || undefined;
    const incomingTags = Array.isArray(data.tags) ? data.tags.filter(Boolean) : [];
    const sourceLabel = data.sourceLabel || config.defaultSourceLabel || undefined;
    const sourceToken = sourceLabel ? normalizeToken(sourceLabel).slice(0, 32) : undefined;
    const sourceTag = sourceToken ? `SOURCE:${sourceToken}` : undefined;
    const normalizedTags = sourceTag ? [...incomingTags, sourceTag] : incomingTags;

    const spamShieldEnabled = Boolean(config.spamShieldEnabled ?? true);
    const spamScore = spamShieldEnabled
      ? computeSpamScore({ email: normalizedEmail, phone: normalizedPhone, notes: data.notes, name: data.name })
      : 0;
    const spamThreshold = Math.max(1, Number(config.spamThreshold || 6));
    const spamTag = spamScore >= spamThreshold ? 'SPAM_SUSPECT' : undefined;
    const finalTags = spamTag ? [...normalizedTags, spamTag] : normalizedTags;

    const aiScoringEnabled = Boolean(config.aiScoringEnabled ?? true);
    const aiScore = aiScoringEnabled
      ? computeAiScore({ phone: normalizedPhone, email: normalizedEmail, notes: data.notes, sourceLabel })
      : undefined;
    const aiScoreTag = aiScore !== undefined ? `AI:${Math.round(aiScore)}` : undefined;
    const taggedWithScore = aiScoreTag ? [...finalTags, aiScoreTag].slice(0, 12) : finalTags;

    const autoPriorityEnabled = Boolean(config.autoPriorityEnabled ?? true);
    const priorityFromAi = aiScore !== undefined
      ? aiScore >= 80
        ? LeadPriority.HOT
        : aiScore >= 50
          ? LeadPriority.WARM
          : LeadPriority.COLD
      : parsedPriority;
    const finalPriority = autoPriorityEnabled && !data.priority ? priorityFromAi : parsedPriority;

    const assignedTo = config.assignToLabel ? String(config.assignToLabel) : undefined;

    if (config.hcaptchaSecret) {
      const token = data.metadata?.hcaptchaToken ? String(data.metadata.hcaptchaToken) : '';
      if (!token) {
        return res.status(403).json({ error: 'Captcha token missing' });
      }
      const ok = await verifyHcaptcha(String(config.hcaptchaSecret), token, req.ip);
      if (!ok) {
        return res.status(403).json({ error: 'Captcha verification failed' });
      }
    }

    let lead;
    if (normalizedEmail) {
      const existing = await prisma.lead.findFirst({
        where: { agentId, email: normalizedEmail },
      });

      if (existing) {
        const notes = data.notes?.trim();
        const mergedNotes = notes
          ? existing.notes
            ? `${existing.notes}\n\n[Website Lead] ${notes}`
            : notes
          : existing.notes;

        const nextTags = Array.from(new Set([...(existing.tags || []), ...taggedWithScore]));

        lead = await prisma.lead.update({
          where: { id: existing.id },
          data: {
            ...(existing.firstName ? {} : { firstName }),
            ...(existing.lastName ? {} : { lastName }),
            ...(existing.phone ? {} : { phone: normalizedPhone }),
            source: parsedSource,
            priority: finalPriority,
            notes: mergedNotes,
            tags: nextTags,
            assignedTo,
            lastContact: new Date(),
          },
        });
      } else {
        lead = await prisma.lead.create({
          data: {
            agentId,
            firstName,
            lastName,
            email: normalizedEmail,
            phone: normalizedPhone,
            source: parsedSource,
            priority: finalPriority,
            notes: data.notes?.trim() || undefined,
            tags: taggedWithScore,
            listingId: data.listingId,
            landingPageId: data.landingPageId,
            assignedTo,
            lastContact: new Date(),
          },
        });
      }
    } else {
      if (!normalizedPhone) {
        return res.status(400).json({ error: 'Email or phone is required' });
      }
      lead = await prisma.lead.create({
        data: {
          agentId,
          firstName,
          lastName,
          email: `${Date.now()}@placeholder.agentease`,
          phone: normalizedPhone,
          source: parsedSource,
          priority: finalPriority,
          notes: data.notes?.trim() || undefined,
          tags: taggedWithScore,
          listingId: data.listingId,
          landingPageId: data.landingPageId,
          assignedTo,
          lastContact: new Date(),
        },
      });
    }

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        activityType: 'WEBSITE_CAPTURE',
        description: 'Lead captured from website integration',
        metadata: {
          websiteUrl: data.websiteUrl,
          sourceLabel,
          aiScore,
          spamScore,
          utmData: data.utmData,
          metadata: data.metadata,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        },
      },
    });

    const sequence = Array.isArray(config.followUpSequence) ? config.followUpSequence : [];
    if (sequence.length > 0 && !spamTag) {
      const tasks = sequence
        .filter((s: any) => s && s.type && s.minutes)
        .map((step: any) => {
          const minutes = Math.max(5, Number(step.minutes || 15));
          const dueAt = new Date(Date.now() + minutes * 60 * 1000);
          const hoursAhead = (dueAt.getTime() - Date.now()) / (1000 * 60 * 60);
          const bucket = hoursAhead <= 24 ? 'TODAY' : hoursAhead <= 72 ? 'THIS_WEEK' : 'LATER';
          const kind = String(step.type).toUpperCase();
          const titlePrefix = kind === 'SMS' ? 'Send SMS' : kind === 'EMAIL' ? 'Send Email' : 'Call';
          const category = kind === 'CALL' ? 'CALL' : kind === 'EMAIL' ? 'MARKETING' : 'GENERAL';
          return {
            agentId,
            title: `${titlePrefix}: ${lead.firstName} ${lead.lastName}`,
            description: sourceLabel ? `New lead from ${sourceLabel}.` : 'New lead captured from website.',
            category,
            priority: 'NORMAL',
            bucket,
            dueAt,
            createdFrom: 'SYSTEM',
          };
        });

      if (tasks.length > 0) {
        await prisma.task.createMany({ data: tasks });
      }
    } else if (config.followUpEnabled && !spamTag) {
      const minutes = Math.max(5, Number(config.followUpMinutes || 15));
      const dueAt = new Date(Date.now() + minutes * 60 * 1000);
      const hoursAhead = (dueAt.getTime() - Date.now()) / (1000 * 60 * 60);
      const bucket = hoursAhead <= 24 ? 'TODAY' : hoursAhead <= 72 ? 'THIS_WEEK' : 'LATER';

      await prisma.task.create({
        data: {
          agentId,
          title: `Follow up: ${lead.firstName} ${lead.lastName}`,
          description: sourceLabel ? `New lead from ${sourceLabel}.` : 'New lead captured from website.',
          category: 'CALL',
          priority: 'NORMAL',
          bucket,
          dueAt,
          createdFrom: 'SYSTEM',
        },
      });
    }

    if (data.landingPageId) {
      await prisma.landingPage.update({
        where: { id: data.landingPageId },
        data: { leadsGenerated: { increment: 1 } },
      });
    }

    res.json({ status: 'ok', leadId: lead.id });
  } catch (error) {
    console.error('Website lead webhook error:', error);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
});

router.get('/lead-capture', async (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    return res.status(400).send('Missing token');
  }

  const connection = await prisma.agentChannelConnection.findFirst({
    where: {
      type: 'WEBSITE',
      config: {
        path: ['webhookToken'],
        equals: token,
      },
    },
  });

  if (!connection) {
    return res.status(404).send('Invalid token');
  }

  const config = (connection.config || {}) as any;
  const hcaptchaSiteKey = config.hcaptchaSiteKey || '';

  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Contact Agent</title>
      <style>
        :root { color-scheme: dark; }
        body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background:#0f172a; color:#e2e8f0; }
        .container { max-width: 520px; margin: 32px auto; padding: 24px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        h1 { margin: 0 0 12px; font-size: 22px; }
        p { margin: 0 0 16px; color:#94a3b8; font-size: 14px; }
        label { display:block; font-size: 12px; margin: 12px 0 6px; color:#cbd5f5; }
        input, textarea { width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.2); background: rgba(15, 23, 42, 0.6); color:#e2e8f0; font-size: 14px; }
        textarea { min-height: 90px; resize: vertical; }
        button { margin-top: 16px; width: 100%; padding: 12px 16px; border-radius: 12px; border: 0; background: #22d3ee; color:#0f172a; font-weight: 600; cursor:pointer; }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
        .status { margin-top: 12px; font-size: 12px; }
        .success { color: #34d399; }
        .error { color: #fb7185; }
      </style>
      ${hcaptchaSiteKey ? `<script src="https://js.hcaptcha.com/1/api.js" async defer></script>` : ''}
    </head>
    <body>
      <div class="container">
        <h1>Contact your agent</h1>
        <p>Share your details and we’ll reach out quickly.</p>
        <form id="lead-form">
          <input type="text" id="company" name="company" style="display:none" autocomplete="off" />
          <label for="name">Full name</label>
          <input id="name" name="name" placeholder="Jane Buyer" required />

          <label for="email">Email</label>
          <input id="email" name="email" type="email" placeholder="jane@email.com" required />

          <label for="phone">Phone (optional)</label>
          <input id="phone" name="phone" placeholder="(555) 123-4567" />

          <label for="notes">Message</label>
          <textarea id="notes" name="notes" placeholder="Tell us what you’re looking for..." required></textarea>

          ${hcaptchaSiteKey ? `<div class="h-captcha" data-sitekey="${hcaptchaSiteKey}"></div>` : ''}

          <button type="submit" id="submit">Send</button>
          <div class="status" id="status"></div>
        </form>
      </div>
      <script>
        const form = document.getElementById('lead-form');
        const statusEl = document.getElementById('status');
        const submitBtn = document.getElementById('submit');
        const params = new URLSearchParams(window.location.search);
        const sourceLabel = params.get('label') || params.get('source') || '';
        const priority = params.get('priority') || '';
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          submitBtn.disabled = true;
          statusEl.textContent = '';
          try {
            const hcaptchaToken = window.hcaptcha ? window.hcaptcha.getResponse() : '';
            const body = {
              name: form.name.value,
              email: form.email.value,
              phone: form.phone.value,
              notes: form.notes.value,
              source: 'WEBSITE',
              priority: priority || 'WARM',
              sourceLabel: sourceLabel || undefined,
              honey: form.company.value,
              metadata: {
                hcaptchaToken: hcaptchaToken || undefined,
              },
            };
            const resp = await fetch('/api/integrations/website-leads', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-agentease-token': ${JSON.stringify(token)},
              },
              body: JSON.stringify(body),
            });
            if (!resp.ok) throw new Error('Failed to submit');
            form.reset();
            statusEl.textContent = 'Thanks! We received your info.';
            statusEl.className = 'status success';
          } catch (err) {
            statusEl.textContent = 'Sorry, something went wrong. Please try again.';
            statusEl.className = 'status error';
          } finally {
            submitBtn.disabled = false;
          }
        });
      </script>
    </body>
  </html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
