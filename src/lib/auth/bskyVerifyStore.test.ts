import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChallenge, getChallenge, clearChallenge, verifyPostContainsCode } from './bskyVerifyStore';
import { BskyAgent } from '@atproto/api';

vi.mock('@atproto/api', () => {
  return {
    BskyAgent: vi.fn().mockImplementation(() => ({
      getAuthorFeed: vi.fn()
    }))
  };
});

const mockedAgent = vi.mocked(BskyAgent);

describe('bskyVerifyStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and retrieves a challenge', () => {
    const ch = createChallenge('Test.User.bsky.social');
    expect(ch.code).toMatch(/^AMP-[A-Z0-9]{6}$/);
    const fetched = getChallenge('test.user.bsky.social');
    expect(fetched).not.toBeNull();
    expect(fetched?.code).toBe(ch.code);
  });

  it('clears a challenge', () => {
    const ch = createChallenge('someone.bsky.social');
    expect(getChallenge('someone.bsky.social')).not.toBeNull();
    clearChallenge('someone.bsky.social');
    expect(getChallenge('someone.bsky.social')).toBeNull();
  });

  it('verifies when a recent post contains the code', async () => {
    const handle = 'verify.me.bsky.social';
    const ch = createChallenge(handle);
    const nowIso = new Date().toISOString();

    // Mock Bluesky feed: include the code in a recent post
    (mockedAgent as any).mockImplementation(() => ({
      getAuthorFeed: vi.fn().mockResolvedValue({
        data: {
          feed: [
            {
              post: {
                uri: 'at://did:plc:test/app.bsky.feed.post/1',
                cid: 'cid1',
                author: { did: 'did:plc:test', handle },
                indexedAt: nowIso,
                record: { text: `Some text ${ch.code}`, createdAt: nowIso }
              }
            }
          ]
        }
      })
    }));

    const res = await verifyPostContainsCode(handle, ch.code, 15);
    expect(res.ok).toBe(true);
  });

  it('fails to verify when recent posts do not contain the code', async () => {
    const handle = 'no.code.bsky.social';
    const ch = createChallenge(handle);
    const nowIso = new Date().toISOString();

    (mockedAgent as any).mockImplementation(() => ({
      getAuthorFeed: vi.fn().mockResolvedValue({
        data: {
          feed: [
            {
              post: {
                uri: 'at://did:plc:test/app.bsky.feed.post/1',
                cid: 'cid1',
                author: { did: 'did:plc:test', handle },
                indexedAt: nowIso,
                record: { text: `Unrelated text`, createdAt: nowIso }
              }
            }
          ]
        }
      })
    }));

    const res = await verifyPostContainsCode(handle, ch.code, 15);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('code_not_found_recent_posts');
  });
});
