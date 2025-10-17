import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params, url }) => {
  const matchId = params.matchId;
  const platform = url.searchParams.get('platform') ?? 'bsky';
  const phase = url.searchParams.get('phase') ?? 'all';

  const qs = new URLSearchParams();
  qs.set('matchId', matchId);
  qs.set('platform', platform);
  qs.set('phase', phase);

  const res = await fetch(`/api/summaries/history?${qs.toString()}`);
  if (!res.ok) {
    return {
      matchId,
      platform,
      phase,
      error: await res.text().catch(() => 'history_load_failed'),
      generatedAt: new Date().toISOString(),
      count: 0,
      summaries: []
    };
  }

  const payload = await res.json();
  return {
    matchId: payload.matchId,
    platform: payload.platform,
    phase: payload.phase,
    generatedAt: new Date().toISOString(),
    count: payload.count,
    summaries: payload.summaries
  };
};
