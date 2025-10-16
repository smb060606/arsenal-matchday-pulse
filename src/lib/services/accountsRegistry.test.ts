import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('accountsRegistry.upsertAccountsRegistryBsky', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns { upserted: 0 } when admin client is not configured or profiles empty', async () => {
    vi.doMock('$lib/supabaseAdmin', () => ({
      getSupabaseAdmin: () => null
    }));
    const mod = await import('$lib/services/accountsRegistry');
    const { upsertAccountsRegistryBsky } = mod;

    // no admin client
    const r1 = await upsertAccountsRegistryBsky([
      {
        did: 'did:plc:test1',
        handle: 'test1.bsky.social',
        displayName: 'User 1',
        followersCount: 1000,
        postsCount: 10,
        createdAt: '2020-01-01T00:00:00Z'
      }
    ] as any);
    expect(r1).toEqual({ upserted: 0 });

    // empty profiles
    const r2 = await upsertAccountsRegistryBsky([]);
    expect(r2).toEqual({ upserted: 0 });
  });

  it('computes stale correctly based on followers and age thresholds; upserts rows', async () => {
    // Mock Supabase admin client and capture upsert payload
    const upsertCalls: any[] = [];
    const mockSb = {
      from: (table: string) => {
        expect(table).toBe('accounts_registry');
        return {
          upsert: (rows: any[], opts?: any) => {
            upsertCalls.push({ rows, opts });
            return { error: null };
          }
        };
      }
    };
    vi.doMock('$lib/supabaseAdmin', () => ({
      getSupabaseAdmin: () => mockSb
    }));

    const mod = await import('$lib/services/accountsRegistry');
    const { upsertAccountsRegistryBsky } = mod;

    const now = new Date('2025-10-16T00:00:00Z');

    // Profiles:
    // - freshOK: followers >= min and age >= min => stale = false
    // - lowFollowers: followers below threshold => stale = true
    // - young: account age months below threshold => stale = true
    // - unknownAge: createdAt null => not marked stale due to age (only by followers)
    const profiles = [
      {
        did: 'did:plc:ok',
        handle: 'ok.bsky.social',
        followersCount: 1000,
        postsCount: 10,
        createdAt: '2020-01-01T00:00:00Z'
      },
      {
        did: 'did:plc:low',
        handle: 'low.bsky.social',
        followersCount: 10,
        postsCount: 5,
        createdAt: '2018-01-01T00:00:00Z'
      },
      {
        did: 'did:plc:young',
        handle: 'young.bsky.social',
        followersCount: 2000,
        postsCount: 1,
        // 2025-08-01 ~ 2.5 months before now; likely below min months threshold
        createdAt: '2025-08-01T00:00:00Z'
      },
      {
        did: 'did:plc:unknown',
        handle: 'unknown.bsky.social',
        followersCount: 700,
        postsCount: 2,
        createdAt: null
      }
    ];

    const res = await upsertAccountsRegistryBsky(profiles as any, now);
    expect(res.upserted).toBe(4);
    expect(upsertCalls.length).toBe(1);
    const { rows, opts } = upsertCalls[0];
    expect(Array.isArray(rows)).toBe(true);
    expect(opts).toEqual({ onConflict: 'platform, did, user_id, handle' });

    // Find rows by handle
    const byHandle: Record<string, any> = {};
    for (const r of rows) {
      byHandle[r.handle] = r;
      // common fields present
      expect(r.platform).toBe('bsky');
      expect(r.did).toBeTruthy();
      expect(r.user_id).toBeNull();
      expect(r.last_checked_at).toBe(now.toISOString());
      // followers_count and account_created_at reflect inputs (or null)
      expect(r.followers_count).toBeDefined();
    }

    // Assertions on stale flag:
    expect(byHandle['ok.bsky.social'].stale).toBe(false); // meets followers and age
    expect(byHandle['low.bsky.social'].stale).toBe(true); // low followers
    expect(byHandle['young.bsky.social'].stale).toBe(true); // too new
    // unknown age => stale only if followers below min; here followers=700 so not stale
    expect(byHandle['unknown.bsky.social'].stale).toBe(false);
  });

  it('swallows upsert errors and returns { upserted: 0 }', async () => {
    const mockSb = {
      from: () => ({
        upsert: () => ({ error: new Error('db-fail') })
      })
    };
    vi.doMock('$lib/supabaseAdmin', () => ({
      getSupabaseAdmin: () => mockSb
    }));

    const mod = await import('$lib/services/accountsRegistry');
    const { upsertAccountsRegistryBsky } = mod;

    const res = await upsertAccountsRegistryBsky(
      [
        {
          did: 'did:plc:test',
          handle: 'test.bsky.social',
          followersCount: 1000,
          postsCount: 5,
          createdAt: '2020-01-01T00:00:00Z'
        }
      ] as any,
      new Date()
    );
    expect(res).toEqual({ upserted: 0 });
  });
});
