-- Free access is a one-time trial.  The database owns the limits so concurrent
-- browser requests, direct API calls, and background workers cannot bypass them.
create table if not exists public.free_trial_entitlements (
  user_id text primary key,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  content_days_limit integer not null default 3
    check (content_days_limit > 0),
  daily_content_pieces integer not null default 10
    check (daily_content_pieces > 0),
  instagram_schedule_limit integer not null default 5
    check (instagram_schedule_limit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > started_at)
);

create table if not exists public.free_trial_instagram_schedule_usage (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.free_trial_entitlements(user_id) on delete restrict,
  scheduled_post_target_id uuid not null unique
    references public.scheduled_post_targets(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists free_trial_instagram_schedule_usage_user_idx
  on public.free_trial_instagram_schedule_usage (user_id, created_at);

alter table public.free_trial_entitlements enable row level security;
alter table public.free_trial_instagram_schedule_usage enable row level security;

revoke all privileges on table public.free_trial_entitlements
  from public, anon, authenticated;
revoke all privileges on table public.free_trial_instagram_schedule_usage
  from public, anon, authenticated;

grant select, insert, update, delete on table public.free_trial_entitlements
  to service_role;
grant select, insert, delete on table public.free_trial_instagram_schedule_usage
  to service_role;

-- Every existing product profile has consumed the former free access. This
-- also prevents an already-created incomplete profile from receiving a fresh
-- trial merely by completing onboarding after this deployment. Existing posts
-- and scheduled targets remain untouched; only future free work is stopped.
insert into public.free_trial_entitlements (
  user_id,
  started_at,
  expires_at,
  content_days_limit,
  daily_content_pieces,
  instagram_schedule_limit
)
select distinct
  profile.user_id,
  now() - interval '3 days',
  now(),
  3,
  10,
  5
from public.business_profiles as profile
on conflict (user_id) do nothing;

create or replace function public.grant_free_trial_on_onboarding_completion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
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
    content_days_limit,
    daily_content_pieces,
    instagram_schedule_limit
  )
  values (
    new.user_id,
    new.onboarding_completed_at,
    new.onboarding_completed_at + interval '3 days',
    3,
    10,
    5
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.grant_free_trial_on_onboarding_completion()
  from public, anon, authenticated;
grant execute on function public.grant_free_trial_on_onboarding_completion()
  to service_role;

drop trigger if exists grant_free_trial_on_onboarding_completion
  on public.business_profiles;

create trigger grant_free_trial_on_onboarding_completion
after insert or update of onboarding_status, onboarding_version, onboarding_completed_at
on public.business_profiles
for each row
execute function public.grant_free_trial_on_onboarding_completion();

create or replace function public.enforce_free_trial_daily_trending_feed()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  trial public.free_trial_entitlements%rowtype;
  content_days_used integer := 0;
begin
  -- Active subscribers are never limited by the free-trial ledger.
  if exists (
    select 1
    from public.billing_subscriptions as subscription
    where subscription.user_id = new.user_id
      and subscription.status = 'active'
  ) then
    return new;
  end if;

  select *
  into trial
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
      detail = 'Free trials may reserve at most 10 content pieces per daily pack.';
  end if;

  select count(*)
  into content_days_used
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
$$;

revoke execute on function public.enforce_free_trial_daily_trending_feed()
  from public, anon, authenticated;
grant execute on function public.enforce_free_trial_daily_trending_feed()
  to service_role;

drop trigger if exists enforce_free_trial_daily_trending_feed
  on public.daily_trending_feeds;

create trigger enforce_free_trial_daily_trending_feed
before insert on public.daily_trending_feeds
for each row
execute function public.enforce_free_trial_daily_trending_feed();

create or replace function public.enforce_free_trial_instagram_schedule_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  trial public.free_trial_entitlements%rowtype;
  scheduled_post_count integer := 0;
begin
  if new.platform <> 'instagram' then
    return new;
  end if;

  -- Paid accounts retain their existing scheduling entitlement.
  if exists (
    select 1
    from public.billing_subscriptions as subscription
    where subscription.user_id = new.user_id
      and subscription.status = 'active'
  ) then
    return new;
  end if;

  -- Serialise free scheduling per user. This makes the five-post cap safe
  -- when multiple schedule requests arrive simultaneously.
  select *
  into trial
  from public.free_trial_entitlements
  where user_id = new.user_id
  for update;

  if not found or trial.expires_at <= clock_timestamp() then
    raise exception using
      errcode = 'P0001',
      message = 'free_trial_schedule_expired',
      detail = 'Your free trial has ended. Upgrade to schedule another Instagram post.';
  end if;

  select count(*)
  into scheduled_post_count
  from public.free_trial_instagram_schedule_usage as usage
  where usage.user_id = new.user_id;

  if scheduled_post_count >= trial.instagram_schedule_limit then
    raise exception using
      errcode = 'P0001',
      message = 'free_trial_schedule_limit_reached',
      detail = 'Free trials may schedule up to five Instagram posts in total, including future dates.';
  end if;

  insert into public.free_trial_instagram_schedule_usage (
    user_id,
    scheduled_post_target_id
  )
  values (new.user_id, new.id);

  return new;
end;
$$;

revoke execute on function public.enforce_free_trial_instagram_schedule_limit()
  from public, anon, authenticated;
grant execute on function public.enforce_free_trial_instagram_schedule_limit()
  to service_role;

drop trigger if exists enforce_free_trial_instagram_schedule_limit
  on public.scheduled_post_targets;

create trigger enforce_free_trial_instagram_schedule_limit
after insert on public.scheduled_post_targets
for each row
execute function public.enforce_free_trial_instagram_schedule_limit();

select pg_notify('pgrst', 'reload schema');
