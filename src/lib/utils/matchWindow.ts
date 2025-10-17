export type MatchWindow = 'pre' | 'live' | 'post' | 'ended';

export const PRE_WINDOW_MIN = 120; // 2 hours before kickoff
export const DEFAULT_LIVE_DURATION_MIN = 120; // default match duration window (incl. HT, stoppage)
export const POST_WINDOW_MIN = 60; // 1 hour after FT
export const HALFTIME_MIN = 15; /**
 * Determine the match time window ('pre', 'live', 'post', or 'ended') relative to the provided kickoff time.
 *
 * If `kickoffISO` cannot be parsed as a finite time, the function returns `'live'`. The function uses
 * a pre-window that opens before kickoff, a live window from kickoff for the specified `liveDurationMin`,
 * and a post-window after live ends; times are compared against `nowMs` (or the current time when omitted).
 *
 * @param kickoffISO - Kickoff time as an ISO 8601 string
 * @param nowMs - Optional current time in milliseconds since the epoch; defaults to the current wall-clock time
 * @param liveDurationMin - Optional duration of the live window in minutes; defaults to the module's default live duration
 * @returns `'pre'`, `'live'`, `'post'`, or `'ended'` indicating the current match window
 */

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
 * Compute the current match minute from kickoff and wall-clock time, collapsing injury time and halftime.
 *
 * During the halftime interval this returns `45`. Minutes before kickoff return `0`, and minutes after the second
 * half are capped at `90`. If `kickoffISO` is invalid, the function returns `0`.
 *
 * @param kickoffISO - Kickoff timestamp in ISO 8601 format
 * @param nowMs - Current time in milliseconds since the epoch (defaults to `Date.now()`)
 * @param halftimeMin - Halftime duration in minutes (defaults to `HALFTIME_MIN`)
 * @returns `0`–`90` representing the effective match minute; `0` before kickoff, `45` during halftime, and capped at `90` after the second half
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
 * Convert a match minute (0–90) to elapsed wall-clock minutes since kickoff, inserting halftime after minute 45.
 *
 * @param matchMinute - Match minute to map; values below 0 or above 90 will be clamped to that range.
 * @param halftimeMin - Duration of halftime in minutes (defaults to 15).
 * @returns Elapsed minutes since kickoff corresponding to `matchMinute`.
 */
export function mapMatchMinuteToElapsedMinutes(matchMinute: number, halftimeMin: number = HALFTIME_MIN): number {
  const mm = Math.max(0, Math.min(90, matchMinute));
  if (mm <= 45) return mm;
  return mm + halftimeMin;
}

/**
 * Determine the current 15-minute live bin for a match.
 *
 * Bins are fixed as 0–15, 15–30, 30–45, 45–60, 60–75, and 75–90 minutes; injury time is collapsed into the 45 or 90 bins and the 45-minute moment is kept in the 30–45 bin until the second half resumes.
 *
 * @param kickoffISO - Kickoff time as an ISO-8601 string
 * @param nowMs - Current wall-clock time in milliseconds (defaults to Date.now())
 * @param halftimeMin - Halftime duration in minutes (defaults to HALFTIME_MIN)
 * @returns An object with:
 *  - `index`: bin index 0..5,
 *  - `startMinute`: inclusive start match minute for the bin (0,15,30,45,60,75),
 *  - `endMinute`: exclusive/end match minute for the bin (15,30,45,60,75,90),
 *  - `binStartMs`: wall-clock milliseconds for when the bin starts (based on kickoff and halftime)
 */
export function getLiveBin(kickoffISO: string, nowMs: number = Date.now(), halftimeMin: number = HALFTIME_MIN): {
  index: number;           // 0..5
  startMinute: number;     // 0,15,30,45,60,75
  endMinute: number;       // 15,30,45,60,75,90
  binStartMs: number;      // wall-clock ms for start of bin
} {
  const kickoff = Date.parse(kickoffISO);
  const elapsedRealMin = Number.isFinite(kickoff) ? Math.max(0, (nowMs - kickoff) / 60_000) : 0;

  const mm = effectiveMatchMinute(kickoffISO, nowMs, halftimeMin);
  let index = Math.floor(mm / 15);

  // Halftime collapse rule: keep mm=45 in the 30–45 bin until second half actually resumes
  if (mm === 45 && elapsedRealMin <= 45 + halftimeMin) {
    index = 2; // 30–45
  }

  if (index < 0) index = 0;
  if (index > 5) index = 5;

  const startMinute = [0, 15, 30, 45, 60, 75][index];
  const endMinute = [15, 30, 45, 60, 75, 90][index];

  // Convert start match minute to wall-clock ms
  const elapsedStartMin = mapMatchMinuteToElapsedMinutes(startMinute, halftimeMin);
  const binStartMs = (Number.isFinite(kickoff) ? kickoff : Date.now()) + elapsedStartMin * 60_000;

  return { index, startMinute, endMinute, binStartMs };
}

/**
 * Compute the pre-match window start timestamp in milliseconds from kickoff.
 *
 * @param kickoffISO - Kickoff time as an ISO 8601 string
 * @returns The UTC timestamp (ms) equal to kickoff minus PRE_WINDOW_MIN minutes; if `kickoffISO` is invalid, returns the current time
 */
export function preWindowStartMs(kickoffISO: string): number {
  const kickoff = Date.parse(kickoffISO);
  return Number.isFinite(kickoff) ? kickoff - PRE_WINDOW_MIN * 60_000 : Date.now();
}

/**
 * Compute the post-match window start time in milliseconds.
 *
 * @param kickoffISO - Kickoff time as an ISO 8601 string
 * @param finalWhistleISO - Optional final whistle time as an ISO 8601 string; used if provided and valid
 * @param halftimeMin - Halftime duration in minutes (defaults to `HALFTIME_MIN`)
 * @returns The epoch timestamp (ms) when the post-match window begins. If `finalWhistleISO` is provided and parses to a valid time, that time is returned; otherwise returns `kickoffISO` + (90 + `halftimeMin`) minutes. If `kickoffISO` is invalid, returns the current time. */
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