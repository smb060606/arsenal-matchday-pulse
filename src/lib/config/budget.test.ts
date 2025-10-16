import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Helper to set and restore env safely between tests
const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
}

describe('budget estimator (admin-only)', () => {
  beforeEach(() => {
    vi.resetModules();
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('returns null for unconfigured platforms (twitter/threads)', async () => {
    // Ensure platform monthly cost is not set => unconfigured
    delete process.env.TWITTER_COST_PER_MONTH_DOLLARS;
    delete process.env.THREADS_COST_PER_MONTH_DOLLARS;

    const budget = await import('$lib/config/budget');
    const { estimateMaxAccounts } = budget;

    expect(estimateMaxAccounts('twitter')).toBeNull();
    expect(estimateMaxAccounts('threads')).toBeNull();
    // Bluesky is treated as $0 and not computed by estimator
    expect(estimateMaxAccounts('bsky')).toBeNull();
  });

  it('computes a sane cap based on pricing and request assumptions (twitter)', async () => {
    // Configure platform as enabled and pricing inputs
    process.env.BUDGET_PER_PLATFORM_DOLLARS = '50';
    process.env.BUDGET_SAFETY_BUFFER = '1'; // make math easier for assertion
    process.env.MATCHES_PER_MONTH = '8';
    process.env.PRE_MINUTES = '120';
    process.env.LIVE_MINUTES = '105';
    process.env.POST_MINUTES = '60';

    // Mark twitter as configured
    process.env.TWITTER_COST_PER_MONTH_DOLLARS = '10'; // any number to set status=ok

    // Pricing assumptions: $1 per 1k requests, 1 request per account per minute
    process.env.TWITTER_COST_PER_1K_REQUESTS = '1';
    process.env.TWITTER_REQUESTS_PER_ACCOUNT_PER_MIN = '1';

    vi.resetModules();
    const budget = await import('$lib/config/budget');
    const { estimateMaxAccounts } = budget;

    const cap = estimateMaxAccounts('twitter');
    expect(cap).not.toBeNull();

    // minutes per match = 120 + 105 + 60 = 285
    // monthlyReqsPerAcc = 285 * 8 = 2280
    // monthlyCostPerAcc = 2280 / 1000 * 1 = 2.28
    // budget 50 / 2.28 = 21.93 => floor = 21
    expect(cap!.maxAccounts).toBe(21);
    expect(cap!.rationale.budget).toBe(50);
    expect(cap!.rationale.costPer1k).toBe(1);
    expect(cap!.rationale.requestsPerAccPerMin).toBe(1);
    expect(cap!.rationale.matchesPerMonth).toBe(8);
    expect(cap!.rationale.minutesPerMatch).toBe(285);
    expect(Math.round(cap!.rationale.monthlyReqsPerAcc)).toBe(2280);
    expect(cap!.rationale.monthlyCostPerAcc).toBeCloseTo(2.28, 4);
    expect(cap!.rationale.buffer).toBe(1);
  });

  it('applies safety buffer to reduce effective cap', async () => {
    process.env.BUDGET_PER_PLATFORM_DOLLARS = '50';
    process.env.BUDGET_SAFETY_BUFFER = '1.25'; // reduce effective budget
    process.env.MATCHES_PER_MONTH = '8';
    process.env.PRE_MINUTES = '120';
    process.env.LIVE_MINUTES = '105';
    process.env.POST_MINUTES = '60';
    process.env.TWITTER_COST_PER_MONTH_DOLLARS = '10';
    process.env.TWITTER_COST_PER_1K_REQUESTS = '1';
    process.env.TWITTER_REQUESTS_PER_ACCOUNT_PER_MIN = '1';

    vi.resetModules();
    const budget = await import('$lib/config/budget');
    const { estimateMaxAccounts } = budget;

    const cap = estimateMaxAccounts('twitter');
    expect(cap).not.toBeNull();

    // Same monthlyCostPerAcc = 2.28
    // effective budget = 50 / 1.25 = 40
    // 40 / 2.28 = 17.54 => floor = 17
    expect(cap!.maxAccounts).toBe(17);
    expect(cap!.rationale.buffer).toBe(1.25);
  });
});
