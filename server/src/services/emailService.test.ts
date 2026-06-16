import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    marketingDeliveryLog: {
      findMany: vi.fn(),
    },
    internalEvent: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from '../lib/prisma';
import { resolveEmailIdentity, sendEmail, sendSigningRequestEmail } from './emailService';

const envKeys = ['SENDGRID_API_KEY', 'SENDGRID_FROM_EMAIL', 'SENDER_EMAIL', 'SENDGRID_ALLOWED_FROM_DOMAINS', 'ESIGN_TRACKING_EMAIL', 'APP_BASE_URL'] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function setEnv(key: (typeof envKeys)[number], value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(() => {
  for (const key of envKeys) {
    setEnv(key, originalEnv[key]);
  }
  vi.mocked(prisma.marketingDeliveryLog.findMany).mockReset();
  vi.mocked(prisma.internalEvent.findMany).mockReset();
  vi.mocked(prisma.internalEvent.create).mockReset();
  vi.restoreAllMocks();
});

describe('resolveEmailIdentity', () => {
  it('uses the verified SendGrid sender and keeps arbitrary agent email as reply-to', () => {
    setEnv('SENDGRID_FROM_EMAIL', 'esign@agenteasepro.com');
    setEnv('SENDGRID_ALLOWED_FROM_DOMAINS', '');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const identity = resolveEmailIdentity({
      fromEmail: 'Agent.Person@gmail.com',
      fromName: 'Agent Person',
    });

    expect(identity.fromEmail).toBe('esign@agenteasepro.com');
    expect(identity.fromName).toBe('Agent Person');
    expect(identity.replyTo).toBe('agent.person@gmail.com');
    expect(identity.requestedFromEmail).toBe('agent.person@gmail.com');
    expect(identity.senderMode).toBe('fallback');
  });

  it('allows a custom from address when the domain is configured for SendGrid', () => {
    setEnv('SENDGRID_FROM_EMAIL', 'esign@agenteasepro.com');
    setEnv('SENDGRID_ALLOWED_FROM_DOMAINS', 'brokerage.com, agenteasepro.com');

    const identity = resolveEmailIdentity({
      fromEmail: 'agent@brokerage.com',
      fromName: 'Brokerage Team',
    });

    expect(identity.fromEmail).toBe('agent@brokerage.com');
    expect(identity.replyTo).toBeUndefined();
    expect(identity.senderMode).toBe('custom');
  });

  it('keeps an explicit reply-to when falling back to the default sender', () => {
    setEnv('SENDGRID_FROM_EMAIL', 'esign@agenteasepro.com');
    setEnv('SENDGRID_ALLOWED_FROM_DOMAINS', 'agenteasepro.com');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const identity = resolveEmailIdentity({
      fromEmail: 'agent@gmail.com',
      fromName: 'Agent Team',
      replyTo: 'reply@brokerage.com',
    });

    expect(identity.fromEmail).toBe('esign@agenteasepro.com');
    expect(identity.replyTo).toBe('reply@brokerage.com');
    expect(identity.senderMode).toBe('fallback');
  });
});

describe('sendSigningRequestEmail', () => {
  it('brands signing requests and attaches e-sign SendGrid metadata safely', async () => {
    setEnv('SENDGRID_API_KEY', 'SG.test');
    setEnv('SENDGRID_FROM_EMAIL', 'esign@agenteasepro.com');
    setEnv('SENDGRID_ALLOWED_FROM_DOMAINS', 'brokerage.com,agenteasepro.com');
    setEnv('ESIGN_TRACKING_EMAIL', 'audit@agenteasepro.com');
    process.env.APP_BASE_URL = 'https://app.agenteasepro.com';

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => (name === 'x-message-id' ? 'msg-123' : null) },
      text: async () => '',
    } as any);

    const result = await sendSigningRequestEmail({
      signerName: '<Buyer One>',
      signerEmail: 'buyer@example.com',
      property: '123 <Main> St',
      subject: 'Please sign',
      message: 'Please review <today>.\nThanks.',
      signingLink: 'https://app.agenteasepro.com/esign/env/signer/token',
      agentName: 'Agent & Co',
      agentEmail: 'agent@brokerage.com',
      branding: {
        logoUrl: '/uploads/logos/brokerage-agent-1.png',
        primaryColor: '#2563eb',
        secondaryColor: '#14b8a6',
        brokerageName: 'Best <Brokerage>',
        emailSignature: 'Agent & Co\nBest Brokerage',
      },
      categories: ['esign_initial'],
      customArgs: {
        agentId: 'agent-1',
        envelopeId: 'env-1',
        signerId: 'signer-1',
      },
    });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String((fetchMock.mock.calls[0][1] as any).body));
    const html = payload.content.find((item: any) => item.type === 'text/html').value;

    expect(payload.from).toEqual({ email: 'agent@brokerage.com', name: 'Agent & Co | Best <Brokerage>' });
    expect(payload.reply_to).toEqual({ email: 'agent@brokerage.com' });
    expect(payload.categories).toEqual(expect.arrayContaining(['esign', 'signature_request', 'esign_initial']));
    expect(payload.personalizations[0].custom_args).toMatchObject({
      feature: 'esign',
      agentId: 'agent-1',
      envelopeId: 'env-1',
      signerId: 'signer-1',
    });
    expect(payload.personalizations[0].cc).toEqual([{ email: 'audit@agenteasepro.com' }]);
    expect(html).toContain('&lt;Buyer One&gt;');
    expect(html).toContain('https://app.agenteasepro.com/uploads/logos/brokerage-agent-1.png');
    expect(html).toContain('123 &lt;Main&gt; St');
    expect(html).toContain('Best &lt;Brokerage&gt;');
    expect(html).not.toContain('Please review <today>');
  });
});

describe('agent monthly email quota', () => {
  it('blocks agent-associated sends before calling SendGrid when the monthly cap would be exceeded', async () => {
    setEnv('SENDGRID_API_KEY', 'SG.test');
    setEnv('SENDGRID_FROM_EMAIL', 'hello@agenteasepro.com');

    vi.mocked(prisma.marketingDeliveryLog.findMany).mockResolvedValue([{ recipientsCount: 199 }] as any);
    vi.mocked(prisma.internalEvent.findMany)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as any);

    const result = await sendEmail({
      agentId: 'agent-1',
      to: ['client-1@example.com', 'client-2@example.com'],
      subject: 'Quota test',
      html: '<p>Test</p>',
      quotaFeature: 'contact_email',
    });

    expect(result.success).toBe(false);
    expect(result.quotaBlocked).toBe(true);
    expect(result.quota?.remaining).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('records successful agent-associated sends in the quota ledger', async () => {
    setEnv('SENDGRID_API_KEY', 'SG.test');
    setEnv('SENDGRID_FROM_EMAIL', 'hello@agenteasepro.com');

    vi.mocked(prisma.marketingDeliveryLog.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.internalEvent.findMany)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any);
    const createMock = vi.mocked(prisma.internalEvent.create).mockResolvedValue({ id: 'event-1' } as any);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => (name === 'x-message-id' ? 'msg-123' : null) },
      text: async () => '',
    } as any);

    const result = await sendEmail({
      agentId: 'agent-1',
      to: 'client@example.com',
      subject: 'Ledger test',
      html: '<p>Test</p>',
      quotaFeature: 'contact_email',
    });

    expect(result.success).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        agentId: 'agent-1',
        kind: 'agent_email_sent',
        meta: expect.objectContaining({
          feature: 'contact_email',
          recipientsCount: 1,
          messageId: 'msg-123',
        }),
      }),
    }));
  });
});
