import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/services/accountOverrides', () => ({
  getOverrides: vi.fn(),
  upsertOverride: vi.fn(),
  deleteOverride: vi.fn()
}));

// Import after mocks
import { GET, POST, DELETE } from './+server';
import { getOverrides, upsertOverride, deleteOverride } from '$lib/services/accountOverrides';

const mGetOverrides = vi.mocked(getOverrides);
const mUpsertOverride = vi.mocked(upsertOverride);
const mDeleteOverride = vi.mocked(deleteOverride);

function makeEvent(input: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  const url = new URL(input.url ?? 'http://localhost/api/admin/accounts/overrides');
  const headers = new Headers(input.headers ?? {});
  const method = input.method ?? 'GET';
  const init: RequestInit = {
    method,
    headers
  };
  if (input.body !== undefined) {
    init.body = JSON.stringify(input.body);
  }
  const request = new Request(url, init);
  return {
    request,
    url
  } as any;
}

describe('/api/admin/accounts/overrides (+server)', () => {
  const TOKEN = 'secret-token';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_SECRET = TOKEN;
  });

  afterEach(() => {
    delete process.env.ADMIN_SECRET;
  });

  describe('authorization', () => {
    it('returns 401 when ADMIN_SECRET missing or wrong', async () => {
      // No header
      const ev1 = makeEvent({});
      let res = await GET(ev1);
      expect(res.status).toBe(401);

      // Wrong admin header
      const ev2 = makeEvent({
        headers: { 'x-admin-token': 'wrong' }
      });
      res = await GET(ev2);
      expect(res.status).toBe(401);
    });
  });

  describe('GET', () => {
    it('returns include/exclude overrides when authorized', async () => {
      mGetOverrides.mockResolvedValue({
        include: [
          {
            id: '1',
            platform: 'bsky',
            identifier_type: 'handle',
            identifier: 'userA',
            handle: 'userA',
            action: 'include',
            scope: 'global',
            match_id: null,
            bypass_eligibility: true,
            notes: null,
            expires_at: null,
            created_by: 'tester',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ],
        exclude: [
          {
            id: '2',
            platform: 'bsky',
            identifier_type: 'handle',
            identifier: 'userB',
            handle: 'userB',
            action: 'exclude',
            scope: 'match',
            match_id: 'M1',
            bypass_eligibility: true,
            notes: null,
            expires_at: null,
            created_by: 'tester',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      });

      const ev = makeEvent({
        headers: { 'x-admin-token': TOKEN },
        url: 'http://localhost/api/admin/accounts/overrides?platform=bsky&matchId=M1'
      });

      const res = await GET(ev);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.include)).toBe(true);
      expect(Array.isArray(data.exclude)).toBe(true);
      expect(mGetOverrides).toHaveBeenCalledWith({ platform: 'bsky', matchId: 'M1' });
    });
  });

  describe('POST', () => {
    it('upserts override when authorized', async () => {
      const payload = {
        platform: 'bsky',
        identifier_type: 'handle',
        identifier: 'userZ',
        handle: 'userZ',
        action: 'include',
        scope: 'global',
        match_id: null,
        bypass_eligibility: true,
        notes: null,
        expires_at: null,
        created_by: 'tester'
      };

      const returned = { ...payload, id: 'abc', created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any;
      mUpsertOverride.mockResolvedValue(returned);

      const ev = makeEvent({
        method: 'POST',
        headers: { 'x-admin-token': TOKEN },
        body: payload
      });

      const res = await POST(ev);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe('abc');
      expect(mUpsertOverride).toHaveBeenCalledTimes(1);
    });

    it('returns 401 on POST without auth', async () => {
      const ev = makeEvent({ method: 'POST', body: {} });
      const res = await POST(ev);
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE', () => {
    it('deletes override by id when authorized', async () => {
      mDeleteOverride.mockResolvedValue({ ok: true } as any);
      const ev = makeEvent({
        method: 'DELETE',
        headers: { 'x-admin-token': TOKEN },
        url: 'http://localhost/api/admin/accounts/overrides?id=abc-123'
      });

      const res = await DELETE(ev);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ ok: true });
      expect(mDeleteOverride).toHaveBeenCalledWith('abc-123');
    });

    it('returns 400 when id is missing', async () => {
      const ev = makeEvent({
        method: 'DELETE',
        headers: { 'x-admin-token': TOKEN },
        url: 'http://localhost/api/admin/accounts/overrides'
      });
      const res = await DELETE(ev);
      expect(res.status).toBe(400);
    });

    it('returns 401 on DELETE without auth', async () => {
      const ev = makeEvent({
        method: 'DELETE',
        url: 'http://localhost/api/admin/accounts/overrides?id=abc'
      });
      const res = await DELETE(ev);
      expect(res.status).toBe(401);
    });
  });
});
