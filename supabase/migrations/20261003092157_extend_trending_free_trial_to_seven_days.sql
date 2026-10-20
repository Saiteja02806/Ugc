-- Seven calendar days and seven daily packs, starting at completed onboarding.
-- Extend only currently active trials. Never restart expired trials or reset usage.
alter table public.free_trial_entitlements
  alter column content_days_limit set default 7;

update public.free_trial_entitlements
set expires_at = greatest(expires_at, started_at + interval '7 days'),
    content_days_limit = greatest(content_days_limit, 7),
    updated_at = now()
where expires_at > now()
  and (expires_at < started_at + interval '7 days' or content_days_limit < 7);

create or replace function public.grant_free_trial_on_onboarding_completion()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  if new.onboarding_status <> 'completed'
    or new.onboarding_version < 3
    or new.onboarding_completed_at is null
  then
    return new;
  end if;

  insert into public.free_trial_entitlements (
    user_id,
    started_at,
    expires_at,
    content_days_limit
  )
  values (
    new.user_id,
    new.onboarding_completed_at,
    new.onboarding_completed_at + interval '7 days',
    7
  )
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

-- Retain the latest paid/complimentary access guards, locking and quota checks.
create or replace function public.enforce_free_trial_daily_trending_feed()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  trial public.free_trial_entitlements%rowtype;
  content_days_used integer := 0;
begin
  if exists (
    select 1
    from public.billing_subscriptions as subscription
    where subscription.user_id = new.user_id
      and subscription.status = 'active'
  ) or exists (
    select 1
    from public.complimentary_plan_grants as complimentary
    where complimentary.user_id = new.user_id
      and complimentary.revoked_at is null
      and (complimentary.expires_at is null or complimentary.expires_at > clock_timestamp())
  ) then
    return new;
  end if;

  select * into trial
  from public.free_trial_entitlements
  where user_id = new.user_id
  for update;

  if not found or trial.expires_at <= clock_timestamp() then
    raise exception using
      errcode = 'P0001',
      message = 'free_trial_content_expired',
      detail = 'An active paid subscription is required to create another daily content pack.';
  end if;

  if new.daily_limit > trial.daily_content_pieces then
    raise exception using
      errcode = 'P0001',
      message = 'free_trial_daily_content_limit_exceeded',
      detail = 'Free trials may reserve at most 20 content pieces per daily pack.';
  end if;

  select count(*) into content_days_used
  from public.daily_trending_feeds as feed
  where feed.user_id = new.user_id
    and feed.created_at >= trial.started_at;

  if content_days_used >= trial.content_days_limit then
    raise exception using
      errcode = 'P0001',
      message = 'free_trial_content_days_exhausted',
      detail = 'Free trials may create content packs on only seven days.';
  end if;

  return new;
end;
$function$;

revoke all on function public.grant_free_trial_on_onboarding_completion()
  from public, anon, authenticated;
revoke all on function public.enforce_free_trial_daily_trending_feed()
  from public, anon, authenticated;
grant execute on function public.grant_free_trial_on_onboarding_completion()
  to postgres, service_role;
grant execute on function public.enforce_free_trial_daily_trending_feed()
  to postgres, service_role;

select pg_notify('pgrst', 'reload schema');
