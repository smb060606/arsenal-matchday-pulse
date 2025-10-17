-- Create table to persist per-phase match summaries for transparency/blog posts
create table if not exists public.match_summaries (
  id uuid primary key default gen_random_uuid(),
  match_id text not null,
  platform text not null check (platform in ('bsky', 'twitter', 'threads')),
  phase text not null check (phase in ('pre', 'live', 'post')),
  generated_at timestamptz not null,
  summary_text text not null,
  sentiment jsonb not null,
  topics jsonb not null,
  samples jsonb not null,
  accounts_used jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_match_summaries_match_platform_phase
  on public.match_summaries(match_id, platform, phase);

-- RLS policy scaffolding: table is read-only to anon, write via service role (admin API)
alter table public.match_summaries enable row level security;

do $$
begin
  -- Allow anon read
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'match_summaries' and policyname = 'match_summaries_select_anon'
  ) then
    create policy match_summaries_select_anon on public.match_summaries
      for select
      to anon, authenticated
      using (true);
  end if;

  -- No insert/update/delete for anon; admin API uses service key
end$$;
