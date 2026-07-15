alter table public.background_jobs
  add column if not exists claim_token uuid;

create index if not exists background_jobs_processing_heartbeat_idx
  on public.background_jobs (last_heartbeat_at)
  where status = 'processing';

create or replace function public.claim_background_job(
  p_job_id uuid,
  p_worker_id text,
  p_claim_token uuid,
  p_stale_after_seconds integer
)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_stale_after_seconds integer := greatest(
    30,
    least(coalesce(p_stale_after_seconds, 600), 43200)
  );
begin
  if p_worker_id is null or char_length(trim(p_worker_id)) = 0 then
    raise exception 'worker id is required';
  end if;

  if p_claim_token is null then
    raise exception 'claim token is required';
  end if;

  return query
  update public.background_jobs as job
  set
    claim_token = p_claim_token,
    last_heartbeat_at = v_now,
    locked_at = v_now,
    started_at = coalesce(job.started_at, v_now),
    status = 'processing',
    updated_at = v_now,
    worker_id = left(trim(p_worker_id), 255)
  where job.id = p_job_id
    and (
      job.status = 'queued'
      or (
        job.status = 'processing'
        and coalesce(
          job.last_heartbeat_at,
          job.locked_at,
          job.updated_at
        ) < v_now - make_interval(secs => v_stale_after_seconds)
      )
    )
  returning job.*;
end;
$$;

revoke all on function public.claim_background_job(uuid, text, uuid, integer)
  from public;
revoke all on function public.claim_background_job(uuid, text, uuid, integer)
  from anon;
revoke all on function public.claim_background_job(uuid, text, uuid, integer)
  from authenticated;
grant execute on function public.claim_background_job(uuid, text, uuid, integer)
  to service_role;

create table if not exists public.social_publish_operations (
  id uuid primary key default gen_random_uuid(),
  scheduled_post_target_id uuid not null unique
    references public.scheduled_post_targets(id) on delete cascade,
  user_id text not null,
  platform text not null
    check (platform in ('instagram', 'tiktok', 'youtube')),
  idempotency_key text not null unique
    check (
      char_length(trim(idempotency_key)) > 0
      and char_length(idempotency_key) <= 200
    ),

  status text not null default 'pending'
    check (status in ('pending', 'initialized', 'published')),
  provider_operation_kind text
    check (
      provider_operation_kind is null
      or provider_operation_kind in (
        'instagram_container',
        'tiktok_publish',
        'youtube_resumable_upload'
      )
    ),
  provider_operation_id text
    check (
      provider_operation_id is null
      or char_length(provider_operation_id) <= 4096
    ),
  platform_post_id text,
  platform_post_url text
    check (platform_post_url is null or platform_post_url ~ '^https?://'),

  active_job_id uuid references public.background_jobs(id) on delete restrict,
  active_claim_token uuid,
  claimed_at timestamptz,
  last_error_code text,
  last_error_message text
    check (last_error_message is null or char_length(last_error_message) <= 500),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),

  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    (provider_operation_kind is null and provider_operation_id is null)
    or
    (provider_operation_kind is not null and provider_operation_id is not null)
  ),
  check (
    (active_job_id is null and active_claim_token is null)
    or
    (active_job_id is not null and active_claim_token is not null)
  ),
  check (status <> 'initialized' or provider_operation_id is not null),
  check (status <> 'published' or platform_post_id is not null)
);

create index if not exists social_publish_operations_user_updated_idx
  on public.social_publish_operations (user_id, updated_at desc);

create index if not exists social_publish_operations_active_job_idx
  on public.social_publish_operations (active_job_id)
  where active_job_id is not null;

alter table public.social_publish_operations enable row level security;

revoke all privileges on table public.social_publish_operations
  from anon, authenticated;

grant select, insert, update on table public.social_publish_operations
  to service_role;

create or replace function public.claim_social_publish_operation(
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
  v_now timestamptz := now();
  v_stale_after_seconds integer := greatest(
    30,
    least(coalesce(p_stale_after_seconds, 900), 43200)
  );
begin
  insert into public.social_publish_operations (
    idempotency_key,
    platform,
    scheduled_post_target_id,
    user_id
  )
  select
    'social-publish:' || target.id::text || ':v1',
    target.platform,
    target.id,
    target.user_id
  from public.scheduled_post_targets as target
  where target.id = p_target_id
    and target.user_id = p_user_id
    and target.platform = p_platform
  on conflict (scheduled_post_target_id) do nothing;

  return query
  update public.social_publish_operations as operation
  set
    active_claim_token = p_claim_token,
    active_job_id = p_job_id,
    claimed_at = v_now,
    last_error_code = null,
    last_error_message = null,
    updated_at = v_now
  where operation.scheduled_post_target_id = p_target_id
    and operation.user_id = p_user_id
    and operation.platform = p_platform
    and operation.status <> 'published'
    and exists (
      select 1
      from public.background_jobs as requested_job
      where requested_job.id = p_job_id
        and requested_job.user_id = p_user_id
        and requested_job.job_type = 'publish_social_post'
        and requested_job.status = 'processing'
        and requested_job.claim_token = p_claim_token
        and requested_job.input_json ->> 'targetId' = p_target_id::text
    )
    and (
      operation.active_claim_token is null
      or (
        operation.active_job_id = p_job_id
        and operation.active_claim_token = p_claim_token
      )
      or not exists (
        select 1
        from public.background_jobs as active_job
        where active_job.id = operation.active_job_id
          and active_job.status = 'processing'
          and active_job.claim_token = operation.active_claim_token
          and coalesce(
            active_job.last_heartbeat_at,
            active_job.locked_at,
            active_job.updated_at
          ) >= v_now - make_interval(secs => v_stale_after_seconds)
      )
    )
  returning operation.*;
end;
$$;

revoke all on function public.claim_social_publish_operation(
  uuid,
  text,
  text,
  uuid,
  uuid,
  integer
) from public;
revoke all on function public.claim_social_publish_operation(
  uuid,
  text,
  text,
  uuid,
  uuid,
  integer
) from anon;
revoke all on function public.claim_social_publish_operation(
  uuid,
  text,
  text,
  uuid,
  uuid,
  integer
) from authenticated;
grant execute on function public.claim_social_publish_operation(
  uuid,
  text,
  text,
  uuid,
  uuid,
  integer
) to service_role;

select pg_notify('pgrst', 'reload schema');
