import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getOverrides, upsertOverride, deleteOverride, type Platform } from '$lib/services/accountOverrides';

/**
 * Checks whether the incoming request includes a valid admin Bearer token.
 *
 * @param event - The request event whose Authorization header is inspected for a Bearer token.
 * @returns `true` if the Authorization Bearer token matches the `ADMIN_TOKEN` environment variable, `false` otherwise.
 */
function requireAdmin(event: any) {
  const hdr = event.request.headers.get('authorization') || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice('Bearer '.length) : '';
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || token !== expected) {
    return false;
  }
  return true;
}

// GET /api/admin/accounts/overrides?platform=bsky&matchId=ABC
export const GET: RequestHandler = async (event) => {
  if (!requireAdmin(event)) {
    return new Response('Unauthorized', { status: 401 });
  }
  const url = event.url;
  const platform = (url.searchParams.get('platform') || 'bsky') as Platform;
  const matchId = url.searchParams.get('matchId') || null;
  const data = await getOverrides({ platform, matchId });
  return json(data);
};

// POST /api/admin/accounts/overrides
// Body: { platform, identifier_type, identifier, handle?, action, scope, match_id?, bypass_eligibility?, expires_at?, notes? }
export const POST: RequestHandler = async (event) => {
  if (!requireAdmin(event)) {
    return new Response('Unauthorized', { status: 401 });
  }
  const payload = await event.request.json();
  const row = await upsertOverride(payload);
  return json(row);
};

// DELETE /api/admin/accounts/overrides?id=UUID
export const DELETE: RequestHandler = async (event) => {
  if (!requireAdmin(event)) {
    return new Response('Unauthorized', { status: 401 });
  }
  const id = event.url.searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400 });
  await deleteOverride(id);
  return json({ ok: true });
};