/**
 * Platform budget and cost configuration.
 * Defaults to $50/month per platform, with Bluesky AppView treated as $0.
 * Twitter/X and Threads are marked unconfigured by default to avoid unexpected spend.
 *
 * Configure via env:
 * - BUDGET_PER_PLATFORM_DOLLARS (default: 50)
 * - BSKY_COST_PER_MONTH_DOLLARS (default: 0)
 * - TWITTER_COST_PER_MONTH_DOLLARS (optional; if unset, platform remains unconfigured)
 * - THREADS_COST_PER_MONTH_DOLLARS (optional; if unset, platform remains unconfigured)
 *
 * Cost-to-Cap Estimator (admin-only usage via /api/accounts/plan):
 * - MATCHES_PER_MONTH (default: 8)
 * - PRE_MINUTES (default: 120)
 * - LIVE_MINUTES (default: 105)
 * - POST_MINUTES (default: 60)
 * - BUDGET_SAFETY_BUFFER (default: 1.2)
 * - TWITTER_COST_PER_1K_REQUESTS (optional)
 * - TWITTER_REQUESTS_PER_ACCOUNT_PER_MIN (default: 1)
 * - THREADS_COST_PER_1K_REQUESTS (optional)
 * - THREADS_REQUESTS_PER_ACCOUNT_PER_MIN (default: 1)
 * (Bluesky is treated as $0 and not estimated here; static caps apply.)
 */

export const BUDGET_PER_PLATFORM_DOLLARS =
  Number(process.env.BUDGET_PER_PLATFORM_DOLLARS ?? '50');

export type PlatformKey = 'bsky' | 'twitter' | 'threads';

export type PlatformCostConfig = {
  platform: PlatformKey;
  costPerMonthDollars: number | null; // null means unconfigured/unknown
  status: 'ok' | 'unconfigured';
  notes: string;
};

export function getPlatformCostConfig(platform: PlatformKey): PlatformCostConfig {
  switch (platform) {
    case 'bsky': {
      const cost = Number(process.env.BSKY_COST_PER_MONTH_DOLLARS ?? '0');
      return {
        platform,
        costPerMonthDollars: Number.isFinite(cost) ? cost : 0,
        status: 'ok',
        notes:
          'Bluesky AppView usage for public reads is currently treated as $0. Selection limited by allowlist and max accounts.'
      };
    }
    case 'twitter': {
      const val = process.env.TWITTER_COST_PER_MONTH_DOLLARS;
      const cost = typeof val === 'string' && val.trim().length > 0 ? Number(val) : null;
      return {
        platform,
        costPerMonthDollars: cost,
        status: cost == null ? 'unconfigured' : 'ok',
        notes:
          cost == null
            ? 'Official X/Twitter API requires a paid plan. Set TWITTER_COST_PER_MONTH_DOLLARS to enable planning.'
            : 'Using configured monthly cost.'
      };
    }
    case 'threads': {
      const val = process.env.THREADS_COST_PER_MONTH_DOLLARS;
      const cost = typeof val === 'string' && val.trim().length > 0 ? Number(val) : null;
      return {
        platform,
        costPerMonthDollars: cost,
        status: cost == null ? 'unconfigured' : 'ok',
        notes:
          cost == null
            ? 'Official Threads API access/cost not configured. Set THREADS_COST_PER_MONTH_DOLLARS to enable planning.'
            : 'Using configured monthly cost.'
      };
    }
    default: {
      // Should never hit for typed PlatformKey
      return {
        platform: platform as PlatformKey,
        costPerMonthDollars: null,
        status: 'unconfigured',
        notes: 'Unknown platform'
      };
    }
  }
}

/**
 * Cost-to-Cap Estimator (admin-only consumption in planner API)
 * Converts pricing + request rate assumptions into a safe max accounts cap (X).
 */

function readNumberEnv(name: string, def: number | null): number | null {
  const v = process.env[name];
  if (v == null || v.trim() === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export const MATCHES_PER_MONTH = Number(process.env.MATCHES_PER_MONTH ?? '8');
export const PRE_MINUTES = Number(process.env.PRE_MINUTES ?? '120');
export const LIVE_MINUTES = Number(process.env.LIVE_MINUTES ?? '105');
export const POST_MINUTES = Number(process.env.POST_MINUTES ?? '60');
export const BUDGET_SAFETY_BUFFER = Number(process.env.BUDGET_SAFETY_BUFFER ?? '1.2');

type PricingParams = {
  costPer1k: number | null;
  requestsPerAccountPerMin: number | null;
};

function getPricingParams(platform: PlatformKey): PricingParams {
  switch (platform) {
    case 'twitter':
      return {
        costPer1k: readNumberEnv('TWITTER_COST_PER_1K_REQUESTS', null),
        requestsPerAccountPerMin: readNumberEnv('TWITTER_REQUESTS_PER_ACCOUNT_PER_MIN', 1)
      };
    case 'threads':
      return {
        costPer1k: readNumberEnv('THREADS_COST_PER_1K_REQUESTS', null),
        requestsPerAccountPerMin: readNumberEnv('THREADS_REQUESTS_PER_ACCOUNT_PER_MIN', 1)
      };
    case 'bsky':
      // Treated as $0 reads; estimator not applied
      return { costPer1k: 0, requestsPerAccountPerMin: 0 };
    default:
      return { costPer1k: null, requestsPerAccountPerMin: null };
  }
}

export type CapEstimate = {
  maxAccounts: number;
  rationale: {
    budget: number;
    costPer1k: number;
    requestsPerAccPerMin: number;
    matchesPerMonth: number;
    minutesPerMatch: number;
    monthlyReqsPerAcc: number;
    monthlyCostPerAcc: number;
    buffer: number;
  };
};

export function estimateMaxAccounts(platform: PlatformKey): CapEstimate | null {
  const cfg = getPlatformCostConfig(platform);
  if (cfg.status !== 'ok') return null;

  // We do not compute for Bluesky in this estimator (treated as $0).
  if (platform === 'bsky') return null;

  const { costPer1k, requestsPerAccountPerMin } = getPricingParams(platform);
  if (costPer1k == null || !Number.isFinite(costPer1k)) return null;

  const r = (requestsPerAccountPerMin ?? 1) as number;
  const minutesPerMatch = PRE_MINUTES + LIVE_MINUTES + POST_MINUTES;
  const monthlyReqsPerAcc = r * minutesPerMatch * MATCHES_PER_MONTH;
  const monthlyCostPerAcc = (monthlyReqsPerAcc / 1000) * costPer1k;

  if (!Number.isFinite(monthlyCostPerAcc) || monthlyCostPerAcc <= 0) return null;

  const buffer = BUDGET_SAFETY_BUFFER > 0 ? BUDGET_SAFETY_BUFFER : 1;
  const effectiveBudget = BUDGET_PER_PLATFORM_DOLLARS / buffer;
  const maxAccounts = Math.max(0, Math.floor(effectiveBudget / monthlyCostPerAcc));

  return {
    maxAccounts,
    rationale: {
      budget: BUDGET_PER_PLATFORM_DOLLARS,
      costPer1k: costPer1k,
      requestsPerAccPerMin: r,
      matchesPerMonth: MATCHES_PER_MONTH,
      minutesPerMatch,
      monthlyReqsPerAcc,
      monthlyCostPerAcc: Number(monthlyCostPerAcc.toFixed(4)),
      buffer
    }
  };
}
