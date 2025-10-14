import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BskyAgent } from '@atproto/api';
import {
  resolveAllowlistProfiles,
  computeEligibility,
  selectEligibleAccounts,
  fetchRecentPostsForAccounts,
  summarizeSentiment,
  extractTopics,
  sampleQuotes,
  buildTick,
  getAccountsSnapshot,
  type BskyProfileBasic,
  type SelectedAccount,
  type SimplePost
} from './bskyService';
import {
  BSKY_MIN_FOLLOWERS,
  BSKY_MIN_ACCOUNT_MONTHS,
  BSKY_MAX_ACCOUNTS,
  BSKY_KEYWORDS,
  DEFAULT_RECENCY_MINUTES
} from '../config/bsky';

// Mock the BskyAgent
const mockAgent = {
  getProfiles: vi.fn(),
  getProfile: vi.fn(),
  getAuthorFeed: vi.fn()
};

vi.mocked(BskyAgent).mockImplementation(() => mockAgent as any);

describe('bskyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveAllowlistProfiles', () => {
    it('should resolve profiles using batch lookup when available', async () => {
      const mockProfiles = [
        {
          did: 'did:plc:test1',
          handle: 'test1.bsky.social',
          displayName: 'Test User 1',
          followersCount: 1000,
          postsCount: 50,
          createdAt: '2023-01-01T00:00:00Z'
        },
        {
          did: 'did:plc:test2',
          handle: 'test2.bsky.social',
          displayName: 'Test User 2',
          followersCount: 2000,
          postsCount: 100,
          createdAt: '2023-06-01T00:00:00Z'
        }
      ];

      mockAgent.getProfiles.mockResolvedValue({
        data: { profiles: mockProfiles }
      });

      const result = await resolveAllowlistProfiles(['test1.bsky.social', 'test2.bsky.social']);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        did: 'did:plc:test1',
        handle: 'test1.bsky.social',
        displayName: 'Test User 1',
        followersCount: 1000,
        postsCount: 50,
        createdAt: '2023-01-01T00:00:00Z'
      });
      expect(mockAgent.getProfiles).toHaveBeenCalledWith({ actors: ['test1.bsky.social', 'test2.bsky.social'] });
    });

    it('should fall back to individual profile lookup when batch fails', async () => {
      mockAgent.getProfiles.mockRejectedValue(new Error('Batch lookup failed'));
      mockAgent.getProfile.mockResolvedValue({
        data: {
          did: 'did:plc:test1',
          handle: 'test1.bsky.social',
          displayName: 'Test User 1',
          followersCount: 1000
        }
      });

      const result = await resolveAllowlistProfiles(['test1.bsky.social']);

      expect(result).toHaveLength(1);
      expect(mockAgent.getProfile).toHaveBeenCalledWith({ actor: 'test1.bsky.social' });
    });

    it('should return empty array for empty handles', async () => {
      const result = await resolveAllowlistProfiles([]);
      expect(result).toEqual([]);
    });
  });

  describe('computeEligibility', () => {
    it('should mark account as eligible when it meets all criteria', () => {
      const profile: BskyProfileBasic = {
        did: 'did:plc:test',
        handle: 'test.bsky.social',
        displayName: 'Test User',
        followersCount: 1000,
        createdAt: '2023-01-01T00:00:00Z'
      };

      const result = computeEligibility(profile);

      expect(result.eligible).toBe(true);
      expect(result.reasons).toContain('followers=1000 ≥ min=500');
      expect(result.reasons.some(r => /^age=\d+(\.\d+)?mo .+min=6mo$/.test(r))).toBe(true);
    });

    it('should mark account as ineligible when followers are too low', () => {
      const profile: BskyProfileBasic = {
        did: 'did:plc:test',
        handle: 'test.bsky.social',
        displayName: 'Test User',
        followersCount: 100,
        createdAt: '2023-01-01T00:00:00Z'
      };

      const result = computeEligibility(profile);

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('followers=100 < min=500');
    });

    it('should mark account as ineligible when account is too new', () => {
      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 3); // 3 months ago

      const profile: BskyProfileBasic = {
        did: 'did:plc:test',
        handle: 'test.bsky.social',
        displayName: 'Test User',
        followersCount: 1000,
        createdAt: recentDate.toISOString()
      };

      const result = computeEligibility(profile);

      expect(result.eligible).toBe(false);
      expect(result.reasons.some(r => r.includes('age=') && r.includes('< min=6mo'))).toBe(true);
    });

    it('should handle missing createdAt gracefully', () => {
      const profile: BskyProfileBasic = {
        did: 'did:plc:test',
        handle: 'test.bsky.social',
        displayName: 'Test User',
        followersCount: 1000,
        createdAt: null
      };

      const result = computeEligibility(profile);

      expect(result.eligible).toBe(true);
      expect(result.reasons).toContain('age=unknown (AppView); allowed based on followers/activity');
    });
  });

  describe('selectEligibleAccounts', () => {
    it('should select eligible accounts sorted by followers', async () => {
      const mockProfiles = [
        {
          did: 'did:plc:test1',
          handle: 'test1.bsky.social',
          displayName: 'Test User 1',
          followersCount: 1000,
          createdAt: '2023-01-01T00:00:00Z'
        },
        {
          did: 'did:plc:test2',
          handle: 'test2.bsky.social',
          displayName: 'Test User 2',
          followersCount: 2000,
          createdAt: '2023-01-01T00:00:00Z'
        }
      ];

      mockAgent.getProfiles.mockResolvedValue({
        data: { profiles: mockProfiles }
      });

      const result = await selectEligibleAccounts();

      expect(result).toHaveLength(2);
      expect(result[0].profile.followersCount).toBe(2000); // Higher followers first
      expect(result[1].profile.followersCount).toBe(1000);
      expect(result.every(acc => acc.eligibility.eligible)).toBe(true);
    });

    it('should respect maximum account limit', async () => {
      const mockProfiles = Array.from({ length: 50 }, (_, i) => ({
        did: `did:plc:test${i}`,
        handle: `test${i}.bsky.social`,
        displayName: `Test User ${i}`,
        followersCount: 1000 + i,
        createdAt: '2023-01-01T00:00:00Z'
      }));

      mockAgent.getProfiles.mockResolvedValue({
        data: { profiles: mockProfiles }
      });

      const result = await selectEligibleAccounts();

      expect(result.length).toBeLessThanOrEqual(BSKY_MAX_ACCOUNTS);
    });
  });

  describe('fetchRecentPostsForAccounts', () => {
    it('should fetch recent posts for accounts', async () => {
      const accounts: SelectedAccount[] = [
        {
          profile: {
            did: 'did:plc:test1',
            handle: 'test1.bsky.social',
            displayName: 'Test User 1',
            followersCount: 1000
          },
          eligibility: { eligible: true, reasons: [] }
        }
      ];

      const mockFeed = {
        data: {
          feed: [
            {
              post: {
                uri: 'at://did:plc:test1/app.bsky.feed.post/123',
                cid: 'cid123',
                author: {
                  did: 'did:plc:test1',
                  handle: 'test1.bsky.social',
                  displayName: 'Test User 1'
                },
                indexedAt: new Date().toISOString(),
                record: {
                  text: 'Great Arsenal performance!',
                  createdAt: new Date().toISOString()
                }
              }
            }
          ]
        }
      };

      mockAgent.getAuthorFeed.mockResolvedValue(mockFeed);

      const result = await fetchRecentPostsForAccounts(accounts);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Great Arsenal performance!');
      expect(result[0].author.handle).toBe('test1.bsky.social');
    });

    it('should filter out old posts', async () => {
      const accounts: SelectedAccount[] = [
        {
          profile: {
            did: 'did:plc:test1',
            handle: 'test1.bsky.social',
            displayName: 'Test User 1',
            followersCount: 1000
          },
          eligibility: { eligible: true, reasons: [] }
        }
      ];

      const oldDate = new Date();
      oldDate.setMinutes(oldDate.getMinutes() - 20); // 20 minutes ago

      const mockFeed = {
        data: {
          feed: [
            {
              post: {
                uri: 'at://did:plc:test1/app.bsky.feed.post/123',
                cid: 'cid123',
                author: {
                  did: 'did:plc:test1',
                  handle: 'test1.bsky.social',
                  displayName: 'Test User 1'
                },
                indexedAt: oldDate.toISOString(),
                record: {
                  text: 'Old Arsenal post',
                  createdAt: oldDate.toISOString()
                }
              }
            }
          ]
        }
      };

      mockAgent.getAuthorFeed.mockResolvedValue(mockFeed);

      const result = await fetchRecentPostsForAccounts(accounts, 10); // 10 minutes window

      expect(result).toHaveLength(0);
    });
  });

  describe('summarizeSentiment', () => {
    it('should calculate sentiment ratios correctly', () => {
      const posts: SimplePost[] = [
        {
          uri: 'at://test/post1',
          cid: 'cid1',
          author: { did: 'did:test', handle: 'test.bsky.social' },
          text: 'Great Arsenal performance!',
          createdAt: new Date().toISOString()
        },
        {
          uri: 'at://test/post2',
          cid: 'cid2',
          author: { did: 'did:test', handle: 'test.bsky.social' },
          text: 'Terrible Arsenal performance!',
          createdAt: new Date().toISOString()
        },
        {
          uri: 'at://test/post3',
          cid: 'cid3',
          author: { did: 'did:test', handle: 'test.bsky.social' },
          text: 'Arsenal played okay today',
          createdAt: new Date().toISOString()
        }
      ];

      const result = summarizeSentiment(posts);

      expect(result.counts.total).toBe(3);
      expect(result.counts.pos).toBe(1);
      expect(result.counts.neg).toBe(1);
      expect(result.counts.neu).toBe(1);
      expect(result.ratios.pos).toBeCloseTo(1/3, 2);
      expect(result.ratios.neg).toBeCloseTo(1/3, 2);
      expect(result.ratios.neu).toBeCloseTo(1/3, 2);
    });

    it('should handle empty posts array', () => {
      const result = summarizeSentiment([]);

      expect(result.counts.total).toBe(0);
      expect(result.ratios.pos).toBe(0);
      expect(result.ratios.neg).toBe(0);
      expect(result.ratios.neu).toBe(0);
    });
  });

  describe('extractTopics', () => {
    it('should extract topics from posts', () => {
      const posts: SimplePost[] = [
        {
          uri: 'at://test/post1',
          cid: 'cid1',
          author: { did: 'did:test', handle: 'test.bsky.social' },
          text: 'Arsenal played great today! COYG!',
          createdAt: new Date().toISOString()
        },
        {
          uri: 'at://test/post2',
          cid: 'cid2',
          author: { did: 'did:test', handle: 'test.bsky.social' },
          text: 'Arsenal and Saka were amazing',
          createdAt: new Date().toISOString()
        }
      ];

      const result = extractTopics(posts);

      expect(result).toContainEqual({ keyword: 'Arsenal', count: 2 });
      expect(result).toContainEqual({ keyword: 'Saka', count: 1 });
      expect(result).toContainEqual({ keyword: 'COYG', count: 1 });
    });

    it('should return empty array for posts with no keywords', () => {
      const posts: SimplePost[] = [
        {
          uri: 'at://test/post1',
          cid: 'cid1',
          author: { did: 'did:test', handle: 'test.bsky.social' },
          text: 'Just a random post about nothing',
          createdAt: new Date().toISOString()
        }
      ];

      const result = extractTopics(posts);

      expect(result).toEqual([]);
    });
  });

  describe('sampleQuotes', () => {
    it('should return most recent posts as samples', () => {
      const now = new Date();
      const posts: SimplePost[] = [
        {
          uri: 'at://test/post1',
          cid: 'cid1',
          author: { did: 'did:test', handle: 'test.bsky.social' },
          text: 'Old post',
          createdAt: new Date(now.getTime() - 10000).toISOString()
        },
        {
          uri: 'at://test/post2',
          cid: 'cid2',
          author: { did: 'did:test', handle: 'test.bsky.social' },
          text: 'Recent post',
          createdAt: now.toISOString()
        }
      ];

      const result = sampleQuotes(posts, 1);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Recent post');
    });
  });

  describe('buildTick', () => {
    it('should build complete tick summary', async () => {
      const mockProfiles = [
        {
          did: 'did:plc:test1',
          handle: 'test1.bsky.social',
          displayName: 'Test User 1',
          followersCount: 1000,
          createdAt: '2023-01-01T00:00:00Z'
        }
      ];

      const mockFeed = {
        data: {
          feed: [
            {
              post: {
                uri: 'at://did:plc:test1/app.bsky.feed.post/123',
                cid: 'cid123',
                author: {
                  did: 'did:plc:test1',
                  handle: 'test1.bsky.social',
                  displayName: 'Test User 1'
                },
                indexedAt: new Date().toISOString()
              },
              record: {
                text: 'Great Arsenal performance!',
                createdAt: new Date().toISOString()
              }
            }
          ]
        }
      };

      mockAgent.getProfiles.mockResolvedValue({ data: { profiles: mockProfiles } });
      mockAgent.getAuthorFeed.mockResolvedValue(mockFeed);

      const result = await buildTick('test-match', 'live', 1);

      expect(result.matchId).toBe('test-match');
      expect(result.platform).toBe('bsky');
      expect(result.window).toBe('live');
      expect(result.tick).toBe(1);
      expect(result.volume).toBe(1);
      expect(result.accountsUsed).toHaveLength(1);
      expect(result.samples).toHaveLength(1);
      expect(result.sentiment.counts.total).toBe(1);
    });
  });

  describe('getAccountsSnapshot', () => {
    it('should return accounts snapshot with eligibility', async () => {
      const mockProfiles = [
        {
          did: 'did:plc:test1',
          handle: 'test1.bsky.social',
          displayName: 'Test User 1',
          followersCount: 1000,
          postsCount: 50,
          createdAt: '2023-01-01T00:00:00Z'
        }
      ];

      mockAgent.getProfiles.mockResolvedValue({ data: { profiles: mockProfiles } });

      const result = await getAccountsSnapshot();

      expect(result).toHaveLength(1);
      expect(result[0].did).toBe('did:plc:test1');
      expect(result[0].handle).toBe('test1.bsky.social');
      expect(result[0].eligibility.eligible).toBe(true);
    });
  });
});
