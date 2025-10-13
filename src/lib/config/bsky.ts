export const BSKY_APPVIEW_BASE = "https://public.api.bsky.app/xrpc";

// Eligibility/config (initial defaults)
export const BSKY_MIN_FOLLOWERS = 500;

// Bluesky is too new for 3-year requirement; use 6 months default and disclose in UI
export const BSKY_MIN_ACCOUNT_MONTHS = 6;

// Maximum accounts to consider per tick (keep it small to respect rate limits)
export const BSKY_MAX_ACCOUNTS = 40;

// Keywords to bias topic extraction/search (can be tuned per match)
export const BSKY_KEYWORDS = ["Arsenal", "AFC", "COYG", "Arteta", "Saka", "Odegaard"];

// Initial allowlist seeds (handles). These will be validated at runtime for eligibility.
export const BSKY_ALLOWLIST: string[] = [
  // Add real Bluesky handles as they are known; placeholders shown here:
  "arseblog.com", // Example: if the handle on Bluesky is a domain
  "gunnerblog.bsky.social",
  "ltarsenal.bsky.social",
  "afcstuff.bsky.social",
  "goonertalk.bsky.social"
];

// Time window defaults (minutes) for fetch/aggregation when no explicit match window provided
export const DEFAULT_RECENCY_MINUTES = 10;

// Tick interval seconds (the SSE endpoint will emit every N seconds, up to a soft cap)
export const DEFAULT_TICK_INTERVAL_SEC = 10;
