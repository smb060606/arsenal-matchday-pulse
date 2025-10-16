-- Enable pgcrypto for gen_random_uuid if not already enabled
create extension if not exists pgcrypto;

-- Table: account_overrides
create table if not exists public.account_overrides (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('bsky','twitter','threads')),
  identifier_type text not null check (identifier_type in ('did','handle','user_id')),
  identifier text not null,
  handle text null, -- optional convenience/UX
  action text not null check (action in ('include','exclude')),
  scope text not null default 'global' check (scope in ('global','match')),
  match_id text null,
  bypass_eligibility boolean not null default true,
  notes text null,
  expires_at timestamptz null default (now() + interval '30 days'),
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique index across platform/identifier and match scope (global vs per-match)
-- Use expression index to treat null match_id as '' for uniqueness
create unique index if not exists account_overrides_unique_key
  on public.account_overrides (platform, identifier, (coalesce(match_id, '')));

-- Helpful indexes
create index if not exists account_overrides_platform_scope_match_action_idx
  on public.account_overrides (platform, scope, match_id, action);

create index if not exists account_overrides_expires_at_idx
  on public.account_overrides (expires_at);

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

drop trigger if exists trg_account_overrides_updated on public.account_overrides;
create trigger trg_account_overrides_updated
before update on public.account_overrides
for each row execute function public.set_updated_at();
