import type { RequestHandler } from '@sveltejs/kit';
import OpenAI from 'openai';
import { selectEligibleAccounts, fetchRecentPostsForAccounts } from '$lib/services/bskyService';
import {
  getWindowState,
  DEFAULT_LIVE_DURATION_MIN,
  getLiveBin,
  preWindowStartMs,
  postWindowStartMs
} from '$lib/utils/matchWindow';

// Simple in-memory rate limiter for cost protection
let SUMMARY_REQ_TIMESTAMPS: number[] = [];
const RATE_WINDOW_MS = Number(process.env.SUMMARIES_RATE_WINDOW_MS ?? 60_000); // 1 minute
const RATE_MAX = Number(process.env.SUMMARIES_RATE_MAX ?? 4); // max requests per window
const SUMMARY_TIMEOUT_MS_DEFAULT = Number(process.env.SUMMARIES_TIMEOUT_MS ?? 15_000);

// Utility: safely read env
function env(name: string, fallback?: string) {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

// Cap posts and characters to control cost/tokens
const MAX_POSTS = 150;
const MAX_CHARS = 12000;

// Supported platforms for now; "combined" currently aliases to bsky until X/Threads are wired
type Platform = 'bsky' | 'twitter' | 'threads' | 'combined';
type Phase = 'pre' | 'live' | 'post';

function normalizePlatform(p: string | null): Platform {
  const k = (p ?? 'combined').toLowerCase();
  if (k === 'bsky' || k === 'twitter' || k === 'threads' || k === 'combined') return k as Platform;
  return 'combined';
}

function normalizePhase(mode: string | null): Phase | null {
  const k = (mode ?? '').toLowerCase();
  if (k === 'pre' || k === 'live' || k === 'post') return k as Phase;
  return null;
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const matchId = url.searchParams.get('matchId') ?? 'latest-finished-test';
    const platform = normalizePlatform(url.searchParams.get('platform'));
    const kickoffISO = url.searchParams.get('kickoff') ?? '';
    const finalWhistleISO = url.searchParams.get('finalWhistle') ?? '';
    const liveMinParam = Number(url.searchParams.get('liveMin'));
    const liveDurationMin = Number.isFinite(liveMinParam) && liveMinParam > 0 ? liveMinParam : DEFAULT_LIVE_DURATION_MIN;
    const mode = normalizePhase(url.searchParams.get('mode'));

    // Derive phase: explicit mode wins; else infer from window state
    let phase: Phase = 'live';
    if (mode) {
      phase = mode;
    } else if (kickoffISO) {
      const state = getWindowState({ kickoffISO, liveDurationMin });
      phase = state === 'pre' || state === 'post' ? state : 'live';
    }

    const nowMs = Date.now();

    // Compute sinceMin window according to phase
    let sinceMin: number;
    let liveBin:
      | { index: number; startMinute: number; endMinute: number; binStartMs: number }
      | null = null;

    if (phase === 'live' && kickoffISO) {
      // Fixed 15-minute bins; compute current bin and derive sinceMin from bin start
      liveBin = getLiveBin(kickoffISO, nowMs);
      const sinceMs = Math.max(0, nowMs - liveBin.binStartMs);
      // Cap sinceMin to 15; use ceil to ensure we cover the whole elapsed portion in current bin
      sinceMin = Math.max(1, Math.min(15, Math.ceil(sinceMs / 60_000)));
    } else if (phase === 'pre' && kickoffISO) {
      // From 2 hours before kickoff to kickoff
      const preStart = preWindowStartMs(kickoffISO);
      const endMs = Math.min(nowMs, Date.parse(kickoffISO) || nowMs);
      const sinceMs = Math.max(0, endMs - preStart);
      sinceMin = Math.max(1, Math.min(120, Math.ceil(sinceMs / 60_000)));
    } else if (phase === 'post' && kickoffISO) {
      // From end of 90+injury (approx 90') to +2h after final whistle; we use the start part here
      const postStart = postWindowStartMs(kickoffISO, finalWhistleISO || undefined);
      const sinceMs = Math.max(0, nowMs - postStart);
      sinceMin = Math.max(1, Math.min(120, Math.ceil(sinceMs / 60_000)));
    } else {
      // Fallback: default to last 15 minutes
      sinceMin = 15;
    }

    // Prepare posts according to platform. For now:
    // - bsky: gather from Bluesky allowlisted eligible accounts
    // - combined: use bsky until X/Threads are implemented
    // - twitter/threads: TODO (future PRs)
    let texts: string[] = [];
    let accountsUsed: Array<{ did: string; handle: string; displayName?: string }> = [];

    if (platform === 'bsky' || platform === 'combined') {
      const accounts = await selectEligibleAccounts();
      accountsUsed = accounts.map((a) => ({
        did: a.profile.did,
        handle: a.profile.handle,
        displayName: a.profile.displayName
      }));
      const posts = await fetchRecentPostsForAccounts(accounts, sinceMin);
      texts = posts
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, MAX_POSTS)
        .map((p) => `[${new Date(p.createdAt).toISOString()}] @${p.author.handle}: ${p.text}`);
    } else {
      // Placeholder: not yet wired
      texts = ['Platform ingestion not yet implemented for this platform in the summary API.'];
    }

    // Truncate by total chars to keep prompt bounded
    let joined = texts.join('\n');

    // Rate limiting (global, in-memory)
    const now = Date.now();
    SUMMARY_REQ_TIMESTAMPS = SUMMARY_REQ_TIMESTAMPS.filter((ts) => now - ts < RATE_WINDOW_MS);
    if (SUMMARY_REQ_TIMESTAMPS.length >= RATE_MAX) {
      const retryAfterMs = RATE_WINDOW_MS - (now - SUMMARY_REQ_TIMESTAMPS[0]);
      return new Response(JSON.stringify({ error: 'rate_limited', retryAfterMs }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil(retryAfterMs / 1000).toString()
        }
      });
    }
    SUMMARY_REQ_TIMESTAMPS.push(now);
    if (joined.length > MAX_CHARS) {
      joined = joined.slice(0, MAX_CHARS);
    }

    const OPENAI_API_KEY = env('OPENAI_API_KEY');
    const OPENAI_MODEL = env('OPENAI_MODEL', 'gpt-5');

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'missing_api_key',
          message: 'OPENAI_API_KEY is not set on the server.'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = new OpenAI({ apiKey: OPENAI_API_KEY });

    const system = [
      'You are an assistant summarizing Arsenal fan sentiment.',
      `This summary is for the ${phase.toUpperCase()} phase (pre-match/live/post-match).`,
      `Summarize the following social posts from the last ${sinceMin} minutes into no more than 3 concise paragraphs.`,
      'Focus on:',
      '- Overall sentiment (positive/negative/mixed) and intensity',
      '- Key topics (players, manager, refereeing, tactics)',
      '- Notable moments or trends fans are discussing',
      'Avoid quoting individual users; avoid personal data; keep it neutral and aggregate-focused.'
    ].join('\n');

    const userPromptHeader = `Match: ${matchId}\nPlatform: ${platform}\nPhase: ${phase}\nTime window: last ${sinceMin} minutes\nPosts:\n`;
    const prompt = `${userPromptHeader}${joined}`;

    // Use chat completion API
    // Timeout and abort handling for OpenAI call
    const timeoutMs = Number.isFinite(Number(process.env.SUMMARIES_TIMEOUT_MS))
      ? Number(process.env.SUMMARIES_TIMEOUT_MS)
      : SUMMARY_TIMEOUT_MS_DEFAULT;
    const ac = new AbortController();
    const timeoutId = setTimeout(() => {
      try {
        ac.abort(new Error('timeout'));
      } catch {
        // ignore abort errors
      }
    }, timeoutMs);

    let completion: any;
    try {
      completion = await client.chat.completions.create(
        {
          model: OPENAI_MODEL!,
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: 600
        },
        { signal: ac.signal, timeout: timeoutMs }
      );
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message === 'timeout') {
        return new Response(JSON.stringify({ error: 'openai_timeout', timeoutMs }), {
          status: 504,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    const content = completion.choices?.[0]?.message?.content ?? '';
    const usage = (completion as any)?.usage ?? {};

    const response = {
      matchId,
      platform,
      phase,
      windowMinutes: sinceMin,
      accountsUsed,
      liveBin: phase === 'live' && liveBin ? { index: liveBin.index, startMinute: liveBin.startMinute, endMinute: liveBin.endMinute } : null,
      model: OPENAI_MODEL,
      summary: content,
      usage
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'summary_failed', message: e?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
