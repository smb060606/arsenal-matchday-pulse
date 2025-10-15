import type { RequestHandler } from '@sveltejs/kit';
import { BUDGET_PER_PLATFORM_DOLLARS, getPlatformCostConfig } from '$lib/config/budget';
import { getAccountsSnapshot } from '$lib/services/bskyService';
import { BSKY_MAX_ACCOUNTS } from '$lib/config/bsky';

type PlatformPlan = {
  platform: 'bsky' | 'twitter' | 'threads';
  status: 'ok' | 'unconfigured';
  budgetPerMonthDollars: number;
  costPerMonthDollars: number | null; // null => unconfigured/unknown
  notes?: string;
  maxAccountsAllowed?: number;
  selected?: Array<{
    did: string;
    handle: string;
    displayName?: string;
    followersCount?: number;
    postsCount?: number;
    createdAt?: string | null;
    eligibility: {
      eligible: boolean;
      reasons: string[];
    };
  }>;
};

export const GET: RequestHandler = async ({ request }) => {
  try {
    // Admin-only guard: require ADMIN_SECRET via header
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      return new Response(JSON.stringify({ error: 'admin_not_configured' }), {
        status: 501,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const token = request.headers.get('x-admin-token') ?? '';
    if (token !== adminSecret) {
      // Hide existence from public
      return new Response('Not found', { status: 404 });
    }

    const generatedAt = new Date().toISOString();
    const budget = BUDGET_PER_PLATFORM_DOLLARS;

    // Bluesky
    const bskyCfg = getPlatformCostConfig('bsky');
    const bskyPlan: PlatformPlan = {
      platform: 'bsky',
      status: bskyCfg.status,
      budgetPerMonthDollars: budget,
      costPerMonthDollars: bskyCfg.costPerMonthDollars,
      notes: bskyCfg.notes
    };

    if (bskyCfg.status === 'ok') {
      // AppView reads treated as $0 – safe to select up to existing max
      const accounts = await getAccountsSnapshot().catch(() => [] as PlatformPlan['selected']);
      const maxAllowed = Math.max(0, BSKY_MAX_ACCOUNTS);
      bskyPlan.maxAccountsAllowed = maxAllowed;
      bskyPlan.selected = (accounts ?? []).slice(0, maxAllowed);
    }

    // Twitter/X
    const twitterCfg = getPlatformCostConfig('twitter');
    const twitterPlan: PlatformPlan = {
      platform: 'twitter',
      status: twitterCfg.status,
      budgetPerMonthDollars: budget,
      costPerMonthDollars: twitterCfg.costPerMonthDollars,
      notes: twitterCfg.notes
    };

    // Threads
    const threadsCfg = getPlatformCostConfig('threads');
    const threadsPlan: PlatformPlan = {
      platform: 'threads',
      status: threadsCfg.status,
      budgetPerMonthDollars: budget,
      costPerMonthDollars: threadsCfg.costPerMonthDollars,
      notes: threadsCfg.notes
    };

    const payload = {
      generatedAt,
      budgetPerPlatformDollars: budget,
      platforms: {
        bsky: bskyPlan,
        twitter: twitterPlan,
        threads: threadsPlan
      }
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: 'plan_generation_failed',
        message: e?.message ?? 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
