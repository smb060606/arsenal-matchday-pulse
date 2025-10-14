import type { RequestHandler } from '@sveltejs/kit';
import { getAccountsSnapshot } from '$lib/services/bskyService';

export const GET: RequestHandler = async () => {
  try {
    const accounts = await getAccountsSnapshot();
    return new Response(JSON.stringify({
      platform: 'bsky',
      generatedAt: new Date().toISOString(),
      count: accounts.length,
      accounts
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: 'failed_to_list_accounts'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
