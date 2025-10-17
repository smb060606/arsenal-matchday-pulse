
import { getAccountsSnapshot } from '$lib/services/bskyService';

export const load = async ({ params }: { params: { platform: string } }) => {
  const platform = params.platform;

  // For tests and SSR, query services directly rather than hitting our API route.
  if (platform === 'bsky') {
    try {
      const accounts = await getAccountsSnapshot();
      return {
        platform,
        generatedAt: new Date().toISOString(),
        count: accounts.length,
        accounts
      };
    } catch {
      // Fall through to empty payload on service error
    }
  }

  // For unsupported platforms or on error, return empty structure
  return {
    platform,
    generatedAt: new Date().toISOString(),
    count: 0,
    accounts: []
  };
};
