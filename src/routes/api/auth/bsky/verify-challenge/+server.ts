import type { RequestHandler } from '@sveltejs/kit';
import { getChallenge, clearChallenge, verifyPostContainsCode } from '$lib/auth/bskyVerifyStore';
import { getSupabaseClient } from '$lib/supabaseClient';

/**
 * POST /api/auth/bsky/verify-challenge
 * Body: { handle: string }
 * Verifies that the user posted the issued challenge code on Bluesky recently.
 * If successful, clears the challenge and returns { ok: true }.
 * (Skeleton for future: link/create user in Supabase or issue a session)
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({} as any));
    const handle = (body?.handle ?? '').toString().trim();

    if (!handle) {
      return new Response(JSON.stringify({ error: 'missing_handle' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const ch = getChallenge(handle);
    if (!ch) {
      return new Response(JSON.stringify({ error: 'no_active_challenge' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify that the posted content contains the code
    const verify = await verifyPostContainsCode(handle, ch.code, 15);
    if (!verify.ok) {
      return new Response(JSON.stringify({ error: 'verification_failed', reason: verify.reason }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Clear the challenge since it's been satisfied
    clearChallenge(handle);

    // TODO: Link/create user in Supabase; issue session or magic link.
    // const supabase = getSupabaseClient();
    // if (supabase) { ... }

    return new Response(JSON.stringify({ ok: true, handle }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'verify_challenge_failed', message: e?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
