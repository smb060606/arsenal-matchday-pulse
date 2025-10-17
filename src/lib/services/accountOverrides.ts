import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '$lib/supabaseAdmin';

export type Platform = 'bsky' | 'twitter' | 'threads';
export type OverrideAction = 'include' | 'exclude';
export type OverrideScope = 'global' | 'match';

export type AccountOverride = {
  id: string;
  platform: Platform;
  identifier_type: 'did' | 'handle' | 'user_id';
  identifier: string;
  handle: string | null;
  action: OverrideAction;
  scope: OverrideScope;
  match_id: string | null;
  bypass_eligibility: boolean;
  notes: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EffectiveOverrides = {
  include: AccountOverride[];
  exclude: AccountOverride[];
};

/**
 * Resolve a server-side Supabase admin client for administrative operations.
 *
 * @returns A Supabase admin client if available; otherwise `null`.
 */
function getAdminClient() {
  // Prefer centralized server-side admin client if available
  const admin = getSupabaseAdmin();
  if (admin) return admin as any;

  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // In tests or local environments without admin envs, return null so callers can gracefully fallback.
  if (!url || !serviceKey) {
    return null as any;
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false }
  });
}

/**
 * Check whether an override row is currently active based on its `expires_at` timestamp.
 *
 * @param row - The AccountOverride row to evaluate
 * @param nowMs - Reference time in milliseconds used to determine expiration
 * @returns `true` if the row has no valid `expires_at` or its `expires_at` is greater than `nowMs`, `false` otherwise
 */
function notExpired(row: AccountOverride, nowMs: number) {
  if (!row.expires_at) return true;
  const exp = Date.parse(row.expires_at);
  if (!Number.isFinite(exp)) return true;
  return exp > nowMs;
}

/**
 * Return effective account overrides for a platform, optionally limited to a specific match.
 *
 * Precedence (high → low): match EXCLUDE, match INCLUDE, global EXCLUDE, global INCLUDE. Expired overrides are excluded. When multiple overrides target the same account (keyed by `identifier_type|identifier`), the highest-precedence override is kept.
 *
 * @param matchId - If provided, include overrides scoped to this match in precedence evaluation; pass `null` to match explicit null `match_id` rows.
 * @param nowMs - Optional epoch milliseconds to use when evaluating expiration; defaults to current time.
 * @returns An object with `include` and `exclude` arrays of `AccountOverride` representing the final, deduplicated overrides according to the precedence rules.
 */
export async function getOverrides(params: {
  platform: Platform;
  matchId?: string | null;
  nowMs?: number;
}): Promise<EffectiveOverrides> {
  const { platform, matchId } = params;
  const nowMs = typeof params.nowMs === 'number' ? params.nowMs : Date.now();
  const sb = getAdminClient();

  // If admin client isn't configured (e.g., tests), return empty overrides gracefully
  if (!sb) {
    return { include: [], exclude: [] };
  }

  // Fetch global + match overrides in one query
  const { data, error } = await (sb as any)
    .from('account_overrides')
    .select(
      'id, platform, identifier_type, identifier, handle, action, scope, match_id, bypass_eligibility, notes, expires_at, created_by, created_at, updated_at'
    )
    .eq('platform', platform);

  if (error) {
    // On error, return empty overrides rather than throwing to keep selection resilient
    return { include: [], exclude: [] };
  }

  const rows = (data || []).filter((r) => notExpired(r as AccountOverride, nowMs)) as AccountOverride[];

  const matchRows = rows.filter((r) => r.scope === 'match' && r.match_id === (matchId ?? null));
  const globalRows = rows.filter((r) => r.scope === 'global');

  // Precedence: match overrides first, then global
  const prioritized = [...matchRows, ...globalRows];

  // Collapse into include/exclude keeping first occurrence for a given identifier (match beats global)
  const seen = new Set<string>(); // key by identifier_type|identifier
  const include: AccountOverride[] = [];
  const exclude: AccountOverride[] = [];

  for (const r of prioritized) {
    const key = `${r.identifier_type}|${r.identifier}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (r.action === 'exclude') exclude.push(r);
    else include.push(r);
  }

  return { include, exclude };
}

/**
 * Insert or update an account override record in the admin database.
 *
 * @param payload - Partial override data (all AccountOverride fields except `created_at` and `updated_at`; `id` may be provided to update an existing row). Fields that are not provided will be stored as `null` where applicable; `bypass_eligibility` defaults to `true` if omitted; `match_id` is stored only when `scope` is `'match'`.
 * @returns The persisted `AccountOverride` row.
 * @throws Rethrows the database error if the upsert operation fails.
 */
export async function upsertOverride(payload: Omit<AccountOverride, 'id' | 'created_at' | 'updated_at'> & { id?: string }) {
  const sb = getAdminClient();
  const insertable: any = {
    id: payload.id,
    platform: payload.platform,
    identifier_type: payload.identifier_type,
    identifier: payload.identifier,
    handle: payload.handle ?? null,
    action: payload.action,
    scope: payload.scope,
    match_id: payload.scope === 'match' ? payload.match_id ?? null : null,
    bypass_eligibility: payload.bypass_eligibility ?? true,
    notes: payload.notes ?? null,
    expires_at: payload.expires_at ?? null,
    created_by: payload.created_by ?? null
  };

  const { data, error } = await sb.from('account_overrides').upsert(insertable).select().single();
  if (error) throw error;
  return data as AccountOverride;
}

/**
 * Remove the account override with the specified id.
 *
 * @param id - The id of the override to delete.
 * @returns An object with `ok: true` on success.
 * @throws The error returned by the admin client if the delete operation fails.
 */
export async function deleteOverride(id: string) {
  const sb = getAdminClient();
  const { error } = await sb.from('account_overrides').delete().eq('id', id);
  if (error) throw error;
  return { ok: true };
}