import type { RequestHandler } from '@sveltejs/kit';
import { getSupabaseClient } from '$lib/supabaseClient';
import { getSupabaseAdmin } from '$lib/supabaseAdmin';
import type { Comment, Platform, CommentUser } from '$lib/types/comment';

const ALLOWED_PLATFORMS: Platform[] = ['bsky', 'twitter', 'threads', 'combined'];

// In-memory fallback store when Supabase is not configured
const COMMENTS_MEM = new Map<string, Comment[]>(); // key = matchId

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePlatform(p?: string | null): Platform {
  if (!p) return 'combined';
  const v = p.toLowerCase();
  return (ALLOWED_PLATFORMS as string[]).includes(v) ? (v as Platform) : 'combined';
}

function rowToComment(row: any): Comment {
  return {
    id: row.id ?? uid(),
    matchId: row.match_id,
    platform: normalizePlatform(row.platform),
    user: {
      id: row.user_id ?? undefined,
      handle: row.user_handle ?? undefined,
      displayName: row.user_display_name ?? undefined
    },
    parentId: row.parent_id ?? null,
    text: row.text,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    status: row.status ?? 'active'
  };
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const matchId = url.searchParams.get('matchId') ?? '';
    if (!matchId) {
      return new Response(JSON.stringify({ error: 'missing_matchId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const admin = getSupabaseAdmin();
    const supabase = admin ?? getSupabaseClient();

    if (supabase) {
      const { data, error } = await supabase
        .from('comments')
        .select('id, match_id, platform, user_id, user_handle, user_display_name, parent_id, text, created_at, status')
        .eq('match_id', matchId)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        // Soft fallback to memory if available
        const arr = COMMENTS_MEM.get(matchId) ?? [];
        return new Response(
          JSON.stringify({ matchId, count: arr.length, comments: arr, note: 'supabase_error_fallback' }),
          { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
        );
      }

      const comments = (data ?? []).map(rowToComment);
      return new Response(JSON.stringify({ matchId, count: comments.length, comments }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    } else {
      // In-memory fallback
      const arr = COMMENTS_MEM.get(matchId) ?? [];
      return new Response(JSON.stringify({ matchId, count: arr.length, comments: arr }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'comments_list_failed', message: e?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({} as any));
    const matchId: string = (body?.matchId ?? '').toString().trim();
    const text: string = (body?.text ?? '').toString().trim();
    const platform = normalizePlatform(body?.platform);
    const parentId: string | null = body?.parentId ? String(body.parentId) : null;
    const user = (body?.user ?? {}) as CommentUser;

    if (!matchId) {
      return new Response(JSON.stringify({ error: 'missing_matchId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!text) {
      return new Response(JSON.stringify({ error: 'missing_text' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const admin = getSupabaseAdmin();
    const anon = getSupabaseClient();

    if (admin || anon) {
      const client = admin ?? anon!;
      const insertRow = {
        match_id: matchId,
        platform,
        user_id: user?.id ?? null,
        user_handle: user?.handle ?? null,
        user_display_name: user?.displayName ?? null,
        parent_id: parentId,
        text,
        status: 'active' as const
      };

      const { data, error } = await client
        .from('comments')
        .insert(insertRow)
        .select('id, match_id, platform, user_id, user_handle, user_display_name, parent_id, text, created_at, status')
        .single();

      if (error) {
        // Fall back to memory if DB insert fails
        const comment: Comment = {
          id: uid(),
          matchId,
          platform,
          user,
          parentId,
          text,
          createdAt: new Date().toISOString(),
          status: 'active'
        };
        const arr = COMMENTS_MEM.get(matchId) ?? [];
        arr.unshift(comment);
        COMMENTS_MEM.set(matchId, arr);

        return new Response(JSON.stringify({ ok: true, comment, note: 'supabase_insert_failed_fallback' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        });
      }

      const created = rowToComment(data);
      return new Response(JSON.stringify({ ok: true, comment: created }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    } else {
      // In-memory fallback only
      const comment: Comment = {
        id: uid(),
        matchId,
        platform,
        user,
        parentId,
        text,
        createdAt: new Date().toISOString(),
        status: 'active'
      };

      const arr = COMMENTS_MEM.get(matchId) ?? [];
      arr.unshift(comment);
      COMMENTS_MEM.set(matchId, arr);

      return new Response(JSON.stringify({ ok: true, comment }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'comments_create_failed', message: e?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
