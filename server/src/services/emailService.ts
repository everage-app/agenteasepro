import { prisma } from '../lib/prisma';
import { withPrismaRetry } from '../lib/prismaRetry';

/**
 * Email Service - SendGrid Integration
 * Centralized email sending for all app features:
 * - eSign document signing requests
 * - Marketing email blasts
 * - Password reset emails
 * - Notifications
 */

interface EmailParams {
  agentId?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  fromName?: string;
  fromEmail?: string;
  quotaFeature?: string;
  countAgainstMonthlyLimit?: boolean;
  recordQuotaUsage?: boolean;
  categories?: string[];
  customArgs?: Record<string, string>;
  headers?: Record<string, string>;
  asm?: {
    groupId: number;
    groupsToDisplay?: number[];
  };
  attachments?: Array<{
    content: string; // base64 encoded
    filename: string;
    type: string;
    disposition?: 'attachment' | 'inline';
  }>;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  quotaBlocked?: boolean;
  quota?: AgentEmailUsage & { requested: number };
}

export type AgentEmailUsage = {
  limit: number;
  used: number;
  remaining: number;
  monthStart: Date;
  monthEnd: Date;
};

type ResolvedEmailIdentity = {
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  requestedFromEmail?: string;
  senderMode: 'default' | 'custom' | 'fallback';
};

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';
const DEFAULT_MONTHLY_AGENT_EMAIL_LIMIT = 200;
const AGENT_EMAIL_USAGE_EVENT = 'agent_email_sent';

export function getMonthlyAgentEmailLimit(): number {
  const configured = Number(process.env.AGENT_MONTHLY_EMAIL_LIMIT || process.env.MONTHLY_AGENT_EMAIL_LIMIT || 0);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_MONTHLY_AGENT_EMAIL_LIMIT;
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: unknown): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextToHtml(value: unknown): string {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function safeHttpUrl(value: unknown): string | undefined {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  try {
    const baseUrl = process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || process.env.WEB_BASE_URL;
    const parsed = raw.startsWith('/') && baseUrl ? new URL(raw, baseUrl) : new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return parsed.toString().slice(0, 1000);
  } catch {
    return undefined;
  }
}

function compactStringRecord(input: Record<string, string | undefined | null>) {
  return Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => [key, String(value || '').trim()] as const)
      .filter(([, value]) => Boolean(value)),
  );
}

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

function asMetaRecord(meta: unknown): Record<string, any> {
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta as Record<string, any> : {};
}

function readRecipientCount(meta: unknown, fallback = 1): number {
  const record = asMetaRecord(meta);
  const count = Number(record.recipientsCount ?? record.recipientCount ?? record.count);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : fallback;
}

function normalizeQuotaFeature(value: unknown): string {
  const feature = String(value || 'email')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 60);
  return feature || 'email';
}

export async function getMonthlyAgentEmailUsage(agentId: string, date = new Date()): Promise<AgentEmailUsage> {
  const { start, end } = getMonthRange(date);

  const [marketingRows, quotaEvents, legacyContactEvents] = await withPrismaRetry(() =>
    Promise.all([
      prisma.marketingDeliveryLog.findMany({
        where: {
          agentId,
          status: 'SENT',
          createdAt: { gte: start, lt: end },
        },
        select: { recipientsCount: true },
      }),
      prisma.internalEvent.findMany({
        where: {
          agentId,
          kind: AGENT_EMAIL_USAGE_EVENT,
          createdAt: { gte: start, lt: end },
        },
        select: { meta: true },
      }),
      prisma.internalEvent.findMany({
        where: {
          agentId,
          kind: 'contact_email_sent',
          createdAt: { gte: start, lt: end },
        },
        select: { meta: true },
      }),
    ]),
  );

  const marketingUsed = marketingRows.reduce((sum, row) => sum + Math.max(0, row.recipientsCount || 0), 0);
  const ledgerUsed = quotaEvents.reduce((sum, row) => sum + readRecipientCount(row.meta), 0);
  const ledgerContactUsed = quotaEvents
    .filter((row) => normalizeQuotaFeature(asMetaRecord(row.meta).feature) === 'contact_email')
    .reduce((sum, row) => sum + readRecipientCount(row.meta), 0);
  const legacyContactUsed = Math.max(0, legacyContactEvents.length - ledgerContactUsed);
  const used = marketingUsed + ledgerUsed + legacyContactUsed;
  const limit = getMonthlyAgentEmailLimit();

  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    monthStart: start,
    monthEnd: end,
  };
}

async function recordAgentEmailUsage(params: {
  agentId: string;
  recipientsCount: number;
  feature: string;
  subject: string;
  messageId?: string;
  categories?: string[];
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  requestedFromEmail?: string;
  senderMode: ResolvedEmailIdentity['senderMode'];
}) {
  await withPrismaRetry(() =>
    prisma.internalEvent.create({
      data: {
        agentId: params.agentId,
        kind: AGENT_EMAIL_USAGE_EVENT,
        path: 'emailService.sendEmail',
        meta: {
          feature: params.feature,
          recipientsCount: params.recipientsCount,
          subject: params.subject.slice(0, 300),
          messageId: params.messageId || null,
          categories: params.categories || [],
          fromEmail: params.fromEmail,
          fromName: params.fromName,
          replyTo: params.replyTo || null,
          requestedFromEmail: params.requestedFromEmail || null,
          senderMode: params.senderMode,
        },
      },
    }),
  );
}

function getDefaultSenderEmail(): string {
  return normalizeEmail(process.env.SENDGRID_FROM_EMAIL || process.env.SENDER_EMAIL || '');
}

function getESignTrackingEmail(): string {
  return normalizeEmail(process.env.ESIGN_TRACKING_EMAIL || process.env.SENDGRID_FROM_EMAIL || process.env.SENDER_EMAIL || '');
}

function getAllowedSenderDomains(defaultSenderEmail: string): string[] {
  const configuredDomains = String(process.env.SENDGRID_ALLOWED_FROM_DOMAINS || '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  if (configuredDomains.length > 0) {
    return Array.from(new Set(configuredDomains));
  }

  const defaultDomain = defaultSenderEmail.split('@')[1] || '';
  return defaultDomain ? [defaultDomain] : [];
}

function canUseRequestedSenderEmail(requestedFromEmail: string, defaultSenderEmail: string): boolean {
  if (!requestedFromEmail) return false;
  if (!defaultSenderEmail) return true;
  if (requestedFromEmail === defaultSenderEmail) return true;

  const requestedDomain = requestedFromEmail.split('@')[1] || '';
  return getAllowedSenderDomains(defaultSenderEmail).includes(requestedDomain);
}

export function resolveEmailIdentity(params: Pick<EmailParams, 'fromEmail' | 'fromName' | 'replyTo'>): ResolvedEmailIdentity {
  const defaultSenderEmail = getDefaultSenderEmail();
  const requestedFromEmail = normalizeEmail(params.fromEmail);
  const requestedReplyTo = normalizeEmail(params.replyTo);
  const configuredFromName = String(process.env.SENDGRID_FROM_NAME || process.env.SENDER_NAME || '').trim();
  const fromName = String(params.fromName || configuredFromName || 'AgentEase Pro').trim() || 'AgentEase Pro';

  let fromEmail = defaultSenderEmail || requestedFromEmail;
  let replyTo = requestedReplyTo || undefined;
  let senderMode: ResolvedEmailIdentity['senderMode'] = 'default';

  if (requestedFromEmail) {
    if (canUseRequestedSenderEmail(requestedFromEmail, defaultSenderEmail)) {
      fromEmail = requestedFromEmail;
      senderMode = requestedFromEmail === defaultSenderEmail ? 'default' : 'custom';
    } else {
      senderMode = 'fallback';
      replyTo = replyTo || requestedFromEmail;
      console.warn(
        `Email sender fallback: requested fromEmail ${requestedFromEmail} is not on an allowed SendGrid sender domain. Using ${defaultSenderEmail || requestedFromEmail} instead.`,
      );
    }
  }

  return {
    fromEmail,
    fromName,
    replyTo,
    requestedFromEmail: requestedFromEmail || undefined,
    senderMode,
  };
}

/**
 * Send an email via SendGrid
 */
export async function sendEmail(params: EmailParams): Promise<SendResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const identity = resolveEmailIdentity(params);
  const fromEmail = identity.fromEmail;
  const agentId = String(params.agentId || '').trim();
  const quotaFeature = normalizeQuotaFeature(params.quotaFeature || params.categories?.[0] || params.customArgs?.feature);
  const countAgainstMonthlyLimit = Boolean(agentId) && params.countAgainstMonthlyLimit !== false;
  const recordQuotaUsage = countAgainstMonthlyLimit && params.recordQuotaUsage !== false;

  if (!apiKey) {
    console.warn('⚠️ SENDGRID_API_KEY not configured - email not sent');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  if (!fromEmail) {
    console.warn('⚠️ SENDGRID_FROM_EMAIL not configured - email not sent');
    return { success: false, error: 'Sender email not configured' };
  }

  // Normalize recipients to array
  const recipients = Array.from(
    new Set(
      (Array.isArray(params.to) ? params.to : [params.to])
        .map((email) => normalizeEmail(email))
        .filter(Boolean),
    ),
  );

  if (recipients.length === 0) {
    return { success: false, error: 'No valid recipients provided' };
  }

  if (countAgainstMonthlyLimit) {
    try {
      const usage = await getMonthlyAgentEmailUsage(agentId);
      if (recipients.length > usage.remaining) {
        return {
          success: false,
          quotaBlocked: true,
          quota: { ...usage, requested: recipients.length },
          error: `Monthly email limit exceeded. Remaining: ${usage.remaining}, requested: ${recipients.length}.`,
        };
      }
    } catch (error) {
      console.error('Email quota check failed:', error);
      return { success: false, error: 'Email quota temporarily unavailable. Please try again.' };
    }
  }

  try {
    // Normalize CC/BCC to arrays
    const rawCc = params.cc ? (Array.isArray(params.cc) ? params.cc : [params.cc]) : [];
    const rawBcc = params.bcc ? (Array.isArray(params.bcc) ? params.bcc : [params.bcc]) : [];
    const normalizedCc = Array.from(new Set(rawCc.map((c) => normalizeEmail(c)).filter(Boolean)));
    const normalizedBcc = Array.from(new Set(rawBcc.map((b) => normalizeEmail(b)).filter(Boolean)));

    // Filter duplicates to prevent SendGrid 400 errors
    const ccRecipients = normalizedCc.filter((c) => !recipients.includes(c));
    const bccRecipients = normalizedBcc.filter((b) => !recipients.includes(b) && !ccRecipients.includes(b));

    const personalizations =
      ccRecipients.length > 0 || bccRecipients.length > 0
        ? [
            {
              to: recipients.map((email) => ({ email })),
              ...(ccRecipients.length > 0 && { cc: ccRecipients.map((email) => ({ email })) }),
              ...(bccRecipients.length > 0 && { bcc: bccRecipients.map((email) => ({ email })) }),
            },
          ]
        : recipients.map((email) => ({ to: [{ email }] }));

    const payload: Record<string, any> = {
      personalizations,
      from: { email: fromEmail, name: identity.fromName },
      subject: params.subject,
      content: [
        ...(params.text ? [{ type: 'text/plain', value: params.text }] : []),
        { type: 'text/html', value: params.html },
      ],
    };

    const customArgs = compactStringRecord({
      ...(params.customArgs || {}),
      ...(agentId ? { agentId } : {}),
      feature: quotaFeature,
    });

    if (Object.keys(customArgs).length > 0) {
      payload.personalizations = payload.personalizations.map((personalization: Record<string, any>) => ({
        ...personalization,
        custom_args: customArgs,
      }));
    }

    if (params.categories && params.categories.length > 0) {
      payload.categories = params.categories;
    }

    if (identity.replyTo && isEmailAddress(identity.replyTo)) {
      payload.reply_to = { email: identity.replyTo };
    }

    if (params.headers && Object.keys(params.headers).length > 0) {
      payload.headers = params.headers;
    }

    if (params.asm?.groupId) {
      payload.asm = {
        group_id: params.asm.groupId,
        ...(params.asm.groupsToDisplay?.length ? { groups_to_display: params.asm.groupsToDisplay } : {}),
      };
    }

    if (params.attachments && params.attachments.length > 0) {
      payload.attachments = params.attachments.map((att) => ({
        content: att.content,
        filename: att.filename,
        type: att.type,
        disposition: att.disposition || 'attachment',
      }));
    }

    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('❌ SendGrid API error:', response.status, errorText);
      return { success: false, error: `SendGrid error: ${response.status}` };
    }

    // Get message ID from headers if available
    const messageId = response.headers.get('x-message-id') || undefined;

    if (recordQuotaUsage) {
      recordAgentEmailUsage({
        agentId,
        recipientsCount: recipients.length,
        feature: quotaFeature,
        subject: params.subject,
        messageId,
        categories: params.categories,
        fromEmail,
        fromName: identity.fromName,
        replyTo: identity.replyTo,
        requestedFromEmail: identity.requestedFromEmail,
        senderMode: identity.senderMode,
      }).catch((error) => {
        console.error('Email sent but quota usage logging failed:', error);
      });
    }

    console.log('✅ Email sent successfully to:', recipients.join(', '));
    return { success: true, messageId };
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send eSign document signing request
 */
// E-sign tracking email defaults to the verified sender when a dedicated audit inbox is not configured.

export async function sendSigningRequestEmail(params: {
  agentId?: string;
  signerName: string;
  signerEmail: string;
  property: string;
  subject: string;
  message: string;
  signingLink: string;
  agentName?: string;
  agentEmail?: string;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    brokerageName?: string;
    emailSignature?: string;
  };
  categories?: string[];
  customArgs?: Record<string, string>;
}): Promise<SendResult> {
  const normalizeHex = (value: string | undefined, fallback: string) => {
    if (!value) return fallback;
    const trimmed = value.trim();
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : fallback;
  };

  const primaryColor = normalizeHex(params.branding?.primaryColor, '#3091f6');
  const secondaryColor = normalizeHex(params.branding?.secondaryColor, '#ba1cbe');
  const logoUrl = safeHttpUrl(params.branding?.logoUrl);
  const signingLink = safeHttpUrl(params.signingLink) || params.signingLink;
  const escapedSigningLink = escapeHtml(signingLink);
  const brokerageNameRaw = String(params.branding?.brokerageName || '').trim();
  const brokerageName = escapeHtml(brokerageNameRaw);
  const emailSignature = String(params.branding?.emailSignature || '').trim();
  const signerNameHtml = escapeHtml(params.signerName || 'there');
  const messageHtml = plainTextToHtml(params.message);
  const propertyLabelHtml = escapeHtml(params.property || 'Document packet');
  const agentName = String(params.agentName || '').trim();
  const agentNameHtml = escapeHtml(agentName);
  const brokerageNameHtml = brokerageName;
  const signatureHtml = emailSignature ? plainTextToHtml(emailSignature) : '';
  const fromName = agentName
    ? `${agentName}${brokerageNameRaw ? ` | ${brokerageNameRaw}` : ' | AgentEase Pro'}`
    : brokerageNameRaw || 'AgentEase Pro';
  const sendgridCategories = Array.from(new Set(['esign', 'signature_request', ...(params.categories || [])])).slice(0, 10);
  const customArgs = compactStringRecord({
    feature: 'esign',
    ...(params.customArgs || {}),
  });

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Agent logo" style="max-height: 44px; max-width: 180px; margin-bottom: 12px; object-fit: contain;" />` : ''}
        <h1 style="color: white; margin: 0; font-size: 24px;">Document Ready for Signature</h1>
        ${brokerageName ? `<p style="color: rgba(255,255,255,0.92); margin: 8px 0 0; font-size: 13px;">${brokerageNameHtml}</p>` : ''}
      </div>
      
      <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
          Hi ${signerNameHtml},
        </p>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
          ${messageHtml}
        </p>
        
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 4px;">Document / property</p>
          <p style="color: #0f0a2e; font-size: 16px; font-weight: 600; margin: 0;">${propertyLabelHtml}</p>
        </div>

        ${agentName ? `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin: 20px 0; padding: 14px 16px;">
            <p style="margin: 0; color: #0f172a; font-size: 14px; font-weight: 600;">Your agent</p>
            <p style="margin: 4px 0 0; color: #334155; font-size: 14px;">${agentNameHtml}${brokerageName ? ` | ${brokerageName}` : ''}</p>
            ${params.agentEmail ? `<p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">Reply directly to this email to contact your agent.</p>` : ''}
          </div>
        ` : ''}
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${escapedSigningLink}" style="display: inline-block; background: linear-gradient(135deg, ${primaryColor} 0%, #0ea5e9 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Review & Sign Document
          </a>
        </div>

        <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0;">
          This secure signing link is intended for ${signerNameHtml}. No AgentEase Pro account is required.
        </p>

        <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 24px 0 0; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${escapedSigningLink}" style="color: ${primaryColor}; word-break: break-all;">${escapedSigningLink}</a>
        </p>
        ${signatureHtml ? `<p style="color: #475569; font-size: 12px; line-height: 1.5; margin-top: 14px;">${signatureHtml}</p>` : ''}
      </div>

      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">
        Sent via AgentEase Pro${agentName ? ` on behalf of ${agentNameHtml}` : ''}
      </p>
    </div>
  `;

  const text = `
Hi ${params.signerName || 'there'},

${params.message}

Property: ${params.property}

${agentName ? `Agent: ${agentName}` : ''}${brokerageNameRaw ? `\nBrokerage: ${brokerageNameRaw}` : ''}

Click here to review and sign: ${signingLink}

If the link doesn't work, copy and paste it into your browser.

Sent via AgentEase Pro${agentName ? ` on behalf of ${agentName}` : ''}
  `.trim();

  const trackingEmail = getESignTrackingEmail();
  const ccRecipients = trackingEmail && trackingEmail !== normalizeEmail(params.signerEmail)
    ? [trackingEmail]
    : undefined;

  return sendEmail({
    agentId: params.agentId,
    to: params.signerEmail,
    ...(ccRecipients ? { cc: ccRecipients } : {}),
    subject: params.subject,
    html,
    text,
    replyTo: params.agentEmail,
    fromEmail: params.agentEmail,
    fromName,
    quotaFeature: 'esign',
    categories: sendgridCategories,
    customArgs,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(params: {
  email: string;
  resetUrl: string;
  expiresAt: Date;
}): Promise<SendResult> {
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #3091f6 0%, #ba1cbe 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Reset Your Password</h1>
      </div>
      
      <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
          We received a request to reset your password for your AgentEase Pro account.
        </p>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          Click the button below to create a new password. This link will expire in 1 hour.
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #3091f6 0%, #0ea5e9 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Reset Password
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 24px 0 0;">
          If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>
        
        <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 24px 0 0; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          If the button doesn't work, copy and paste this link:<br>
          <a href="${params.resetUrl}" style="color: #3091f6; word-break: break-all;">${params.resetUrl}</a>
        </p>
      </div>
      
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">
        AgentEase Pro - Your Real Estate Command Center
      </p>
    </div>
  `;

  const text = `
Reset Your Password

We received a request to reset your password for your AgentEase Pro account.

Click here to reset: ${params.resetUrl}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

AgentEase Pro
  `.trim();

  return sendEmail({
    to: params.email,
    subject: 'Reset Your AgentEase Pro Password',
    html,
    text,
  });
}

/**
 * Send marketing email blast
 */
export async function sendMarketingEmail(params: {
  agentId?: string;
  recipients: string[];
  subject: string;
  htmlContent: string;
  listingAddress?: string;
  agentName?: string;
  unsubscribeUrl?: string;
  trackingPixelUrl?: string;
  categories?: string[];
  customArgs?: Record<string, string>;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  countAgainstMonthlyLimit?: boolean;
  headers?: Record<string, string>;
  asm?: {
    groupId: number;
    groupsToDisplay?: number[];
  };
}): Promise<SendResult> {
  // Add tracking pixel and unsubscribe link if provided
  let html = params.htmlContent;

  if (params.trackingPixelUrl) {
    html += `<img src="${params.trackingPixelUrl}" width="1" height="1" style="display:none" alt="" />`;
  }

  if (params.unsubscribeUrl) {
    html += `
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="color: #9ca3af; font-size: 11px;">
          <a href="${params.unsubscribeUrl}" style="color: #6b7280;">Unsubscribe</a> from these emails
        </p>
      </div>
    `;
  }

  // Wrap in branded template
  const fullHtml = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${html}
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">
        Sent via AgentEase Pro${params.agentName ? ` by ${params.agentName}` : ''}
      </p>
    </div>
  `;

  const textContent = `${params.subject}\n\n${params.htmlContent
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()}`;

  return sendEmail({
    agentId: params.agentId,
    to: params.recipients,
    subject: params.subject,
    html: fullHtml,
    text: textContent,
    fromEmail: params.fromEmail,
    fromName: params.fromName || params.agentName,
    replyTo: params.replyTo,
    quotaFeature: 'marketing',
    countAgainstMonthlyLimit: params.countAgainstMonthlyLimit,
    recordQuotaUsage: false,
    categories: params.categories,
    customArgs: params.customArgs,
    headers: params.headers,
    asm: params.asm,
  });
}

/**
 * Send notification email (generic)
 */
export async function sendNotificationEmail(params: {
  agentId?: string;
  to: string;
  subject: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const safeTitle = escapeHtml(params.title);
  const messageHtml = plainTextToHtml(params.message);
  const safeActionText = escapeHtml(params.actionText || 'Open');
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #3091f6 0%, #ba1cbe 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">${safeTitle}</h1>
      </div>
      
      <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          ${messageHtml}
        </p>
        
        ${params.actionUrl && params.actionText ? `
          <div style="text-align: center; margin: 32px 0;">
            <a href="${params.actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #3091f6 0%, #0ea5e9 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              ${safeActionText}
            </a>
          </div>
        ` : ''}
      </div>
      
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">
        AgentEase Pro - Your Real Estate Command Center
      </p>
    </div>
  `;

  return sendEmail({
    agentId: params.agentId,
    to: params.to,
    subject: params.subject,
    html,
    text: params.message,
    replyTo: params.replyTo,
    quotaFeature: 'notification',
  });
}

export default {
  sendEmail,
  sendSigningRequestEmail,
  sendPasswordResetEmail,
  sendMarketingEmail,
  sendNotificationEmail,
  sendVerificationEmail,
};

/**
 * Send email verification code to new users
 */
export async function sendVerificationEmail(params: {
  email: string;
  code: string;
  name?: string;
}): Promise<SendResult> {
  const greeting = params.name ? params.name : 'there';
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #3091f6 0%, #ba1cbe 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Verify Your Email</h1>
      </div>

      <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
          Hey ${greeting}! Welcome to AgentEase Pro.
        </p>

        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          Enter the 6-digit code below to verify your email and activate your account:
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <div style="display: inline-block; background: #f3f4f6; border: 2px dashed #3091f6; border-radius: 12px; padding: 20px 40px;">
            <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1e40af;">
              ${params.code}
            </span>
          </div>
        </div>

        <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 8px;">
          This code expires in <strong>15 minutes</strong>.
        </p>

        <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0;">
          If you didn't create an AgentEase Pro account, you can safely ignore this email.
        </p>
      </div>

      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">
        AgentEase Pro &mdash; Your Real Estate Command Center
      </p>
    </div>
  `;

  const text = `
Welcome to AgentEase Pro!

Your verification code is: ${params.code}

Enter this 6-digit code in the app to verify your email and activate your account.

This code expires in 15 minutes.

If you didn't create this account, you can safely ignore this email.

AgentEase Pro
  `.trim();

  return sendEmail({
    to: params.email,
    subject: `${params.code} — Verify your AgentEase Pro email`,
    html,
    text,
    categories: ['email-verification'],
  });
}
