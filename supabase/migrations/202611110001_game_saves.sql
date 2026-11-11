-- Immutable snapshots: uploads never overwrite another save.
create table public.game_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'version' = '1'),
  created_at timestamptz not null default now()
);
create index game_saves_owner_date on public.game_saves(user_id, created_at desc);
alter table public.game_saves enable row level security;
revoke all on public.game_saves from anon, authenticated;
grant select, insert on public.game_saves to authenticated;
create policy "Read own saves" on public.game_saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own saves" on public.game_saves for insert to authenticated with check ((select auth.uid()) = user_id);
