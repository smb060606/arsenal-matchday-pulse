import type { RequestHandler } from './$types';
import { buildTick } from '$lib/services/bskyService';
import { DEFAULT_RECENCY_MINUTES, DEFAULT_TICK_INTERVAL_SEC } from '$lib/config/bsky';

export const GET: RequestHandler = async ({ setHeaders, url }) => {
  setHeaders({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive'
  });

  const matchId = url.searchParams.get('matchId') ?? 'demo';
  const windowParam = (url.searchParams.get('window') ?? 'live').toLowerCase();
  const window: 'pre' | 'live' | 'post' =
    windowParam === 'pre' || windowParam === 'post' ? (windowParam as any) : 'live';

  const nInterval = Number(url.searchParams.get('intervalSec'));
  const intervalSec = Math.max(
    1,
    Number.isFinite(nInterval) && nInterval > 0 ? nInterval : DEFAULT_TICK_INTERVAL_SEC
  );
  const nSince = Number(url.searchParams.get('sinceMin'));
  const sinceMin = Number.isFinite(nSince) && nSince > 0 ? nSince : DEFAULT_RECENCY_MINUTES;

  const encoder = new TextEncoder();
  let stopped = false;
  let closer: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Initial comment to open the stream in some proxies
      controller.enqueue(encoder.encode(': stream start\n\n'));

      let tick = 0;

      const loop = async () => {
        while (!stopped) {
          try {
            const payload = await buildTick(matchId, window, tick++, sinceMin);
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

      // Soft cap the connection to 15 minutes; client can reconnect
      closer = setTimeout(() => {
        stopped = true;
        controller.close();
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
