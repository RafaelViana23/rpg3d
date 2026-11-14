-- Display database timestamps in the project's actual operating timezone.
-- timestamptz values remain absolute instants; only their rendered timezone
-- changes from UTC to America/Sao_Paulo.
do $$
begin
  execute format(
    'alter database %I set timezone to %L',
    current_database(),
    'America/Sao_Paulo'
  );
end
$$;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role', 'authenticator']
  loop
    if exists(select 1 from pg_roles where rolname = role_name) then
      execute format('alter role %I set timezone to %L', role_name, 'America/Sao_Paulo');
    end if;
  end loop;
end
$$;

