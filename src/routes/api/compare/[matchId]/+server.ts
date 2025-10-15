import type { RequestHandler } from '@sveltejs/kit';
import { buildTick } from '$lib/services/bskyService';
import { DEFAULT_RECENCY_MINUTES } from '$lib/config/bsky';
import { getWindowState, DEFAULT_LIVE_DURATION_MIN } from '$lib/utils/matchWindow';

// For now, this snapshot endpoint returns Bluesky-only tick summaries,
// with window enforcement based on kickoff and live duration.
// Future: extend to twitter/threads once APIs/cost guards are configured.

export const GET: RequestHandler = async ({ url, params }) => {
  try {
    const matchId = params.matchId || url.searchParams.get('matchId') || 'demo';

    // Optional overrides
    const windowParam = (url.searchParams.get('window') ?? '').toLowerCase();
    const forceWindow: 'pre' | 'live' | 'post' | null =
      windowParam === 'pre' || windowParam === 'post' || windowParam === 'live'
        ? (windowParam as any)
        : null;

    const kickoffISO = url.searchParams.get('kickoff') ?? '';
    const liveMinParam = Number(url.searchParams.get('liveMin'));
    const liveDurationMin = Number.isFinite(liveMinParam) && liveMinParam > 0 ? liveMinParam : DEFAULT_LIVE_DURATION_MIN;

    const nSince = Number(url.searchParams.get('sinceMin'));
    const sinceMin = Number.isFinite(nSince) && nSince > 0 ? nSince : DEFAULT_RECENCY_MINUTES;

    // Compute window if not forced
    const current = forceWindow ?? (() => {
      const w = getWindowState({ kickoffISO, liveDurationMin });
      return w === 'ended' ? 'post' : w; // treat ended as post
    })();

    // Build Bluesky tick summary for snapshot (tick index -1 indicates "snapshot")
    const bsky = await buildTick(matchId, current as 'pre' | 'live' | 'post', -1, sinceMin);

    const payload = {
      generatedAt: new Date().toISOString(),
      matchId,
      kickoffISO: kickoffISO || null,
      window: current,
      sinceMin,
      platforms: {
        bsky
        // twitter: null,
        // threads: null
      }
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: 'compare_snapshot_failed',
        message: e?.message ?? 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
