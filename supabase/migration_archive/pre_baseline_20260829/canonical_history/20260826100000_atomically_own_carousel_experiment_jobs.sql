-- A Carousel experiment always owns exactly five existing generation rows.
-- Create (or recover) its durable writer job and attach those five reserved
-- content-plan items in one transaction before Cloud Tasks is allowed to
-- deliver the job. This prevents a process stop between job creation and
-- ownership attachment from leaving work ambiguous or safely parallel workers
-- from claiming the same Carousel ideas.
create or replace function public.create_or_get_carousel_experiment_batch_job(
  p_user_id text,
  p_project_id text,
  p_experiment_batch_id uuid,
  p_carousel_ids uuid[],
  p_text_style text
)
returns table (
  job_id uuid,
  created boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch public.carousel_experiment_batches%rowtype;
  v_created boolean := false;
  v_expected_carousel_ids uuid[];
  v_job public.background_jobs%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_unique_carousel_count integer;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or nullif(trim(coalesce(p_project_id, '')), '') is null
     or p_experiment_batch_id is null
     or p_carousel_ids is null
     or coalesce(array_length(p_carousel_ids, 1), 0) <> 5
     or array_position(p_carousel_ids, null) is not null
     or p_text_style is null
     or p_text_style not in ('highlight', 'plain', 'soft-gradient') then
    raise exception 'carousel_experiment_job_input_invalid';
  end if;

  select count(distinct carousel_id)::integer
  into v_unique_carousel_count
  from unnest(p_carousel_ids) as value(carousel_id);

  if v_unique_carousel_count <> 5 then
    raise exception 'carousel_experiment_job_carousel_ids_invalid';
  end if;

  -- This is deliberately per experiment batch, not global. Different users and
  -- different batches can reserve work at the same time.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'carousel-experiment-job:' || p_experiment_batch_id::text,
      641902731
    )
  );

  select batch.*
  into v_batch
  from public.carousel_experiment_batches as batch
  join public.business_profiles as profile
    on profile.id = batch.business_profile_id
  where batch.id = p_experiment_batch_id
    and profile.user_id = p_user_id
  for update of batch;

  if not found then
    raise exception 'carousel_experiment_batch_not_found';
  end if;

  select array_agg(locked_generation.id order by locked_generation.candidate_index)
  into v_expected_carousel_ids
  from (
    select generation.id, generation.candidate_index
    from public.carousel_generations as generation
    where generation.id = any(p_carousel_ids)
      and generation.user_id = p_user_id
      and generation.project_id = p_project_id
      and generation.carousel_experiment_batch_id = p_experiment_batch_id
      and generation.business_profile_id = v_batch.business_profile_id
      and generation.business_profile_version = v_batch.business_profile_version
    for update
  ) as locked_generation;

  if coalesce(array_length(v_expected_carousel_ids, 1), 0) <> 5
     or v_expected_carousel_ids is distinct from p_carousel_ids then
    raise exception 'carousel_experiment_job_generation_ownership_mismatch';
  end if;

  if exists (
    select 1
    from public.carousel_generations as generation
    left join public.carousel_experiment_assignments as assignment
      on assignment.id = generation.carousel_experiment_assignment_id
    where generation.id = any(p_carousel_ids)
      and (
        assignment.experiment_batch_id is distinct from p_experiment_batch_id
        or assignment.carousel_generation_id is distinct from generation.id
      )
  ) then
    raise exception 'carousel_experiment_job_assignment_ownership_mismatch';
  end if;

  select job.*
  into v_job
  from public.background_jobs as job
  where job.user_id = p_user_id
    and job.job_type = 'generate_carousel'
    and job.idempotency_key =
      'carousel-experiment-batch:' || p_experiment_batch_id::text
  for update;

  if found then
    if v_job.project_id is distinct from p_project_id
       or v_job.input_json ->> 'experimentBatchId'
            is distinct from p_experiment_batch_id::text
       or v_job.input_json -> 'carouselIds' is distinct from to_jsonb(p_carousel_ids) then
      raise exception 'carousel_experiment_job_idempotency_conflict';
    end if;
  else
    insert into public.background_jobs (
      user_id,
      project_id,
      job_type,
      queue_name,
      queue_provider,
      status,
      stage,
      queued_at,
      max_attempts,
      idempotency_key,
      input_json,
      updated_at
    ) values (
      p_user_id,
      p_project_id,
      'generate_carousel',
      'carousel',
      'gcp',
      'queued',
      'queued',
      v_now,
      3,
      'carousel-experiment-batch:' || p_experiment_batch_id::text,
      jsonb_build_object(
        'carouselIds', to_jsonb(p_carousel_ids),
        'experimentBatchId', p_experiment_batch_id,
        'textStyle', p_text_style
      ),
      v_now
    )
    returning * into v_job;
    v_created := true;
  end if;

  if v_batch.planner_job_id is not null
     and v_batch.planner_job_id is distinct from v_job.id then
    raise exception 'carousel_experiment_batch_job_conflict';
  end if;

  if exists (
    select 1
    from public.carousel_generations as generation
    left join public.carousel_content_plan_items as item
      on item.id = generation.content_plan_item_id
    left join public.carousel_content_plan_reservations as reservation
      on reservation.id = generation.content_plan_reservation_id
    where generation.id = any(p_carousel_ids)
      and (
        generation.content_plan_id is null
        or generation.content_plan_item_id is null
        or generation.content_plan_reservation_id is null
        or item.user_id is distinct from p_user_id
        or item.plan_id is distinct from generation.content_plan_id
        or item.reservation_token is distinct from generation.content_plan_reservation_id
        or item.status <> 'reserved'
        or reservation.user_id is distinct from p_user_id
        or reservation.status <> 'active'
        or reservation.expires_at <= v_now
        or (
          item.reserved_by_job_id is not null
          and item.reserved_by_job_id is distinct from v_job.id
        )
      )
  ) then
    raise exception 'carousel_experiment_job_content_plan_ownership_mismatch';
  end if;

  if exists (
    select 1
    from public.carousel_generations as generation
    where generation.id = any(p_carousel_ids)
      and generation.trigger_run_id is not null
      and generation.trigger_run_id <> v_job.id::text
  ) then
    raise exception 'carousel_experiment_job_generation_job_conflict';
  end if;

  update public.carousel_content_plan_items as item
  set
    reserved_by_job_id = v_job.id,
    updated_at = v_now
  where item.id in (
    select generation.content_plan_item_id
    from public.carousel_generations as generation
    where generation.id = any(p_carousel_ids)
  )
    and item.user_id = p_user_id
    and item.status = 'reserved'
    and (item.reserved_by_job_id is null or item.reserved_by_job_id = v_job.id);

  if (
    select count(*)
    from public.carousel_content_plan_items as item
    where item.id in (
      select generation.content_plan_item_id
      from public.carousel_generations as generation
      where generation.id = any(p_carousel_ids)
    )
      and item.reserved_by_job_id = v_job.id
  ) <> 5 then
    raise exception 'carousel_experiment_job_content_plan_attachment_failed';
  end if;

  update public.carousel_generations as generation
  set trigger_run_id = v_job.id::text
  where generation.id = any(p_carousel_ids)
    and generation.trigger_run_id is null;

  update public.carousel_experiment_assignments as assignment
  set
    status = case
      when assignment.status = 'reserved' then 'queued'
      else assignment.status
    end,
    updated_at = v_now
  where assignment.carousel_generation_id = any(p_carousel_ids)
    and assignment.experiment_batch_id = p_experiment_batch_id;

  update public.carousel_experiment_batches as batch
  set
    planner_job_id = v_job.id,
    status = case
      when batch.status = 'reserved' then 'queued'
      else batch.status
    end,
    updated_at = v_now
  where batch.id = p_experiment_batch_id;

  return query select v_job.id, v_created;
end;
$$;

revoke all on function public.create_or_get_carousel_experiment_batch_job(
  text,
  text,
  uuid,
  uuid[],
  text
) from public, anon, authenticated;

grant execute on function public.create_or_get_carousel_experiment_batch_job(
  text,
  text,
  uuid,
  uuid[],
  text
) to service_role;

comment on function public.create_or_get_carousel_experiment_batch_job(
  text,
  text,
  uuid,
  uuid[],
  text
) is
  'Atomically creates or reuses one durable five-Carousel writer job, attaches its exact reserved content-plan items, and binds the batch, assignments, and generations before queue delivery.';

select pg_notify('pgrst', 'reload schema');
