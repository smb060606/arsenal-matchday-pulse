import type { RequestHandler } from './$types';
import { buildTick } from '$lib/services/bskyService';

// Test endpoint: generate a "post-match" livestream using recent posts, suitable for matches that have finished.
// Defaults:
// - window = "post"
// - sinceMin = 180 (last 3 hours)
// - intervalSec = 10
export const GET: RequestHandler = async ({ setHeaders, url }) => {
  setHeaders({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive'
  });

  // Use an indicative matchId for testing; caller can override with ?matchId=foo
  const matchId = url.searchParams.get('matchId') ?? 'latest-finished-test';
  const nInterval = Number(url.searchParams.get('intervalSec'));
  const intervalSec = Math.max(1, Number.isFinite(nInterval) && nInterval > 0 ? nInterval : 10);
  const nSince = Number(url.searchParams.get('sinceMin'));
  const sinceMin = Number.isFinite(nSince) && nSince > 0 ? nSince : 180;

  const encoder = new TextEncoder();
  let stopped = false;
  let closer: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(': test post-match stream start\n\n'));

      let tick = 0;

      const loop = async () => {
        while (!stopped) {
          try {
            const payload = await buildTick(matchId, 'post', tick++, sinceMin);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          } catch (e) {
            const err = { message: 'tick_failed' };
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(err)}\n\n`));
          }
          await new Promise((r) => setTimeout(r, intervalSec * 1000));
        }
      };

      loop().catch(() => {
        try { controller.close(); } catch {}
      });

      // Close after 10 minutes by default; client can reconnect
      closer = setTimeout(() => {
        stopped = true;
        controller.close();
      }, 10 * 60 * 1000);
    },
    cancel() {
      // Proper cancellation and cleanup
      stopped = true;
      if (closer) {
        clearTimeout(closer);
        closer = null;
      }
    }
  });

  return new Response(stream);
};
