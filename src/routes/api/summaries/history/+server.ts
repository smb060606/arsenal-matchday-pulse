import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '$lib/supabaseAdmin';

/**
 * Obtain a Supabase client for server-side use, preferring an existing admin client and falling back to environment-configured credentials.
 *
 * @returns A Supabase client instance configured for server use, or `null` when no admin client and required environment variables are present.
 */
function getDb() {
  const admin = getSupabaseAdmin();
  if (admin) return admin as any;

  // Fallback to server env if available
  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null as any;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// GET /api/summaries/history?matchId=...&platform=bsky|twitter|threads|all&phase=pre|live|post|all
export const GET: RequestHandler = async ({ url }) => {
  try {
    const matchId = url.searchParams.get('matchId') || '';
    const platform = (url.searchParams.get('platform') || 'all').toLowerCase();
    const phase = (url.searchParams.get('phase') || 'all').toLowerCase();

    if (!matchId) {
      return json({ error: 'missing_match_id' }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return json({ error: 'supabase_not_configured' }, { status: 501 });
    }

    // Fetch all rows for the match, then filter in-memory for platform/phase to keep builder shape simple.
    const resAll = await (db as any)
      .from('match_summaries')
      .select(
        'id, match_id, platform, phase, generated_at, summary_text, sentiment, topics, samples, accounts_used, created_at'
      )
      .eq('match_id', matchId)
      .order('generated_at', { ascending: false });

    let data: any[] = Array.isArray(resAll?.data) ? resAll.data : [];
    const error: any = resAll?.error ?? null;

    if (!error && Array.isArray(data)) {
      if (platform !== 'all') {
        if (!['bsky', 'twitter', 'threads'].includes(platform)) {
          return json({ error: 'invalid_platform' }, { status: 400 });
        }
        data = data.filter((r) => r?.platform === platform);
      }
      if (phase !== 'all') {
        if (!['pre', 'live', 'post'].includes(phase)) {
          return json({ error: 'invalid_phase' }, { status: 400 });
        }
        data = data.filter((r) => r?.phase === phase);
      }
    }

    if (error) {
      return json({ error: 'fetch_failed', message: String(error?.message || 'unknown') }, { status: 500 });
    }

    return json({
      matchId,
      platform: platform as any,
      phase: phase as any,
      count: data.length,
      summaries: data
    });
  } catch (e: any) {
    return json({ error: 'history_failed', message: e?.message ?? 'Unknown error' }, { status: 500 });
  }
};