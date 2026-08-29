-- Keep an active Hook run aligned with a larger entitlement and merge newly
-- discovered source metadata into that same durable run. The target never
-- shrinks: a content-mix change applies to the next daily plan, while work
-- already committed for the current plan is allowed to finish.
CREATE OR REPLACE FUNCTION public.create_or_resume_trending_hook_generation_run_v1 (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_prompt_version           text,
  p_selection_version        text,
  p_source_selection_key     text,
  p_target_valid_count       integer,
  p_candidate_pool           jsonb
)
  RETURNS TABLE (
    run_id                uuid,
    run_status            text,
    target_valid_count    integer,
    completed_valid_count integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_run public.trending_hook_generation_runs%rowtype;
  v_scope_key text;
  v_candidate_count integer;
  v_candidate_order_base integer;
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or coalesce(p_business_profile_version, 0) < 1
    or char_length(trim(coalesce(p_prompt_version, ''))) = 0
    or char_length(trim(coalesce(p_selection_version, ''))) = 0
    or coalesce(p_target_valid_count, 0) not between 1 and 100
    or jsonb_typeof(p_candidate_pool) <> 'array'
  then
    raise exception 'trending_hook_generation_run_invalid_input';
  end if;

  v_candidate_count := jsonb_array_length(p_candidate_pool);

  if v_candidate_count < 1 or v_candidate_count > 600
    or exists (
      select 1
      from jsonb_array_elements(p_candidate_pool) as candidate(value)
      where jsonb_typeof(candidate.value) <> 'object'
        or char_length(trim(coalesce(candidate.value ->> 'influencerVideoId', ''))) = 0
    )
    or (
      select count(distinct trim(candidate.value ->> 'influencerVideoId'))
      from jsonb_array_elements(p_candidate_pool) as candidate(value)
    ) <> v_candidate_count
  then
    raise exception 'trending_hook_generation_run_invalid_candidates';
  end if;

  v_scope_key := concat_ws(
    ':',
    p_user_id,
    p_business_profile_id::text,
    p_business_profile_version::text
  );
  perform pg_advisory_xact_lock(hashtextextended(v_scope_key, 0));

  select *
  into v_run
  from public.trending_hook_generation_runs as run
  where run.user_id = p_user_id
    and run.business_profile_id = p_business_profile_id
    and run.business_profile_version = p_business_profile_version
    and run.status in ('queued', 'processing', 'continuation_pending')
  order by run.created_at desc
  limit 1
  for update;

  if found and v_run.source_selection_key <> coalesce(p_source_selection_key, '') then
    update public.trending_hook_generation_runs
    set
      status = 'superseded',
      last_error = 'The Hook-video source selection changed before this run completed.',
      updated_at = now()
    where id = v_run.id;
    v_run := null;
  end if;

  if v_run.id is null then
    insert into public.trending_hook_generation_runs (
      user_id,
      business_profile_id,
      business_profile_version,
      prompt_version,
      selection_version,
      source_selection_key,
      target_valid_count,
      status
    ) values (
      trim(p_user_id),
      p_business_profile_id,
      p_business_profile_version,
      trim(p_prompt_version),
      trim(p_selection_version),
      coalesce(p_source_selection_key, ''),
      p_target_valid_count,
      'queued'
    )
    returning * into v_run;

    v_candidate_order_base := -1;
  else
    update public.trending_hook_generation_runs as run
    set
      target_valid_count = greatest(
        run.target_valid_count,
        run.completed_valid_count + p_target_valid_count
      ),
      last_error = null,
      updated_at = case
        when run.completed_valid_count + p_target_valid_count > run.target_valid_count then now()
        else run.updated_at
      end
    where run.id = v_run.id
    returning run.* into v_run;

    select coalesce(max(candidate.candidate_order), -1)
    into v_candidate_order_base
    from public.trending_hook_generation_run_candidates as candidate
    where candidate.run_id = v_run.id;
  end if;

  insert into public.trending_hook_generation_run_candidates (
    run_id,
    influencer_video_id,
    candidate_order,
    candidate_payload
  )
  select
    v_run.id,
    trim(candidate.value ->> 'influencerVideoId'),
    v_candidate_order_base + candidate.ordinality,
    candidate.value
  from jsonb_array_elements(p_candidate_pool)
    with ordinality as candidate(value, ordinality)
  on conflict (run_id, influencer_video_id) do nothing;

  return query
  select
    v_run.id,
    v_run.status,
    v_run.target_valid_count,
    v_run.completed_valid_count;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.create_or_resume_trending_hook_generation_run_v1(text, uuid, integer, text, text, text, integer, jsonb)
  TO postgres, service_role;
REVOKE ALL ON FUNCTION public.create_or_resume_trending_hook_generation_run_v1(text, uuid, integer, text, text, text, integer, jsonb)
  FROM PUBLIC, anon, authenticated;

-- Reserve the exact outstanding target whenever it fits in one safe worker
-- payload. Large paid targets continue in bounded groups of twelve, never in
-- the previous arbitrary fixed group of six.
CREATE OR REPLACE FUNCTION public.reserve_trending_hook_generation_chunk_v2 (
  p_run_id uuid
)
  RETURNS TABLE (
    run_id                uuid,
    run_status            text,
    chunk_id              uuid,
    chunk_number          integer,
    candidate_payloads    jsonb,
    target_valid_count    integer,
    completed_valid_count integer,
    remaining_valid_count integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_remaining integer;
begin
  select greatest(run.target_valid_count - run.completed_valid_count, 0)
  into v_remaining
  from public.trending_hook_generation_runs as run
  where run.id = p_run_id
  for update;

  if not found then
    raise exception 'trending_hook_generation_run_not_found';
  end if;

  if v_remaining = 0 then
    update public.trending_hook_generation_runs as run
    set
      status = 'completed',
      completed_at = coalesce(run.completed_at, now()),
      last_error = null,
      updated_at = now()
    where run.id = p_run_id
      and run.status in ('queued', 'processing', 'continuation_pending');
  end if;

  return query
  select *
  from public.reserve_trending_hook_generation_chunk_v1(
    p_run_id,
    greatest(1, least(v_remaining, 12))
  );
end;
$function$;

GRANT EXECUTE ON FUNCTION public.reserve_trending_hook_generation_chunk_v2(uuid)
  TO postgres, service_role;
REVOKE ALL ON FUNCTION public.reserve_trending_hook_generation_chunk_v2(uuid)
  FROM PUBLIC, anon, authenticated;

-- Run creation/resume, exact reservation, and the existing trigger-generated
-- dispatch outbox record commit in the same transaction.
CREATE OR REPLACE FUNCTION public.create_or_resume_and_reserve_trending_hook_generation_chunk_v2 (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_prompt_version           text,
  p_selection_version        text,
  p_source_selection_key     text,
  p_target_valid_count       integer,
  p_candidate_pool           jsonb
)
  RETURNS TABLE (
    run_id                uuid,
    run_status            text,
    chunk_id              uuid,
    chunk_number          integer,
    candidate_payloads    jsonb,
    target_valid_count    integer,
    completed_valid_count integer,
    remaining_valid_count integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_run record;
begin
  select *
  into v_run
  from public.create_or_resume_trending_hook_generation_run_v1(
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    p_prompt_version,
    p_selection_version,
    p_source_selection_key,
    p_target_valid_count,
    p_candidate_pool
  );

  return query
  select *
  from public.reserve_trending_hook_generation_chunk_v2(v_run.run_id);
end;
$function$;

GRANT EXECUTE ON FUNCTION public.create_or_resume_and_reserve_trending_hook_generation_chunk_v2(text, uuid, integer, text, text, text, integer, jsonb)
  TO postgres, service_role;
REVOKE ALL ON FUNCTION public.create_or_resume_and_reserve_trending_hook_generation_chunk_v2(text, uuid, integer, text, text, text, integer, jsonb)
  FROM PUBLIC, anon, authenticated;

-- A worker retry checks durable chunk progress before contacting the model.
-- This avoids a second paid generation when persistence succeeded but the
-- worker response was interrupted before the background job was completed.
CREATE OR REPLACE FUNCTION public.get_trending_hook_generation_chunk_progress_v1 (
  p_run_id   uuid,
  p_chunk_id uuid,
  p_job_id   uuid
)
  RETURNS TABLE (
    accepted_count        integer,
    already_persisted     boolean,
    completed_valid_count integer,
    remaining_valid_count integer,
    run_status            text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_run public.trending_hook_generation_runs%rowtype;
  v_chunk public.trending_hook_generation_run_chunks%rowtype;
begin
  if p_run_id is null or p_chunk_id is null or p_job_id is null then
    raise exception 'trending_hook_generation_chunk_progress_invalid_input';
  end if;

  select *
  into v_run
  from public.trending_hook_generation_runs as run
  where run.id = p_run_id;

  if not found then
    raise exception 'trending_hook_generation_run_not_found';
  end if;

  select *
  into v_chunk
  from public.trending_hook_generation_run_chunks as chunk
  where chunk.id = p_chunk_id
    and chunk.run_id = p_run_id
    and chunk.background_job_id = p_job_id;

  if not found then
    raise exception 'trending_hook_generation_chunk_progress_scope_mismatch';
  end if;

  return query
  select
    v_chunk.accepted_count,
    v_chunk.status = 'completed',
    v_run.completed_valid_count,
    greatest(v_run.target_valid_count - v_run.completed_valid_count, 0),
    v_run.status;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.get_trending_hook_generation_chunk_progress_v1(uuid, uuid, uuid)
  TO postgres, service_role;
REVOKE ALL ON FUNCTION public.get_trending_hook_generation_chunk_progress_v1(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- A continuation chunk must add its valid Hooks without superseding Hooks
-- already saved by an earlier chunk in the same daily run. The legacy V7
-- persistence path replaces the active set and remains untouched for legacy
-- jobs and the user-driven Hook composer.
CREATE OR REPLACE FUNCTION public.persist_trending_hook_copy_generation_append_v1 (
  p_job_id                   uuid,
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_prompt_version           text,
  p_selection_version        text,
  p_generator_model          text,
  p_candidates               jsonb
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_candidate jsonb;
  v_candidate_count integer;
  v_existing_count integer;
  v_item record;
  v_slot_base integer;
  v_slot_index integer;
  v_suggestion_id uuid;
begin
  if p_job_id is null
    or char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or coalesce(p_business_profile_version, 0) < 1
    or p_prompt_version <> 'trending-hook-copy-v7'
    or p_selection_version <> 'reaction-format-map-v2'
    or char_length(trim(coalesce(p_generator_model, ''))) = 0
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'trending_hook_append_invalid_scope';
  end if;

  v_candidate_count := jsonb_array_length(p_candidates);

  if v_candidate_count < 1 or v_candidate_count > 12
    or (
      select count(distinct (item.value ->> 'candidateIndex')::integer)
      from jsonb_array_elements(p_candidates) as item(value)
    ) <> v_candidate_count
    or (
      select count(distinct trim(item.value ->> 'influencerVideoId'))
      from jsonb_array_elements(p_candidates) as item(value)
    ) <> v_candidate_count
  then
    raise exception 'trending_hook_append_invalid_candidates';
  end if;

  if not exists (
    select 1
    from public.background_jobs as job
    where job.id = p_job_id
      and job.user_id = p_user_id
      and job.job_type = 'generate_trending_hook_copy'
  ) or not exists (
    select 1
    from public.business_profiles as profile
    where profile.id = p_business_profile_id
      and profile.user_id = p_user_id
      and profile.profile_version = p_business_profile_version
  ) then
    raise exception 'trending_hook_append_scope_mismatch';
  end if;

  for v_candidate in
    select value from jsonb_array_elements(p_candidates)
  loop
    if not public.hook_copy_v7_candidate_is_valid(v_candidate) then
      raise exception 'trending_hook_append_invalid_candidate';
    end if;
  end loop;

  -- Serialize slot allocation for this profile/version. Multiple worker
  -- instances may finish at once, but each persisted Hook receives one stable
  -- global feed position and the unique candidate index cannot collide.
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_business_profile_id::text || ':' || p_business_profile_version::text,
      0
    )
  );

  select count(*)
  into v_existing_count
  from public.hook_video_suggestions as suggestion
  where suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.suggestion_context = 'trending';

  if v_existing_count > 0 then
    if v_existing_count <> v_candidate_count then
      raise exception 'trending_hook_append_partial_state';
    end if;

    return v_existing_count;
  end if;

  select coalesce(max(suggestion.candidate_index), -1) + 1
  into v_slot_base
  from public.hook_video_suggestions as suggestion
  where suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.suggestion_context = 'trending';

  for v_item in
    select item.value, item.ordinality
    from jsonb_array_elements(p_candidates)
      with ordinality as item(value, ordinality)
    order by item.ordinality
  loop
    v_candidate := v_item.value;
    v_slot_index := v_slot_base + v_item.ordinality::integer - 1;
    v_suggestion_id := gen_random_uuid();

    insert into public.hook_video_suggestions (
      id,
      user_id,
      business_profile_id,
      business_profile_version,
      generation_id,
      generation_job_id,
      candidate_index,
      suggestion_context,
      influencer_id,
      influencer_key,
      influencer_name,
      influencer_video_id,
      influencer_video_title,
      influencer_source,
      reaction_type,
      visual_group,
      demo_asset_id,
      text,
      duration_seconds,
      source_duration_seconds,
      trim_start,
      trim_end,
      thumbnail_url,
      prompt_version,
      selection_version,
      generator_model,
      readability_review,
      visual_fit,
      opening_lines,
      pattern_id,
      pattern_library_version,
      validator_version,
      input_context_hash,
      validation_metadata,
      quality_score,
      campaign_purpose,
      industry_pack_id,
      audio_intent,
      hook_text_format_id,
      hook_text_variant_id,
      hook_text_format_library_version
    ) values (
      v_suggestion_id,
      p_user_id,
      p_business_profile_id,
      p_business_profile_version,
      p_job_id,
      p_job_id,
      v_slot_index,
      'trending',
      trim(v_candidate ->> 'influencerId'),
      nullif(trim(v_candidate ->> 'influencerKey'), ''),
      trim(v_candidate ->> 'influencerName'),
      trim(v_candidate ->> 'influencerVideoId'),
      trim(v_candidate ->> 'influencerVideoTitle'),
      v_candidate ->> 'sourceKind',
      nullif(trim(v_candidate ->> 'reactionType'), ''),
      nullif(trim(v_candidate ->> 'visualGroup'), ''),
      null,
      trim(v_candidate ->> 'hookText'),
      (v_candidate ->> 'durationSeconds')::numeric,
      (v_candidate ->> 'sourceDurationSeconds')::numeric,
      (v_candidate ->> 'trimStart')::numeric,
      (v_candidate ->> 'trimEnd')::numeric,
      nullif(trim(v_candidate ->> 'thumbnailUrl'), ''),
      p_prompt_version,
      p_selection_version,
      p_generator_model,
      v_candidate -> 'readabilityReview',
      v_candidate -> 'visualFit',
      v_candidate -> 'openingLines',
      null,
      null,
      v_candidate ->> 'validatorVersion',
      v_candidate ->> 'inputContextHash',
      v_candidate -> 'validation',
      (v_candidate #>> '{readabilityReview,scores,total}')::integer,
      v_candidate ->> 'campaignPurpose',
      null,
      v_candidate -> 'audioIntent',
      v_candidate ->> 'hookTextFormatId',
      v_candidate ->> 'hookTextVariantId',
      v_candidate ->> 'hookTextFormatLibraryVersion'
    );

    insert into public.user_hook_video_assignments (
      user_id,
      business_profile_id,
      business_profile_version,
      hook_suggestion_id,
      position,
      state
    ) values (
      p_user_id,
      p_business_profile_id,
      p_business_profile_version,
      v_suggestion_id,
      v_slot_index,
      'active'
    );
  end loop;

  return v_candidate_count;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.persist_trending_hook_copy_generation_append_v1(uuid, text, uuid, integer, text, text, text, jsonb)
  TO postgres, service_role;
REVOKE ALL ON FUNCTION public.persist_trending_hook_copy_generation_append_v1(uuid, text, uuid, integer, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;

-- Persist one simplified durable-run chunk and advance the run. Unlike V1,
-- this path appends independently valid Hooks and keeps earlier chunks active.
CREATE OR REPLACE FUNCTION public.persist_trending_hook_generation_chunk_v2 (
  p_run_id                   uuid,
  p_chunk_id                 uuid,
  p_job_id                   uuid,
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_prompt_version           text,
  p_selection_version        text,
  p_generator_model          text,
  p_candidates               jsonb
)
  RETURNS TABLE (
    accepted_count        integer,
    already_persisted     boolean,
    completed_valid_count integer,
    remaining_valid_count integer,
    run_status            text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_run public.trending_hook_generation_runs%rowtype;
  v_chunk public.trending_hook_generation_run_chunks%rowtype;
  v_accepted_count integer;
  v_candidate_count integer;
  v_accepted_video_ids text[];
  v_remaining_before integer;
begin
  if p_run_id is null
    or p_chunk_id is null
    or p_job_id is null
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'trending_hook_generation_run_invalid_persistence_input';
  end if;

  select *
  into v_run
  from public.trending_hook_generation_runs as run
  where run.id = p_run_id
  for update;

  select *
  into v_chunk
  from public.trending_hook_generation_run_chunks as chunk
  where chunk.id = p_chunk_id
    and chunk.run_id = p_run_id
  for update;

  if not found then
    raise exception 'trending_hook_generation_chunk_not_found';
  end if;

  if v_chunk.status = 'completed' then
    return query
    select
      v_chunk.accepted_count,
      true,
      v_run.completed_valid_count,
      greatest(v_run.target_valid_count - v_run.completed_valid_count, 0),
      v_run.status;
    return;
  end if;

  if v_run.status not in ('queued', 'processing', 'continuation_pending')
    or v_chunk.background_job_id <> p_job_id
  then
    raise exception 'trending_hook_generation_run_scope_mismatch';
  end if;

  v_candidate_count := jsonb_array_length(p_candidates);
  v_remaining_before := v_run.target_valid_count - v_run.completed_valid_count;

  if v_candidate_count > v_remaining_before
    or v_candidate_count > v_chunk.candidate_count
    or (
      select count(distinct trim(candidate.value ->> 'influencerVideoId'))
      from jsonb_array_elements(p_candidates) as candidate(value)
    ) <> v_candidate_count
    or exists (
      select 1
      from jsonb_array_elements(p_candidates) as candidate(value)
      where not exists (
        select 1
        from public.trending_hook_generation_run_candidates as source_candidate
        where source_candidate.run_id = p_run_id
          and source_candidate.chunk_id = p_chunk_id
          and source_candidate.influencer_video_id = trim(candidate.value ->> 'influencerVideoId')
      )
    )
  then
    raise exception 'trending_hook_generation_run_invalid_persistence_candidates';
  end if;

  if v_candidate_count = 0 then
    v_accepted_count := 0;
  else
    v_accepted_count := public.persist_trending_hook_copy_generation_append_v1(
      p_job_id,
      p_user_id,
      p_business_profile_id,
      p_business_profile_version,
      p_prompt_version,
      p_selection_version,
      p_generator_model,
      p_candidates
    );
  end if;

  if v_accepted_count <> v_candidate_count then
    raise exception 'trending_hook_generation_run_persistence_mismatch';
  end if;

  select array_agg(trim(candidate.value ->> 'influencerVideoId'))
  into v_accepted_video_ids
  from jsonb_array_elements(p_candidates) as candidate(value);

  update public.trending_hook_generation_run_candidates as candidate
  set
    state = case
      when candidate.influencer_video_id = any(v_accepted_video_ids) then 'accepted'
      else 'rejected'
    end,
    attempted_at = now(),
    updated_at = now()
  where candidate.run_id = p_run_id
    and candidate.chunk_id = p_chunk_id
    and candidate.state = 'reserved';

  update public.trending_hook_generation_run_chunks
  set
    accepted_count = v_accepted_count,
    rejected_count = candidate_count - v_accepted_count,
    status = 'completed',
    completed_at = now(),
    last_error = null,
    updated_at = now()
  where id = p_chunk_id;

  update public.trending_hook_generation_runs as run
  set
    completed_valid_count = run.completed_valid_count + v_accepted_count,
    status = case
      when run.completed_valid_count + v_accepted_count >= run.target_valid_count then 'completed'
      else 'continuation_pending'
    end,
    completed_at = case
      when run.completed_valid_count + v_accepted_count >= run.target_valid_count then now()
      else null
    end,
    last_error = null,
    updated_at = now()
  where run.id = p_run_id
  returning run.* into v_run;

  return query
  select
    v_accepted_count,
    false,
    v_run.completed_valid_count,
    greatest(v_run.target_valid_count - v_run.completed_valid_count, 0),
    v_run.status;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.persist_trending_hook_generation_chunk_v2(uuid, uuid, uuid, text, uuid, integer, text, text, text, jsonb)
  TO postgres, service_role;
REVOKE ALL ON FUNCTION public.persist_trending_hook_generation_chunk_v2(uuid, uuid, uuid, text, uuid, integer, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;

-- Emergency repair for old queued runs that predate the atomic first-batch
-- setup. This safety path now uses the same exact-missing reservation rule.
CREATE OR REPLACE FUNCTION public.reserve_missing_initial_trending_hook_generation_chunks_v2 (
  p_limit integer DEFAULT 25
)
  RETURNS TABLE (
    run_id   uuid,
    chunk_id uuid,
    user_id  text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_run record;
  v_reserved record;
begin
  for v_run in
    select run.id, run.user_id
    from public.trending_hook_generation_runs as run
    where run.status = 'queued'
      and not exists (
        select 1
        from public.trending_hook_generation_run_chunks as chunk
        where chunk.run_id = run.id
      )
    order by run.created_at, run.id
    limit v_limit
    for update of run skip locked
  loop
    select *
    into v_reserved
    from public.reserve_trending_hook_generation_chunk_v2(v_run.id);

    if v_reserved.chunk_id is not null then
      return query
      select v_reserved.run_id, v_reserved.chunk_id, v_run.user_id;
    end if;
  end loop;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.reserve_missing_initial_trending_hook_generation_chunks_v2(integer)
  TO postgres, service_role;
REVOKE ALL ON FUNCTION public.reserve_missing_initial_trending_hook_generation_chunks_v2(integer)
  FROM PUBLIC, anon, authenticated;
