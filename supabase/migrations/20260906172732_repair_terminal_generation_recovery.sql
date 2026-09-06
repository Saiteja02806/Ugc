-- Recover closed Carousel reservations without rewriting their provenance.
CREATE OR REPLACE FUNCTION public.replace_partial_daily_carousel_refill_batch_if_profile_current(p_user_id text, p_business_profile_id uuid, p_business_profile_version integer, p_feed_id uuid, p_expected_generation_batch_id uuid, p_requested_count integer)
 RETURNS daily_carousel_refill_batches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_existing public.daily_carousel_refill_batches%rowtype;
  v_feed_local_date date;
  v_replacement public.daily_carousel_refill_batches%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if
    p_feed_id is null
    or p_expected_generation_batch_id is null
    or p_requested_count is null
    or p_requested_count < 1
    or p_requested_count > 50
  then
    raise exception 'invalid_daily_carousel_refill_replacement_request';
  end if;

  perform public.assert_business_profile_version_current(
    p_user_id,
    p_business_profile_id,
    p_business_profile_version
  );

  select feed.local_date
  into v_feed_local_date
  from public.daily_carousel_feeds as feed
  where feed.id = p_feed_id
    and feed.user_id = p_user_id
  for share;

  if not found then
    raise exception 'daily_carousel_refill_feed_mismatch';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('daily-carousel-refill:' || p_feed_id::text, 152039841)
  );

  select batch.*
  into v_existing
  from public.daily_carousel_refill_batches as batch
  where batch.feed_id = p_feed_id
    and batch.business_profile_id = p_business_profile_id
    and batch.business_profile_version = p_business_profile_version
    and batch.superseded_at is null
  for update;

  if not found
     or v_existing.generation_batch_id <> p_expected_generation_batch_id then
    return null;
  end if;

  if v_existing.user_id <> p_user_id
     or v_existing.local_date <> v_feed_local_date then
    raise exception 'daily_carousel_refill_ownership_mismatch';
  end if;

  -- Do not abandon a still-running candidate. A failed/cancelled background
  -- job is terminal even if its generation row has not yet been updated.
  if exists (
    select 1
    from public.carousel_generations as generation
    left join public.background_jobs as job
      on job.id::text = generation.trigger_run_id
    where generation.generation_batch_id = v_existing.generation_batch_id
      and (
        job.status not in ('failed', 'cancelled', 'completed')
        or (generation.status = 'processing' and job.id is null)
      )
  ) then
    return null;
  end if;

  if not exists (
    select 1
    from public.carousel_generations as generation
    left join public.background_jobs as job
      on job.id::text = generation.trigger_run_id
    where generation.generation_batch_id = v_existing.generation_batch_id
      and (
        generation.status = 'failed'
        or job.status in ('failed', 'cancelled')
      )
  ) then
    return null;
  end if;

  -- Partial reservations and fully failed reservations attached to a durable
  -- writer must not be reopened. Preserve their history and start a successor.
  -- Jobless, unconsumed preparations retain their existing exact-item recovery.
  if not exists (
    select 1
    from public.carousel_generations as generation
    join public.carousel_content_plan_reservations as reservation
      on reservation.id = generation.content_plan_reservation_id
      and reservation.user_id = generation.user_id
    where generation.generation_batch_id = v_existing.generation_batch_id
      and reservation.user_id = p_user_id
      and (
        (reservation.status in ('released_partial', 'expired_partial')
          and reservation.consumed_count > 0)
        or (reservation.status in ('released', 'expired')
          and reservation.consumed_count = 0
          and generation.trigger_run_id is not null)
      )
  ) then
    return null;
  end if;

  -- Retire the active row before inserting because the partial unique index
  -- intentionally allows exactly one active batch for this feed/profile.
  update public.daily_carousel_refill_batches as batch
  set
    superseded_at = v_now,
    updated_at = v_now
  where batch.id = v_existing.id
    and batch.superseded_at is null;

  if not found then
    raise exception 'daily_carousel_refill_replacement_race';
  end if;

  insert into public.daily_carousel_refill_batches (
    business_profile_id,
    business_profile_version,
    feed_id,
    local_date,
    replacement_sequence,
    requested_count,
    user_id
  ) values (
    p_business_profile_id,
    p_business_profile_version,
    p_feed_id,
    v_feed_local_date,
    v_existing.replacement_sequence + 1,
    p_requested_count,
    p_user_id
  )
  returning * into v_replacement;

  update public.daily_carousel_refill_batches as batch
  set
    superseded_by_batch_id = v_replacement.id,
    updated_at = v_now
  where batch.id = v_existing.id
    and batch.superseded_at = v_now;

  return v_replacement;
end;
$function$;

-- A job row is the first lock in reservation/claim/terminal cleanup. This
-- fences late HTTP work after cancellation without changing legacy callers.
CREATE OR REPLACE FUNCTION public.assert_wall_text_generation_job_active(
  p_user_id text, p_request_key text, p_profile_id uuid, p_profile_version integer
) RETURNS void LANGUAGE plpgsql SET search_path TO '' AS $function$
declare
  v_job public.background_jobs%rowtype;
begin
  select job.* into v_job from public.background_jobs as job
  where job.user_id = p_user_id and job.job_type = 'wall_text_generation'
    and job.idempotency_key = p_request_key
  for share;
  if not found then return; end if;
  if v_job.input_json->>'userId' is distinct from p_user_id
    or v_job.input_json->>'businessProfileId' is distinct from p_profile_id::text
    or v_job.input_json->>'businessProfileVersion' is distinct from p_profile_version::text
    or v_job.input_json->>'requestKey' is distinct from p_request_key then
    raise exception 'wall_text_generation_job_ownership_mismatch';
  end if;
  if v_job.status not in ('queued', 'processing', 'waiting_external_service', 'retrying') then
    raise exception 'wall_text_generation_parent_not_active';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.terminalize_wall_text_generation_for_job(p_job_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare
  v_job public.background_jobs%rowtype;
  v_batch public.wall_text_generation_batches%rowtype;
  v_now timestamptz := clock_timestamp();
  v_count integer := 0;
  v_code text;
begin
  select job.* into v_job from public.background_jobs as job
  where job.id = p_job_id for update;
  if not found or v_job.job_type <> 'wall_text_generation' then return 0; end if;
  -- A retryable failure with remaining attempts may still resume this batch.
  if not (v_job.status = 'cancelled' or (v_job.status = 'failed' and (
    v_job.attempt_count >= v_job.max_attempts or coalesce(v_job.error_code in (
      'wall_text_persistence_rejected', 'wall_text_render_fit_rejected',
      'wall_text_runtime_configuration_error', 'wall_text_dependency_unavailable',
      'content_retry_exhausted'
    ), false)
  ))) then return 0; end if;
  v_code := coalesce(v_job.error_code, 'wall_text_parent_terminal');

  for v_batch in
    select batch.* from public.wall_text_generation_batches as batch
    where batch.user_id = v_job.user_id
      and batch.request_key = v_job.idempotency_key
      and batch.request_key = v_job.input_json->>'requestKey'
      and batch.user_id = v_job.input_json->>'userId'
      and batch.business_profile_id::text = v_job.input_json->>'businessProfileId'
      and batch.business_profile_version::text = v_job.input_json->>'businessProfileVersion'
      and batch.status <> 'completed'
  loop
    -- Match save/claim lock order: chunks, assignments, plan items, batch.
    perform 1 from public.wall_text_generation_chunks as chunk
    where chunk.batch_id = v_batch.id order by chunk.id for update;
    update public.wall_text_generation_chunks as chunk
    set status = 'failed', claim_token = null, locked_at = null,
        last_error_code = v_code, last_error_message = left(v_job.error_message, 1000),
        completed_at = coalesce(chunk.completed_at, v_now), updated_at = v_now
    where chunk.batch_id = v_batch.id and chunk.status <> 'completed';
    update public.wall_text_generation_assignments as assignment
    set status = 'failed', last_failure_code = v_code, updated_at = v_now
    where assignment.batch_id = v_batch.id and assignment.status <> 'completed';
    -- Retire only ideas still reserved by these unfinished assignments.
    -- Completed creatives and consumed ideas retain their original provenance.
    update public.wall_text_content_plan_items as item
    set status = 'retired', retired_at = v_now, retirement_reason = v_code, updated_at = v_now
    where item.user_id = v_job.user_id and item.status = 'reserved'
      and exists (
        select 1 from public.wall_text_generation_assignments as assignment
        where assignment.batch_id = v_batch.id and assignment.status = 'failed'
          and assignment.wall_text_content_plan_item_id = item.id
      )
      and not exists (
        select 1 from public.wall_text_generation_assignments as other_assignment
        join public.wall_text_generation_batches as other_batch on other_batch.id = other_assignment.batch_id
        where other_assignment.wall_text_content_plan_item_id = item.id
          and other_assignment.batch_id <> v_batch.id
          and other_assignment.status in ('pending', 'processing', 'retry_pending')
          and other_batch.status in ('pending', 'processing')
      );
    update public.wall_text_generation_batches as batch
    set status = 'failed', completed_at = coalesce(batch.completed_at, v_now), updated_at = v_now
    where batch.id = v_batch.id and batch.status <> 'completed';
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.terminalize_wall_text_generation_on_job_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
begin
  perform public.terminalize_wall_text_generation_for_job(new.id);
  return new;
end;
$function$;

CREATE TRIGGER terminalize_wall_text_generation_on_job_status_trigger
AFTER UPDATE OF status ON public.background_jobs
FOR EACH ROW WHEN (NEW.job_type = 'wall_text_generation' AND NEW.status IN ('failed', 'cancelled'))
EXECUTE FUNCTION public.terminalize_wall_text_generation_on_job_status();

REVOKE ALL ON FUNCTION public.assert_wall_text_generation_job_active(text,text,uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.terminalize_wall_text_generation_for_job(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.terminalize_wall_text_generation_on_job_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_wall_text_generation_job_active(text,text,uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.terminalize_wall_text_generation_for_job(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_wall_text_generation_batch_v1(p_user_id text, p_business_profile_id uuid, p_business_profile_version integer, p_request_key text, p_request_hash text, p_generator_version text, p_prompt_version text, p_format_library_version text, p_selector_version text, p_assignments jsonb)
 RETURNS SETOF wall_text_generation_batches
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
  perform public.assert_wall_text_generation_job_active(
    p_user_id, p_request_key, p_business_profile_id, p_business_profile_version
  );
  assignment_count := jsonb_array_length(p_assignments);
  if jsonb_typeof(p_assignments) <> 'array' or assignment_count < 1 or assignment_count > 50 then
    raise exception 'wall_text_batch_invalid_assignments';
  end if;

  select count(*) into ordinary_assignment_count
  from jsonb_array_elements(p_assignments) as item(value)
  where item.value ->> 'sourceKind' <> 'instagram_reel';

  perform 1 from public.business_profiles as profile
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
    where item ->> 'assignedFormatId' is not null and item ->> 'sourceKind' <> 'instagram_reel'
    group by item ->> 'assignedFormatId'
    having count(*) > floor(ordinary_assignment_count * 0.5)
  ) then
    raise exception 'wall_text_batch_format_share_exceeded';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_assignments) as item(value)
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
      and (item.value ->> 'instagramReelTemplateId' is not null
        or item.value ->> 'instagramReelTemplateVersion' is not null
        or item.value ->> 'instagramReferenceText' is not null
        or item.value ->> 'instagramReferenceTextHash' is not null
        or item.value ->> 'instagramLockedAudioAssetId' is not null
        or item.value ->> 'instagramAudioFitMode' is not null)
  ) then
    raise exception 'wall_text_non_instagram_snapshot_invalid';
  end if;

  select greatest(
    coalesce((select max(creative.candidate_index) + 1 from public.wall_text_creatives as creative
      where creative.user_id = p_user_id and creative.business_profile_id = p_business_profile_id
        and creative.business_profile_version = p_business_profile_version), 0),
    coalesce((select max(batch.candidate_index_start + batch.requested_count)
      from public.wall_text_generation_batches as batch
      where batch.user_id = p_user_id and batch.business_profile_id = p_business_profile_id
        and batch.business_profile_version = p_business_profile_version), 0)
  ) into candidate_start;

  -- There is deliberately no direct-generation fallback. A pending plan is a
  -- durable planning dependency; an active plan is a rotating source pool.
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

  select array_agg(candidate.id order by candidate.fresh_rank, candidate.last_used_at nulls first, candidate.use_count, candidate.sequence_index)
  into v_plan_item_ids
  from (
    select item.id,
           case when item.status = 'available' then 0 else 1 end as fresh_rank,
           item.last_used_at, item.use_count, item.sequence_index
    from public.wall_text_content_plan_items as item
    where item.plan_id = v_content_plan_id
      and item.user_id = p_user_id
      and (
        item.status = 'available'
        or (
          item.status = 'consumed'
          and not exists (
            select 1
            from public.wall_text_generation_assignments as prior_assignment
            join public.wall_text_generation_batches as prior_batch on prior_batch.id = prior_assignment.batch_id
            where prior_assignment.wall_text_content_plan_item_id = item.id
              and prior_batch.status in ('pending', 'processing')
          )
        )
      )
    order by case when item.status = 'available' then 0 else 1 end,
             item.last_used_at nulls first, item.use_count, item.sequence_index
    limit assignment_count
    for update of item skip locked
  ) as candidate;

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
  set status = 'reserved', reserved_at = timezone('utc', now()), consumed_at = null,
      updated_at = timezone('utc', now())
  where item.plan_id = v_content_plan_id
    and item.user_id = p_user_id
    and item.id = any(v_plan_item_ids)
    and item.status in ('available', 'consumed');

  if (
    select count(*) from public.wall_text_content_plan_items as item
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

CREATE OR REPLACE FUNCTION public.claim_wall_text_generation_chunk_v1(p_user_id text, p_chunk_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  chunk_record public.wall_text_generation_chunks;
  next_claim_token uuid;
  v_batch public.wall_text_generation_batches%rowtype;
begin
  select batch.* into v_batch
  from public.wall_text_generation_batches as batch
  join public.wall_text_generation_chunks as chunk on chunk.batch_id = batch.id
  where chunk.id = p_chunk_id and batch.user_id = p_user_id;
  if not found then raise exception 'wall_text_generation_chunk_unavailable'; end if;
  perform public.assert_wall_text_generation_job_active(
    p_user_id, v_batch.request_key, v_batch.business_profile_id, v_batch.business_profile_version
  );
  if v_batch.status = 'failed' then raise exception 'wall_text_generation_batch_failed'; end if;
  select chunk.* into chunk_record
  from public.wall_text_generation_chunks as chunk
  join public.wall_text_generation_batches as batch
    on batch.id = chunk.batch_id
  where chunk.id = p_chunk_id
    and batch.user_id = p_user_id
  for update of chunk;
  if not found then
    raise exception 'wall_text_generation_chunk_unavailable';
  end if;

  if chunk_record.status = 'completed' then
    return null;
  end if;
  if chunk_record.status = 'failed' then
    raise exception 'wall_text_generation_chunk_failed';
  end if;
  if chunk_record.status = 'processing'
    and chunk_record.locked_at > now() - interval '15 minutes'
  then
    return null;
  end if;

  next_claim_token := gen_random_uuid();

  update public.wall_text_generation_chunks
  set
    attempt_count = attempt_count + 1,
    claim_token = next_claim_token,
    last_error_code = null,
    last_error_message = null,
    locked_at = now(),
    status = 'processing',
    updated_at = now()
  where id = p_chunk_id;

  update public.wall_text_generation_assignments
  set status = 'processing', updated_at = now()
  where chunk_id = p_chunk_id
    and status <> 'completed';

  update public.wall_text_generation_batches
  set status = 'processing', updated_at = now()
  where id = chunk_record.batch_id
    and status <> 'completed';

  return next_claim_token;
end;
$function$;

SELECT pg_notify('pgrst', 'reload schema');
