import type { RequestHandler } from '@sveltejs/kit';
import { createChallenge, getChallenge } from '$lib/auth/bskyVerifyStore';

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

    // If an existing challenge exists and hasn't expired, reuse it (avoid generating multiple codes quickly)
    const existing = getChallenge(handle);
    const ch = existing ?? createChallenge(handle);

    return new Response(
      JSON.stringify({
        ok: true,
        handle,
        code: ch.code,
        createdAt: ch.createdAt,
        expiresAt: ch.expiresAt,
        instructions: `Post the code "${ch.code}" publicly on Bluesky from @${handle} (or in your bio) within the next few minutes, then call verify-challenge to complete verification.`
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'create_challenge_failed', message: e?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
