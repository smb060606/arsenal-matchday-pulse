import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '$lib/supabaseAdmin';
import type { BskyProfileBasic } from '$lib/services/bskyService';
import { BSKY_MIN_ACCOUNT_MONTHS, BSKY_MIN_FOLLOWERS } from '$lib/config/bsky';

function monthsBetween(a: Date, b: Date): number {
  const diffMs = Math.abs(a.getTime() - b.getTime());
  return diffMs / (1000 * 60 * 60 * 24 * 30);
}

function getAdminClient() {
  const admin = getSupabaseAdmin();
  if (admin) return admin as any;

  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null as any;

  return createClient(url, serviceKey, {
    auth: { persistSession: false }
  });
}

/**
 * Upsert Bluesky profiles into accounts_registry and compute stale flags.
 */
export async function upsertAccountsRegistryBsky(
  profiles: BskyProfileBasic[],
  now: Date = new Date()
): Promise<{ upserted: number }> {
  const sb = getAdminClient();
  if (!sb || !profiles.length) return { upserted: 0 };

  const rows = profiles.map((p) => {
    const createdAtMs = p.createdAt ? Date.parse(p.createdAt) : NaN;
    const ageMonths = Number.isFinite(createdAtMs) ? monthsBetween(new Date(createdAtMs), now) : Infinity;
    const followers = p.followersCount ?? 0;
    const stale =
      followers < BSKY_MIN_FOLLOWERS ||
      (Number.isFinite(ageMonths) ? ageMonths < BSKY_MIN_ACCOUNT_MONTHS : false);

    return {
      platform: 'bsky',
      did: p.did || null,
      user_id: null,
      handle: p.handle || null,
      followers_count: p.followersCount ?? null,
      posts_count: p.postsCount ?? null,
      account_created_at: p.createdAt ?? null,
      last_checked_at: now.toISOString(),
      stale,
      last_error: null
    };
  });

  const { error } = await sb.from('accounts_registry').upsert(rows, { onConflict: 'platform, did, user_id, handle' });
  if (error) {
    // Swallow errors to avoid breaking admin job
    return { upserted: 0 };
  }
  return { upserted: rows.length };
}
