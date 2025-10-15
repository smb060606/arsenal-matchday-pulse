export type MatchWindow = 'pre' | 'live' | 'post' | 'ended';

export const PRE_WINDOW_MIN = 120; // 2 hours before kickoff
export const DEFAULT_LIVE_DURATION_MIN = 120; // default match duration window (incl. HT, stoppage)
export const POST_WINDOW_MIN = 60; // 1 hour after FT

export function getWindowState(params: {
  kickoffISO: string;
  nowMs?: number;
  liveDurationMin?: number;
}): MatchWindow {
  const { kickoffISO } = params;
  const now = typeof params.nowMs === 'number' ? params.nowMs : Date.now();
  const liveDur = Number(params.liveDurationMin ?? DEFAULT_LIVE_DURATION_MIN);

  const kickoff = Date.parse(kickoffISO);
  if (!Number.isFinite(kickoff)) {
    // If kickoff invalid, default to live (no enforcement)
    return 'live';
  }

  const preStart = kickoff - PRE_WINDOW_MIN * 60_000;
  const liveEnd = kickoff + liveDur * 60_000;
  const postEnd = liveEnd + POST_WINDOW_MIN * 60_000;

  if (now < preStart) {
    // Before pre-window opens, treat as pre (but caller may choose to not stream yet)
    return 'pre';
  }
  if (now >= preStart && now < kickoff) return 'pre';
  if (now >= kickoff && now < liveEnd) return 'live';
  if (now >= liveEnd && now < postEnd) return 'post';
  return 'ended';
}
