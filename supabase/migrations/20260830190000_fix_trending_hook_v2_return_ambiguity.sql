-- Fix the atomic Hook wrapper's output-column ambiguity.
-- PostgreSQL can resolve SELECT * from a set-returning function against the
-- wrapper's own OUT parameters (run_id, chunk_id, etc.). Explicit aliases
-- keep the durable V2 setup path deterministic.

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
  select source.run_id,
         source.run_status,
         source.target_valid_count,
         source.completed_valid_count
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
  ) as source;

  return query
  select reserved.run_id,
         reserved.run_status,
         reserved.chunk_id,
         reserved.chunk_number,
         reserved.candidate_payloads,
         reserved.target_valid_count,
         reserved.completed_valid_count,
         reserved.remaining_valid_count
  from public.reserve_trending_hook_generation_chunk_v2(v_run.run_id) as reserved;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.create_or_resume_and_reserve_trending_hook_generation_chunk_v2(text, uuid, integer, text, text, text, integer, jsonb)
  TO postgres, service_role;
REVOKE ALL ON FUNCTION public.create_or_resume_and_reserve_trending_hook_generation_chunk_v2(text, uuid, integer, text, text, text, integer, jsonb)
  FROM PUBLIC, anon, authenticated;

-- The exact-reservation V2 helper also needs explicit aliases because it wraps
-- the legacy set-returning function with the same OUT parameter names.
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
  select reserved.run_id,
         reserved.run_status,
         reserved.chunk_id,
         reserved.chunk_number,
         reserved.candidate_payloads,
         reserved.target_valid_count,
         reserved.completed_valid_count,
         reserved.remaining_valid_count
  from public.reserve_trending_hook_generation_chunk_v1(
    p_run_id,
    greatest(1, least(v_remaining, 12))
  ) as reserved;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.reserve_trending_hook_generation_chunk_v2(uuid)
  TO postgres, service_role;
REVOKE ALL ON FUNCTION public.reserve_trending_hook_generation_chunk_v2(uuid)
  FROM PUBLIC, anon, authenticated;

-- The V2 path calls the existing run-upsert helper. Its conflict target used
-- the same name as the function's OUT parameter (run_id), which PostgreSQL
-- treats as ambiguous in PL/pgSQL. Prefer table columns and name the unique
-- constraint explicitly so candidate persistence is reliable.
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
#variable_conflict use_column
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
  on conflict on constraint trending_hook_generation_run_can_run_id_influencer_video_id_key do nothing;

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
