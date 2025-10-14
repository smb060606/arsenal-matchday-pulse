import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { buildTick } from '$lib/services/bskyService';
import { DEFAULT_RECENCY_MINUTES } from '$lib/config/bsky';
import { selectEligibleAccounts, fetchRecentPostsForAccounts } from '$lib/services/bskyService';

// Utility: safely read env
function env(name: string, fallback?: string) {
  const v = process.env[name];
  return (v && v.length > 0) ? v : fallback;
}

// Cap posts and characters to control cost/tokens
const MAX_POSTS = 150;
const MAX_CHARS = 12000;

// Default window: last 15 minutes
const DEFAULT_WINDOW_MIN = 15;

// Supported platforms for now; "combined" currently aliases to bsky until X/Threads are wired
type Platform = 'bsky' | 'twitter' | 'threads' | 'combined';

function normalizePlatform(p: string | null): Platform {
  const k = (p ?? 'combined').toLowerCase();
  if (k === 'bsky' || k === 'twitter' || k === 'threads' || k === 'combined') return k as Platform;
  return 'combined';
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const matchId = url.searchParams.get('matchId') ?? 'latest-finished-test';
    const platform = normalizePlatform(url.searchParams.get('platform'));
    const sinceMin = Number(url.searchParams.get('sinceMin') ?? DEFAULT_WINDOW_MIN);

    // Prepare posts according to platform. For now:
    // - bsky: gather from Bluesky allowlisted eligible accounts
    // - combined: use bsky until X/Threads are implemented
    // - twitter/threads: TODO (future PRs)
    let texts: string[] = [];

    if (platform === 'bsky' || platform === 'combined') {
      const accounts = await selectEligibleAccounts();
      const posts = await fetchRecentPostsForAccounts(accounts, sinceMin);
      texts = posts
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, MAX_POSTS)
        .map((p) => `[${new Date(p.createdAt).toISOString()}] @${p.author.handle}: ${p.text}`);
    } else {
      // Placeholder: not yet wired
      texts = [
        'Platform ingestion not yet implemented for this platform in the summary API.'
      ];
    }

    // Truncate by total chars to keep prompt bounded
    let joined = texts.join('\n');
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
      'Summarize the following social posts from the last 15 minutes into no more than 3 concise paragraphs.',
      'Focus on:',
      '- Overall sentiment (positive/negative/mixed) and intensity',
      '- Key topics (players, manager, refereeing, tactics)',
      '- Notable moments or trends fans are discussing',
      'Avoid quoting individual users; avoid personal data; keep it neutral and aggregate-focused.'
    ].join('\n');

    const userPromptHeader = `Match: ${matchId}\nPlatform: ${platform}\nTime window: last ${sinceMin} minutes\nPosts:\n`;
    const prompt = `${userPromptHeader}${joined}`;

    // Use chat completion API
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL!,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 600
    });

    const content = completion.choices?.[0]?.message?.content ?? '';
    const usage = (completion as any)?.usage ?? {};

    const response = {
      matchId,
      platform,
      windowMinutes: sinceMin,
      model: OPENAI_MODEL,
      summary: content,
      usage
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: 'summary_failed', message: e?.message ?? 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
