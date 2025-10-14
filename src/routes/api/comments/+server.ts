import type { RequestHandler } from '@sveltejs/kit';

type Comment = {
  id: string;
  matchId: string;
  platform?: 'bsky' | 'twitter' | 'threads' | 'combined';
  user?: { id?: string; handle?: string; displayName?: string };
  parentId?: string | null;
  text: string;
  createdAt: string;
  status: 'active' | 'deleted';
};

const COMMENTS = new Map<string, Comment[]>(); // key = matchId

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
    const arr = COMMENTS.get(matchId) ?? [];
    return new Response(
      JSON.stringify({
        matchId,
        count: arr.length,
        comments: arr
      }),
      {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      }
    );
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
    const platform = (body?.platform ?? 'combined') as Comment['platform'];
    const parentId: string | null = body?.parentId ? String(body.parentId) : null;
    const user = (body?.user ?? {}) as Comment['user'];

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

    const arr = COMMENTS.get(matchId) ?? [];
    arr.unshift(comment);
    COMMENTS.set(matchId, arr);

    return new Response(JSON.stringify({ ok: true, comment }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'comments_create_failed', message: e?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
