-- A publish operation is idempotent per target. This extra lane protects the
-- provider account itself: different posts cannot publish concurrently to the
-- same connected Instagram/TikTok/YouTube account.
create table if not exists public.social_publish_account_lanes (
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube')),
  social_connection_id uuid not null
    references public.social_connections(id) on delete cascade,
  active_job_id uuid references public.background_jobs(id) on delete restrict,
  active_claim_token uuid,
  claimed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (platform, social_connection_id),
  check (
    (active_job_id is null and active_claim_token is null and claimed_at is null)
    or (active_job_id is not null and active_claim_token is not null and claimed_at is not null)
  )
);

alter table public.social_publish_account_lanes enable row level security;
revoke all privileges on table public.social_publish_account_lanes from anon, authenticated;
grant select, insert, update on table public.social_publish_account_lanes to service_role;

create or replace function public.claim_social_publish_operation_with_account_lane(
  p_target_id uuid,
  p_user_id text,
  p_platform text,
  p_job_id uuid,
  p_claim_token uuid,
  p_stale_after_seconds integer
)
returns setof public.social_publish_operations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_connection_id uuid;
  v_lane public.social_publish_account_lanes%rowtype;
  v_operation public.social_publish_operations%rowtype;
  v_now timestamptz := now();
  v_stale_after_seconds integer := greatest(
    30,
    least(coalesce(p_stale_after_seconds, 900), 43200)
  );
begin
  if p_claim_token is null then
    raise exception 'publish claim token is required';
  end if;

  select target.social_connection_id
  into v_connection_id
  from public.scheduled_post_targets as target
  where target.id = p_target_id
    and target.user_id = p_user_id
    and target.platform = p_platform;

  if not found then
    return;
  end if;

  if not exists (
    select 1
    from public.background_jobs as requested_job
    where requested_job.id = p_job_id
      and requested_job.user_id = p_user_id
      and requested_job.job_type = 'publish_social_post'
      and requested_job.status = 'processing'
      and requested_job.claim_token = p_claim_token
      and requested_job.input_json ->> 'targetId' = p_target_id::text
  ) then
    return;
  end if;

  -- Lock a stable account key before insert/update so two first-time publishes
  -- to the same account cannot both create an active lane.
  perform pg_advisory_xact_lock(hashtextextended(p_platform || ':' || v_connection_id::text, 0));

  insert into public.social_publish_account_lanes (platform, social_connection_id)
  values (p_platform, v_connection_id)
  on conflict (platform, social_connection_id) do nothing;

  select lane.*
  into v_lane
  from public.social_publish_account_lanes as lane
  where lane.platform = p_platform
    and lane.social_connection_id = v_connection_id
  for update;

  if v_lane.active_job_id is not null
    and not (
      v_lane.active_job_id = p_job_id
      and v_lane.active_claim_token = p_claim_token
    )
    and exists (
      select 1
      from public.background_jobs as active_job
      where active_job.id = v_lane.active_job_id
        and active_job.status = 'processing'
        and active_job.claim_token = v_lane.active_claim_token
        and coalesce(
          active_job.last_heartbeat_at,
          active_job.locked_at,
          active_job.updated_at
        ) >= v_now - make_interval(secs => v_stale_after_seconds)
    ) then
    return;
  end if;

  update public.social_publish_account_lanes as lane
  set
    active_job_id = p_job_id,
    active_claim_token = p_claim_token,
    claimed_at = v_now,
    updated_at = v_now
  where lane.platform = p_platform
    and lane.social_connection_id = v_connection_id;

  select operation.*
  into v_operation
  from public.claim_social_publish_operation(
    p_target_id,
    p_user_id,
    p_platform,
    p_job_id,
    p_claim_token,
    p_stale_after_seconds
  ) as operation
  limit 1;

  if not found then
    update public.social_publish_account_lanes as lane
    set
      active_job_id = null,
      active_claim_token = null,
      claimed_at = null,
      updated_at = v_now
    where lane.platform = p_platform
      and lane.social_connection_id = v_connection_id
      and lane.active_job_id = p_job_id
      and lane.active_claim_token = p_claim_token;
    return;
  end if;

  return next v_operation;
end;
$$;

create or replace function public.release_social_publish_account_lane_on_operation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_connection_id uuid;
begin
  if old.active_job_id is null or old.active_claim_token is null then
    return new;
  end if;

  if new.active_job_id is not distinct from old.active_job_id
    and new.active_claim_token is not distinct from old.active_claim_token then
    return new;
  end if;

  select target.social_connection_id
  into v_connection_id
  from public.scheduled_post_targets as target
  where target.id = old.scheduled_post_target_id;

  if found then
    update public.social_publish_account_lanes as lane
    set
      active_job_id = null,
      active_claim_token = null,
      claimed_at = null,
      updated_at = now()
    where lane.platform = old.platform
      and lane.social_connection_id = v_connection_id
      and lane.active_job_id = old.active_job_id
      and lane.active_claim_token = old.active_claim_token;
  end if;

  return new;
end;
$$;

drop trigger if exists release_social_publish_account_lane_on_operation_change
  on public.social_publish_operations;
create trigger release_social_publish_account_lane_on_operation_change
after update of active_job_id, active_claim_token on public.social_publish_operations
for each row
execute function public.release_social_publish_account_lane_on_operation_change();

revoke all on function public.claim_social_publish_operation_with_account_lane(
  uuid, text, text, uuid, uuid, integer
) from public, anon, authenticated;
grant execute on function public.claim_social_publish_operation_with_account_lane(
  uuid, text, text, uuid, uuid, integer
) to service_role;
