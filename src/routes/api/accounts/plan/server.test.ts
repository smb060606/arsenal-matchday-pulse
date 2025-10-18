import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET } from './+server';
import { createMockRequest, createMockUrl } from '../../../../test/utils';
import * as budget from '$lib/config/budget';
import * as overrides from '$lib/services/accountOverrides';
import * as bskySvc from '$lib/services/bskyService';
import * as twSvc from '$lib/services/twitterService';

// Mock admin secret
const OLD_ENV = process.env;
describe('/api/accounts/plan/+server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV, ADMIN_SECRET: 'secret' };
  });
  afterEach(() => {
    process.env = OLD_ENV;
    vi.restoreAllMocks();
  });

  it('returns planner payload including Twitter section shape when configured', async () => {
    // Configure budget to mark twitter as ok
    vi.spyOn(budget, 'getPlatformCostConfig').mockImplementation((platform: any) => {
      if (platform === 'bsky') {
        return { platform: 'bsky', costPerMonthDollars: 0, status: 'ok', notes: 'ok' } as any;
      }
      if (platform === 'twitter') {
        return { platform: 'twitter', costPerMonthDollars: 10, status: 'ok', notes: 'ok' } as any;
      }
      return { platform: 'threads', costPerMonthDollars: null, status: 'unconfigured', notes: 'off' } as any;
    });
    vi.spyOn(budget, 'estimateMaxAccounts').mockImplementation((p: any) => {
      if (p === 'twitter') {
        return {
          maxAccounts: 2,
          rationale: {
            budget: 50,
            costPer1k: 1,
            requestsPerAccPerMin: 1,
            matchesPerMonth: 8,
            minutesPerMatch: 285,
            monthlyReqsPerAcc: 285 * 8,
            monthlyCostPerAcc: 2.5,
            buffer: 1.2
          }
        } as any;
      }
      return null;
    });

    // Mock overrides empty
    vi.spyOn(overrides, 'getOverrides').mockResolvedValue({ include: [], exclude: [] });

    // Mock bsky snapshot minimal
    vi.spyOn(bskySvc, 'getAccountsSnapshot').mockResolvedValue([
      { did: 'did:test', handle: 'test.bsky.social', eligibility: { eligible: true, reasons: [] } }
    ] as any);

    // Mock twitter snapshot minimal
    vi.spyOn(twSvc, 'getAccountsSnapshot').mockResolvedValue([
      { user_id: '1', handle: 'handle1', eligibility: { eligible: true, reasons: [] } }
    ] as any);

    const url = createMockUrl('/api/accounts/plan');
    const req = createMockRequest(url, { headers: { 'x-admin-token': 'secret' } });

    const res = await GET({ request: req } as any);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.platforms).toBeDefined();
    expect(json.platforms.twitter).toBeDefined();
    expect(json.platforms.twitter.status).toBe('ok');
    expect(json.platforms.twitter.selected?.length).toBeGreaterThanOrEqual(1);
    const first = json.platforms.twitter.selected[0];
    expect(first).toHaveProperty('handle');
    expect(first).toHaveProperty('eligibility');
    expect(json.platforms.twitter.maxAccountsAllowed).toBeGreaterThanOrEqual(1);
    expect(json.platforms.twitter.capRationale).toBeDefined();
  });

  it('returns 404 when ADMIN_SECRET mismatch', async () => {
    const url = createMockUrl('/api/accounts/plan');
    const req = createMockRequest(url, { headers: { 'x-admin-token': 'wrong' } });
    const res = await GET({ request: req } as any);
    expect(res.status).toBe(404);
  });
});
