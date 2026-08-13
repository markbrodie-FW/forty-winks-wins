-- Forty Winks Wins — production schema + RLS
create extension if not exists pgcrypto;

create table if not exists public.wins (
  id uuid primary key default gen_random_uuid(),
  win_text text not null check (char_length(win_text) between 1 and 220),
  person_name text not null check (char_length(person_name) between 1 and 80),
  department text not null check (char_length(department) between 1 and 60),
  win_date date not null,
  status text not null default 'active' check (status in ('active','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wins_win_date_idx on public.wins(win_date desc);
create index if not exists wins_status_idx on public.wins(status);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wins_set_updated_at on public.wins;
create trigger wins_set_updated_at
before update on public.wins
for each row execute function public.set_updated_at();

alter table public.wins enable row level security;

-- This project intentionally uses an open admin page.
-- Anyone with the public site credentials can read, submit, edit, hide/show and delete wins.
-- Keep the admin URL unlinked if you prefer it to remain unobtrusive.

drop policy if exists "Public can read active wins" on public.wins;
drop policy if exists "Authenticated can read all wins" on public.wins;
drop policy if exists "Public can submit wins" on public.wins;
drop policy if exists "Authenticated can insert wins" on public.wins;
drop policy if exists "Authenticated can update wins" on public.wins;
drop policy if exists "Authenticated can delete wins" on public.wins;
drop policy if exists "Public can read all wins" on public.wins;
drop policy if exists "Public can update wins" on public.wins;
drop policy if exists "Public can delete wins" on public.wins;

create policy "Public can read all wins"
on public.wins for select
to anon
using (true);

create policy "Public can submit wins"
on public.wins for insert
to anon
with check (status = 'active');

create policy "Public can update wins"
on public.wins for update
to anon
using (true)
with check (status in ('active','hidden'));

create policy "Public can delete wins"
on public.wins for delete
to anon
using (true);

-- Realtime updates for the display/admin pages.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wins'
  ) then
    alter publication supabase_realtime add table public.wins;
  end if;
end $$;
