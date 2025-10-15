import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase admin client.
 * Uses the SERVICE ROLE key for privileged operations (bypasses RLS).
 * NEVER expose this key to the browser.
 */
let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    // Not configured: return null so callers can fallback (anon client or in-memory)
    return null;
  }

  if (!adminClient) {
    adminClient = createClient(url, serviceRole, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          'X-Client-Info': 'arsenal-matchday-pulse/server-admin'
        }
      }
    });
  }
  return adminClient;
}
