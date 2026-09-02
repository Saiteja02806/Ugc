-- A terminal worker job must never leave a content plan indefinitely owned and
-- marked as generating. This can happen when the process records the durable
-- job failure but is interrupted before it records the matching plan failure.
-- The next planner invocation reopens the same plan with a new generation
-- attempt. Carousel and Wall-of-Text use separate plan tables, but share this
-- ownership invariant.
CREATE OR REPLACE FUNCTION public.ensure_carousel_content_plan (
  p_user_id                  text,
  p_project_id               text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_timezone                 text,
  p_business_description     text,
  p_planning_context         jsonb,
  p_target_item_count        integer,
  p_planner_model            text,
  p_planner_prompt_version   text
)
  RETURNS public.carousel_content_plans
  LANGUAGE plpgsql
  SET search_path TO ''
AS $function$
declare
  v_current_date date;
  v_next_plan_version integer;
  v_now timestamptz := timezone('utc', now());
  v_owner_status text;
  v_plan public.carousel_content_plans%rowtype;
  v_reopen_plan boolean := false;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or nullif(trim(coalesce(p_project_id, '')), '') is null
     or p_business_profile_id is null
     or p_business_profile_version is null
     or p_business_profile_version <= 0
     or nullif(trim(coalesce(p_timezone, '')), '') is null
     or nullif(trim(coalesce(p_business_description, '')), '') is null
     or char_length(trim(p_business_description)) > 4000
     or p_planning_context is null
     or jsonb_typeof(p_planning_context) <> 'object'
     or p_target_item_count <> 150
     or p_planner_model <> 'gpt-4o-mini'
     or nullif(trim(coalesce(p_planner_prompt_version, '')), '') is null then
    raise exception 'carousel_content_plan_ensure_input_invalid';
  end if;

  begin
    v_current_date := timezone(trim(p_timezone), v_now)::date;
  exception
    when invalid_parameter_value then
      raise exception 'carousel_content_plan_timezone_invalid';
  end;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'carousel-content-plan:' || p_user_id || ':' || p_business_profile_id::text,
      641902731
    )
  );

  perform 1
  from public.business_profiles as profile
  where profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.project_id = p_project_id
    and profile.profile_version = p_business_profile_version
  for share;

  if not found then
    raise exception 'business_profile_version_changed';
  end if;

  select plan.*
  into v_plan
  from public.carousel_content_plans as plan
  where plan.user_id = p_user_id
    and plan.project_id = p_project_id
    and plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.status in ('generating', 'active', 'exhausted', 'failed')
    and v_current_date between plan.period_start_date and plan.period_end_date
  order by plan.period_start_date desc, plan.plan_version desc
  limit 1
  for update;

  if found then
    if v_plan.status = 'failed' then
      v_reopen_plan := true;
    elsif v_plan.status = 'generating'
      and v_plan.generation_job_id is not null then
      select job.status
      into v_owner_status
      from public.background_jobs as job
      where job.id = v_plan.generation_job_id;

      -- A terminal owner can no longer activate this plan. Do not return its
      -- stale ownership to the caller, or a replacement job will fail at the
      -- ownership-attachment guard.
      if v_owner_status in ('failed', 'cancelled') then
        v_reopen_plan := true;
      end if;
    end if;

    if v_reopen_plan then
      update public.carousel_content_plans as plan
      set
        status = 'generating',
        activated_at = null,
        exhausted_at = null,
        failed_at = null,
        failure_reason = null,
        generation_attempt = plan.generation_attempt + 1,
        generation_completed_at = null,
        generation_job_id = null,
        generation_started_at = null,
        superseded_at = null,
        superseded_by_plan_id = null,
        updated_at = v_now
      where plan.id = v_plan.id
      returning plan.* into v_plan;
    end if;

    return v_plan;
  end if;

  select coalesce(max(plan.plan_version), 0) + 1
  into v_next_plan_version
  from public.carousel_content_plans as plan
  where plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.period_start_date = v_current_date;

  insert into public.carousel_content_plans (
    user_id,
    project_id,
    business_profile_id,
    business_profile_version,
    period_start_date,
    period_end_date,
    timezone,
    plan_version,
    business_description,
    planning_context,
    target_item_count,
    planner_model,
    planner_prompt_version
  ) values (
    p_user_id,
    p_project_id,
    p_business_profile_id,
    p_business_profile_version,
    v_current_date,
    v_current_date + 29,
    trim(p_timezone),
    v_next_plan_version,
    trim(p_business_description),
    p_planning_context,
    p_target_item_count,
    p_planner_model,
    trim(p_planner_prompt_version)
  )
  returning * into v_plan;

  return v_plan;
end;
$function$;

COMMENT ON FUNCTION public.ensure_carousel_content_plan(text, text, uuid, integer, text, text, jsonb, integer, text, text)
  IS 'Returns the current 30-day Carousel plan, reopening it after its owner job has terminally failed or been cancelled.';

CREATE OR REPLACE FUNCTION public.ensure_wall_text_content_plan (
  p_user_id                  text,
  p_project_id               text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_timezone                 text,
  p_business_description     text,
  p_planning_context         jsonb,
  p_target_item_count        integer,
  p_planner_model            text,
  p_planner_prompt_version   text
)
  RETURNS public.wall_text_content_plans
  LANGUAGE plpgsql
  SET search_path TO ''
AS $function$
declare
  v_current_date date;
  v_next_plan_version integer;
  v_now timestamptz := timezone('utc', now());
  v_owner_status text;
  v_plan public.wall_text_content_plans%rowtype;
  v_reopen_plan boolean := false;
begin
  if nullif(btrim(coalesce(p_user_id, '')), '') is null
     or nullif(btrim(coalesce(p_project_id, '')), '') is null
     or p_business_profile_id is null
     or p_business_profile_version is null
     or p_business_profile_version <= 0
     or nullif(btrim(coalesce(p_timezone, '')), '') is null
     or nullif(btrim(coalesce(p_business_description, '')), '') is null
     or char_length(btrim(p_business_description)) > 4000
     or p_planning_context is null
     or jsonb_typeof(p_planning_context) <> 'object'
     or p_target_item_count <> 200
     or nullif(btrim(coalesce(p_planner_model, '')), '') is null
     or nullif(btrim(coalesce(p_planner_prompt_version, '')), '') is null then
    raise exception 'wall_text_content_plan_ensure_input_invalid';
  end if;

  begin
    v_current_date := timezone(btrim(p_timezone), v_now)::date;
  exception
    when invalid_parameter_value then
      raise exception 'wall_text_content_plan_timezone_invalid';
  end;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'wall-text-content-plan:' || p_user_id || ':' || p_business_profile_id::text,
      819325101
    )
  );

  perform 1
  from public.business_profiles as profile
  where profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.project_id = p_project_id
    and profile.profile_version = p_business_profile_version
  for share;

  if not found then
    raise exception 'business_profile_version_changed';
  end if;

  select plan.*
  into v_plan
  from public.wall_text_content_plans as plan
  where plan.user_id = p_user_id
    and plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.status in ('generating', 'active', 'failed')
    and v_current_date between plan.period_start_date and plan.period_end_date
  order by plan.period_start_date desc, plan.plan_version desc
  limit 1
  for update;

  if found then
    if v_plan.status = 'failed' then
      v_reopen_plan := true;
    elsif v_plan.status = 'generating'
      and v_plan.generation_job_id is not null then
      select job.status
      into v_owner_status
      from public.background_jobs as job
      where job.id = v_plan.generation_job_id;

      -- A failed or cancelled owner can no longer activate this plan. Do not
      -- return its stale ownership to the caller, or the next job will fail at
      -- the ownership-attachment guard.
      if v_owner_status in ('failed', 'cancelled') then
        v_reopen_plan := true;
      end if;
    end if;

    if v_reopen_plan then
      update public.wall_text_content_plans as plan
      set
        status = 'generating',
        activated_at = null,
        failed_at = null,
        failure_reason = null,
        generation_attempt = plan.generation_attempt + 1,
        generation_completed_at = null,
        generation_job_id = null,
        generation_started_at = null,
        superseded_at = null,
        superseded_by_plan_id = null,
        updated_at = v_now
      where plan.id = v_plan.id
      returning plan.* into v_plan;
    end if;

    return v_plan;
  end if;

  select coalesce(max(plan.plan_version), 0) + 1
  into v_next_plan_version
  from public.wall_text_content_plans as plan
  where plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.period_start_date = v_current_date;

  insert into public.wall_text_content_plans (
    user_id, project_id, business_profile_id, business_profile_version,
    period_start_date, period_end_date, timezone, plan_version,
    business_description, planning_context, target_item_count,
    planner_model, planner_prompt_version
  ) values (
    p_user_id, p_project_id, p_business_profile_id, p_business_profile_version,
    v_current_date, v_current_date + 29, btrim(p_timezone), v_next_plan_version,
    btrim(p_business_description), p_planning_context, p_target_item_count,
    btrim(p_planner_model), btrim(p_planner_prompt_version)
  ) returning * into v_plan;

  return v_plan;
end;
$function$;

COMMENT ON FUNCTION public.ensure_wall_text_content_plan(text, text, uuid, integer, text, text, jsonb, integer, text, text)
  IS 'Returns the current 30-day Wall plan, reopening it after its owner job has terminally failed or been cancelled.';

-- Record terminal plan failure in the same transaction as the durable job
-- state. This closes the process-crash window between markFailed() and the
-- worker's best-effort parent-plan update. It also places a reconciliation
-- record in the durable outbox, so feed recovery does not depend on a browser
-- read or on the failed worker staying alive long enough to call the app.
CREATE OR REPLACE FUNCTION public.enqueue_completed_trending_feed_reconciliation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
declare
  should_reconcile boolean := true;
  terminal_failure_reason text := left(
    coalesce(nullif(btrim(new.error_message), ''), 'The content-plan owner job failed before activation.'),
    1000
  );
begin
  if new.status in ('failed', 'cancelled')
    and new.job_type = 'carousel_content_plan_generation'
  then
    update public.carousel_content_plans as plan
    set
      status = 'failed',
      failed_at = coalesce(plan.failed_at, now()),
      failure_reason = terminal_failure_reason,
      updated_at = now()
    where plan.generation_job_id = new.id
      and plan.user_id = new.user_id
      and plan.status = 'generating';
  elsif new.status in ('failed', 'cancelled')
    and new.job_type = 'wall_text_content_plan_generation'
  then
    update public.wall_text_content_plans as plan
    set
      status = 'failed',
      failed_at = coalesce(plan.failed_at, now()),
      failure_reason = terminal_failure_reason,
      updated_at = now()
    where plan.generation_job_id = new.id
      and plan.user_id = new.user_id
      and plan.status = 'generating';
  end if;

  -- Preserve the durable Hook-run cleanup introduced with chunked Hook
  -- generation. Its candidates must be released before reconciliation wakes
  -- the next chunk.
  if new.status in ('failed', 'cancelled')
    and new.job_type = 'generate_trending_hook_copy'
    and new.input_json ? 'generationRunId'
  then
    perform public.fail_trending_hook_generation_chunk_v1(
      new.id,
      coalesce(new.error_message, 'The Hook generation worker failed.')
    );
  end if;

  -- Only a Carousel job that owns daily-feed inventory should prepare a daily
  -- replacement. Manual and non-daily Carousel failures remain isolated.
  if new.status in ('failed', 'cancelled')
    and new.job_type = 'generate_carousel'
  then
    select exists (
      select 1
      from public.carousel_generations as generation
      where generation.trigger_run_id = new.id::text
        and generation.origin_daily_feed_id is not null
    )
    into should_reconcile;
  end if;

  if not should_reconcile then
    return new;
  end if;

  insert into public.trending_feed_reconciliation_outbox (
    source_job_id,
    user_id,
    status,
    next_attempt_at
  ) values (
    new.id,
    new.user_id,
    'pending',
    now()
  )
  on conflict (source_job_id) do nothing;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS enqueue_completed_trending_feed_reconciliation
  ON public.background_jobs;

CREATE TRIGGER enqueue_completed_trending_feed_reconciliation
  AFTER UPDATE OF status ON public.background_jobs
  FOR EACH ROW
  WHEN (
    old.status IS DISTINCT FROM new.status
    AND new.user_id IS NOT NULL
    AND (
      (
        new.status = 'completed'
        AND new.job_type IN (
          'carousel_content_plan_generation',
          'generate_carousel',
          'generate_trending_hook_copy',
          'wall_text_content_plan_generation',
          'wall_text_generation'
        )
      )
      OR (
        new.status IN ('failed', 'cancelled')
        AND (
          (
            new.job_type = 'generate_trending_hook_copy'
            AND new.input_json ? 'generationRunId'
          )
          OR new.job_type IN (
            'carousel_content_plan_generation',
            'generate_carousel',
            'wall_text_content_plan_generation',
            'wall_text_generation'
          )
        )
      )
    )
  )
  EXECUTE FUNCTION public.enqueue_completed_trending_feed_reconciliation();

-- Repair the historical state left by worker versions that could fail a job
-- without failing its parent plan. These updates touch only plans whose owning
-- job is already terminal; active work remains untouched. Each repaired job
-- also gets one durable feed-reconciliation record so it resumes without a
-- browser refresh after this migration commits.
WITH recovered_carousel_jobs AS (
  UPDATE public.carousel_content_plans AS plan
  SET
    status = 'failed',
    failed_at = coalesce(plan.failed_at, timezone('utc', now())),
    failure_reason = coalesce(
      nullif(left(btrim(coalesce(job.error_message, '')), 1000), ''),
      'The Carousel content-plan owner job ended before activating the plan.'
    ),
    updated_at = timezone('utc', now())
  FROM public.background_jobs AS job
  WHERE plan.status = 'generating'
    AND plan.generation_job_id = job.id
    AND job.status IN ('failed', 'cancelled')
  RETURNING plan.generation_job_id AS source_job_id, plan.user_id
), recovered_wall_text_jobs AS (
  UPDATE public.wall_text_content_plans AS plan
  SET
    status = 'failed',
    failed_at = coalesce(plan.failed_at, timezone('utc', now())),
    failure_reason = coalesce(
      nullif(left(btrim(coalesce(job.error_message, '')), 1000), ''),
      'The Wall-of-Text content-plan owner job ended before activating the plan.'
    ),
    updated_at = timezone('utc', now())
  FROM public.background_jobs AS job
  WHERE plan.status = 'generating'
    AND plan.generation_job_id = job.id
    AND job.status IN ('failed', 'cancelled')
  RETURNING plan.generation_job_id AS source_job_id, plan.user_id
)
INSERT INTO public.trending_feed_reconciliation_outbox (
  source_job_id,
  user_id,
  status,
  next_attempt_at
)
SELECT source_job_id, user_id, 'pending', now()
FROM (
  SELECT source_job_id, user_id FROM recovered_carousel_jobs
  UNION ALL
  SELECT source_job_id, user_id FROM recovered_wall_text_jobs
) AS recovered_jobs
WHERE source_job_id IS NOT NULL
ON CONFLICT (source_job_id) DO NOTHING;

SELECT pg_notify('pgrst', 'reload schema');
