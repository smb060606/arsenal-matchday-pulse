import type { RequestHandler } from '@sveltejs/kit';
import { getSupabaseAdmin } from '$lib/supabaseAdmin';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      return json({ error: 'admin_not_configured' }, 501);
    }
    const token = request.headers.get('x-admin-token') ?? '';
    if (token !== adminSecret) {
      return json({ error: 'forbidden' }, 403);
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return json({ error: 'supabase_admin_not_configured' }, 501);
    }

    const body = await request.json().catch(() => ({} as any));
    const id: string = (body?.id ?? '').toString().trim();
    if (!id) {
      return json({ error: 'missing_id' }, 400);
    }

    const { data, error } = await admin
      .from('comments')
      .update({ status: 'deleted' })
      .eq('id', id)
      .select('id, match_id, status, text, created_at')
      .maybeSingle();

    if (error) {
      return json({ error: 'moderation_update_failed', message: error.message }, 500);
    }
    if (!data) {
      return json({ error: 'not_found' }, 404);
    }

    return json({ ok: true, comment: data });
  } catch (e: any) {
    return json({ error: 'moderation_failed', message: e?.message ?? 'Unknown error' }, 500);
  }
};
