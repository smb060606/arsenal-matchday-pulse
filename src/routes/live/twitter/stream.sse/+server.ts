import type { RequestHandler } from "./$types";

// Parity with Bluesky SSE endpoint: retry hint, heartbeats, Last-Event-ID resume, id per message, and proper cleanup.
export const GET: RequestHandler = async ({ setHeaders, url, request }) => {
  const sseHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  } as const;

  if (typeof setHeaders === "function") {
    setHeaders(sseHeaders as any);
  }

  const matchId = url.searchParams.get("matchId") ?? "demo";

  // Interval between data ticks (seconds)
  const nInterval = Number(url.searchParams.get("intervalSec"));
  const intervalSec = Math.max(1, Number.isFinite(nInterval) && nInterval > 0 ? nInterval : 3.5);

  // Heartbeat keep-alive interval (seconds)
  const nHeartbeat = Number(url.searchParams.get("heartbeatSec"));
  const heartbeatSec = Number.isFinite(nHeartbeat) && nHeartbeat > 0 ? nHeartbeat : 15;

  // Support resuming from Last-Event-ID (header or query param ?lastEventId=)
  const lastEventIdHeader = request?.headers?.get("last-event-id") || null;
  const lastEventIdParam = url.searchParams.get("lastEventId");
  const parsedLast = Number(lastEventIdParam ?? lastEventIdHeader);
  const startTick = Number.isFinite(parsedLast) && parsedLast >= 0 ? parsedLast + 1 : 0;

  const encoder = new TextEncoder();
  let stopped = false;
  let closer: ReturnType<typeof setTimeout> | null = null;
  let pinger: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Intro frames
      const intro = {
        matchId,
        intervalSec,
        mode: "live"
      };
      // initial comment and retry hint
      controller.enqueue(encoder.encode(`: stream start\n`));
      controller.enqueue(encoder.encode(`retry: ${Math.max(1000, intervalSec * 1000)}\n`));
      controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify(intro)}\n\n`));

      // Heartbeat comments to keep proxies/connections alive
      pinger = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive ${Date.now()}\n\n`));
        } catch {
          // ignore
        }
      }, heartbeatSec * 1000);

      let tick = startTick;

      const loop = async () => {
        while (!stopped) {
          try {
            // Simulated payload for Twitter (placeholder until full integration)
            const payload = {
              matchId,
              platform: "twitter",
              window: "live",
              generatedAt: new Date().toISOString(),
              tick: tick,
              sentiment: {
                pos: Math.random(),
                neu: Math.random(),
                neg: Math.random()
              }
            };

            // include id for resume
            controller.enqueue(encoder.encode(`id: ${tick}\ndata: ${JSON.stringify(payload)}\n\n`));
            tick++;
          } catch {
            const err = { message: "tick_failed" };
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(err)}\n\n`));
          }

          await new Promise((r) => setTimeout(r, intervalSec * 1000));
        }

        if (pinger) {
          clearInterval(pinger);
          pinger = null;
        }
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

      // Soft cap connection to 15 minutes; client can reconnect
      closer = setTimeout(() => {
        stopped = true;
        if (pinger) {
          clearInterval(pinger);
          pinger = null;
        }
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
      if (pinger) {
        clearInterval(pinger);
        pinger = null;
      }
    }
  });

  return new Response(stream, { headers: new Headers(sseHeaders) });
};
