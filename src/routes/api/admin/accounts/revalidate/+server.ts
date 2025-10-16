import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSupabaseAdmin } from '$lib/supabaseAdmin';
import { resolveAllowlistProfiles } from '$lib/services/bskyService';
import { upsertAccountsRegistryBsky } from '$lib/services/accountsRegistry';

/**
 * Admin endpoint to re-evaluate account health every ~30 days.
 * - Refresh allowlist profiles (Bluesky) and upsert into accounts_registry with stale flags
 * - Purge expired overrides to keep table lean (selection already ignores expired)
 *
 * Authorization:
 *  - Requires Authorization: Bearer ADMIN_TOKEN
 */
function requireAdmin(event: any) {
  const hdr = event.request.headers.get('authorization') || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice('Bearer '.length) : '';
  const expected = process.env.ADMIN_TOKEN;
  return !!expected && token === expected;
}

export const POST: RequestHandler = async (event) => {
  if (!requireAdmin(event)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    // If admin env missing, surface graceful error so scheduler/report can catch
    return json({ ok: false, error: 'admin_not_configured' }, { status: 501 });
  }

  const now = new Date();

  // 1) Refresh Bluesky allowlist profiles and update registry
  let bskyUpserted = 0;
  try {
    const profiles = await resolveAllowlistProfiles();
    const { upserted } = await upsertAccountsRegistryBsky(profiles, now);
    bskyUpserted = upserted;
  } catch (e: any) {
    // continue; we still want to attempt purge
  }

  // 2) Purge expired overrides (selection already ignores expired; this keeps table tidy)
  let overridesPurged = 0;
  try {
    const { data, error } = await admin
      .from('account_overrides')
      .delete()
      .lt('expires_at', now.toISOString())
      .select('id');
    if (!error) {
      overridesPurged = Array.isArray(data) ? data.length : 0;
    }
  } catch {
    // ignore
  }

  return json({
    ok: true,
    at: now.toISOString(),
    stats: {
      bsky: { upserted: bskyUpserted },
      overrides: { purgedExpired: overridesPurged }
    }
  });
};
