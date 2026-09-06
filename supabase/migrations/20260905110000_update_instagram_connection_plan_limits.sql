-- Keep the database guard aligned with the application entitlement policy.
-- This guard is authoritative because a plan can change while an OAuth flow is
-- in progress, after the pre-authorization application check has completed.
create or replace function public.enforce_instagram_connection_limit()
  returns trigger
  language plpgsql
  set search_path to ''
as $function$
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
      and old.user_id = new.user_id then
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
    account_limit := 5;
  elsif exists (
    select 1
    from public.billing_subscriptions
    where user_id = new.user_id
      and plan_key = 'starter'
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
$function$;

drop trigger if exists enforce_instagram_connection_limit
  on public.social_connections;
create trigger enforce_instagram_connection_limit
  before insert or update of user_id, platform, revoked_at on public.social_connections
  for each row
  execute function public.enforce_instagram_connection_limit();

revoke execute on function public.enforce_instagram_connection_limit()
  from public, anon, authenticated;
grant execute on function public.enforce_instagram_connection_limit()
  to postgres, service_role;

select pg_notify('pgrst', 'reload schema');
