import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Not configured yet; return null so callers can no-op or throw a friendly error
    return null;
  }

  if (!supabase) {
    supabase = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
  }
  return supabase;
}
