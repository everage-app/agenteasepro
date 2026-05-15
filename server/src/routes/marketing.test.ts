import { describe, expect, it } from 'vitest';
import { scoreMarketingAudienceCandidate } from './marketing';

const now = new Date('2026-04-21T12:00:00.000Z');

function baseCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contact-1',
    contactType: 'client' as const,
    name: 'Client One',
    email: 'client@example.com',
    stage: 'NURTURE',
    temperature: 'WARM',
    tags: [],
    lastContactAt: new Date('2026-03-01T12:00:00.000Z'),
    lastMarketingAt: null,
    createdAt: new Date('2026-01-01T12:00:00.000Z'),
    ...overrides,
  } as any;
}

describe('scoreMarketingAudienceCandidate', () => {
  it('prioritizes hot engaged contacts', () => {
    const hotEngaged = scoreMarketingAudienceCandidate(
      baseCandidate({ temperature: 'HOT', stage: 'ACTIVE' }),
      {
        processed: 1,
        delivered: 1,
        opens: 2,
        clicks: 1,
        replies: 0,
        bounces: 0,
        unsubscribes: 0,
        spamReports: 0,
        lastEventAt: new Date('2026-04-20T12:00:00.000Z'),
      },
      now,
    );

    const coldUnengaged = scoreMarketingAudienceCandidate(
      baseCandidate({ temperature: 'COLD', stage: 'PAST_CLIENT' }),
      undefined,
      now,
    );

    expect(hotEngaged.score).toBeGreaterThan(coldUnengaged.score);
    expect(hotEngaged.reasons).toContain('clicked past email');
  });

  it('penalizes contacts marketed in the last week', () => {
    const fresh = scoreMarketingAudienceCandidate(
      baseCandidate({ lastMarketingAt: new Date('2026-04-19T12:00:00.000Z') }),
      undefined,
      now,
    );
    const due = scoreMarketingAudienceCandidate(
      baseCandidate({ lastMarketingAt: new Date('2026-03-01T12:00:00.000Z') }),
      undefined,
      now,
    );

    expect(due.score).toBeGreaterThan(fresh.score);
    expect(fresh.reasons).toContain('recently marketed');
  });
});
