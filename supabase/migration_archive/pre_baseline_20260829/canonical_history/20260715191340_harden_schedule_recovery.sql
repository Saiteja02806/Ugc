alter table public.background_jobs
  add column if not exists next_attempt_at timestamptz;

alter table public.scheduled_post_targets
  add column if not exists publish_job_id uuid
    references public.background_jobs(id) on delete set null,
  add column if not exists next_retry_at timestamptz,
  add column if not exists scheduler_deleted_at timestamptz,
  add column if not exists last_reconciled_at timestamptz;

create index if not exists background_jobs_social_retry_due_idx
  on public.background_jobs (next_attempt_at, created_at)
  where job_type = 'publish_social_post' and status = 'queued';

create index if not exists scheduled_post_targets_publish_job_idx
  on public.scheduled_post_targets (publish_job_id)
  where publish_job_id is not null;

create index if not exists scheduled_post_targets_recovery_due_idx
  on public.scheduled_post_targets (scheduled_for, publish_job_id)
  where
    publish_job_id is not null
    and status in ('scheduling', 'scheduled', 'publishing');

create index if not exists scheduled_post_targets_scheduler_cleanup_idx
  on public.scheduled_post_targets (updated_at)
  where
    status = 'cancelled'
    and scheduler_schedule_name is not null
    and scheduler_deleted_at is null;

update public.scheduled_post_targets as target
set publish_job_id = (
  select job.id
  from public.background_jobs as job
  where job.job_type = 'publish_social_post'
    and job.user_id = target.user_id
    and job.input_json ->> 'targetId' = target.id::text
  order by job.created_at desc
  limit 1
)
where target.publish_job_id is null
  and exists (
    select 1
    from public.background_jobs as job
    where job.job_type = 'publish_social_post'
      and job.user_id = target.user_id
      and job.input_json ->> 'targetId' = target.id::text
  );

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
    completed_at = null,
    last_heartbeat_at = v_now,
    locked_at = v_now,
    next_attempt_at = null,
    started_at = coalesce(job.started_at, v_now),
    status = 'processing',
    updated_at = v_now,
    worker_id = left(trim(p_worker_id), 255)
  where job.id = p_job_id
    and (
      (
        job.status = 'queued'
        and (job.next_attempt_at is null or job.next_attempt_at <= v_now)
      )
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
  v_operation_id uuid;
  v_post_id uuid;
  v_post_status text;
  v_stale_after_seconds integer := greatest(
    30,
    least(coalesce(p_stale_after_seconds, 900), 43200)
  );
  v_target_status text;
begin
  select target.scheduled_post_id
  into v_post_id
  from public.scheduled_post_targets as target
  where target.id = p_target_id
    and target.user_id = p_user_id
    and target.platform = p_platform;

  if not found then
    return;
  end if;

  select post.status
  into v_post_status
  from public.scheduled_posts as post
  where post.id = v_post_id
    and post.user_id = p_user_id
  for update;

  if not found or v_post_status in ('cancelled', 'published') then
    return;
  end if;

  select target.status
  into v_target_status
  from public.scheduled_post_targets as target
  where target.id = p_target_id
    and target.user_id = p_user_id
    and target.platform = p_platform
  for update;

  if not found
    or v_target_status not in ('scheduling', 'scheduled', 'publishing') then
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

  insert into public.social_publish_operations (
    idempotency_key,
    platform,
    scheduled_post_target_id,
    user_id
  ) values (
    'social-publish:' || p_target_id::text || ':v1',
    p_platform,
    p_target_id,
    p_user_id
  )
  on conflict (scheduled_post_target_id) do nothing;

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
  returning operation.id into v_operation_id;

  if v_operation_id is null then
    return;
  end if;

  update public.scheduled_post_targets as target
  set
    attempt_count = target.attempt_count + 1,
    last_error_code = null,
    last_error_message = null,
    next_retry_at = null,
    status = 'publishing',
    updated_at = v_now
  where target.id = p_target_id
    and target.user_id = p_user_id;

  update public.scheduled_posts as post
  set
    last_error_code = null,
    status = 'publishing',
    updated_at = v_now
  where post.id = v_post_id
    and post.user_id = p_user_id;

  return query
  select operation.*
  from public.social_publish_operations as operation
  where operation.id = v_operation_id;
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

create or replace function public.cancel_scheduled_post(
  p_post_id uuid,
  p_user_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_post_status text;
begin
  select post.status
  into v_post_status
  from public.scheduled_posts as post
  where post.id = p_post_id
    and post.user_id = p_user_id
  for update;

  if not found then
    return 'not_found';
  end if;

  perform target.id
  from public.scheduled_post_targets as target
  where target.scheduled_post_id = p_post_id
    and target.user_id = p_user_id
  order by target.id
  for update;

  if v_post_status = 'published'
    or exists (
      select 1
      from public.scheduled_post_targets as target
      where target.scheduled_post_id = p_post_id
        and target.user_id = p_user_id
        and target.status = 'published'
    )
    or exists (
      select 1
      from public.social_publish_operations as operation
      join public.scheduled_post_targets as target
        on target.id = operation.scheduled_post_target_id
      where target.scheduled_post_id = p_post_id
        and target.user_id = p_user_id
        and (
          operation.active_claim_token is not null
          or operation.status = 'published'
        )
    ) then
    return 'too_late';
  end if;

  update public.scheduled_posts as post
  set
    cancelled_at = v_now,
    last_error_code = null,
    status = 'cancelled',
    updated_at = v_now
  where post.id = p_post_id
    and post.user_id = p_user_id;

  update public.scheduled_post_targets as target
  set
    cancelled_at = v_now,
    next_retry_at = null,
    status = 'cancelled',
    updated_at = v_now
  where target.scheduled_post_id = p_post_id
    and target.user_id = p_user_id
    and target.status in (
      'draft',
      'scheduling',
      'scheduled',
      'publishing',
      'failed'
    );

  update public.background_jobs as job
  set
    claim_token = null,
    completed_at = v_now,
    next_attempt_at = null,
    status = 'cancelled',
    updated_at = v_now
  where job.status in ('queued', 'processing')
    and exists (
      select 1
      from public.scheduled_post_targets as target
      where target.scheduled_post_id = p_post_id
        and target.user_id = p_user_id
        and target.publish_job_id = job.id
    );

  return 'cancelled';
end;
$$;

revoke all on function public.cancel_scheduled_post(uuid, text) from public;
revoke all on function public.cancel_scheduled_post(uuid, text) from anon;
revoke all on function public.cancel_scheduled_post(uuid, text)
  from authenticated;
grant execute on function public.cancel_scheduled_post(uuid, text)
  to service_role;

create or replace function public.list_due_social_publish_jobs(
  p_limit integer,
  p_stale_after_seconds integer
)
returns table(job_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select job.id as job_id
  from public.scheduled_post_targets as target
  join public.scheduled_posts as post
    on post.id = target.scheduled_post_id
    and post.user_id = target.user_id
  join public.background_jobs as job
    on job.id = target.publish_job_id
    and job.user_id = target.user_id
  where target.status in ('scheduling', 'scheduled', 'publishing')
    and post.status not in ('cancelled', 'published')
    and target.scheduled_for <= now()
    and job.job_type = 'publish_social_post'
    and job.input_json ->> 'targetId' = target.id::text
    and (
      (
        job.status = 'queued'
        and (job.next_attempt_at is null or job.next_attempt_at <= now())
      )
      or (
        job.status = 'processing'
        and coalesce(job.last_heartbeat_at, job.locked_at, job.updated_at) <
          now() - make_interval(
            secs => greatest(
              30,
              least(coalesce(p_stale_after_seconds, 600), 43200)
            )
          )
      )
    )
  order by target.scheduled_for, job.created_at
  limit greatest(1, least(coalesce(p_limit, 10), 100));
$$;

revoke all on function public.list_due_social_publish_jobs(integer, integer)
  from public;
revoke all on function public.list_due_social_publish_jobs(integer, integer)
  from anon;
revoke all on function public.list_due_social_publish_jobs(integer, integer)
  from authenticated;
grant execute on function public.list_due_social_publish_jobs(integer, integer)
  to service_role;

create or replace function public.reconcile_social_schedule_state(
  p_limit integer,
  p_stale_after_seconds integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancelled_targets integer := 0;
  v_failed_targets integer := 0;
  v_now timestamptz := now();
  v_published_targets integer := 0;
  v_reconciled integer := 0;
  v_stale_targets integer := 0;
  v_stale_after_seconds integer := greatest(
    60,
    least(coalesce(p_stale_after_seconds, 300), 3600)
  );
begin
  with published_operation_targets as (
    select target.id
    from public.scheduled_post_targets as target
    join public.social_publish_operations as operation
      on operation.scheduled_post_target_id = target.id
      and operation.user_id = target.user_id
    where operation.status = 'published'
      and operation.platform_post_id is not null
      and (
        target.status <> 'published'
        or target.platform_post_id is distinct from operation.platform_post_id
        or target.platform_post_url is distinct from operation.platform_post_url
      )
    order by operation.published_at, target.id
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.scheduled_post_targets as target
  set
    last_error_code = case
      when not exists (
        select 1
        from public.scheduled_post_targets as target
        where target.scheduled_post_id = post.id
          and target.status <> 'published'
      ) then null
      else post.last_error_code
    end,
    last_error_message = null,
    last_reconciled_at = v_now,
    next_retry_at = null,
    platform_post_id = operation.platform_post_id,
    platform_post_url = operation.platform_post_url,
    published_at = coalesce(operation.published_at, v_now),
    status = 'published',
    updated_at = v_now
  from public.social_publish_operations as operation
  where target.id in (
      select published_target.id
      from published_operation_targets as published_target
    )
    and operation.scheduled_post_target_id = target.id
    and operation.user_id = target.user_id;

  get diagnostics v_published_targets = row_count;
  v_reconciled := v_reconciled + v_published_targets;

  update public.scheduled_posts as post
  set
    last_error_code = null,
    published_at = case
      when not exists (
        select 1
        from public.scheduled_post_targets as target
        where target.scheduled_post_id = post.id
          and target.status <> 'published'
      ) then v_now
      else post.published_at
    end,
    status = case
      when not exists (
        select 1
        from public.scheduled_post_targets as target
        where target.scheduled_post_id = post.id
          and target.status <> 'published'
      ) then 'published'
      when post.status = 'cancelled' then 'partially_failed'
      else post.status
    end,
    updated_at = v_now
  where exists (
    select 1
    from public.scheduled_post_targets as target
    where target.scheduled_post_id = post.id
      and target.status = 'published'
      and target.last_reconciled_at = v_now
  );

  with stale_targets as (
    select target.id
    from public.scheduled_post_targets as target
    where target.status = 'scheduling'
      and target.publish_job_id is not null
      and exists (
        select 1
        from public.background_jobs as job
        where job.id = target.publish_job_id
          and job.status in ('queued', 'processing')
      )
      and target.updated_at <
        v_now - make_interval(secs => v_stale_after_seconds)
    order by target.updated_at, target.id
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.scheduled_post_targets as target
  set
    last_error_code = 'scheduler_fallback_active',
    last_error_message = null,
    last_reconciled_at = v_now,
    status = 'scheduled',
    updated_at = v_now
  where target.id in (select stale_target.id from stale_targets as stale_target);

  get diagnostics v_stale_targets = row_count;
  v_reconciled := v_reconciled + v_stale_targets;

  with failed_job_targets as (
    select target.id
    from public.scheduled_post_targets as target
    join public.background_jobs as job
      on job.id = target.publish_job_id
      and job.user_id = target.user_id
    where target.status in ('scheduling', 'scheduled', 'publishing')
      and job.status = 'failed'
      and not exists (
        select 1
        from public.social_publish_operations as operation
        where operation.scheduled_post_target_id = target.id
          and operation.status = 'published'
      )
    order by job.updated_at, target.id
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.scheduled_post_targets as target
  set
    last_error_code = case
      when target.last_error_code is null
        or target.last_error_code = 'scheduler_fallback_active'
        then 'social_publish_failed'
      else target.last_error_code
    end,
    last_error_message = left(job.error_message, 500),
    last_reconciled_at = v_now,
    next_retry_at = null,
    status = 'failed',
    updated_at = v_now
  from public.background_jobs as job
  where target.id in (
      select failed_target.id
      from failed_job_targets as failed_target
    )
    and job.id = target.publish_job_id;

  get diagnostics v_failed_targets = row_count;
  v_reconciled := v_reconciled + v_failed_targets;

  update public.scheduled_posts as post
  set
    last_error_code = case
      when post.last_error_code is null
        or post.last_error_code = 'scheduler_fallback_active'
        then 'social_publish_failed'
      else post.last_error_code
    end,
    status = case
      when exists (
        select 1
        from public.scheduled_post_targets as target
        where target.scheduled_post_id = post.id
          and target.status <> 'failed'
      ) then 'partially_failed'
      else 'failed'
    end,
    updated_at = v_now
  where post.status <> 'cancelled'
    and exists (
      select 1
      from public.scheduled_post_targets as target
      where target.scheduled_post_id = post.id
        and target.status = 'failed'
        and target.last_reconciled_at = v_now
    );

  with cancelled_parent_targets as (
    select target.id
    from public.scheduled_post_targets as target
    join public.scheduled_posts as post
      on post.id = target.scheduled_post_id
      and post.user_id = target.user_id
    where post.status = 'cancelled'
      and target.status in (
        'draft',
        'scheduling',
        'scheduled',
        'publishing',
        'failed'
      )
      and not exists (
        select 1
        from public.social_publish_operations as operation
        where operation.scheduled_post_target_id = target.id
          and (
            operation.active_claim_token is not null
            or operation.status = 'published'
          )
      )
    order by target.updated_at, target.id
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.scheduled_post_targets as target
  set
    cancelled_at = coalesce(target.cancelled_at, v_now),
    last_reconciled_at = v_now,
    next_retry_at = null,
    status = 'cancelled',
    updated_at = v_now
  where target.id in (
    select cancelled_target.id
    from cancelled_parent_targets as cancelled_target
  );

  get diagnostics v_cancelled_targets = row_count;
  v_reconciled := v_reconciled + v_cancelled_targets;

  update public.background_jobs as job
  set
    claim_token = null,
    completed_at = v_now,
    next_attempt_at = null,
    status = 'cancelled',
    updated_at = v_now
  where job.status in ('queued', 'processing')
    and exists (
      select 1
      from public.scheduled_post_targets as target
      where target.publish_job_id = job.id
        and target.status = 'cancelled'
    );

  update public.scheduled_posts as post
  set
    last_error_code = case
      when exists (
        select 1
        from public.scheduled_post_targets as target
        where target.scheduled_post_id = post.id
          and target.last_error_code = 'scheduler_fallback_active'
      ) then 'scheduler_fallback_active'
      else null
    end,
    status = 'scheduled',
    updated_at = v_now
  where post.status = 'scheduling'
    and exists (
      select 1
      from public.scheduled_post_targets as target
      where target.scheduled_post_id = post.id
        and target.status = 'scheduled'
    )
    and not exists (
      select 1
      from public.scheduled_post_targets as target
      where target.scheduled_post_id = post.id
        and target.status <> 'scheduled'
    );

  return v_reconciled;
end;
$$;

revoke all on function public.reconcile_social_schedule_state(integer, integer)
  from public;
revoke all on function public.reconcile_social_schedule_state(integer, integer)
  from anon;
revoke all on function public.reconcile_social_schedule_state(integer, integer)
  from authenticated;
grant execute on function public.reconcile_social_schedule_state(integer, integer)
  to service_role;

select pg_notify('pgrst', 'reload schema');
