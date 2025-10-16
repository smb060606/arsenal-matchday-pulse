import { describe, it, expect } from 'vitest';
import { load } from './+page';

describe('/history/[matchId]/+page', () => {
  it('loads history with defaults (platform=bsky, phase=all) and returns empty array on non-200', async () => {
    const matchId = 'demo';
    const fetch = async (input: RequestInfo) => {
      // Validate URL
      const url = new URL(input as string, 'http://localhost');
      expect(url.pathname).toBe('/api/summaries/history');
      expect(url.searchParams.get('matchId')).toBe(matchId);
      expect(url.searchParams.get('platform')).toBe('bsky');
      expect(url.searchParams.get('phase')).toBe('all');

      return new Response('history_load_failed', { status: 500 });
    };

    const url = new URL(`http://localhost/history/${matchId}`);
    const result: any = await load({ fetch, params: { matchId }, url } as any);
    expect(result.matchId).toBe(matchId);
    expect(result.platform).toBe('bsky');
    expect(result.phase).toBe('all');
    expect(result.count).toBe(0);
    expect(Array.isArray(result.summaries)).toBe(true);
  });

  it('loads history for given platform/phase and returns summaries', async () => {
    const matchId = 'demo';
    const payload = {
      matchId: 'demo',
      platform: 'bsky',
      phase: 'pre',
      count: 1,
      summaries: [
        {
          id: '1',
          match_id: 'demo',
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
      ]
    };

    const fetch = async (_input: RequestInfo) => {
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const url = new URL(`http://localhost/history/${matchId}?platform=bsky&phase=pre`);
    const result: any = await load({ fetch, params: { matchId }, url } as any);
    expect(result.matchId).toBe('demo');
    expect(result.platform).toBe('bsky');
    expect(result.phase).toBe('pre');
    expect(result.count).toBe(1);
    expect(Array.isArray(result.summaries)).toBe(true);
    expect(result.summaries[0].platform).toBe('bsky');
    expect(result.summaries[0].phase).toBe('pre');
  });
});
