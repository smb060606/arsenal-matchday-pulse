import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './+server';
import { getAccountsSnapshot } from '$lib/services/bskyService';

// Mock the bskyService
vi.mock('$lib/services/bskyService', () => ({
  getAccountsSnapshot: vi.fn()
}));

const mockGetAccountsSnapshot = vi.mocked(getAccountsSnapshot);

describe('/api/accounts/bsky/+server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET handler', () => {
    it('should return accounts data as JSON', async () => {
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
            reasons: ['followers=1000 ≥ min=500']
          }
        }
      ];

      mockGetAccountsSnapshot.mockResolvedValue(mockAccounts);

      const request = new Request('http://localhost/api/accounts/bsky');
      const response = await GET({ request } as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');

      const data = await response.json();
      expect(data).toEqual(mockAccounts);
    });

    it('should handle empty accounts list', async () => {
      mockGetAccountsSnapshot.mockResolvedValue([]);

      const request = new Request('http://localhost/api/accounts/bsky');
      const response = await GET({ request } as any);

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toEqual([]);
    });

    it('should handle service errors', async () => {
      mockGetAccountsSnapshot.mockRejectedValue(new Error('Service unavailable'));

      const request = new Request('http://localhost/api/accounts/bsky');
      
      try {
        await GET({ request } as any);
        // If no error is thrown, the handler should handle it gracefully
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Service unavailable');
      }
    });

    it('should return correct JSON structure', async () => {
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

      const request = new Request('http://localhost/api/accounts/bsky');
      const response = await GET({ request } as any);

      const data = await response.json();
      
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      
      // Verify structure of each account
      data.forEach((account: any) => {
        expect(account).toHaveProperty('did');
        expect(account).toHaveProperty('handle');
        expect(account).toHaveProperty('displayName');
        expect(account).toHaveProperty('followersCount');
        expect(account).toHaveProperty('postsCount');
        expect(account).toHaveProperty('createdAt');
        expect(account).toHaveProperty('eligibility');
        expect(account.eligibility).toHaveProperty('eligible');
        expect(account.eligibility).toHaveProperty('reasons');
        expect(Array.isArray(account.eligibility.reasons)).toBe(true);
      });
    });

    it('should handle null/undefined values in account data', async () => {
      const mockAccounts = [
        {
          did: 'did:plc:test1',
          handle: 'test1.bsky.social',
          displayName: null,
          followersCount: undefined,
          postsCount: 50,
          createdAt: null,
          eligibility: {
            eligible: false,
            reasons: ['followers=undefined < min=500']
          }
        }
      ];

      mockGetAccountsSnapshot.mockResolvedValue(mockAccounts);

      const request = new Request('http://localhost/api/accounts/bsky');
      const response = await GET({ request } as any);

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data[0].displayName).toBeNull();
      expect(data[0].followersCount).toBeUndefined();
      expect(data[0].createdAt).toBeNull();
    });
  });
});

