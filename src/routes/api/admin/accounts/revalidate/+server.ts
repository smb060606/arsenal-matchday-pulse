import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSupabaseAdmin } from '$lib/supabaseAdmin';
import { resolveAllowlistProfiles } from '$lib/services/bskyService';
import { upsertAccountsRegistryBsky } from '$lib/services/accountsRegistry';

/**
 * Authorization:
 * - Requires header: x-admin-token: <ADMIN_SECRET>
 */
function requireAdmin(event: any) {
  const token = event.request.headers.get('x-admin-token') || '';
  const expected = process.env.ADMIN_SECRET;
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
  } catch {
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
