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
  const intervalSec = Number(url.searchParams.get('intervalSec') ?? 10);
  const sinceMin = Number(url.searchParams.get('sinceMin') ?? 180);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(': test post-match stream start\n\n'));

      let tick = 0;
      const iv = setInterval(async () => {
        try {
          const payload = await buildTick(matchId, 'post', tick++, sinceMin);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch (e) {
          const err = { message: 'tick_failed' };
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(err)}\n\n`));
        }
      }, Math.max(1, intervalSec) * 1000);

      // Close after 10 minutes by default; client can reconnect
      const closer = setTimeout(() => {
        clearInterval(iv);
        controller.close();
      }, 10 * 60 * 1000);

      // Optional cancellation support
      // @ts-ignore
      controller.signal?.addEventListener?.('abort', () => {
        clearInterval(iv);
        clearTimeout(closer);
        controller.close();
      });
    }
  });

  return new Response(stream);
};
