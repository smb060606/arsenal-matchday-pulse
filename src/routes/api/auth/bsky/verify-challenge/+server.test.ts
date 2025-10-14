import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server';
import * as store from '$lib/auth/bskyVerifyStore';

describe('/api/auth/bsky/verify-challenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when handle is missing', async () => {
    const req = new Request('http://localhost/api/auth/bsky/verify-challenge', {
      method: 'POST',
      body: JSON.stringify({})
    });
    const res = await POST({ request: req } as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('missing_handle');
  });

  it('returns 400 when no active challenge', async () => {
    const spyGet = vi.spyOn(store, 'getChallenge').mockReturnValue(null as any);
    const req = new Request('http://localhost/api/auth/bsky/verify-challenge', {
      method: 'POST',
      body: JSON.stringify({ handle: 'user.bsky.social' })
    });
    const res = await POST({ request: req } as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('no_active_challenge');
    expect(spyGet).toHaveBeenCalled();
  });

  it('returns 400 when verification fails', async () => {
    const ch = { code: 'AMP-ABC123', handle: 'user', createdAt: Date.now(), expiresAt: Date.now() + 60000 } as any;
    vi.spyOn(store, 'getChallenge').mockReturnValue(ch);
    vi.spyOn(store, 'verifyPostContainsCode').mockResolvedValue({ ok: false, reason: 'code_not_found_recent_posts' });
    const req = new Request('http://localhost/api/auth/bsky/verify-challenge', {
      method: 'POST',
      body: JSON.stringify({ handle: 'user.bsky.social' })
    });
    const res = await POST({ request: req } as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('verification_failed');
    expect(data.reason).toBe('code_not_found_recent_posts');
  });

  it('returns ok and clears challenge on success', async () => {
    const ch = { code: 'AMP-SUCCESS', handle: 'user2', createdAt: Date.now(), expiresAt: Date.now() + 60000 } as any;
    const spyGet = vi.spyOn(store, 'getChallenge').mockReturnValue(ch);
    const spyVerify = vi.spyOn(store, 'verifyPostContainsCode').mockResolvedValue({ ok: true });
    const spyClear = vi.spyOn(store, 'clearChallenge').mockImplementation(() => {});
    const req = new Request('http://localhost/api/auth/bsky/verify-challenge', {
      method: 'POST',
      body: JSON.stringify({ handle: 'user2.bsky.social' })
    });
    const res = await POST({ request: req } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.handle).toBe('user2.bsky.social');
    expect(spyGet).toHaveBeenCalled();
    expect(spyVerify).toHaveBeenCalled();
    expect(spyClear).toHaveBeenCalled();
  });
});
