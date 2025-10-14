import { BskyAgent } from '@atproto/api';
import { BSKY_APPVIEW_BASE } from '$lib/config/bsky';

type Challenge = {
  code: string;
  handle: string;
  createdAt: number;
  expiresAt: number;
};

const CHALLENGE_TTL_MS = Number(process.env.BSKY_VERIFY_TTL_MS ?? 10 * 60_000); // 10 minutes default
const store = new Map<string, Challenge>(); // key: handle (lowercased)

function getServiceBase(): string {
  // BskyAgent expects service base URL without trailing /xrpc
  return BSKY_APPVIEW_BASE.endsWith('/xrpc')
    ? BSKY_APPVIEW_BASE.slice(0, -('/xrpc'.length))
    : BSKY_APPVIEW_BASE;
}

let agentPromise: Promise<BskyAgent> | null = null;
async function getAgent(): Promise<BskyAgent> {
  if (!agentPromise) {
    agentPromise = (async () => {
      const agent = new BskyAgent({ service: getServiceBase() });
      return agent;
    })();
  }
  return agentPromise;
}

export function createChallenge(handle: string): Challenge {
  const normalized = handle.trim().toLowerCase();
  const code = `AMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const now = Date.now();
  const challenge: Challenge = {
    code,
    handle: normalized,
    createdAt: now,
    expiresAt: now + CHALLENGE_TTL_MS
  };
  store.set(normalized, challenge);
  return challenge;
}

export function getChallenge(handle: string): Challenge | null {
  const normalized = handle.trim().toLowerCase();
  const ch = store.get(normalized);
  if (!ch) return null;
  if (Date.now() > ch.expiresAt) {
    store.delete(normalized);
    return null;
  }
  return ch;
}

export function clearChallenge(handle: string): void {
  const normalized = handle.trim().toLowerCase();
  store.delete(normalized);
}

/**
 * Verifies that the user posted the verification code recently.
 * Strategy: fetch recent author feed entries and inspect post.record.text.
 */
export async function verifyPostContainsCode(handle: string, code: string, windowMinutes = 15): Promise<{ ok: boolean; reason?: string }> {
  try {
    const agent = await getAgent();
    const res: any = await (agent as any).getAuthorFeed?.({
      actor: handle,
      limit: 30,
      filter: 'posts_no_replies'
    });
    const feed: any[] = res?.data?.feed ?? [];
    const since = Date.now() - windowMinutes * 60_000;

    for (const item of feed) {
      const post = item?.post;
      const record = post?.record;
      const createdAt: string | undefined = record?.createdAt || post?.indexedAt;
      if (!createdAt) continue;
      const ts = Date.parse(createdAt);
      if (Number.isFinite(ts) && ts < since) continue;
      const text: string = typeof record?.text === 'string' ? record.text : (record?.text ?? '');
      if (text && text.includes(code)) {
        return { ok: true };
      }
    }
    return { ok: false, reason: 'code_not_found_recent_posts' };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? 'verification_failed' };
  }
}
