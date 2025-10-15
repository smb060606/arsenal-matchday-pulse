import type { PageLoad } from './$types';
import { getWindowState, DEFAULT_LIVE_DURATION_MIN } from '$lib/utils/matchWindow';

export const load: PageLoad = async ({ params, url }) => {
  const matchId = params.id;
  const kickoff = url.searchParams.get('kickoff') ?? '';
  const sinceMinStr = url.searchParams.get('sinceMin') ?? '';
  const liveMinStr = url.searchParams.get('liveMin') ?? '';

  const sinceMin = Number.isFinite(Number(sinceMinStr)) && Number(sinceMinStr) > 0 ? Number(sinceMinStr) : 30;
  const liveMin = Number.isFinite(Number(liveMinStr)) && Number(liveMinStr) > 0 ? Number(liveMinStr) : DEFAULT_LIVE_DURATION_MIN;

  const currentWindow = kickoff ? getWindowState({ kickoffISO: kickoff, liveDurationMin: liveMin }) : 'live';

  return {
    matchId,
    kickoff,
    sinceMin,
    liveMin,
    currentWindow
  };
};
