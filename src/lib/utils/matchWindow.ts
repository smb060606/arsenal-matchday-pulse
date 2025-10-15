export type MatchWindow = 'pre' | 'live' | 'post' | 'ended';

export const PRE_WINDOW_MIN = 120; // 2 hours before kickoff
export const DEFAULT_LIVE_DURATION_MIN = 120; // default match duration window (incl. HT, stoppage)
export const POST_WINDOW_MIN = 60; // 1 hour after FT
export const HALFTIME_MIN = 15; // standard halftime duration

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

/**
 * Compute the effective "match minute" given wall clock time and kickoff.
 * Injury time is collapsed:
 * - 45+X is treated as 45 until second half begins
 * - 90+X is treated as 90 (cap)
 */
export function effectiveMatchMinute(kickoffISO: string, nowMs: number = Date.now(), halftimeMin: number = HALFTIME_MIN): number {
  const kickoff = Date.parse(kickoffISO);
  if (!Number.isFinite(kickoff)) return 0;
  const elapsedMin = Math.max(0, (nowMs - kickoff) / 60_000);

  if (elapsedMin <= 45) {
    return Math.max(0, Math.min(45, Math.floor(elapsedMin)));
  }
  // During halftime break (approx 15 minutes), keep match minute at 45
  if (elapsedMin > 45 && elapsedMin <= 45 + halftimeMin) {
    return 45;
  }
  // Second half: subtract halftime duration, cap at 90
  const secondHalfMin = elapsedMin - halftimeMin;
  return Math.max(45, Math.min(90, Math.floor(secondHalfMin)));
}

/**
 * Map a match minute (0..90) to elapsed real minutes since kickoff,
 * accounting for halftime break.
 */
export function mapMatchMinuteToElapsedMinutes(matchMinute: number, halftimeMin: number = HALFTIME_MIN): number {
  const mm = Math.max(0, Math.min(90, matchMinute));
  if (mm <= 45) return mm;
  return mm + halftimeMin;
}

/**
 * Compute the current 15-minute live bin.
 * Bins are fixed at: [0-15), [15-30), [30-45), [45-60), [60-75), [75-90]
 * Injury time is collapsed into 45 or 90 bins respectively.
 */
export function getLiveBin(kickoffISO: string, nowMs: number = Date.now(), halftimeMin: number = HALFTIME_MIN): {
  index: number;           // 0..5
  startMinute: number;     // 0,15,30,45,60,75
  endMinute: number;       // 15,30,45,60,75,90
  binStartMs: number;      // wall-clock ms for start of bin
} {
  const mm = effectiveMatchMinute(kickoffISO, nowMs, halftimeMin);
  let index = Math.floor(mm / 15);
  if (index < 0) index = 0;
  if (index > 5) index = 5;
  const startMinute = [0, 15, 30, 45, 60, 75][index];
  const endMinute = [15, 30, 45, 60, 75, 90][index];
  // Convert start match minute to wall-clock ms
  const kickoff = Date.parse(kickoffISO);
  const elapsedStartMin = mapMatchMinuteToElapsedMinutes(startMinute, halftimeMin);
  const binStartMs = kickoff + elapsedStartMin * 60_000;
  return { index, startMinute, endMinute, binStartMs };
}

/** Pre-match window start time (ms): kickoff - 120 minutes */
export function preWindowStartMs(kickoffISO: string): number {
  const kickoff = Date.parse(kickoffISO);
  return Number.isFinite(kickoff) ? kickoff - PRE_WINDOW_MIN * 60_000 : Date.now();
}

/**
 * Post-match window start time (ms):
 * - If finalWhistleISO provided, that time
 * - Else (approximate) kickoff + (90 + halftime) minutes
 */
export function postWindowStartMs(kickoffISO: string, finalWhistleISO?: string, halftimeMin: number = HALFTIME_MIN): number {
  if (finalWhistleISO) {
    const fw = Date.parse(finalWhistleISO);
    if (Number.isFinite(fw)) return fw;
  }
  const kickoff = Date.parse(kickoffISO);
  if (!Number.isFinite(kickoff)) return Date.now();
  const minutesFromKickoffToFT = 90 + halftimeMin; // 90' plus halftime
  return kickoff + minutesFromKickoffToFT * 60_000;
}
