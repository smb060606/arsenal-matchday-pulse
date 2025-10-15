export const load = async ({ fetch }) => {
  try {
    const res = await fetch('/api/accounts/plan');
    if (res.ok) {
      const payload = await res.json();
      return payload;
    }
  } catch {
    // ignore and fall through to empty payload
  }
  return {
    generatedAt: new Date().toISOString(),
    budgetPerPlatformDollars: 50,
    platforms: {
      bsky: { platform: 'bsky', status: 'unconfigured', budgetPerMonthDollars: 50, costPerMonthDollars: 0, notes: 'fallback' },
      twitter: { platform: 'twitter', status: 'unconfigured', budgetPerMonthDollars: 50, costPerMonthDollars: null, notes: 'fallback' },
      threads: { platform: 'threads', status: 'unconfigured', budgetPerMonthDollars: 50, costPerMonthDollars: null, notes: 'fallback' }
    }
  };
};
