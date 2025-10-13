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

  const intervalSec = Number(url.searchParams.get('intervalSec') ?? DEFAULT_TICK_INTERVAL_SEC);
  const sinceMin = Number(url.searchParams.get('sinceMin') ?? DEFAULT_RECENCY_MINUTES);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Initial comment to open the stream in some proxies
      controller.enqueue(encoder.encode(': stream start\n\n'));

      let tick = 0;
      const iv = setInterval(async () => {
        try {
          const payload = await buildTick(matchId, window, tick++, sinceMin);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch (e) {
          const err = { message: 'tick_failed' };
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(err)}\n\n`));
        }
      }, Math.max(1, intervalSec) * 1000);

      // Soft cap the connection to 15 minutes; client can reconnect
      const closer = setTimeout(() => {
        clearInterval(iv);
        controller.close();
      }, 15 * 60 * 1000);

      // Optional: handle client cancellation
      // @ts-ignore - TS lib dom types may not include oncancel for ReadableStreamDefaultController
      controller.signal?.addEventListener?.('abort', () => {
        clearInterval(iv);
        clearTimeout(closer);
        controller.close();
      });
    }
  });

  return new Response(stream);
};
