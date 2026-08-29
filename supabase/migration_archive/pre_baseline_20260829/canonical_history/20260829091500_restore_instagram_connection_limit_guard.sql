-- Production schema audit found that the original migration version is present
-- in history but its guard function and trigger are absent. Restore the guard
-- under a new forward-only version; this does not modify existing connections.
create or replace function public.enforce_instagram_connection_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  account_limit integer := 1;
  active_connection_count integer := 0;
begin
  if new.platform <> 'instagram' or new.revoked_at is not null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.platform = 'instagram'
      and old.revoked_at is null
      and old.user_id = new.user_id
    then
      return new;
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instagram-connections:' || new.user_id, 0)
  );

  if exists (
    select 1
    from public.billing_subscriptions
    where user_id = new.user_id
      and plan_key = 'growth'
      and status = 'active'
  ) then
    account_limit := 3;
  end if;

  select count(*)
  into active_connection_count
  from public.social_connections
  where user_id = new.user_id
    and platform = 'instagram'
    and revoked_at is null
    and id <> new.id;

  if active_connection_count >= account_limit then
    raise exception using
      errcode = 'P0001',
      message = 'instagram_account_limit_reached',
      detail = pg_catalog.format(
        'The current plan supports %s active Instagram account(s).',
        account_limit
      );
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_instagram_connection_limit()
  from public, anon, authenticated;
grant execute on function public.enforce_instagram_connection_limit()
  to service_role;

drop trigger if exists enforce_instagram_connection_limit
  on public.social_connections;

create trigger enforce_instagram_connection_limit
before insert or update of user_id, platform, revoked_at
on public.social_connections
for each row
execute function public.enforce_instagram_connection_limit();

select pg_notify('pgrst', 'reload schema');
