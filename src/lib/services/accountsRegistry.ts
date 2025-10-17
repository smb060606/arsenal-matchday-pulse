'use server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '$lib/supabaseAdmin';
import type { BskyProfileBasic } from '$lib/services/bskyService';
import { BSKY_MIN_ACCOUNT_MONTHS, BSKY_MIN_FOLLOWERS } from '$lib/config/bsky';

/**
 * Compute the approximate number of months between two dates.
 *
 * @param a - The first date to compare
 * @param b - The second date to compare
 * @returns The absolute difference in months (may be fractional), assuming 30 days per month
 */
function monthsBetween(a: Date, b: Date): number {
  const diffMs = Math.abs(a.getTime() - b.getTime());
  return diffMs / (1000 * 60 * 60 * 24 * 30);
}

/**
 * Obtain a Supabase admin client from the existing helper or by creating one from environment variables.
 *
 * Tries getSupabaseAdmin() first; if that is not available, constructs a client using
 * SUPABASE_URL or PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. If required environment
 * variables are missing, returns `null`.
 *
 * @returns A Supabase admin client instance, or `null` if an admin client cannot be obtained.
 */
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
 * Upserts an array of Bluesky profiles into the accounts_registry table and computes a stale flag for each profile.
 *
 * @param now - Reference timestamp used to compute account age and stale status; defaults to the current date and time
 * @returns An object with `upserted` set to the number of rows written to the registry (0 if nothing was upserted)
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
    console.error('accountsRegistry.upsertAccountsRegistryBsky: upsert failed', { error: String(error) });
    throw new Error('accounts_registry_upsert_failed');
  }
  return { upserted: rows.length };
}