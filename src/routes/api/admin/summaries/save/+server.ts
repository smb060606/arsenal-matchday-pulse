import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '$lib/supabaseAdmin';

/**
 * Checks whether the incoming request supplies the admin Bearer token.
 *
 * @param event - The server request event whose `authorization` header will be checked for a Bearer token
 * @returns `true` if the Authorization header contains a Bearer token that exactly matches the `ADMIN_TOKEN` environment variable, `false` otherwise.
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

/**
 * Obtain a Supabase admin client, preferring an existing admin instance and falling back to creating one from server environment variables.
 *
 * @returns A Supabase client with admin privileges, or `null` when no admin instance is available and required environment variables are missing.
 */
function getDb() {
  const admin = getSupabaseAdmin();
  if (admin) return admin as any;

  // Fallback: allow direct server env usage when available
  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null as any;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

type SavePayload = {
  matchId: string;
  platform: 'bsky' | 'twitter' | 'threads';
  phase: 'pre' | 'live' | 'post';
  generatedAt: string; // ISO
  summary: string;
  sentiment: any;
  topics: any[];
  samples: any[];
  accountsUsed: any[];
};

/**
 * Checks whether a value conforms to the SavePayload shape expected by the route.
 *
 * @param p - The candidate payload to validate.
 * @returns `true` if `p` has a non-empty `matchId` string, a `platform` equal to `"bsky"`, `"twitter"`, or `"threads"`, a `phase` equal to `"pre"`, `"live"`, or `"post"`, a non-empty `generatedAt` string, a `summary` string, a non-null `sentiment` object, and `topics`, `samples`, and `accountsUsed` arrays; `false` otherwise.
 */
function validate(p: any): p is SavePayload {
  if (!p) return false;
  if (typeof p.matchId !== 'string' || !p.matchId.trim()) return false;
  if (!['bsky', 'twitter', 'threads'].includes(p.platform)) return false;
  if (!['pre', 'live', 'post'].includes(p.phase)) return false;
  if (typeof p.generatedAt !== 'string' || !p.generatedAt.trim()) return false;
  if (typeof p.summary !== 'string') return false;
  if (typeof p.sentiment !== 'object' || p.sentiment == null) return false;
  if (!Array.isArray(p.topics)) return false;
  if (!Array.isArray(p.samples)) return false;
  if (!Array.isArray(p.accountsUsed)) return false;
  return true;
}

// POST /api/admin/summaries/save
// Body: SavePayload
export const POST: RequestHandler = async (event) => {
  if (!requireAdmin(event)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await event.request.json().catch(() => null);
  if (!validate(body)) {
    return json({ error: 'invalid_payload' }, { status: 400 });
  }

  const db = getDb();
  if (!db) {
    return json({ error: 'supabase_not_configured' }, { status: 501 });
  }

  try {
    const { error } = await (db as any).from('match_summaries').insert({
      match_id: body.matchId,
      platform: body.platform,
      phase: body.phase,
      generated_at: body.generatedAt,
      summary_text: body.summary,
      sentiment: body.sentiment,
      topics: body.topics,
      samples: body.samples,
      accounts_used: body.accountsUsed
    });

    if (error) {
      return json({ error: 'save_failed', message: String(error?.message || 'unknown') }, { status: 500 });
    }

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: 'save_failed', message: e?.message ?? 'Unknown error' }, { status: 500 });
  }
};