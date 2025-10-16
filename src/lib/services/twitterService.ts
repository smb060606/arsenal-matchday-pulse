import { getOverrides } from '$lib/services/accountOverrides';
import {
  TWITTER_ALLOWLIST,
  TWITTER_MAX_ACCOUNTS,
  TWITTER_MIN_ACCOUNT_MONTHS,
  TWITTER_MIN_FOLLOWERS,
  TWITTER_DEFAULT_RECENCY_MINUTES
} from '$lib/config/twitter';

// Types mirrored after Bluesky service for parity
export type TwitterProfileBasic = {
  user_id?: string; // canonical if available
  handle: string;
  displayName?: string;
  followersCount?: number;
  postsCount?: number;
  createdAt?: string | null;
};

export type Eligibility = {
  eligible: boolean;
  reasons: string[];
};

export type SelectedAccount = {
  profile: TwitterProfileBasic;
  eligibility: Eligibility;
};

export type SimpleTweet = {
  id: string;
  author: {
    user_id?: string;
    handle: string;
    displayName?: string;
  };
  text: string;
  createdAt: string;
};

// Placeholder for future cost-aware rate planning
export const DEFAULT_RECENCY_MINUTES = TWITTER_DEFAULT_RECENCY_MINUTES;

// Placeholder resolver: convert allowlist handles to minimal profiles.
// In a future iteration, this should call Twitter API to resolve user_id,
// followers, posts, createdAt, etc, and feed into accounts_registry.
export async function resolveAllowlistProfiles(handles: string[] = TWITTER_ALLOWLIST): Promise<TwitterProfileBasic[]> {
  return handles.map((h) => ({
    handle: h,
    displayName: h,
    followersCount: undefined,
    postsCount: undefined,
    createdAt: null
  }));
}

function monthsBetween(a: Date, b: Date): number {
  const diffMs = Math.abs(a.getTime() - b.getTime());
  return diffMs / (1000 * 60 * 60 * 24 * 30);
}

export function computeEligibility(profile: TwitterProfileBasic): Eligibility {
  const reasons: string[] = [];
  let ok = true;

  const followers = profile.followersCount ?? 0;
  if (followers < TWITTER_MIN_FOLLOWERS) {
    ok = false;
    reasons.push(`followers=${followers} < min=${TWITTER_MIN_FOLLOWERS}`);
  } else {
    reasons.push(`followers=${followers} ≥ min=${TWITTER_MIN_FOLLOWERS}`);
  }

  if (profile.createdAt) {
    const months = monthsBetween(new Date(profile.createdAt), new Date());
    if (months < TWITTER_MIN_ACCOUNT_MONTHS) {
      ok = false;
      reasons.push(`age=${months.toFixed(1)}mo < min=${TWITTER_MIN_ACCOUNT_MONTHS}mo`);
    } else {
      reasons.push(`age=${months.toFixed(1)}mo ≥ min=${TWITTER_MIN_ACCOUNT_MONTHS}mo`);
    }
  } else {
    // If we cannot determine age, disclose uncertainty; allow by followers/activity
    reasons.push('age=unknown; allowed based on followers/activity');
  }

  return { eligible: ok, reasons };
}

function keyOf(p: TwitterProfileBasic): string {
  return p.user_id ? `id:${p.user_id}` : `handle:${p.handle}`;
}

/**
 * Select eligible Twitter accounts applying admin overrides.
 * Precedence (high → low):
 *  - match EXCLUDE
 *  - match INCLUDE
 *  - global EXCLUDE
 *  - global INCLUDE
 */
export async function selectEligibleAccounts(params?: { matchId?: string | null }): Promise<SelectedAccount[]> {
  const matchId = params?.matchId ?? null;

  // 1) Start from allowlist-based resolution
  const baseProfiles = await resolveAllowlistProfiles();

  // 2) Load overrides (per-match takes precedence over global)
  const { include: inc, exclude: exc } = await getOverrides({ platform: 'twitter', matchId });

  // Build exclude set
  const excludeKeys = new Set<string>();
  for (const o of exc) {
    const key = o.identifier_type === 'user_id' ? `id:${o.identifier}` : `handle:${o.identifier}`;
    excludeKeys.add(key);
  }

  const isExcluded = (p: TwitterProfileBasic) => {
    const idKey = p.user_id ? `id:${p.user_id}` : null;
    const hKey = p.handle ? `handle:${p.handle}` : null;
    return (idKey && excludeKeys.has(idKey)) || (hKey && excludeKeys.has(hKey));
  };

  // For includes, resolve to minimal profiles by identifier
  const includeByKey = new Map<string, TwitterProfileBasic>();
  for (const o of inc) {
    const key = o.identifier_type === 'user_id' ? `id:${o.identifier}` : `handle:${o.identifier}`;
    includeByKey.set(
      key,
      o.identifier_type === 'user_id'
        ? { user_id: o.identifier, handle: o.handle || o.identifier, displayName: o.handle || o.identifier, createdAt: null }
        : { handle: o.identifier, displayName: o.identifier, createdAt: null }
    );
  }

  // 3) Build include list honoring bypass eligibility and excludes
  const selectedInclude: SelectedAccount[] = [];
  for (const o of inc) {
    const key = o.identifier_type === 'user_id' ? `id:${o.identifier}` : `handle:${o.identifier}`;
    const p = includeByKey.get(key);
    if (!p) continue;
    if (isExcluded(p)) continue;

    const elig = o.bypass_eligibility ? { eligible: true, reasons: ['admin:include override (bypass=true)'] } : computeEligibility(p);
    if (!o.bypass_eligibility && !elig.eligible) continue;

    selectedInclude.push({ profile: p, eligibility: elig });
  }

  // 4) Build eligible base list (exclude excluded and already included)
  const selectedBase: SelectedAccount[] = [];
  for (const p of baseProfiles) {
    if (isExcluded(p)) continue;
    const alreadyIncluded = selectedInclude.find((si) => keyOf(si.profile) === keyOf(p));
    if (alreadyIncluded) continue;
    const elig = computeEligibility(p);
    if (!elig.eligible) continue;
    selectedBase.push({ profile: p, eligibility: elig });
  }

  // 5) Merge with includes prioritized, sort by followers desc, and cap to max accounts
  const merged = [...selectedInclude, ...selectedBase];
  merged.sort((a, b) => (b.profile.followersCount ?? 0) - (a.profile.followersCount ?? 0));

  if (merged.length > TWITTER_MAX_ACCOUNTS) {
    const includesCount = selectedInclude.length;
    const remaining = Math.max(TWITTER_MAX_ACCOUNTS - includesCount, 0);
    return [...selectedInclude, ...selectedBase.slice(0, remaining)];
  }

  return merged;
}

// Placeholder: in the future, this will fetch tweets for the selected accounts.
export async function fetchRecentTweetsForAccounts(
  _accounts: SelectedAccount[],
  _sinceMinutes: number = DEFAULT_RECENCY_MINUTES
): Promise<SimpleTweet[]> {
  return [];
}

// Convenience for planner-style snapshot (parity with Bluesky)
export async function getAccountsSnapshot(): Promise<
  Array<{
    user_id?: string;
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
    user_id: a.profile.user_id,
    handle: a.profile.handle,
    displayName: a.profile.displayName,
    followersCount: a.profile.followersCount,
    postsCount: a.profile.postsCount,
    createdAt: a.profile.createdAt ?? null,
    eligibility: a.eligibility
  }));
}
