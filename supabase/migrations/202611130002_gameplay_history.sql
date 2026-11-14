-- Reuse the original immutable-save table as the gameplay timeline.
-- Existing rows are preserved as legacy snapshots.
alter table public.game_saves
  alter column user_id drop not null,
  add column if not exists slot text not null default 'main',
  add column if not exists event_type text not null default 'legacy_snapshot',
  add column if not exists event_data jsonb not null default '{}'::jsonb;

alter table public.game_saves
  add constraint game_saves_event_type_check
  check (event_type in ('legacy_snapshot','game_started','gameplay_checkpoint','level_up','quest_completed'));

create index if not exists game_saves_slot_date
  on public.game_saves(slot, created_at desc);

create index if not exists game_saves_slot_event_date
  on public.game_saves(slot, event_type, created_at desc);

