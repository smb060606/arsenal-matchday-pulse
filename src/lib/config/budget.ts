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
