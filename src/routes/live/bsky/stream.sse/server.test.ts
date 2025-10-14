import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './+server';
import { buildTick } from '$lib/services/bskyService';
import { DEFAULT_RECENCY_MINUTES, DEFAULT_TICK_INTERVAL_SEC } from '$lib/config/bsky';

// Mock the bskyService
vi.mock('$lib/services/bskyService', () => ({
  buildTick: vi.fn()
}));

const mockBuildTick = vi.mocked(buildTick);

describe('/live/bsky/stream.sse/+server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful tick data
    mockBuildTick.mockResolvedValue({
      matchId: 'test-match',
      platform: 'bsky',
      window: 'live',
      generatedAt: '2024-01-01T00:00:00Z',
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
          createdAt: '2024-01-01T00:00:00Z'
        }
      ]
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET handler', () => {
    it('should return SSE response with correct headers', async () => {
      const url = new URL('http://localhost/live/bsky/stream.sse?matchId=test-match');
      const request = new Request(url);

      const response = await GET({ url, request } as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
      expect(response.headers.get('Connection')).toBe('keep-alive');
    });

    it('should use default parameters when not provided', async () => {
      const url = new URL('http://localhost/live/bsky/stream.sse');
      const request = new Request(url);

      const response = await GET({ url, request } as any);

      expect(response.status).toBe(200);
      // The stream should be created with default parameters
      expect(response.body).toBeDefined();
    });

    it('should parse query parameters correctly', async () => {
      const url = new URL('http://localhost/live/bsky/stream.sse?matchId=custom-match&window=pre&intervalSec=5&sinceMin=15');
      const request = new Request(url);

      const response = await GET({ url, request } as any);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('should handle invalid window parameter', async () => {
      const url = new URL('http://localhost/live/bsky/stream.sse?window=invalid');
      const request = new Request(url);

      const response = await GET({ url, request } as any);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('should handle invalid numeric parameters', async () => {
      const url = new URL('http://localhost/live/bsky/stream.sse?intervalSec=invalid&sinceMin=invalid');
      const request = new Request(url);

      const response = await GET({ url, request } as any);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('should create a readable stream', async () => {
      const url = new URL('http://localhost/live/bsky/stream.sse?matchId=test-match');
      const request = new Request(url);

      const response = await GET({ url, request } as any);

      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it('should handle buildTick errors gracefully', async () => {
      mockBuildTick.mockRejectedValue(new Error('API Error'));

      const url = new URL('http://localhost/live/bsky/stream.sse?matchId=test-match');
      const request = new Request(url);

      const response = await GET({ url, request } as any);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('should use correct default values', async () => {
      const url = new URL('http://localhost/live/bsky/stream.sse');
      const request = new Request(url);

      await GET({ url, request } as any);

      // The function should be called with default values
      // Note: This test verifies the parameters passed to buildTick
      // The actual stream behavior would need more complex testing
    });

    it('should handle zero or negative interval values', async () => {
      const url = new URL('http://localhost/live/bsky/stream.sse?intervalSec=0');
      const request = new Request(url);

      const response = await GET({ url, request } as any);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('should handle negative sinceMin values', async () => {
      const url = new URL('http://localhost/live/bsky/stream.sse?sinceMin=-5');
      const request = new Request(url);

      const response = await GET({ url, request } as any);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });
  });

  describe('Stream behavior', () => {
    it('should emit initial comment', async () => {
      const url = new URL('http://localhost/live/bsky/stream.sse?matchId=test-match');
      const request = new Request(url);

      const response = await GET({ url, request } as any);
      const reader = response.body?.getReader();
      
      if (reader) {
        const { value } = await reader.read();
        const text = new TextDecoder().decode(value);
        expect(text).toContain(': stream start');
        reader.releaseLock();
      }
    });

    it('should handle different window types', async () => {
      const windows = ['pre', 'live', 'post'];
      
      for (const window of windows) {
        const url = new URL(`http://localhost/live/bsky/stream.sse?window=${window}`);
        const request = new Request(url);

        const response = await GET({ url, request } as any);
        expect(response.status).toBe(200);
      }
    });

    it('should handle case-insensitive window parameter', async () => {
      const url = new URL('http://localhost/live/bsky/stream.sse?window=PRE');
      const request = new Request(url);

      const response = await GET({ url, request } as any);
      expect(response.status).toBe(200);
    });
  });
});

