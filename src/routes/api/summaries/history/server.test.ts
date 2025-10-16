import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/supabaseAdmin', () => ({
  getSupabaseAdmin: vi.fn()
}));

import { GET } from './+server';
import { getSupabaseAdmin } from '$lib/supabaseAdmin';

const mGetSupabaseAdmin = vi.mocked(getSupabaseAdmin);

function makeUrl(params: Record<string, string | undefined> = {}) {
  const url = new URL('http://localhost/api/summaries/history');
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, v);
  }
  return url;
}

describe('/api/summaries/history (+server)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 when matchId is missing', async () => {
    mGetSupabaseAdmin.mockReturnValue({} as any); // not used due to early validation
    const req = new Request(makeUrl(), { method: 'GET' });
    const res = await GET({ url: new URL(req.url) } as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('missing_match_id');
  });

  it('returns 501 when supabase is not configured', async () => {
    mGetSupabaseAdmin.mockReturnValue(null as any);
    delete (process as any).env.SUPABASE_URL;
    delete (process as any).env.PUBLIC_SUPABASE_URL;
    delete (process as any).env.SUPABASE_SERVICE_ROLE_KEY;

    const req = new Request(makeUrl({ matchId: 'M1' }), { method: 'GET' });
    const res = await GET({ url: new URL(req.url) } as any);
    expect(res.status).toBe(501);
  });

  it('returns summaries filtered by matchId and optional platform/phase', async () => {
    const rows = [
      {
        id: '1',
        match_id: 'M1',
        platform: 'bsky',
        phase: 'pre',
        generated_at: new Date().toISOString(),
        summary_text: 'Pre summary',
        sentiment: { pos: 0.5, neu: 0.3, neg: 0.2 },
        topics: [],
        samples: [],
        accounts_used: [],
        created_at: new Date().toISOString()
      }
    ];

    // Build a small query builder mock with chainable select/eq/order
    const qb: any = {
      _filters: [] as any[],
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(function (col: string, val: any) {
        this._filters.push([col, val]);
        return this;
      }),
      order: vi.fn().mockReturnThis()
    };

    Object.defineProperty(qb, 'then', {
      value: undefined,
      writable: false
    });

    const mockDb = {
      from: (table: string) => {
        expect(table).toBe('match_summaries');
        return {
          select: (...args: any[]) => {
            qb.select(...args);
            return {
              eq: (col: string, val: any) => {
                qb.eq(col, val);
                return {
                  eq: (col2: string, val2: any) => {
                    qb.eq(col2, val2);
                    return {
                      order: (col3: string, opts: any) => {
                        qb.order(col3, opts);
                        return Promise.resolve({ data: rows, error: null });
                      }
                    };
                  },
                  order: (col3: string, opts: any) => {
                    qb.order(col3, opts);
                    return Promise.resolve({ data: rows, error: null });
                  }
                };
              }
            };
          }
        } as any;
      }
    };

    mGetSupabaseAdmin.mockReturnValue(mockDb as any);

    const req = new Request(
      makeUrl({ matchId: 'M1', platform: 'bsky', phase: 'pre' }),
      { method: 'GET' }
    );
    const res = await GET({ url: new URL(req.url) } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.matchId).toBe('M1');
    expect(data.platform).toBe('bsky');
    expect(data.phase).toBe('pre');
    expect(data.count).toBe(1);
    expect(Array.isArray(data.summaries)).toBe(true);
    expect(data.summaries[0].summary_text).toBe('Pre summary');
  });
});
