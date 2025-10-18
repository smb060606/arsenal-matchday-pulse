/**
 * Simple SSE client with auto-reconnect, exponential backoff, and resume support.
 * Intended for browser usage (relies on EventSource).
 *
 * Server expectations:
 * - Emits "id: <number>" before each data frame (for resume)
 * - May emit "retry: <ms>" hint; we still enforce a bounded backoff
 * - Optional heartbeats via comment frames (": keep-alive ...")
 *
 * Client behavior:
 * - Uses EventSource to connect to the provided URL
 * - Tracks lastEventId from message events and appends it as a `lastEventId` query param on reconnect
 * - Exponential backoff between reconnect attempts (bounded)
 *
 * Example:
 *   const client = createSSEClient('/live/bsky/stream.sse?matchId=123', {
 *     onMessage: (data, raw) => console.log('tick', data),
 *     onOpen: () => console.log('open'),
 *     onError: (err) => console.warn('sse error', err),
 *   });
 *   client.start();
 *   // later...
 *   client.stop();
 */

export interface SSEClientOptions<T = unknown> {
  onMessage: (data: T, evt: MessageEvent) => void;
  onOpen?: (evt: Event) => void;
  onError?: (evt: Event) => void;
  // Named SSE event listeners (e.g., meta, ended). Handlers receive the raw MessageEvent.
  namedListeners?: Record<string, (evt: MessageEvent) => void>;
  // Backoff configuration
  backoffBaseMs?: number; // initial backoff
  backoffMaxMs?: number;  // cap
  // Extra query params to always include
  params?: Record<string, string | number | boolean | null | undefined>;
}

export interface SSEClientController {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

function appendParams(url: string, params: Record<string, string>): string {
  const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  return u.toString();
}

export function createSSEClient<T = unknown>(baseUrl: string, opts: SSEClientOptions<T>): SSEClientController {
  if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
    // Not in a browser environment
    // You can add a fetch-based polyfill here if desired.
    console.warn('SSEClient: EventSource not available (non-browser environment).');
  }

  let es: EventSource | null = null;
  let running = false;
  let lastId: string | null = null;
  let backoff = Math.max(0, opts.backoffBaseMs ?? 1000);
  const backoffMax = Math.max(backoff, opts.backoffMaxMs ?? 30000);

  const buildUrl = () => {
    const extra: Record<string, string> = {};
    if (lastId) {
      // While EventSource should include Last-Event-ID header on reconnect,
      // also include for redundancy via query param if the server supports it.
      extra['lastEventId'] = lastId;
    }
    if (opts.params) {
      for (const [k, v] of Object.entries(opts.params)) {
        if (v === null || v === undefined) continue;
        extra[k] = String(v);
      }
    }
    return appendParams(baseUrl, extra);
  };

  const connect = () => {
    if (!running) return;
    const url = buildUrl();
    try {
      es = new EventSource(url);
    } catch (e) {
      // Immediate failure; schedule reconnect
      scheduleReconnect();
      return;
    }

    es.onopen = (evt) => {
      // Reset backoff on successful connection
      backoff = Math.max(0, opts.backoffBaseMs ?? 1000);
      opts.onOpen?.(evt);
    };

    es.onmessage = (evt) => {
      // Track lastEventId for resume
      if (evt.lastEventId) {
        lastId = evt.lastEventId;
      }
      try {
        const parsed = JSON.parse(evt.data) as T;
        opts.onMessage(parsed, evt);
      } catch {
        // Non-JSON payloads are ignored but still advance lastEventId
        // Consumers can handle raw evt if needed
      }
    };

    es.onerror = (evt) => {
      opts.onError?.(evt);
      // Close current instance and schedule reconnect
      try {
        es?.close();
      } catch {}
      es = null;
      scheduleReconnect();
    };

    // Attach named event listeners (e.g., meta, ended)
    if (opts.namedListeners) {
      for (const [name, handler] of Object.entries(opts.namedListeners)) {
        try {
          es.addEventListener(name, (evt: MessageEvent) => {
            // Track lastEventId if provided by server on named events
            if ((evt as any).lastEventId) {
              lastId = (evt as any).lastEventId as string;
            }
            try {
              handler(evt);
            } catch {
              // swallow handler errors
            }
          });
        } catch {
          // ignore addEventListener errors
        }
      }
    }
  };

  const scheduleReconnect = () => {
    if (!running) return;
    const delay = Math.min(backoff, backoffMax);
    backoff = Math.min(backoff * 2, backoffMax); // exponential growth
    setTimeout(() => {
      if (running) connect();
    }, delay);
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      connect();
    },
    stop: () => {
      running = false;
      try {
        es?.close();
      } catch {}
      es = null;
    },
    isRunning: () => running,
  };
}
