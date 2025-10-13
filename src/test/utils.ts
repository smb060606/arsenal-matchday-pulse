import { vi } from 'vitest';

/**
 * Test utilities for Arsenal Matchday Pulse
 */

export interface MockBskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  followersCount?: number;
  postsCount?: number;
  createdAt?: string | null;
}

export interface MockPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
  };
  text: string;
  createdAt: string;
}

/**
 * Creates a mock BskyAgent with configurable responses
 */
export function createMockBskyAgent() {
  return {
    getProfiles: vi.fn(),
    getProfile: vi.fn(),
    getAuthorFeed: vi.fn()
  };
}

/**
 * Creates mock profile data for testing
 */
export function createMockProfile(overrides: Partial<MockBskyProfile> = {}): MockBskyProfile {
  return {
    did: 'did:plc:test',
    handle: 'test.bsky.social',
    displayName: 'Test User',
    followersCount: 1000,
    postsCount: 50,
    createdAt: '2023-01-01T00:00:00Z',
    ...overrides
  };
}

/**
 * Creates mock post data for testing
 */
export function createMockPost(overrides: Partial<MockPost> = {}): MockPost {
  return {
    uri: 'at://did:plc:test/app.bsky.feed.post/123',
    cid: 'cid123',
    author: {
      did: 'did:plc:test',
      handle: 'test.bsky.social',
      displayName: 'Test User'
    },
    text: 'Test post content',
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Creates mock feed response data
 */
export function createMockFeedResponse(posts: MockPost[] = []) {
  return {
    data: {
      feed: posts.map(post => ({
        post: {
          uri: post.uri,
          cid: post.cid,
          author: post.author,
          indexedAt: post.createdAt
        },
        record: {
          text: post.text,
          createdAt: post.createdAt
        }
      }))
    }
  };
}

/**
 * Creates mock profiles response data
 */
export function createMockProfilesResponse(profiles: MockBskyProfile[] = []) {
  return {
    data: {
      profiles
    }
  };
}

/**
 * Creates mock sentiment analysis result
 */
export function createMockSentimentResult(score: number = 0) {
  return {
    score,
    positive: score > 0 ? ['positive'] : [],
    negative: score < 0 ? ['negative'] : [],
    tokenizedPhrase: ['test', 'phrase']
  };
}

/**
 * Waits for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a mock URL for testing
 */
export function createMockUrl(path: string, searchParams: Record<string, string> = {}): URL {
  const url = new URL(`http://localhost${path}`);
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url;
}

/**
 * Creates a mock Request object for testing
 */
export function createMockRequest(url: string | URL, options: RequestInit = {}): Request {
  return new Request(url, options);
}

/**
 * Creates mock eligibility data
 */
export function createMockEligibility(eligible: boolean = true, reasons: string[] = []) {
  return {
    eligible,
    reasons: reasons.length > 0 ? reasons : (eligible ? ['meets criteria'] : ['does not meet criteria'])
  };
}

/**
 * Creates a mock tick summary for testing
 */
export function createMockTickSummary(overrides: any = {}) {
  return {
    matchId: 'test-match',
    platform: 'bsky' as const,
    window: 'live' as const,
    generatedAt: new Date().toISOString(),
    tick: 0,
    sentiment: {
      pos: 0.6,
      neu: 0.3,
      neg: 0.1,
      counts: {
        total: 10,
        pos: 6,
        neu: 3,
        neg: 1
      }
    },
    volume: 10,
    accountsUsed: [
      { did: 'did:test', handle: 'test.bsky.social', displayName: 'Test User' }
    ],
    topics: [
      { keyword: 'Arsenal', count: 5 },
      { keyword: 'COYG', count: 3 }
    ],
    samples: [
      {
        authorHandle: 'test.bsky.social',
        text: 'Great Arsenal performance!',
        createdAt: new Date().toISOString()
      }
    ],
    ...overrides
  };
}

/**
 * Asserts that a value is a valid ISO date string
 */
export function expectValidISODate(dateString: string): void {
  const date = new Date(dateString);
  expect(date).toBeInstanceOf(Date);
  expect(date.getTime()).not.toBeNaN();
  expect(dateString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/);
}

/**
 * Asserts that a value is a valid DID (Decentralized Identifier)
 */
export function expectValidDID(did: string): void {
  expect(did).toMatch(/^did:[a-z]+:[a-zA-Z0-9._-]+$/);
}

/**
 * Asserts that a value is a valid Bluesky handle
 */
export function expectValidBlueskyHandle(handle: string): void {
  expect(handle).toMatch(/^[a-zA-Z0-9.-]+(\.bsky\.social|\.com)$/);
}

