create or replace function public.append_background_job_event(
  p_job_id uuid,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if p_event_type is null
    or char_length(trim(p_event_type)) not between 1 and 120 then
    raise exception 'invalid background job event type';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'background job event metadata must be an object';
  end if;

  insert into public.background_job_events (job_id, event_type, metadata)
  values (p_job_id, trim(p_event_type), p_metadata)
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.transition_background_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_status text,
  p_stage text default null,
  p_progress smallint default null,
  p_output_reference text default null,
  p_error_code text default null,
  p_error_message text default null,
  p_event_type text default 'status_changed',
  p_metadata jsonb default '{}'::jsonb
)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.background_jobs%rowtype;
  v_now timestamptz := now();
begin
  select job.*
  into v_current
  from public.background_jobs as job
  where job.id = p_job_id
  for update;

  if not found then
    return;
  end if;

  if p_claim_token is not null and v_current.claim_token is distinct from p_claim_token then
    return;
  end if;

  if not (
    v_current.status = p_status
    or (v_current.status = 'created' and p_status in ('queued', 'cancelled'))
    or (v_current.status = 'queued' and p_status in ('processing', 'cancelled', 'failed', 'stalled'))
    or (
      v_current.status in (
        'processing',
        'waiting_external_service',
        'rendering',
        'uploading_output'
      )
      and p_status in (
        'queued',
        'processing',
        'waiting_external_service',
        'rendering',
        'uploading_output',
        'completed',
        'failed',
        'cancel_requested',
        'cancelled',
        'stalled'
      )
    )
    or (v_current.status = 'cancel_requested' and p_status in ('cancelled', 'failed'))
    or (v_current.status = 'stalled' and p_status in ('queued', 'failed', 'cancelled'))
    or (v_current.status = 'failed' and p_status = 'queued')
  ) then
    raise exception 'invalid background job transition: % -> %',
      v_current.status,
      p_status;
  end if;

  update public.background_jobs as job
  set
    status = p_status,
    stage = case
      when p_stage is not null then left(trim(p_stage), 120)
      else job.stage
    end,
    progress = p_progress,
    output_reference = coalesce(p_output_reference, job.output_reference),
    error_code = case
      when p_status in ('failed', 'stalled') then left(nullif(trim(p_error_code), ''), 120)
      when p_status in ('queued', 'processing', 'completed', 'cancelled') then null
      else job.error_code
    end,
    error_message = case
      when p_status in ('failed', 'stalled') then left(nullif(trim(p_error_message), ''), 1000)
      when p_status in ('queued', 'processing', 'completed', 'cancelled') then null
      else job.error_message
    end,
    queued_at = case when p_status = 'queued' then v_now else job.queued_at end,
    started_at = case
      when p_status in ('processing', 'waiting_external_service', 'rendering', 'uploading_output')
        then coalesce(job.started_at, v_now)
      else job.started_at
    end,
    completed_at = case when p_status in ('completed', 'cancelled') then v_now else job.completed_at end,
    failed_at = case when p_status in ('failed', 'stalled') then v_now else job.failed_at end,
    last_heartbeat_at = case
      when p_status in ('processing', 'waiting_external_service', 'rendering', 'uploading_output')
        then v_now
      else job.last_heartbeat_at
    end,
    claim_token = case
      when p_status in ('queued', 'completed', 'failed', 'cancelled', 'stalled') then null
      else job.claim_token
    end,
    locked_at = case
      when p_status in ('queued', 'completed', 'failed', 'cancelled', 'stalled') then null
      else job.locked_at
    end,
    worker_id = case
      when p_status in ('queued', 'completed', 'failed', 'cancelled', 'stalled') then null
      else job.worker_id
    end,
    worker_execution_id = case
      when p_status in ('queued', 'completed', 'failed', 'cancelled', 'stalled') then null
      else job.worker_execution_id
    end,
    updated_at = v_now
  where job.id = p_job_id;

  perform public.append_background_job_event(
    p_job_id,
    p_event_type,
    p_metadata || jsonb_build_object(
      'fromStatus', v_current.status,
      'toStatus', p_status,
      'stage', p_stage
    )
  );

  return query
  select job.*
  from public.background_jobs as job
  where job.id = p_job_id;
end;
$$;

create or replace function public.request_background_job_cancel(
  p_job_id uuid,
  p_user_id text
)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.background_jobs%rowtype;
  v_next_status text;
  v_now timestamptz := now();
begin
  select job.*
  into v_current
  from public.background_jobs as job
  where job.id = p_job_id
    and job.user_id = p_user_id
  for update;

  if not found then
    return;
  end if;

  if v_current.status in ('completed', 'failed', 'cancelled') then
    return next v_current;
    return;
  end if;

  v_next_status := case
    when v_current.status in ('created', 'queued', 'stalled') then 'cancelled'
    else 'cancel_requested'
  end;

  update public.background_jobs as job
  set
    status = v_next_status,
    stage = v_next_status,
    cancel_requested_at = v_now,
    completed_at = case when v_next_status = 'cancelled' then v_now else job.completed_at end,
    claim_token = case when v_next_status = 'cancelled' then null else job.claim_token end,
    locked_at = case when v_next_status = 'cancelled' then null else job.locked_at end,
    worker_id = case when v_next_status = 'cancelled' then null else job.worker_id end,
    worker_execution_id = case when v_next_status = 'cancelled' then null else job.worker_execution_id end,
    updated_at = v_now
  where job.id = p_job_id;

  perform public.append_background_job_event(
    p_job_id,
    case when v_next_status = 'cancelled' then 'job_cancelled' else 'cancellation_requested' end,
    jsonb_build_object('fromStatus', v_current.status)
  );

  return query
  select job.* from public.background_jobs as job where job.id = p_job_id;
end;
$$;

create or replace function public.retry_background_job(
  p_job_id uuid,
  p_user_id text
)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.background_jobs%rowtype;
  v_now timestamptz := now();
begin
  select job.*
  into v_current
  from public.background_jobs as job
  where job.id = p_job_id
    and job.user_id = p_user_id
  for update;

  if not found then
    return;
  end if;

  if v_current.status not in ('failed', 'stalled') then
    raise exception 'background job is not retryable';
  end if;

  if v_current.attempt_count >= v_current.max_attempts then
    raise exception 'background job maximum attempts exceeded';
  end if;

  update public.background_jobs as job
  set
    status = 'queued',
    stage = 'queued',
    progress = null,
    error_code = null,
    error_message = null,
    failed_at = null,
    completed_at = null,
    cancel_requested_at = null,
    queued_at = v_now,
    next_attempt_at = null,
    queue_message_id = null,
    last_delivery_at = null,
    last_heartbeat_at = null,
    locked_at = null,
    claim_token = null,
    worker_id = null,
    worker_execution_id = null,
    updated_at = v_now
  where job.id = p_job_id;

  perform public.append_background_job_event(
    p_job_id,
    'job_retried',
    jsonb_build_object('attemptCount', v_current.attempt_count)
  );

  return query
  select job.* from public.background_jobs as job where job.id = p_job_id;
end;
$$;

create or replace function public.list_recoverable_background_jobs(
  p_limit integer default 100,
  p_stale_after_seconds integer default 900
)
returns setof public.background_jobs
language sql
security definer
set search_path = public
as $$
  select job.*
  from public.background_jobs as job
  where (
    job.status in (
      'processing',
      'waiting_external_service',
      'rendering',
      'uploading_output',
      'cancel_requested'
    )
    and coalesce(job.last_heartbeat_at, job.locked_at, job.updated_at)
      < now() - make_interval(secs => greatest(60, least(p_stale_after_seconds, 43200)))
  ) or (
    job.status = 'queued'
    and coalesce(job.last_delivery_at, job.queued_at, job.updated_at)
      < now() - make_interval(secs => greatest(60, least(p_stale_after_seconds, 43200)))
  )
  order by coalesce(job.last_heartbeat_at, job.queued_at, job.updated_at), job.id
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

create or replace function public.recover_background_job(
  p_job_id uuid
)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.background_jobs%rowtype;
  v_now timestamptz := now();
  v_next_status text;
begin
  select job.*
  into v_current
  from public.background_jobs as job
  where job.id = p_job_id
    and job.status in (
      'queued',
      'processing',
      'waiting_external_service',
      'rendering',
      'uploading_output',
      'cancel_requested',
      'stalled'
    )
  for update;

  if not found then
    return;
  end if;

  if v_current.status = 'cancel_requested' then
    v_next_status := 'cancelled';
  elsif v_current.attempt_count + 1 >= v_current.max_attempts then
    v_next_status := 'failed';
  else
    v_next_status := 'queued';
  end if;

  update public.background_jobs as job
  set
    attempt_count = case
      when v_next_status = 'cancelled' then job.attempt_count
      else job.attempt_count + 1
    end,
    status = v_next_status,
    stage = case
      when v_next_status = 'queued' then 'recovered'
      when v_next_status = 'cancelled' then 'cancelled'
      else 'failed'
    end,
    progress = null,
    error_code = case
      when v_next_status = 'failed' then 'WORKER_STALLED'
      else null
    end,
    error_message = case
      when v_next_status = 'failed' then 'Background job exceeded its recovery attempts.'
      else null
    end,
    failed_at = case when v_next_status = 'failed' then v_now else null end,
    completed_at = case when v_next_status = 'cancelled' then v_now else null end,
    queued_at = case when v_next_status = 'queued' then v_now else job.queued_at end,
    next_attempt_at = null,
    queue_message_id = null,
    last_delivery_at = null,
    last_heartbeat_at = null,
    locked_at = null,
    claim_token = null,
    worker_id = null,
    worker_execution_id = null,
    updated_at = v_now
  where job.id = p_job_id;

  perform public.append_background_job_event(
    p_job_id,
    case
      when v_next_status = 'queued' then 'job_recovered'
      when v_next_status = 'cancelled' then 'job_cancelled_during_recovery'
      else 'job_recovery_exhausted'
    end,
    jsonb_build_object(
      'fromStatus', v_current.status,
      'attemptCount', v_current.attempt_count,
      'maxAttempts', v_current.max_attempts
    )
  );

  return query
  select job.* from public.background_jobs as job where job.id = p_job_id;
end;
$$;

revoke all on function public.append_background_job_event(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.transition_background_job(uuid, uuid, text, text, smallint, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.request_background_job_cancel(uuid, text) from public, anon, authenticated;
revoke all on function public.retry_background_job(uuid, text) from public, anon, authenticated;
revoke all on function public.list_recoverable_background_jobs(integer, integer) from public, anon, authenticated;
revoke all on function public.recover_background_job(uuid) from public, anon, authenticated;

grant execute on function public.append_background_job_event(uuid, text, jsonb) to service_role;
grant execute on function public.transition_background_job(uuid, uuid, text, text, smallint, text, text, text, text, jsonb) to service_role;
grant execute on function public.request_background_job_cancel(uuid, text) to service_role;
grant execute on function public.retry_background_job(uuid, text) to service_role;
grant execute on function public.list_recoverable_background_jobs(integer, integer) to service_role;
grant execute on function public.recover_background_job(uuid) to service_role;

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
    error_code = null,
    error_message = null,
    last_heartbeat_at = v_now,
    locked_at = v_now,
    next_attempt_at = null,
    stage = 'processing',
    started_at = coalesce(job.started_at, v_now),
    status = 'processing',
    updated_at = v_now,
    worker_execution_id = left(trim(p_worker_id) || ':' || p_claim_token::text, 255),
    worker_id = left(trim(p_worker_id), 255)
  where job.id = p_job_id
    and (
      (
        job.status in ('queued', 'stalled')
        and (job.next_attempt_at is null or job.next_attempt_at <= v_now)
      )
      or (
        job.status in (
          'processing',
          'waiting_external_service',
          'rendering',
          'uploading_output'
        )
        and coalesce(job.last_heartbeat_at, job.locked_at, job.updated_at)
          < v_now - make_interval(secs => v_stale_after_seconds)
      )
    )
  returning job.*;
end;
$$;

revoke all on function public.claim_background_job(uuid, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_background_job(uuid, text, uuid, integer)
  to service_role;
