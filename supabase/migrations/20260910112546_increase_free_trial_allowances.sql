-- Free trials now receive twenty daily content pieces for three days.
-- A NULL scheduling limit means unlimited scheduling while the trial is active.
-- Keep the usage table and trigger so a future positive cap can be restored.
alter table public.free_trial_entitlements
  alter column daily_content_pieces set default 20,
  alter column instagram_schedule_limit drop not null,
  alter column instagram_schedule_limit set default null;

update public.free_trial_entitlements
set daily_content_pieces = 20,
    instagram_schedule_limit = null;

update public.subscription_entitlements
set daily_trending_limit = 20
where plan_key = 'free';

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
    new.onboarding_completed_at + interval '3 days',
    3
  )
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

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
      detail = 'Free trials may create content packs on only three days.';
  end if;

  return new;
end;
$function$;

create or replace function public.enforce_free_trial_instagram_schedule_limit()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  trial public.free_trial_entitlements%rowtype;
  scheduled_post_count integer := 0;
begin
  if new.platform <> 'instagram' then
    return new;
  end if;

  if exists (
    select 1
    from public.billing_subscriptions as subscription
    where subscription.user_id = new.user_id
      and subscription.status = 'active'
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
      message = 'free_trial_schedule_expired',
      detail = 'Your free trial has ended. Upgrade to schedule another Instagram post.';
  end if;

  select count(*) into scheduled_post_count
  from public.free_trial_instagram_schedule_usage as usage
  where usage.user_id = new.user_id;

  if trial.instagram_schedule_limit is not null
    and scheduled_post_count >= trial.instagram_schedule_limit
  then
    raise exception using
      errcode = 'P0001',
      message = 'free_trial_schedule_limit_reached',
      detail = 'Free trials may schedule up to the configured Instagram post limit.';
  end if;

  insert into public.free_trial_instagram_schedule_usage (
    user_id,
    scheduled_post_target_id
  )
  values (new.user_id, new.id);

  return new;
end;
$function$;
