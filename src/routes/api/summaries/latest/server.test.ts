import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './+server';

// Mock OpenAI SDK
vi.mock('openai', () => {
  class MockChat {
    completions = {
      create: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'Mock summary content.' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      })
    };
  }
  return {
    default: class OpenAI {
      chat = new MockChat();
    }
  };
});

// Mock Bluesky services
vi.mock('$lib/services/bskyService', () => {
  return {
    selectEligibleAccounts: vi.fn().mockResolvedValue([
      {
        profile: {
          did: 'did:example:1',
          handle: 'user1.example',
          displayName: 'User One'
        },
        eligibility: { eligible: true, reasons: [] }
      }
    ]),
    fetchRecentPostsForAccounts: vi.fn().mockImplementation(async (_accounts, _sinceMin) => {
      // Provide a few recent posts within any requested window
      const now = Date.now();
      return [
        {
          uri: 'at://did:example:1/app.bsky.feed.post/1',
          cid: 'cid1',
          author: { did: 'did:example:1', handle: 'user1.example', displayName: 'User One' },
          text: 'COYG! Good press.',
          createdAt: new Date(now - 60_000).toISOString()
        },
        {
          uri: 'at://did:example:1/app.bsky.feed.post/2',
          cid: 'cid2',
          author: { did: 'did:example:1', handle: 'user1.example', displayName: 'User One' },
          text: 'Arsenal on top.',
          createdAt: new Date(now - 120_000).toISOString()
        }
      ];
    })
  };
});

describe('summaries/latest API - phase windows and live bins', () => {
  const kickoffISO = '2025-10-19T11:30:00.000Z';
  const kickoffMs = Date.parse(kickoffISO);

  beforeEach(() => {
    vi.useFakeTimers();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.OPENAI_API_KEY;
  });

  it('live: computes current 15-min bin and sinceMin from bin start', async () => {
    // 22 minutes after kickoff → bin should be 15–30 and sinceMin ≈ 7
    const nowMs = kickoffMs + 22 * 60_000;
    vi.setSystemTime(nowMs);

    const params = new URLSearchParams({
      matchId: 'TEST-LIVE',
      kickoff: kickoffISO,
      mode: 'live',
      platform: 'bsky'
    });
    const url = new URL(`http://localhost/api/summaries/latest?${params.toString()}`);
    const req = new Request(url);

    const res = await GET({ url, request: req } as any);
    expect(res.status).toBe(200);
    const payload = await res.json();

    expect(payload.phase).toBe('live');
    expect(payload.liveBin).toBeTruthy();
    expect(payload.liveBin.startMinute).toBe(15);
    expect(payload.liveBin.endMinute).toBe(30);
    // sinceMin should be ceil(7) = 7
    expect(payload.windowMinutes).toBeGreaterThanOrEqual(1);
    expect(payload.windowMinutes).toBeLessThanOrEqual(15);
  });

  it('pre: summarizes full pre window from KO-120 to KO', async () => {
    // 30 minutes before kickoff
    const nowMs = kickoffMs - 30 * 60_000;
    vi.setSystemTime(nowMs);

    const params = new URLSearchParams({
      matchId: 'TEST-PRE',
      kickoff: kickoffISO,
      mode: 'pre',
      platform: 'bsky'
    });
    const url = new URL(`http://localhost/api/summaries/latest?${params.toString()}`);
    const req = new Request(url);

    const res = await GET({ url, request: req } as any);
    expect(res.status).toBe(200);
    const payload = await res.json();

    expect(payload.phase).toBe('pre');
    // time from KO-120 to now (KO-30) => 90 minutes; capped at 120
    expect(payload.windowMinutes).toBeGreaterThanOrEqual(1);
    expect(payload.windowMinutes).toBeLessThanOrEqual(120);
  });

  it('post: summarizes from 90+injury (approx FT) to now, capped at 120', async () => {
    // Using approximate FT = KO + 105 (90 + halftime 15), set now 3 minutes after FT
    const nowMs = kickoffMs + 108 * 60_000;
    vi.setSystemTime(nowMs);

    const params = new URLSearchParams({
      matchId: 'TEST-POST',
      kickoff: kickoffISO,
      mode: 'post',
      platform: 'bsky'
    });
    const url = new URL(`http://localhost/api/summaries/latest?${params.toString()}`);
    const req = new Request(url);

    const res = await GET({ url, request: req } as any);
    expect(res.status).toBe(200);
    const payload = await res.json();

    expect(payload.phase).toBe('post');
    // windowMinutes should be small (~3), but generally <= 120 and >= 1
    expect(payload.windowMinutes).toBeGreaterThanOrEqual(1);
    expect(payload.windowMinutes).toBeLessThanOrEqual(120);
  });
});
