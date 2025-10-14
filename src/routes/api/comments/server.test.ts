import { describe, it, expect } from 'vitest';
import { GET, POST } from './+server';

describe('/api/comments', () => {
  it('returns 400 when matchId is missing on GET', async () => {
    const req = new Request('http://localhost/api/comments');
    const res = await GET({ url: new URL(req.url) } as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('missing_matchId');
  });

  it('creates and lists comments for a match', async () => {
    const matchId = 'test-match';
    const postReq = new Request('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({ matchId, text: 'First!', user: { handle: 'tester' } })
    });
    const postRes = await POST({ request: postReq } as any);
    expect(postRes.status).toBe(201);
    const postData = await postRes.json();
    expect(postData.ok).toBe(true);
    expect(postData.comment.text).toBe('First!');
    expect(postData.comment.matchId).toBe(matchId);

    const getUrl = new URL('http://localhost/api/comments');
    getUrl.searchParams.set('matchId', matchId);
    const getRes = await GET({ url: getUrl } as any);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.matchId).toBe(matchId);
    expect(Array.isArray(getData.comments)).toBe(true);
    expect(getData.comments.length).toBeGreaterThan(0);
    expect(getData.comments[0].text).toBe('First!');
  });

  it('rejects empty text on POST', async () => {
    const matchId = 'test-match-2';
    const postReq = new Request('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({ matchId, text: '' })
    });
    const postRes = await POST({ request: postReq } as any);
    expect(postRes.status).toBe(400);
    const data = await postRes.json();
    expect(data.error).toBe('missing_text');
  });
});
