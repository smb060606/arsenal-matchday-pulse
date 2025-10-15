import type { RequestHandler } from './$types';
import { buildTick } from '$lib/services/bskyService';
import { DEFAULT_RECENCY_MINUTES, DEFAULT_TICK_INTERVAL_SEC } from '$lib/config/bsky';
import { getWindowState, DEFAULT_LIVE_DURATION_MIN } from '$lib/utils/matchWindow';

export const GET: RequestHandler = async ({ setHeaders, url }) => {
  setHeaders({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });

  const matchId = url.searchParams.get('matchId') ?? 'demo';

  // Optional override for testing (pre|live|post). If omitted, we compute window dynamically.
  const windowParam = (url.searchParams.get('window') ?? '').toLowerCase();
  const forceWindow: 'pre' | 'live' | 'post' | null =
    windowParam === 'pre' || windowParam === 'post' || windowParam === 'live'
      ? (windowParam as any)
      : null;

  // Kickoff time (ISO string) and optional live duration to determine match windows
  const kickoffISO = url.searchParams.get('kickoff') ?? '';
  const liveMinParam = Number(url.searchParams.get('liveMin'));
  const liveDurationMin = Number.isFinite(liveMinParam) && liveMinParam > 0 ? liveMinParam : DEFAULT_LIVE_DURATION_MIN;

  const nInterval = Number(url.searchParams.get('intervalSec'));
  const intervalSec = Math.max(1, Number.isFinite(nInterval) && nInterval > 0 ? nInterval : DEFAULT_TICK_INTERVAL_SEC);

  const nSince = Number(url.searchParams.get('sinceMin'));
  const sinceMin = Number.isFinite(nSince) && nSince > 0 ? nSince : DEFAULT_RECENCY_MINUTES;

  const encoder = new TextEncoder();
  let stopped = false;
  let closer: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Initial comment to open the stream in some proxies and communicate parameters
      const intro = {
        matchId,
        kickoffISO: kickoffISO || '(none)',
        liveDurationMin,
        intervalSec,
        sinceMin,
        mode: forceWindow ? `force:${forceWindow}` : 'dynamic'
      };
      controller.enqueue(encoder.encode(`: stream start\n`));
      controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify(intro)}\n\n`));

      let tick = 0;

      const loop = async () => {
        while (!stopped) {
          try {
            // Determine current window
            const dynamic = forceWindow ?? (() => {
              const w = getWindowState({ kickoffISO, liveDurationMin });
              return w === 'ended' ? 'post' : w; // treat ended as post to send a final tick then close
            })();

            // If we are past post window, end the stream gracefully
            if (!forceWindow && getWindowState({ kickoffISO, liveDurationMin }) === 'ended') {
              controller.enqueue(encoder.encode(`event: ended\ndata: ${JSON.stringify({ matchId, at: new Date().toISOString() })}\n\n`));
              break;
            }

            const payload = await buildTick(matchId, dynamic as 'pre' | 'live' | 'post', tick++, sinceMin);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          } catch (e) {
            const err = { message: 'tick_failed' };
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(err)}\n\n`));
          }
          await new Promise((r) => setTimeout(r, intervalSec * 1000));
        }

        // Close after loop exits
        try {
          controller.close();
        } catch {
          // no-op
        }
      };

      loop().catch(() => {
        try {
          controller.close();
        } catch {
          // ignore
        }
      });

      // Soft cap the connection to 15 minutes; client can reconnect
      closer = setTimeout(() => {
        stopped = true;
        try {
          controller.close();
        } catch {
          // ignore
        }
      }, 15 * 60 * 1000);
    },
    cancel() {
      stopped = true;
      if (closer) {
        clearTimeout(closer);
        closer = null;
      }
    }
  });

  return new Response(stream);
};
