-- Enable pgcrypto for gen_random_uuid if not already enabled
create extension if not exists pgcrypto;

-- Table: accounts_registry
-- Caches canonical identifiers and health metrics used for selection and 30-day re-evaluation.
create table if not exists public.accounts_registry (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('bsky','twitter','threads')),
  -- Canonical identity (prefer stable ID over handle)
  did text null,           -- Bluesky DID when platform='bsky'
  user_id text null,       -- Twitter user id when platform='twitter'
  handle text null,        -- Optional convenience for display and resolution
  -- Metrics
  followers_count integer null,
  posts_count integer null,
  account_created_at timestamptz null,
  last_checked_at timestamptz null,
  stale boolean not null default false,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Uniqueness: one row per platform + canonical identifier
  constraint accounts_registry_unique_identity
    unique (platform, coalesce(did, ''), coalesce(user_id, ''), coalesce(handle, ''))
);

-- Helpful indexes
create index if not exists accounts_registry_platform_idx
  on public.accounts_registry (platform);

create index if not exists accounts_registry_stale_idx
  on public.accounts_registry (stale);

create index if not exists accounts_registry_last_checked_idx
  on public.accounts_registry (last_checked_at);

-- Trigger to maintain updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_accounts_registry_updated on public.accounts_registry;
create trigger trg_accounts_registry_updated
before update on public.accounts_registry
for each row execute function public.set_updated_at();
