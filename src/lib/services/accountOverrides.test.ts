import { describe, it, expect, beforeEach, vi } from 'vitest';

type Row = {
  id: string;
  platform: 'bsky' | 'twitter' | 'threads';
  identifier_type: 'did' | 'handle' | 'user_id';
  identifier: string;
  handle: string | null;
  action: 'include' | 'exclude';
  scope: 'global' | 'match';
  match_id: string | null;
  bypass_eligibility: boolean;
  notes: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const NOW = new Date('2025-10-16T20:00:00Z').getTime();
const PAST = new Date('2024-01-01T00:00:00Z').toISOString();
const FUTURE = new Date('2026-01-01T00:00:00Z').toISOString();

function makeRow(partial: Partial<Row>): Row {
  return {
    id: partial.id ?? crypto.randomUUID?.() ?? Math.random().toString(),
    platform: partial.platform ?? 'bsky',
    identifier_type: partial.identifier_type ?? 'handle',
    identifier: partial.identifier ?? 'user',
    handle: partial.handle ?? partial.identifier ?? null,
    action: partial.action ?? 'include',
    scope: partial.scope ?? 'global',
    match_id: partial.scope === 'match' ? (partial.match_id ?? 'M1') : null,
    bypass_eligibility: partial.bypass_eligibility ?? true,
    notes: partial.notes ?? null,
    expires_at: partial.expires_at ?? null,
    created_by: partial.created_by ?? null,
    created_at: partial.created_at ?? new Date(NOW).toISOString(),
    updated_at: partial.updated_at ?? new Date(NOW).toISOString()
  };
}

describe('accountOverrides.getOverrides precedence and expiry', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns empty include/exclude gracefully if admin client not configured', async () => {
    // getSupabaseAdmin returns null -> service should return empty sets
    vi.doMock('$lib/supabaseAdmin', () => ({
      getSupabaseAdmin: () => null
    }));

    const mod = await import('$lib/services/accountOverrides');
    const res = await mod.getOverrides({ platform: 'bsky', matchId: 'M1', nowMs: NOW });
    expect(res).toEqual({ include: [], exclude: [] });
  });

  it('applies precedence: match overrides beat global; expired rows filtered out', async () => {
    const rows: Row[] = [
      // Global include A
      makeRow({ identifier: 'userA', action: 'include', scope: 'global', expires_at: null }),
      // Global exclude C
      makeRow({ identifier: 'userC', action: 'exclude', scope: 'global', expires_at: null }),
      // Match include C (should beat global exclude)
      makeRow({ identifier: 'userC', action: 'include', scope: 'match', match_id: 'M1', expires_at: null }),
      // Match exclude D
      makeRow({ identifier: 'userD', action: 'exclude', scope: 'match', match_id: 'M1', expires_at: null }),
      // Expired global include E (should be filtered out)
      makeRow({ identifier: 'userE', action: 'include', scope: 'global', expires_at: PAST })
    ];

    const mockSb = {
      from: (table: string) => {
        expect(table).toBe('account_overrides');
        return {
          select: () => ({
            eq: (col: string, val: any) => {
              expect(col).toBe('platform');
              expect(val).toBe('bsky');
              return { data: rows, error: null };
            }
          })
        };
      }
    };

    vi.doMock('$lib/supabaseAdmin', () => ({
      getSupabaseAdmin: () => mockSb
    }));

    const mod = await import('$lib/services/accountOverrides');
    const res = await mod.getOverrides({ platform: 'bsky', matchId: 'M1', nowMs: NOW });

    const incIds = res.include.map((r) => r.identifier).sort();
    const excIds = res.exclude.map((r) => r.identifier).sort();

    // userA from global include
    // userC from match include (beats global exclude C)
    // userE expired and filtered
    expect(incIds).toEqual(['userA', 'userC']);
    // userD excluded via match exclude
    expect(excIds).toEqual(['userD']);

    // Ensure no duplicates / precedence collapse occurred
    const allKeys = new Set(res.include.concat(res.exclude).map((r) => `${r.identifier_type}|${r.identifier}`));
    expect(allKeys.size).toBe(res.include.length + res.exclude.length);
  });

  it('collapses duplicate identifiers preferring match scope', async () => {
    const rows: Row[] = [
      // Both include for userX with different scopes; match should win
      makeRow({ identifier: 'userX', action: 'include', scope: 'global', expires_at: null }),
      makeRow({ identifier: 'userX', action: 'include', scope: 'match', match_id: 'M1', expires_at: null })
    ];

    const mockSb = {
      from: () => ({
        select: () => ({
          eq: () => ({ data: rows, error: null })
        })
      })
    };

    vi.doMock('$lib/supabaseAdmin', () => ({
      getSupabaseAdmin: () => mockSb
    }));

    const mod = await import('$lib/services/accountOverrides');
    const res = await mod.getOverrides({ platform: 'bsky', matchId: 'M1', nowMs: NOW });

    expect(res.include.map((r) => r.identifier)).toEqual(['userX']);
    expect(res.include[0].scope).toBe('match');
    expect(res.exclude.length).toBe(0);
  });
});

describe('accountOverrides upsert/delete', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('upsertOverride forwards payload to Supabase upsert and returns row', async () => {
    const returned = makeRow({ identifier: 'userZ', action: 'include', scope: 'global' });

    const mockSb = {
      from: (table: string) => ({
        upsert: (insertable: any) => {
          // Basic shape checks
          expect(insertable.platform).toBe('bsky');
          expect(insertable.identifier).toBe('userZ');
          expect(insertable.action).toBe('include');
          expect(insertable.scope).toBe('global');
          return {
            select: () => ({
              single: () => ({ data: returned, error: null })
            })
          };
        }
      })
    };

    vi.doMock('$lib/supabaseAdmin', () => ({
      getSupabaseAdmin: () => mockSb
    }));

    const mod = await import('$lib/services/accountOverrides');
    const row = await mod.upsertOverride({
      platform: 'bsky',
      identifier_type: 'handle',
      identifier: 'userZ',
      handle: 'userZ',
      action: 'include',
      scope: 'global',
      match_id: null,
      bypass_eligibility: true,
      notes: null,
      expires_at: null,
      created_by: 'tester'
    } as any);

    expect(row.identifier).toBe('userZ');
    expect(row.scope).toBe('global');
  });

  it('deleteOverride deletes by id', async () => {
    const deletedIds: string[] = [];
    const mockSb = {
      from: (table: string) => ({
        delete: () => ({
          eq: (col: string, id: string) => {
            expect(col).toBe('id');
            deletedIds.push(id);
            return { error: null };
          }
        })
      })
    };

    vi.doMock('$lib/supabaseAdmin', () => ({
      getSupabaseAdmin: () => mockSb
    }));

    const mod = await import('$lib/services/accountOverrides');
    const res = await mod.deleteOverride('abc-123');
    expect(res).toEqual({ ok: true });
    expect(deletedIds).toEqual(['abc-123']);
  });
});
