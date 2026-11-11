-- Single-player world, accessed only by the trusted game server.
create table public.rpg_world_saves (
  slot text primary key,
  revision bigint not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.rpg_world_history (
  slot text not null,
  revision bigint not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (slot, revision)
);
alter table public.rpg_world_saves enable row level security;
alter table public.rpg_world_history enable row level security;
revoke all on public.rpg_world_saves, public.rpg_world_history from anon, authenticated;
grant all on public.rpg_world_saves, public.rpg_world_history to service_role;

create function public.write_rpg_world(p_slot text, p_expected bigint, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  previous public.rpg_world_saves%rowtype;
  next_revision bigint;
  stamp timestamptz := now();
begin
  if p_slot <> 'main' or p_expected < 0 or p_payload->>'version' is distinct from '1'
    or jsonb_typeof(p_payload->'entries') is distinct from 'object' then
    raise exception 'Invalid save' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('rpg3d-save-' || p_slot));
  select * into previous from public.rpg_world_saves where slot = p_slot;
  if coalesce(previous.revision, 0) <> p_expected then
    raise exception 'Save changed in another session' using errcode = '40001';
  end if;
  next_revision := p_expected + 1;
  insert into public.rpg_world_saves(slot, revision, payload, updated_at)
    values(p_slot, next_revision, p_payload, stamp)
    on conflict(slot) do update set revision = excluded.revision, payload = excluded.payload, updated_at = excluded.updated_at;
  -- Keep every map edit; checkpoint runtime changes at most every five minutes.
  if previous.revision is null
    or previous.payload->'entries'->>'rpg3d.worldBuilder.v1' is distinct from p_payload->'entries'->>'rpg3d.worldBuilder.v1'
    or not exists(select 1 from public.rpg_world_history where slot = p_slot and created_at > stamp - interval '5 minutes') then
    insert into public.rpg_world_history(slot, revision, payload) values(p_slot, next_revision, p_payload);
  end if;
  return jsonb_build_object('revision', next_revision, 'updatedAt', stamp);
end;
$$;
revoke all on function public.write_rpg_world(text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.write_rpg_world(text, bigint, jsonb) to service_role;
