import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, request }) => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    throw error(501, 'admin_not_configured');
  }

  const token = request.headers.get('x-admin-token') ?? '';
  if (token !== adminSecret) {
    // Hide route existence from non-admin users
    throw error(404, 'Not found');
  }

  const res = await fetch('/api/accounts/plan', {
    headers: { 'x-admin-token': adminSecret }
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => 'planner_load_failed');
    throw error(res.status, msg || 'planner_load_failed');
  }

  const payload = await res.json();
  return payload;
};
