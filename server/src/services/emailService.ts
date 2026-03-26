/**
 * Email Service - SendGrid Integration
 * Centralized email sending for all app features:
 * - eSign document signing requests
 * - Marketing email blasts
 * - Password reset emails
 * - Notifications
 */

interface EmailParams {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  fromName?: string;
  fromEmail?: string;
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
}

type ResolvedEmailIdentity = {
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  requestedFromEmail?: string;
  senderMode: 'default' | 'custom' | 'fallback';
};

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getDefaultSenderEmail(): string {
  return normalizeEmail(process.env.SENDGRID_FROM_EMAIL || process.env.SENDER_EMAIL || '');
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
  const fromName = String(params.fromName || 'AgentEase Pro').trim() || 'AgentEase Pro';

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

    if (params.customArgs && Object.keys(params.customArgs).length > 0) {
      payload.personalizations = payload.personalizations.map((personalization: Record<string, any>) => ({
        ...personalization,
        custom_args: params.customArgs,
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
// E-sign tracking email - all signature requests are CC'd here for audit trail
const ESIGN_TRACKING_EMAIL = 'esign@agenteasepro.com';

export async function sendSigningRequestEmail(params: {
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
}): Promise<SendResult> {
  const normalizeHex = (value: string | undefined, fallback: string) => {
    if (!value) return fallback;
    const trimmed = value.trim();
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : fallback;
  };

  const primaryColor = normalizeHex(params.branding?.primaryColor, '#3091f6');
  const secondaryColor = normalizeHex(params.branding?.secondaryColor, '#ba1cbe');
  const logoUrl = params.branding?.logoUrl;
  const brokerageName = params.branding?.brokerageName;
  const emailSignature = params.branding?.emailSignature;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        ${logoUrl ? `<img src="${logoUrl}" alt="Agent logo" style="max-height: 44px; max-width: 180px; margin-bottom: 12px; object-fit: contain;" />` : ''}
        <h1 style="color: white; margin: 0; font-size: 24px;">Document Ready for Signature</h1>
        ${brokerageName ? `<p style="color: rgba(255,255,255,0.92); margin: 8px 0 0; font-size: 13px;">${brokerageName}</p>` : ''}
      </div>
      
      <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
          Hi ${params.signerName},
        </p>
        
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
          ${params.message}
        </p>
        
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 4px;">Property:</p>
          <p style="color: #0f0a2e; font-size: 16px; font-weight: 600; margin: 0;">${params.property}</p>
        </div>

        ${params.agentName ? `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin: 20px 0; padding: 14px 16px;">
            <p style="margin: 0; color: #0f172a; font-size: 14px; font-weight: 600;">Your agent</p>
            <p style="margin: 4px 0 0; color: #334155; font-size: 14px;">${params.agentName}${brokerageName ? ` • ${brokerageName}` : ''}</p>
            ${params.agentEmail ? `<p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">Reply directly to this email to contact your agent.</p>` : ''}
          </div>
        ` : ''}
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.signingLink}" style="display: inline-block; background: linear-gradient(135deg, ${primaryColor} 0%, #0ea5e9 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Review & Sign Document
          </a>
        </div>
        
        <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 24px 0 0; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${params.signingLink}" style="color: ${primaryColor}; word-break: break-all;">${params.signingLink}</a>
        </p>
        ${emailSignature ? `<p style="color: #475569; font-size: 12px; line-height: 1.5; margin-top: 14px; white-space: pre-line;">${emailSignature}</p>` : ''}
      </div>
      
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">
        Sent via AgentEase Pro${params.agentName ? ` on behalf of ${params.agentName}` : ''}
      </p>
    </div>
  `;

  const text = `
Hi ${params.signerName},

${params.message}

Property: ${params.property}

${params.agentName ? `Agent: ${params.agentName}` : ''}${brokerageName ? `\nBrokerage: ${brokerageName}` : ''}

Click here to review and sign: ${params.signingLink}

If the link doesn't work, copy and paste it into your browser.

Sent via AgentEase Pro${params.agentName ? ` on behalf of ${params.agentName}` : ''}
  `.trim();

  return sendEmail({
    to: params.signerEmail,
    cc: ESIGN_TRACKING_EMAIL,
    subject: params.subject,
    html,
    text,
    replyTo: params.agentEmail,
    fromName: params.agentName ? `${params.agentName} via AgentEase Pro` : 'AgentEase Pro',
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
    to: params.recipients,
    subject: params.subject,
    html: fullHtml,
    text: textContent,
    fromEmail: params.fromEmail,
    fromName: params.fromName || params.agentName,
    replyTo: params.replyTo,
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
  to: string;
  subject: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}): Promise<SendResult> {
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #3091f6 0%, #ba1cbe 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">${params.title}</h1>
      </div>
      
      <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          ${params.message}
        </p>
        
        ${params.actionUrl && params.actionText ? `
          <div style="text-align: center; margin: 32px 0;">
            <a href="${params.actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #3091f6 0%, #0ea5e9 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              ${params.actionText}
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
    to: params.to,
    subject: params.subject,
    html,
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
