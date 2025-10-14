import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server';
import * as store from '$lib/auth/bskyVerifyStore';

describe('/api/auth/bsky/create-challenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when handle is missing', async () => {
    const req = new Request('http://localhost/api/auth/bsky/create-challenge', {
      method: 'POST',
      body: JSON.stringify({})
    });
    const res = await POST({ request: req } as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('missing_handle');
  });

  it('creates a challenge when none exists', async () => {
    const spyGet = vi.spyOn(store, 'getChallenge').mockReturnValue(null as any);
    const mockCh = { code: 'AMP-ABC123', handle: 'user.bsky.social', createdAt: Date.now(), expiresAt: Date.now() + 60000 };
    const spyCreate = vi.spyOn(store, 'createChallenge').mockReturnValue(mockCh as any);

    const req = new Request('http://localhost/api/auth/bsky/create-challenge', {
      method: 'POST',
      body: JSON.stringify({ handle: 'user.bsky.social' })
    });
    const res = await POST({ request: req } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.handle).toBe('user.bsky.social');
    expect(data.code).toBe('AMP-ABC123');
    expect(typeof data.instructions).toBe('string');

    expect(spyGet).toHaveBeenCalled();
    expect(spyCreate).toHaveBeenCalled();
  });

  it('reuses an existing challenge if not expired', async () => {
    const existing = { code: 'AMP-EXIST1', handle: 'user2.bsky.social', createdAt: Date.now(), expiresAt: Date.now() + 600000 } as any;
    const spyGet = vi.spyOn(store, 'getChallenge').mockReturnValue(existing);
    const spyCreate = vi.spyOn(store, 'createChallenge').mockReturnValue(existing);

    const req = new Request('http://localhost/api/auth/bsky/create-challenge', {
      method: 'POST',
      body: JSON.stringify({ handle: 'user2.bsky.social' })
    });
    const res = await POST({ request: req } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.code).toBe('AMP-EXIST1');

    expect(spyGet).toHaveBeenCalled();
    // Should not create a new one if existing used
    expect(spyCreate).not.toHaveBeenCalled();
  });
});
