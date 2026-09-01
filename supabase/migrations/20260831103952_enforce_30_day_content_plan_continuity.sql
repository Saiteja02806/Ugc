-- Each profile-version owns one plan for its whole 30-day window. A planner
-- failure reopens that same plan so its accepted ideas remain available as
-- exclusions; it must never create a fresh, context-only plan in the window.

ALTER TABLE public.carousel_content_plans
  ADD COLUMN IF NOT EXISTS generation_attempt integer NOT NULL DEFAULT 1;

ALTER TABLE public.wall_text_content_plans
  ADD COLUMN IF NOT EXISTS generation_attempt integer NOT NULL DEFAULT 1;

ALTER TABLE public.carousel_content_plans
  DROP CONSTRAINT IF EXISTS carousel_content_plans_generation_attempt_check,
  ADD CONSTRAINT carousel_content_plans_generation_attempt_check
    CHECK (generation_attempt >= 1);

ALTER TABLE public.wall_text_content_plans
  DROP CONSTRAINT IF EXISTS wall_text_content_plans_generation_attempt_check,
  ADD CONSTRAINT wall_text_content_plans_generation_attempt_check
    CHECK (generation_attempt >= 1);

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
  v_plan public.carousel_content_plans%rowtype;
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
  IS 'Returns the one plan for the current 30-day window, reopens a failed plan in place, and starts a new plan only after that window ends.';

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
  v_plan public.wall_text_content_plans%rowtype;
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
  IS 'Returns the one plan for the current 30-day window, reopens a failed plan in place, and starts a new plan only after that window ends.';

CREATE OR REPLACE FUNCTION public.reserve_wall_text_generation_batch_v1 (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_request_key              text,
  p_request_hash             text,
  p_generator_version        text,
  p_prompt_version           text,
  p_format_library_version   text,
  p_selector_version         text,
  p_assignments              jsonb
)
  RETURNS SETOF public.wall_text_generation_batches
  LANGUAGE plpgsql
  SET search_path TO ''
AS $function$
declare
  assignment_count integer;
  ordinary_assignment_count integer;
  batch_record public.wall_text_generation_batches;
  candidate_start integer;
  v_content_plan_id uuid;
  v_plan_item_ids uuid[];
begin
  assignment_count := jsonb_array_length(p_assignments);
  if jsonb_typeof(p_assignments) <> 'array'
    or assignment_count < 1
    or assignment_count > 50 then
    raise exception 'wall_text_batch_invalid_assignments';
  end if;

  select count(*) into ordinary_assignment_count
  from jsonb_array_elements(p_assignments) as item(value)
  where item.value ->> 'sourceKind' <> 'instagram_reel';

  perform 1
  from public.business_profiles as profile
  where profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.profile_version = p_business_profile_version
  for update;
  if not found then
    raise exception 'wall_text_business_profile_changed';
  end if;

  select batch.* into batch_record
  from public.wall_text_generation_batches as batch
  where batch.user_id = p_user_id and batch.request_key = p_request_key;
  if found then
    if batch_record.request_hash <> p_request_hash then
      raise exception 'wall_text_batch_idempotency_mismatch';
    end if;
    return next batch_record;
    return;
  end if;

  if ordinary_assignment_count > 1 and exists (
    select 1 from jsonb_array_elements(p_assignments) as item
    where item ->> 'assignedFormatId' is not null
      and item ->> 'sourceKind' <> 'instagram_reel'
    group by item ->> 'assignedFormatId'
    having count(*) > floor(ordinary_assignment_count * 0.5)
  ) then
    raise exception 'wall_text_batch_format_share_exceeded';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignments) as item(value)
    where item.value ->> 'sourceKind' = 'instagram_reel'
      and not exists (
        select 1 from public.wall_text_instagram_reel_templates as template
        where template.id = nullif(item.value ->> 'instagramReelTemplateId', '')::uuid
          and template.status = 'active'
          and template.template_version = (item.value ->> 'instagramReelTemplateVersion')::integer
          and template.overlay_media_asset_id = (item.value ->> 'overlayMediaAssetId')::uuid
          and template.locked_audio_asset_id = item.value ->> 'instagramLockedAudioAssetId'
          and template.reference_text = item.value ->> 'instagramReferenceText'
          and template.reference_text_hash = item.value ->> 'instagramReferenceTextHash'
          and template.audio_fit_mode = item.value ->> 'instagramAudioFitMode'
          and template.writer_format_id = item.value ->> 'assignedFormatId'
          and abs((template.safe_text_box ->> 'x')::numeric - (item.value #>> '{layout,textBox,x}')::numeric) < 0.000001
          and abs((template.safe_text_box ->> 'y')::numeric - (item.value #>> '{layout,textBox,y}')::numeric) < 0.000001
          and abs((template.safe_text_box ->> 'width')::numeric - (item.value #>> '{layout,textBox,width}')::numeric) < 0.000001
          and abs((template.safe_text_box ->> 'height')::numeric - (item.value #>> '{layout,textBox,height}')::numeric) < 0.000001
      )
  ) then
    raise exception 'wall_text_instagram_reservation_mismatch';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_assignments) as item(value)
    where item.value ->> 'sourceKind' <> 'instagram_reel'
      and (
        item.value ->> 'instagramReelTemplateId' is not null
        or item.value ->> 'instagramReelTemplateVersion' is not null
        or item.value ->> 'instagramReferenceText' is not null
        or item.value ->> 'instagramReferenceTextHash' is not null
        or item.value ->> 'instagramLockedAudioAssetId' is not null
        or item.value ->> 'instagramAudioFitMode' is not null
      )
  ) then
    raise exception 'wall_text_non_instagram_snapshot_invalid';
  end if;

  select greatest(
    coalesce((
      select max(creative.candidate_index) + 1
      from public.wall_text_creatives as creative
      where creative.user_id = p_user_id
        and creative.business_profile_id = p_business_profile_id
        and creative.business_profile_version = p_business_profile_version
    ), 0),
    coalesce((
      select max(batch.candidate_index_start + batch.requested_count)
      from public.wall_text_generation_batches as batch
      where batch.user_id = p_user_id
        and batch.business_profile_id = p_business_profile_id
        and batch.business_profile_version = p_business_profile_version
    ), 0)
  ) into candidate_start;

  -- Wall writing is plan-first. Waiting for a complete plan is preferable to
  -- creating unplanned content that bypasses 30-day uniqueness guarantees.
  select plan.id into v_content_plan_id
  from public.wall_text_content_plans as plan
  where plan.user_id = p_user_id
    and plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.status = 'active'
    and timezone(plan.timezone, timezone('utc', now()))::date
      between plan.period_start_date and plan.period_end_date
  order by plan.period_start_date desc, plan.plan_version desc
  limit 1
  for update;

  if not found then
    raise exception 'wall_text_content_plan_pending';
  end if;

  select array_agg(available.id order by available.sequence_index)
  into v_plan_item_ids
  from (
    select item.id, item.sequence_index
    from public.wall_text_content_plan_items as item
    where item.plan_id = v_content_plan_id
      and item.user_id = p_user_id
      and item.status = 'available'
    order by item.sequence_index
    limit assignment_count
    for update skip locked
  ) as available;

  if coalesce(cardinality(v_plan_item_ids), 0) <> assignment_count then
    raise exception 'wall_text_content_plan_inventory_pending';
  end if;

  insert into public.wall_text_generation_batches (
    user_id, business_profile_id, business_profile_version, request_key,
    request_hash, requested_count, chunk_count, candidate_index_start,
    generator_version, prompt_version, format_library_version, selector_version
  ) values (
    p_user_id, p_business_profile_id, p_business_profile_version,
    btrim(p_request_key), p_request_hash, assignment_count,
    ceil(assignment_count / 10.0)::integer, candidate_start,
    p_generator_version, p_prompt_version, p_format_library_version, p_selector_version
  ) returning * into batch_record;

  insert into public.wall_text_generation_chunks (
    batch_id, chunk_index, first_batch_candidate_index, candidate_count,
    idempotency_key, request_hash
  )
  select batch_record.id, chunk_index, chunk_index * 10,
    least(10, assignment_count - chunk_index * 10),
    'wall-text-batch:' || batch_record.id::text || ':chunk:' || chunk_index::text,
    p_request_hash
  from generate_series(0, batch_record.chunk_count - 1) as chunk_index;

  insert into public.wall_text_generation_assignments (
    batch_id, chunk_id, batch_candidate_index, creative_candidate_index,
    assigned_format_id, format_library_version, selection_mode,
    selection_weight_snapshot, source_kind, overlay_media_asset_id,
    instagram_reel_template_id, instagram_reel_template_version,
    instagram_reference_text, instagram_reference_text_hash,
    instagram_locked_audio_asset_id, instagram_audio_fit_mode,
    duration_seconds, layout_json, target_words, max_words, focus_json,
    wall_text_content_plan_id, wall_text_content_plan_item_id
  )
  select
    batch_record.id, chunk.id, item.ordinality - 1,
    candidate_start + item.ordinality - 1, item.value ->> 'assignedFormatId',
    p_format_library_version, item.value ->> 'selectionMode',
    coalesce((item.value ->> 'selectionWeight')::numeric, 1),
    item.value ->> 'sourceKind', (item.value ->> 'overlayMediaAssetId')::uuid,
    nullif(item.value ->> 'instagramReelTemplateId', '')::uuid,
    nullif(item.value ->> 'instagramReelTemplateVersion', '')::integer,
    item.value ->> 'instagramReferenceText', item.value ->> 'instagramReferenceTextHash',
    item.value ->> 'instagramLockedAudioAssetId', item.value ->> 'instagramAudioFitMode',
    (item.value ->> 'durationSeconds')::numeric, item.value -> 'layout',
    (item.value ->> 'targetWords')::integer, (item.value ->> 'maxWords')::integer,
    coalesce(item.value -> 'focus', '{}'::jsonb), v_content_plan_id,
    planned_item.item_id
  from jsonb_array_elements(p_assignments) with ordinality as item(value, ordinality)
  join public.wall_text_generation_chunks as chunk
    on chunk.batch_id = batch_record.id
    and chunk.chunk_index = floor((item.ordinality - 1) / 10.0)::integer
  join unnest(v_plan_item_ids) with ordinality as planned_item(item_id, item_ordinal)
    on planned_item.item_ordinal = item.ordinality;

  update public.wall_text_content_plan_items as item
  set status = 'reserved', reserved_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where item.plan_id = v_content_plan_id
    and item.user_id = p_user_id
    and item.id = any(v_plan_item_ids)
    and item.status = 'available';

  if (
    select count(*)
    from public.wall_text_content_plan_items as item
    where item.plan_id = v_content_plan_id
      and item.user_id = p_user_id
      and item.id = any(v_plan_item_ids)
      and item.status = 'reserved'
  ) <> assignment_count then
    raise exception 'wall_text_content_plan_reservation_incomplete';
  end if;

  return next batch_record;
end;
$function$;

COMMENT ON FUNCTION public.reserve_wall_text_generation_batch_v1(text, uuid, integer, text, text, text, text, text, text, jsonb)
  IS 'Reserves only a complete batch of active Wall-of-Text 30-day plan items; it never falls back to unplanned generation.';

CREATE OR REPLACE FUNCTION public.activate_carousel_content_plan (
  p_user_id text,
  p_plan_id uuid
)
  RETURNS public.carousel_content_plans
  LANGUAGE plpgsql
  SET search_path TO ''
AS $function$
declare
  v_brief_count integer;
  v_invalid_brief_item_count integer;
  v_item_count integer;
  v_minimum_day_count integer;
  v_now timestamptz := timezone('utc', now());
  v_plan public.carousel_content_plans%rowtype;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_plan_id is null then
    raise exception 'carousel_content_plan_activation_input_invalid';
  end if;

  select plan.* into v_plan
  from public.carousel_content_plans as plan
  where plan.id = p_plan_id and plan.user_id = p_user_id;
  if not found then
    raise exception 'carousel_content_plan_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'carousel-content-plan:' || p_user_id || ':' || v_plan.business_profile_id::text,
      641902731
    )
  );

  select plan.* into v_plan
  from public.carousel_content_plans as plan
  where plan.id = p_plan_id and plan.user_id = p_user_id
  for update;

  if v_plan.status = 'active' then
    return v_plan;
  end if;
  if v_plan.status <> 'generating' then
    raise exception 'carousel_content_plan_not_activatable';
  end if;

  perform 1
  from public.business_profiles as profile
  where profile.id = v_plan.business_profile_id
    and profile.user_id = p_user_id
    and profile.project_id = v_plan.project_id
    and profile.profile_version = v_plan.business_profile_version
  for share;
  if not found then
    raise exception 'business_profile_version_changed';
  end if;

  if timezone(v_plan.timezone, v_now)::date
       not between v_plan.period_start_date and v_plan.period_end_date then
    raise exception 'carousel_content_plan_period_not_current';
  end if;

  select count(*)::integer into v_item_count
  from public.carousel_content_plan_items as item
  where item.plan_id = v_plan.id
    and item.user_id = p_user_id
    and item.status = 'planned';

  select min(day_items.item_count)::integer into v_minimum_day_count
  from (
    select item.day_number, count(*)::integer as item_count
    from public.carousel_content_plan_items as item
    where item.plan_id = v_plan.id
      and item.user_id = p_user_id
      and item.status = 'planned'
    group by item.day_number
  ) as day_items;

  if v_item_count < v_plan.target_item_count
     or (
       select count(distinct item.day_number)
       from public.carousel_content_plan_items as item
       where item.plan_id = v_plan.id
         and item.user_id = p_user_id
         and item.status = 'planned'
     ) <> 30
     or coalesce(v_minimum_day_count, 0) < 5 then
    raise exception 'carousel_content_plan_incomplete';
  end if;

  if v_plan.planner_prompt_version in (
    'carousel-content-plan-creative-briefs-v2',
    'carousel-content-plan-creative-briefs-v3-explicit-definitions',
    'carousel-content-plan-creative-briefs-v4-diverse-cycle-history',
    'carousel-content-plan-creative-briefs-v5-broad-cycle-history'
  ) then
    select count(*)::integer into v_brief_count
    from public.carousel_content_plan_briefs as brief
    where brief.plan_id = v_plan.id and brief.user_id = p_user_id;

    select count(*)::integer into v_invalid_brief_item_count
    from (
      select item.creative_brief_id
      from public.carousel_content_plan_items as item
      where item.plan_id = v_plan.id
        and item.user_id = p_user_id
        and item.status = 'planned'
      group by item.creative_brief_id
      having item.creative_brief_id is null or count(*) <> 5
    ) as invalid_brief_items;

    if v_brief_count <> 30 or v_invalid_brief_item_count <> 0 then
      raise exception 'carousel_content_plan_creative_briefs_incomplete';
    end if;
  end if;

  update public.carousel_content_plans as prior_plan
  set
    status = 'superseded',
    superseded_at = v_now,
    superseded_by_plan_id = v_plan.id,
    updated_at = v_now
  where prior_plan.user_id = p_user_id
    and prior_plan.business_profile_id = v_plan.business_profile_id
    and prior_plan.id <> v_plan.id
    and prior_plan.status = 'active';

  update public.carousel_content_plan_items as item
  set status = 'available', updated_at = v_now
  where item.plan_id = v_plan.id
    and item.user_id = p_user_id
    and item.status = 'planned';

  update public.carousel_content_plans as plan
  set activated_at = v_now, status = 'active', updated_at = v_now
  where plan.id = v_plan.id
  returning plan.* into v_plan;

  return v_plan;
end;
$function$;

COMMENT ON FUNCTION public.activate_carousel_content_plan(text, uuid)
  IS 'Activates a complete current 30-day plan, including the diverse-cycle-history creative-brief contract.';
