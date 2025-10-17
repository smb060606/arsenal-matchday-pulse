// Twitter (X) platform configuration
// Default thresholds align with requirement: accounts ≥ 3 years and ≥ 500 followers.
// Admin includes can bypass these thresholds via override.

export const TWITTER_MIN_FOLLOWERS = 500;
export const TWITTER_MIN_ACCOUNT_MONTHS = 36;

// Maximum accounts to consider per tick (budget/cost dependent in future)
export const TWITTER_MAX_ACCOUNTS = 40;

// Initial allowlist (handles or user IDs). These will be resolved at runtime.
// For now, populate with known Arsenal-related handles where appropriate.
export const TWITTER_ALLOWLIST: string[] = [
  'arseblog',
  'gunnerblog',
  'LTArsenal',
  'afcstuff',
  'GoonerTalk'
];

// Time window defaults for fetching posts (placeholder for parity with Bluesky)
export const TWITTER_DEFAULT_RECENCY_MINUTES = 10;
