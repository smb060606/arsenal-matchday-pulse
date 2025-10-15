-- Create comments table for persisted comments
-- Safe to run in Supabase SQL editor if not using CLI migrations

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  match_id text not null,
  platform text not null check (platform in ('bsky','twitter','threads','combined')),
  user_id text null,
  user_handle text null,
  user_display_name text null,
  parent_id uuid null references public.comments(id) on delete set null,
  text text not null check (length(text) >= 1 and length(text) <= 2000),
  status text not null default 'active' check (status in ('active','deleted')),
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_comments_match_created on public.comments(match_id, created_at desc);
create index if not exists idx_comments_status on public.comments(status);
create index if not exists idx_comments_parent on public.comments(parent_id);

-- Enable RLS
alter table public.comments enable row level security;

-- Policies
-- Everyone can select active comments only
do $$
begin
  if not exists (
    select 1 from pg_policies p
    where p.tablename = 'comments' and p.policyname = 'select_active_comments'
  ) then
    create policy select_active_comments
      on public.comments
      for select
      using (status = 'active');
  end if;
end$$;

-- Allow inserts for any authenticated or anon client (backend validates limits)
do $$
begin
  if not exists (
    select 1 from pg_policies p
    where p.tablename = 'comments' and p.policyname = 'insert_comments_open'
  ) then
    create policy insert_comments_open
      on public.comments
      for insert
      with check (status = 'active' and length(text) >= 1 and length(text) <= 2000);
  end if;
end$$;

-- NOTE: No update/delete policies are created. Service Role bypasses RLS for moderation.
-- If you want user-scoped updates later, add appropriate policies keyed by auth.uid().
