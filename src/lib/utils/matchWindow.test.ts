import { describe, it, expect } from 'vitest';
import {
  effectiveMatchMinute,
  getLiveBin,
  preWindowStartMs,
  postWindowStartMs,
  mapMatchMinuteToElapsedMinutes,
  HALFTIME_MIN
} from './matchWindow';

describe('matchWindow helpers', () => {
  const kickoffISO = '2025-10-19T11:30:00.000Z';
  const kickoffMs = Date.parse(kickoffISO);

  it('effectiveMatchMinute: early first-half minutes map directly', () => {
    const nowMs = kickoffMs + 10 * 60_000; // +10 min
    expect(effectiveMatchMinute(kickoffISO, nowMs)).toBe(10);
  });

  it('effectiveMatchMinute: 45+X collapses to 45 until second half begins', () => {
    // 47 real minutes after kickoff, still halftime block (<= 45 + halftime)
    const nowMs = kickoffMs + 47 * 60_000;
    expect(effectiveMatchMinute(kickoffISO, nowMs)).toBe(45);
  });

  it('effectiveMatchMinute: second half minutes subtract halftime and cap at 90', () => {
    // 61 real minutes after kickoff -> second half minute floor(61 - halftime(15)) = 46
    const nowMs = kickoffMs + 61 * 60_000;
    expect(effectiveMatchMinute(kickoffISO, nowMs)).toBe(46);

    // very late: 120 real minutes -> match minute floor(120 - 15) = 105, cap to 90
    const laterMs = kickoffMs + 120 * 60_000;
    expect(effectiveMatchMinute(kickoffISO, laterMs)).toBe(90);
  });

  it('mapMatchMinuteToElapsedMinutes accounts for halftime', () => {
    expect(mapMatchMinuteToElapsedMinutes(30, HALFTIME_MIN)).toBe(30);
    expect(mapMatchMinuteToElapsedMinutes(45, HALFTIME_MIN)).toBe(45);
    expect(mapMatchMinuteToElapsedMinutes(60, HALFTIME_MIN)).toBe(60 + HALFTIME_MIN); // 75 real minutes
    expect(mapMatchMinuteToElapsedMinutes(90, HALFTIME_MIN)).toBe(90 + HALFTIME_MIN); // 105 real minutes
  });

  it('getLiveBin: returns correct bin and start/end minutes in first half', () => {
    const nowMs = kickoffMs + 20 * 60_000; // match minute ~20
    const bin = getLiveBin(kickoffISO, nowMs);
    expect(bin.index).toBe(1);
    expect(bin.startMinute).toBe(15);
    expect(bin.endMinute).toBe(30);
    // bin start wall clock should be kickoff + elapsed for 15' => 15'
    expect(new Date(bin.binStartMs).toISOString()).toBe(new Date(kickoffMs + 15 * 60_000).toISOString());
  });

  it('getLiveBin: halftime collapse keeps bin at 30-45', () => {
    const nowMs = kickoffMs + 50 * 60_000; // during halftime (<= 60)
    const bin = getLiveBin(kickoffISO, nowMs);
    expect(bin.index).toBe(2);
    expect(bin.startMinute).toBe(30);
    expect(bin.endMinute).toBe(45);
  });

  it('getLiveBin: second half bins use 45-60, 60-75, 75-90', () => {
    const nowMs = kickoffMs + 70 * 60_000; // ~55' of match time
    const bin = getLiveBin(kickoffISO, nowMs);
    expect(bin.index).toBe(3);
    expect(bin.startMinute).toBe(45);
    expect(bin.endMinute).toBe(60);

    const laterMs = kickoffMs + 100 * 60_000; // ~85' of match time
    const bin2 = getLiveBin(kickoffISO, laterMs);
    expect(bin2.index).toBe(5);
    expect(bin2.startMinute).toBe(75);
    expect(bin2.endMinute).toBe(90);
  });

  it('pre/post window calculators', () => {
    const preStart = preWindowStartMs(kickoffISO);
    expect(preStart).toBe(kickoffMs - 120 * 60_000);

    const postStartApprox = postWindowStartMs(kickoffISO);
    // by default, post starts at 90 + halftime (15) = 105 minutes
    expect(postStartApprox).toBe(kickoffMs + (90 + HALFTIME_MIN) * 60_000);

    const fwISO = new Date(kickoffMs + 110 * 60_000).toISOString();
    const postStartExact = postWindowStartMs(kickoffISO, fwISO);
    expect(postStartExact).toBe(Date.parse(fwISO));
  });
});
