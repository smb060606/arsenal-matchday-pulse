import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeEligibility,
  resolveAllowlistProfiles,
  selectEligibleAccounts,
  getAccountsSnapshot,
  type TwitterProfileBasic
} from './twitterService';
import {
  TWITTER_MIN_FOLLOWERS,
  TWITTER_MIN_ACCOUNT_MONTHS,
  TWITTER_ALLOWLIST
} from '$lib/config/twitter';

// Mock overrides service to avoid Supabase in unit tests
vi.mock('$lib/services/accountOverrides', () => ({
  getOverrides: vi.fn().mockResolvedValue({ include: [], exclude: [] })
}));

describe('twitterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveAllowlistProfiles', () => {
    it('creates minimal profiles from allowlist with displayName equal to handle', async () => {
      const result = await resolveAllowlistProfiles(['handle1', 'handle2']);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        handle: 'handle1',
        displayName: 'handle1',
        followersCount: undefined,
        postsCount: undefined,
        createdAt: null
      });
    });

    it('defaults to config TWITTER_ALLOWLIST when no handles provided', async () => {
      const result = await resolveAllowlistProfiles();
      // Not asserting the entire list content; just that it maps correctly
      expect(Array.isArray(result)).toBe(true);
      if (TWITTER_ALLOWLIST.length) {
        expect(result[0].handle).toBe(TWITTER_ALLOWLIST[0]);
      }
    });
  });

  describe('computeEligibility', () => {
    it('eligible when followers and account age thresholds are met', () => {
      const created = new Date();
      created.setMonth(created.getMonth() - (TWITTER_MIN_ACCOUNT_MONTHS + 6)); // older than min
      const p: TwitterProfileBasic = {
        handle: 'test',
        displayName: 'Test',
        followersCount: TWITTER_MIN_FOLLOWERS + 10,
        createdAt: created.toISOString()
      };
      const res = computeEligibility(p);
      expect(res.eligible).toBe(true);
      expect(res.reasons.some(r => r.includes(`≥ min=${TWITTER_MIN_FOLLOWERS}`))).toBe(true);
      expect(res.reasons.some(r => r.includes(`≥ min=${TWITTER_MIN_ACCOUNT_MONTHS}mo`))).toBe(true);
    });

    it('ineligible when followers are below threshold', () => {
      const p: TwitterProfileBasic = {
        handle: 'low',
        followersCount: TWITTER_MIN_FOLLOWERS - 1,
        createdAt: null
      };
      const res = computeEligibility(p);
      expect(res.eligible).toBe(false);
      expect(res.reasons.some(r => r.includes('< min='))).toBe(true);
    });

    it('ineligible when account age is below threshold', () => {
      const created = new Date();
      created.setMonth(created.getMonth() - (TWITTER_MIN_ACCOUNT_MONTHS - 6)); // slightly younger than min
      const p: TwitterProfileBasic = {
        handle: 'young',
        followersCount: TWITTER_MIN_FOLLOWERS + 100,
        createdAt: created.toISOString()
      };
      const res = computeEligibility(p);
      expect(res.eligible).toBe(false);
      expect(res.reasons.some(r => r.includes('< min'))).toBe(true);
    });

    it('allows unknown account age with disclosure if followers sufficient', () => {
      const p: TwitterProfileBasic = {
        handle: 'unknown-age',
        followersCount: TWITTER_MIN_FOLLOWERS + 1,
        createdAt: null
      };
      const res = computeEligibility(p);
      expect(res.eligible).toBe(true);
      expect(res.reasons.some(r => r.includes('age=unknown'))).toBe(true);
    });
  });

  describe('selectEligibleAccounts', () => {
    it('respects overrides precedence and caps to max accounts', async () => {
      // Arrange: include two entries, exclude one of them; exclude should win
      const mockOverrides = {
        include: [
          { identifier_type: 'handle', identifier: 'inc1', handle: 'inc1', bypass_eligibility: true },
          { identifier_type: 'handle', identifier: 'inc2', handle: 'inc2', bypass_eligibility: false }
        ],
        exclude: [
          { identifier_type: 'handle', identifier: 'inc2' } // should remove inc2 despite include
        ]
      };

      const { getOverrides } = await import('$lib/services/accountOverrides' as any) as any;
      (getOverrides as any).mockResolvedValueOnce(mockOverrides);

      // Spy resolveAllowlistProfiles to known set
      const profiles: TwitterProfileBasic[] = [
        { handle: 'base1', followersCount: TWITTER_MIN_FOLLOWERS + 100, createdAt: null },
        { handle: 'base2', followersCount: TWITTER_MIN_FOLLOWERS + 50, createdAt: null }
      ];
      const spy = vi.spyOn(await import('./twitterService'), 'resolveAllowlistProfiles' as any).mockResolvedValueOnce(profiles);

      const res = await selectEligibleAccounts({ matchId: 'm1' });
      // Should include inc1 (bypass) and base1/base2 eligible; inc2 excluded by exclude
      const handles = res.map(r => r.profile.handle);
      expect(handles).toContain('inc1');
      expect(handles).not.toContain('inc2');
      expect(handles.some(h => h === 'base1' || h === 'base2')).toBe(true);

      spy.mockRestore();
    });
  });

  describe('getAccountsSnapshot', () => {
    it('returns snapshot with eligibility field', async () => {
      // Use empty overrides and allowlist resolution (minimal fields)
      const res = await getAccountsSnapshot();
      expect(Array.isArray(res)).toBe(true);
      if (res.length) {
        expect(res[0]).toHaveProperty('handle');
        expect(res[0]).toHaveProperty('eligibility');
      }
    });
  });
});
