-- Future social publishes are intentional scheduled waits, not stalled work.
-- Check the durable target at recovery selection, locked recovery, and worker claim.
-- Keep cancelled/published targets claimable for idempotent cleanup; orphaned and
-- superseded publish jobs cannot start. Honor retry waits without spending attempts.

CREATE OR REPLACE FUNCTION public.claim_background_job(p_job_id uuid, p_worker_id text, p_claim_token uuid, p_stale_after_seconds integer)
 RETURNS SETOF background_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      job.job_type <> 'publish_social_post'
      or exists (
        select 1 from public.scheduled_post_targets as target
        where target.publish_job_id = job.id
          and target.user_id = job.user_id
          and (target.scheduled_for <= v_now or target.status in ('cancelled', 'published'))
      )
    )
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
$function$;


CREATE OR REPLACE FUNCTION public.list_recoverable_background_jobs(p_limit integer DEFAULT 100, p_stale_after_seconds integer DEFAULT 900)
 RETURNS SETOF background_jobs
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select job.*
  from public.background_jobs as job
  where (job.next_attempt_at is null or job.next_attempt_at <= now())
    and (
      job.job_type <> 'publish_social_post'
      or exists (
        select 1 from public.scheduled_post_targets as target
        where target.publish_job_id = job.id
          and target.user_id = job.user_id
          and (target.scheduled_for <= now() or target.status in ('cancelled', 'published'))
      )
    )
    and ((
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
  )
  order by coalesce(job.last_heartbeat_at, job.queued_at, job.updated_at), job.id
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$function$;


CREATE OR REPLACE FUNCTION public.recover_background_job(p_job_id uuid)
 RETURNS SETOF background_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current public.background_jobs%rowtype;
  v_now timestamptz := now();
  v_next_status text;
begin
  select job.*
  into v_current
  from public.background_jobs as job
  where job.id = p_job_id
    and (job.next_attempt_at is null or job.next_attempt_at <= v_now)
    and (
      job.job_type <> 'publish_social_post'
      or exists (
        select 1 from public.scheduled_post_targets as target
        where target.publish_job_id = job.id
          and target.user_id = job.user_id
          and (target.scheduled_for <= v_now or target.status in ('cancelled', 'published'))
      )
    )
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
$function$;
