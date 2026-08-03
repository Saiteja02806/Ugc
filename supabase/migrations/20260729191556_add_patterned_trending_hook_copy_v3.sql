alter table public.hook_video_suggestions
  add column if not exists opening_lines jsonb,
  add column if not exists pattern_id text,
  add column if not exists pattern_library_version text,
  add column if not exists validator_version text,
  add column if not exists input_context_hash text,
  add column if not exists validation_metadata jsonb,
  add column if not exists quality_score integer;

alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_v3_metadata_check;

alter table public.hook_video_suggestions
  add constraint hook_video_suggestions_v3_metadata_check
  check (
    (
      opening_lines is null
      and pattern_id is null
      and pattern_library_version is null
      and validator_version is null
      and input_context_hash is null
      and validation_metadata is null
      and quality_score is null
    )
    or (
      suggestion_context = 'trending'
      and jsonb_typeof(opening_lines) = 'array'
      and jsonb_array_length(opening_lines) between 1 and 3
      and pattern_id in (
        'mystery_discovery',
        'direct_capability',
        'painful_truth',
        'skeptical_challenge',
        'problem_reversal',
        'workflow_exposed',
        'outcome_without_friction',
        'professional_transformation'
      )
      and pattern_library_version = 'trending-hook-patterns-v1'
      and validator_version = 'trending-hook-validator-v1'
      and input_context_hash ~ '^[a-f0-9]{64}$'
      and jsonb_typeof(validation_metadata) = 'object'
      and validation_metadata ->> 'passed' = 'true'
      and quality_score between 80 and 100
    )
  ) not valid;

create index if not exists
  hook_video_suggestions_pattern_performance_idx
  on public.hook_video_suggestions (
    pattern_id,
    quality_score desc
  )
  where pattern_id is not null;

create or replace function public.persist_trending_hook_copy_generation(
  p_job_id uuid,
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_prompt_version text,
  p_selection_version text,
  p_generator_model text,
  p_candidates jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate jsonb;
  candidate_count integer;
  existing_count integer;
  persisted_count integer;
  slot_base integer;
  slotted_candidates jsonb;
begin
  if jsonb_typeof(p_candidates) <> 'array' then
    raise exception 'trending_hook_generation_invalid_candidate_batch';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 1 or candidate_count > 12 then
    raise exception 'trending_hook_generation_invalid_candidate_count';
  end if;

  if p_prompt_version = 'trending-hook-copy-v3' then
    for candidate in
      select value
      from jsonb_array_elements(p_candidates)
    loop
      if jsonb_typeof(candidate) <> 'object'
        or jsonb_typeof(candidate -> 'openingLines') <> 'array'
        or jsonb_array_length(candidate -> 'openingLines')
          not between 1 and 3
        or exists (
          select 1
          from jsonb_array_elements(candidate -> 'openingLines') as line
          where jsonb_typeof(line.value) <> 'string'
            or char_length(trim(line.value #>> '{}')) not between 1 and 100
        )
        or coalesce(trim(candidate ->> 'hookText'), '') <> (
          select string_agg(line.value #>> '{}', E'\n' order by line.ordinality)
          from jsonb_array_elements(candidate -> 'openingLines')
            with ordinality as line(value, ordinality)
        )
        or coalesce(candidate ->> 'patternId', '') not in (
          'mystery_discovery',
          'direct_capability',
          'painful_truth',
          'skeptical_challenge',
          'problem_reversal',
          'workflow_exposed',
          'outcome_without_friction',
          'professional_transformation'
        )
        or candidate ->> 'patternLibraryVersion'
          <> 'trending-hook-patterns-v1'
        or candidate ->> 'validatorVersion'
          <> 'trending-hook-validator-v1'
        or coalesce(candidate ->> 'inputContextHash', '')
          !~ '^[a-f0-9]{64}$'
        or jsonb_typeof(candidate -> 'validation') <> 'object'
        or candidate #>> '{validation,passed}' <> 'true'
        or candidate #>> '{readabilityReview,truthful}' <> 'true'
        or candidate #>> '{readabilityReview,claimSafe}' <> 'true'
        or (candidate #>> '{readabilityReview,scores,total}')::integer
          not between 80 and 100
        or candidate #>> '{visualFit,overlayVersion}'
          <> 'hook-overlay-v3'
        or candidate #>> '{visualFit,fits}' <> 'true'
      then
        raise exception 'trending_hook_generation_invalid_v3_candidate';
      end if;
    end loop;
  end if;

  select count(*)
  into existing_count
  from public.hook_video_suggestions as suggestion
  where suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.suggestion_context = 'trending';

  if existing_count > 0 then
    return existing_count;
  end if;

  select coalesce(max(suggestion.candidate_index), -1) + 1
  into slot_base
  from public.hook_video_suggestions as suggestion
  where suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.suggestion_context = 'trending';

  select jsonb_agg(
    jsonb_set(
      item.value,
      '{candidateIndex}',
      to_jsonb(
        slot_base + (item.value ->> 'candidateIndex')::integer
      ),
      false
    )
    order by item.ordinality
  )
  into slotted_candidates
  from jsonb_array_elements(p_candidates)
    with ordinality as item(value, ordinality);

  persisted_count :=
    public.persist_trending_hook_copy_generation_slot_internal(
      p_job_id,
      p_user_id,
      p_business_profile_id,
      p_business_profile_version,
      p_prompt_version,
      p_selection_version,
      p_generator_model,
      slotted_candidates
    );

  if p_prompt_version = 'trending-hook-copy-v3' then
    update public.hook_video_suggestions as suggestion
    set
      opening_lines = candidate.value -> 'openingLines',
      pattern_id = candidate.value ->> 'patternId',
      pattern_library_version =
        candidate.value ->> 'patternLibraryVersion',
      validator_version = candidate.value ->> 'validatorVersion',
      input_context_hash = candidate.value ->> 'inputContextHash',
      validation_metadata = candidate.value -> 'validation',
      quality_score = (
        candidate.value #>> '{readabilityReview,scores,total}'
      )::integer
    from jsonb_array_elements(p_candidates) as candidate(value)
    where suggestion.generation_job_id = p_job_id
      and suggestion.user_id = p_user_id
      and suggestion.candidate_index =
        slot_base + (candidate.value ->> 'candidateIndex')::integer;
  end if;

  update public.user_hook_video_assignments as assignment
  set
    position = suggestion.candidate_index - slot_base,
    updated_at = now()
  from public.hook_video_suggestions as suggestion
  where assignment.hook_suggestion_id = suggestion.id
    and suggestion.generation_job_id = p_job_id
    and assignment.user_id = p_user_id
    and assignment.business_profile_id = p_business_profile_id
    and assignment.business_profile_version = p_business_profile_version;

  return persisted_count;
end;
$$;

revoke all on function public.persist_trending_hook_copy_generation(
  uuid,
  text,
  uuid,
  integer,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.persist_trending_hook_copy_generation(
  uuid,
  text,
  uuid,
  integer,
  text,
  text,
  text,
  jsonb
) to service_role;

select pg_notify('pgrst', 'reload schema');
