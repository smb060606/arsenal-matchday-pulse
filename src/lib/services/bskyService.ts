import { BskyAgent } from '@atproto/api';
import {
  BSKY_APPVIEW_BASE,
  BSKY_ALLOWLIST,
  BSKY_MIN_FOLLOWERS,
  BSKY_MIN_ACCOUNT_MONTHS,
  BSKY_MAX_ACCOUNTS,
  BSKY_KEYWORDS,
  DEFAULT_RECENCY_MINUTES
} from '../config/bsky';
import winkSentiment from 'wink-sentiment';

export type BskyProfileBasic = {
  did: string;
  handle: string;
  displayName?: string;
  followersCount?: number;
  postsCount?: number;
  createdAt?: string | null;
};

export type Eligibility = {
  eligible: boolean;
  reasons: string[]; // descriptive reasons for eligibility/ineligibility
};

export type SelectedAccount = {
  profile: BskyProfileBasic;
  eligibility: Eligibility;
};

export type SimplePost = {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
  };
  text: string;
  createdAt: string;
};

export type TickSummary = {
  matchId: string;
  platform: 'bsky';
  window: 'pre' | 'live' | 'post';
  generatedAt: string;
  tick: number;
  sentiment: {
    pos: number; // ratio 0..1
    neu: number; // ratio 0..1
    neg: number; // ratio 0..1
    counts: {
      total: number;
      pos: number;
      neu: number;
      neg: number;
    };
  };
  volume: number; // total posts in this window
  accountsUsed: Array<{ did: string; handle: string; displayName?: string }>;
  topics: Array<{ keyword: string; count: number }>;
  samples: Array<{ authorHandle: string; text: string; createdAt: string }>;
};

let agentPromise: Promise<BskyAgent> | null = null;

function getServiceBase(): string {
  // BskyAgent expects the service base URL without trailing /xrpc.
  const base = BSKY_APPVIEW_BASE.endsWith('/xrpc')
    ? BSKY_APPVIEW_BASE.slice(0, -('/xrpc'.length))
    : BSKY_APPVIEW_BASE;
  return base;
}

async function getAgent(): Promise<BskyAgent> {
  if (!agentPromise) {
    agentPromise = (async () => {
      const agent = new BskyAgent({ service: getServiceBase() });
      return agent;
    })();
  }
  return agentPromise;
}

function monthsBetween(a: Date, b: Date): number {
  const diffMs = Math.abs(a.getTime() - b.getTime());
  // Approximate: 30 days/month
  return diffMs / (1000 * 60 * 60 * 24 * 30);
}

function isTextPost(record: any): record is { text: string; createdAt?: string } {
  return record && typeof record.text === 'string';
}

function toProfileBasic(p: any): BskyProfileBasic {
  return {
    did: p?.did,
    handle: p?.handle,
    displayName: p?.displayName,
    followersCount: typeof p?.followersCount === 'number' ? p.followersCount : undefined,
    postsCount: typeof p?.postsCount === 'number' ? p.postsCount : undefined,
    // Some Bluesky profiles may expose createdAt; if not present, leave null and handle in eligibility
    createdAt: p?.createdAt ?? null
  };
}

export async function resolveAllowlistProfiles(handles: string[] = BSKY_ALLOWLIST): Promise<BskyProfileBasic[]> {
  if (!handles.length) return [];
  const agent = await getAgent();
  try {
    // Prefer batch lookup when available
    if (typeof agent.getProfiles === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const res = await (agent as any).getProfiles({ actors: handles });
      const profiles = (res?.data?.profiles ?? []).map(toProfileBasic);
      return profiles;
    }
  } catch (e) {
    // fall through to per-handle lookup
    // console.error('Batch getProfiles failed, falling back to per-handle', e);
  }

  const profiles: BskyProfileBasic[] = [];
  for (const handle of handles) {
    try {
      const res = await (agent as any).getProfile?.({ actor: handle });
      if (res?.data) profiles.push(toProfileBasic(res.data));
    } catch {
      // ignore failed resolution for this handle
    }
  }
  return profiles;
}

export function computeEligibility(profile: BskyProfileBasic): Eligibility {
  const reasons: string[] = [];
  let ok = true;

  const followers = profile.followersCount ?? 0;
  if (followers < BSKY_MIN_FOLLOWERS) {
    ok = false;
    reasons.push(`followers=${followers} < min=${BSKY_MIN_FOLLOWERS}`);
  } else {
    reasons.push(`followers=${followers} ≥ min=${BSKY_MIN_FOLLOWERS}`);
  }

  if (profile.createdAt) {
    const months = monthsBetween(new Date(profile.createdAt), new Date());
    if (months < BSKY_MIN_ACCOUNT_MONTHS) {
      ok = false;
      reasons.push(`age=${months.toFixed(1)}mo < min=${BSKY_MIN_ACCOUNT_MONTHS}mo`);
    } else {
      reasons.push(`age=${months.toFixed(1)}mo ≥ min=${BSKY_MIN_ACCOUNT_MONTHS}mo`);
    }
  } else {
    // Public AppView may not expose createdAt; disclose and allow based on followers+activity
    reasons.push('age=unknown (AppView); allowed based on followers/activity');
  }

  return { eligible: ok, reasons };
}

export async function selectEligibleAccounts(): Promise<SelectedAccount[]> {
  const profiles = await resolveAllowlistProfiles();
  // Rank by followersCount desc as proxy for influence/activity
  const ranked = profiles
    .map((p) => ({ profile: p, eligibility: computeEligibility(p) }))
    .sort((a, b) => (b.profile.followersCount ?? 0) - (a.profile.followersCount ?? 0));

  // Keep only eligible and cap to max accounts
  const selected = ranked.filter((r) => r.eligibility.eligible).slice(0, BSKY_MAX_ACCOUNTS);

  // If not enough eligible, consider adding top non-eligible with disclaimer to at least have some data
  if (selected.length === 0 && ranked.length > 0) {
    return ranked.slice(0, Math.min(ranked.length, Math.max(5, Math.min(10, BSKY_MAX_ACCOUNTS))));
  }

  return selected;
}

export async function fetchRecentPostsForAccounts(
  accounts: SelectedAccount[],
  sinceMinutes: number = DEFAULT_RECENCY_MINUTES
): Promise<SimplePost[]> {
  const agent = await getAgent();
  const minutes = Number(sinceMinutes);
  const validatedMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_RECENCY_MINUTES;
  const since = Date.now() - validatedMinutes * 60_000;

  const out: SimplePost[] = [];

  // Keep per-author fetch small to respect rate limits
  const perAuthorLimit = 25;

  for (const acct of accounts) {
    try {
      // Using getAuthorFeed to fetch posts for a specific actor (did or handle)
      const actor = acct.profile.did || acct.profile.handle;
      if (!actor) continue;

      const res = await (agent as any).getAuthorFeed?.({
        actor,
        limit: perAuthorLimit,
        filter: 'posts_no_replies'
      });

      const feed: any[] = res?.data?.feed ?? [];
      for (const item of feed) {
        const post = item?.post;
        const record = post?.record;
        const createdAt: string | undefined = record?.createdAt || post?.indexedAt;
        if (!createdAt) continue;
        const ts = Date.parse(createdAt);
        if (Number.isFinite(ts) && ts < since) continue;

        const text = isTextPost(record) ? record.text : (record?.text ?? '');
        if (!text) continue;

        out.push({
          uri: post?.uri,
          cid: post?.cid,
          author: {
            did: post?.author?.did ?? acct.profile.did,
            handle: post?.author?.handle ?? acct.profile.handle,
            displayName: post?.author?.displayName ?? acct.profile.displayName
          },
          text,
          createdAt
        });
      }
    } catch {
      // Ignore errors for this account; continue others
    }
  }

  return out;
}

export function summarizeSentiment(posts: SimplePost[]) {
  let posCount = 0;
  let negCount = 0;
  let neuCount = 0;

  for (const p of posts) {
    const res = winkSentiment(p.text) as any;
    const score = typeof res?.score === 'number' ? res.score : 0;
    if (score > 0) posCount++;
    else if (score < 0) negCount++;
    else neuCount++;
  }

  const total = posts.length || 1;
  const pos = posCount / total;
  const neg = negCount / total;
  const neu = neuCount / total;

  return {
    ratios: { pos, neg, neu },
    counts: { total: posts.length, pos: posCount, neg: negCount, neu: neuCount }
  };
}

export function extractTopics(posts: SimplePost[], keywords: string[] = BSKY_KEYWORDS) {
  const counts = new Map<string, number>();
  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  for (const p of posts) {
    const lower = p.text.toLowerCase();
    for (const kw of lowerKeywords) {
      if (lower.includes(kw)) {
        counts.set(kw, (counts.get(kw) ?? 0) + 1);
      }
    }
  }
  const arr = Array.from(counts.entries()).map(([keyword, count]) => ({ keyword, count }));
  arr.sort((a, b) => b.count - a.count);
  return arr.slice(0, 10);
}

export function sampleQuotes(posts: SimplePost[], n = 5) {
  const sorted = [...posts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return sorted.slice(0, n).map((p) => ({
    authorHandle: p.author.handle,
    text: p.text,
    createdAt: p.createdAt
  }));
}

export async function buildTick(
  matchId: string,
  window: 'pre' | 'live' | 'post',
  tick: number,
  sinceMinutes: number = DEFAULT_RECENCY_MINUTES
): Promise<TickSummary> {
  const accounts = await selectEligibleAccounts();
  const posts = await fetchRecentPostsForAccounts(accounts, sinceMinutes);
  const sentiment = summarizeSentiment(posts);
  const topics = extractTopics(posts);
  const samples = sampleQuotes(posts, 5);

  return {
    matchId,
    platform: 'bsky',
    window,
    generatedAt: new Date().toISOString(),
    tick,
    sentiment: {
      pos: sentiment.ratios.pos,
      neu: sentiment.ratios.neu,
      neg: sentiment.ratios.neg,
      counts: sentiment.counts
    },
    volume: posts.length,
    accountsUsed: accounts.map((a) => ({
      did: a.profile.did,
      handle: a.profile.handle,
      displayName: a.profile.displayName
    })),
    topics,
    samples
  };
}

export async function getAccountsSnapshot(): Promise<
  Array<{
    did: string;
    handle: string;
    displayName?: string;
    followersCount?: number;
    postsCount?: number;
    createdAt?: string | null;
    eligibility: Eligibility;
  }>
> {
  const accounts = await selectEligibleAccounts();
  return accounts.map((a) => ({
    did: a.profile.did,
    handle: a.profile.handle,
    displayName: a.profile.displayName,
    followersCount: a.profile.followersCount,
    postsCount: a.profile.postsCount,
    createdAt: a.profile.createdAt ?? null,
    eligibility: a.eligibility
  }));
}
