import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params, url }) => {
  const matchId = params.matchId;

  const kickoff = url.searchParams.get('kickoff') ?? '';
  const sinceMin = url.searchParams.get('sinceMin') ?? '';
  const liveMin = url.searchParams.get('liveMin') ?? '';

  const qs = new URLSearchParams();
  if (kickoff) qs.set('kickoff', kickoff);
  if (sinceMin) qs.set('sinceMin', sinceMin);
  if (liveMin) qs.set('liveMin', liveMin);

  const endpoint = `/api/compare/${encodeURIComponent(matchId)}${qs.toString() ? `?${qs.toString()}` : ''}`;

  try {
    const res = await fetch(endpoint);
    if (res.ok) {
      const payload = await res.json();
      return { matchId, compare: payload };
    }
  } catch {
    // ignore and fall through
  }

  return { matchId, compare: null };
};
