import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveEmailIdentity } from './emailService';

const envKeys = ['SENDGRID_FROM_EMAIL', 'SENDER_EMAIL', 'SENDGRID_ALLOWED_FROM_DOMAINS'] as const;
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