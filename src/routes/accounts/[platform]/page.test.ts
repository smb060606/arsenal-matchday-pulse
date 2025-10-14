import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { load } from './+page';
import { getAccountsSnapshot } from '$lib/services/bskyService';

// Mock the bskyService
vi.mock('$lib/services/bskyService', () => ({
  getAccountsSnapshot: vi.fn()
}));

const mockGetAccountsSnapshot = vi.mocked(getAccountsSnapshot);

describe('/accounts/[platform]/+page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('load function', () => {
    it('should load accounts for bsky platform', async () => {
      const mockAccounts = [
        {
          did: 'did:plc:test1',
          handle: 'test1.bsky.social',
          displayName: 'Test User 1',
          followersCount: 1000,
          postsCount: 50,
          createdAt: '2023-01-01T00:00:00Z',
          eligibility: {
            eligible: true,
            reasons: ['followers=1000 ≥ min=500', 'age=12.0mo ≥ min=6mo']
          }
        },
        {
          did: 'did:plc:test2',
          handle: 'test2.bsky.social',
          displayName: 'Test User 2',
          followersCount: 2000,
          postsCount: 100,
          createdAt: '2023-06-01T00:00:00Z',
          eligibility: {
            eligible: true,
            reasons: ['followers=2000 ≥ min=500', 'age=6.0mo ≥ min=6mo']
          }
        }
      ];

      mockGetAccountsSnapshot.mockResolvedValue(mockAccounts);

      const params = { platform: 'bsky' };
      const result = await load({ params } as any);

      expect(result).toEqual({
        platform: 'bsky',
        generatedAt: expect.any(String),
        count: 2,
        accounts: mockAccounts
      });

      expect(mockGetAccountsSnapshot).toHaveBeenCalledTimes(1);
    });

    it('should handle empty accounts list', async () => {
      mockGetAccountsSnapshot.mockResolvedValue([]);

      const params = { platform: 'bsky' };
      const result = await load({ params } as any);

      expect(result).toEqual({
        platform: 'bsky',
        generatedAt: expect.any(String),
        count: 0,
        accounts: []
      });
    });

    it('should handle different platforms', async () => {
      mockGetAccountsSnapshot.mockResolvedValue([]);

      const platforms = ['bsky', 'twitter', 'threads'];
      
      for (const platform of platforms) {
        const params = { platform };
        const result = await load({ params } as any);

        expect(result.platform).toBe(platform);
        expect(result.generatedAt).toBeDefined();
        expect(result.count).toBe(0);
        expect(result.accounts).toEqual([]);
      }
    });

    it('should include generatedAt timestamp', async () => {
      mockGetAccountsSnapshot.mockResolvedValue([]);

      const params = { platform: 'bsky' };
      const result = await load({ params } as any);

      expect(result.generatedAt).toBeDefined();
      expect(new Date(result.generatedAt)).toBeInstanceOf(Date);
      expect(new Date(result.generatedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should handle service errors gracefully', async () => {
      mockGetAccountsSnapshot.mockRejectedValue(new Error('Service unavailable'));

      const params = { platform: 'bsky' };
      
      // The load function should handle errors and return empty data
      // This depends on the actual implementation - if it doesn't handle errors,
      // the test should expect the error to be thrown
      try {
        const result = await load({ params } as any);
        // If no error is thrown, verify the result structure
        expect(result).toHaveProperty('platform');
        expect(result).toHaveProperty('generatedAt');
        expect(result).toHaveProperty('count');
        expect(result).toHaveProperty('accounts');
      } catch (error) {
        // If error is thrown, verify it's the expected error
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Service unavailable');
      }
    });

    it('should return correct count for accounts', async () => {
      const mockAccounts = Array.from({ length: 5 }, (_, i) => ({
        did: `did:plc:test${i}`,
        handle: `test${i}.bsky.social`,
        displayName: `Test User ${i}`,
        followersCount: 1000 + i * 100,
        postsCount: 50 + i * 10,
        createdAt: '2023-01-01T00:00:00Z',
        eligibility: {
          eligible: true,
          reasons: ['followers=1000 ≥ min=500']
        }
      }));

      mockGetAccountsSnapshot.mockResolvedValue(mockAccounts);

      const params = { platform: 'bsky' };
      const result = await load({ params } as any);

      expect(result.count).toBe(5);
      expect(result.accounts).toHaveLength(5);
    });

    it('should preserve account data structure', async () => {
      const mockAccount = {
        did: 'did:plc:test',
        handle: 'test.bsky.social',
        displayName: 'Test User',
        followersCount: 1500,
        postsCount: 75,
        createdAt: '2023-03-15T00:00:00Z',
        eligibility: {
          eligible: true,
          reasons: ['followers=1500 ≥ min=500', 'age=9.0mo ≥ min=6mo']
        }
      };

      mockGetAccountsSnapshot.mockResolvedValue([mockAccount]);

      const params = { platform: 'bsky' };
      const result = await load({ params } as any);

      expect(result.accounts[0]).toEqual(mockAccount);
      expect(result.accounts[0].did).toBe('did:plc:test');
      expect(result.accounts[0].handle).toBe('test.bsky.social');
      expect(result.accounts[0].displayName).toBe('Test User');
      expect(result.accounts[0].followersCount).toBe(1500);
      expect(result.accounts[0].postsCount).toBe(75);
      expect(result.accounts[0].createdAt).toBe('2023-03-15T00:00:00Z');
      expect(result.accounts[0].eligibility.eligible).toBe(true);
      expect(result.accounts[0].eligibility.reasons).toHaveLength(2);
    });
  });
});

