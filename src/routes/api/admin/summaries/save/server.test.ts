import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/supabaseAdmin', () => ({
  getSupabaseAdmin: vi.fn()
}));

import { POST } from './+server';
import { getSupabaseAdmin } from '$lib/supabaseAdmin';

const mGetSupabaseAdmin = vi.mocked(getSupabaseAdmin);

function makeEvent(body?: any, token?: string) {
  const headers = new Headers();
  if (token) headers.set('authorization', `Bearer ${token}`);
  const req = new Request('http://localhost/api/admin/summaries/save', {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  return { request: req } as any;
}

describe('/api/admin/summaries/save (+server)', () => {
  const TOKEN = 'secret';

  beforeEach(() => {
    vi.clearAllMocks();
    (process as any).env.ADMIN_TOKEN = TOKEN;
  });

  afterEach(() => {
    delete (process as any).env.ADMIN_TOKEN;
  });

  it('rejects without authorization', async () => {
    const ev = makeEvent({});
    const res = await POST(ev);
    expect(res.status).toBe(401);
  });

  it('rejects invalid payloads', async () => {
    mGetSupabaseAdmin.mockReturnValue({} as any); // not used due to invalid payload
    const ev = makeEvent({ bad: 'payload' }, TOKEN);
    const res = await POST(ev);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid_payload');
  });

  it('returns 501 if supabase admin not configured', async () => {
    mGetSupabaseAdmin.mockReturnValue(null as any);
    // also ensure no env service role to trigger 501 path
    delete (process as any).env.SUPABASE_URL;
    delete (process as any).env.PUBLIC_SUPABASE_URL;
    delete (process as any).env.SUPABASE_SERVICE_ROLE_KEY;

    const payload = {
      matchId: 'M1',
      platform: 'bsky',
      phase: 'pre',
      generatedAt: new Date().toISOString(),
      summary: 'Test summary',
      sentiment: { pos: 0.5, neu: 0.3, neg: 0.2 },
      topics: [],
      samples: [],
      accountsUsed: []
    };

    const ev = makeEvent(payload, TOKEN);
    const res = await POST(ev);
    expect(res.status).toBe(501);
  });

  it('inserts summary and returns ok when authorized and configured', async () => {
    const insertCalls: any[] = [];
    const mockDb = {
      from: (table: string) => {
        expect(table).toBe('match_summaries');
        return {
          insert: (row: any) => {
            insertCalls.push(row);
            return { error: null };
          }
        };
      }
    };
    mGetSupabaseAdmin.mockReturnValue(mockDb as any);

    const payload = {
      matchId: 'M1',
      platform: 'bsky' as const,
      phase: 'live' as const,
      generatedAt: new Date().toISOString(),
      summary: 'Live summary',
      sentiment: { pos: 0.6, neu: 0.3, neg: 0.1 },
      topics: [{ keyword: 'Arsenal', count: 5 }],
      samples: [{ authorHandle: 'test', text: 'COYG', createdAt: new Date().toISOString() }],
      accountsUsed: [{ did: 'did:test', handle: 'test.bsky.social' }]
    };

    const ev = makeEvent(payload, TOKEN);
    const res = await POST(ev);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true });
    expect(insertCalls.length).toBe(1);

    const row = insertCalls[0];
    expect(row.match_id).toBe(payload.matchId);
    expect(row.platform).toBe(payload.platform);
    expect(row.phase).toBe(payload.phase);
    expect(row.summary_text).toBe(payload.summary);
    expect(Array.isArray(row.topics)).toBe(true);
    expect(Array.isArray(row.samples)).toBe(true);
    expect(Array.isArray(row.accounts_used)).toBe(true);
  });
});
