alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_v3_metadata_check;

alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_v4_metadata_check;

alter table public.hook_video_suggestions
  add constraint hook_video_suggestions_v4_metadata_check
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
      and input_context_hash ~ '^[a-f0-9]{64}$'
      and jsonb_typeof(validation_metadata) = 'object'
      and validation_metadata ->> 'passed' = 'true'
      and quality_score between 80 and 100
      and (
        (
          jsonb_array_length(opening_lines) between 1 and 3
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
        )
        or (
          jsonb_array_length(opening_lines) between 1 and 2
          and pattern_id in (
            'mystery_discovery',
            'direct_capability',
            'problem_observation',
            'skeptical_challenge',
            'problem_reversal',
            'workflow_exposed',
            'outcome_without_friction',
            'professional_transformation'
          )
          and pattern_library_version = 'trending-hook-patterns-v2'
          and validator_version = 'trending-hook-validator-v2'
          and validation_metadata ->> 'evidenceBindingPassed' = 'true'
          and jsonb_typeof(validation_metadata -> 'evidenceBindings') = 'array'
          and jsonb_array_length(validation_metadata -> 'evidenceBindings')
            between 1 and 2
          and validation_metadata ->> 'multipleMessagesPassed' = 'true'
          and validation_metadata ->> 'demoExplanationPassed' = 'true'
          and validation_metadata ->> 'secondaryBenefitPassed' = 'true'
          and validation_metadata ->> 'aiLikeLanguagePassed' = 'true'
          and validation_metadata ->> 'intentionalLineBreaksPassed' = 'true'
        )
      )
    )
  ) not valid;

create or replace function public.persist_trending_hook_copy_generation_v4(
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
  persisted_count integer;
  slot_base integer;
begin
  if p_prompt_version <> 'trending-hook-copy-v4'
    or p_selection_version <> 'pattern-diversity-v4'
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'trending_hook_generation_invalid_v4_contract';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 1 or candidate_count > 12 then
    raise exception 'trending_hook_generation_invalid_candidate_count';
  end if;

  for candidate in
    select value
    from jsonb_array_elements(p_candidates)
  loop
    if jsonb_typeof(candidate) <> 'object'
      or jsonb_typeof(candidate -> 'openingLines') <> 'array'
      or jsonb_array_length(candidate -> 'openingLines') not between 1 and 2
      or exists (
        select 1
        from jsonb_array_elements(candidate -> 'openingLines') as line
        where jsonb_typeof(line.value) <> 'string'
          or char_length(trim(line.value #>> '{}')) not between 1 and 78
      )
      or coalesce(trim(candidate ->> 'hookText'), '') <> (
        select string_agg(
          line.value #>> '{}',
          E'\n'
          order by line.ordinality
        )
        from jsonb_array_elements(candidate -> 'openingLines')
          with ordinality as line(value, ordinality)
      )
      or coalesce(candidate ->> 'patternId', '') not in (
        'mystery_discovery',
        'direct_capability',
        'problem_observation',
        'skeptical_challenge',
        'problem_reversal',
        'workflow_exposed',
        'outcome_without_friction',
        'professional_transformation'
      )
      or candidate ->> 'patternLibraryVersion'
        <> 'trending-hook-patterns-v2'
      or candidate ->> 'validatorVersion'
        <> 'trending-hook-validator-v2'
      or coalesce(candidate ->> 'inputContextHash', '')
        !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(candidate -> 'validation') <> 'object'
      or candidate #>> '{validation,passed}' <> 'true'
      or candidate #>> '{validation,evidenceBindingPassed}' <> 'true'
      or jsonb_typeof(
        candidate #> '{validation,evidenceBindings}'
      ) <> 'array'
      or jsonb_array_length(
        candidate #> '{validation,evidenceBindings}'
      ) not between 1 and 2
      or candidate #>> '{validation,multipleMessagesPassed}' <> 'true'
      or candidate #>> '{validation,demoExplanationPassed}' <> 'true'
      or candidate #>> '{validation,secondaryBenefitPassed}' <> 'true'
      or candidate #>> '{validation,aiLikeLanguagePassed}' <> 'true'
      or candidate #>> '{validation,intentionalLineBreaksPassed}' <> 'true'
      or candidate #>> '{readabilityReview,truthful}' <> 'true'
      or candidate #>> '{readabilityReview,claimSafe}' <> 'true'
      or candidate #>> '{readabilityReview,humanVoice}' <> 'true'
      or candidate #>> '{readabilityReview,openingOnly}' <> 'true'
      or candidate #>> '{readabilityReview,singleIdea}' <> 'true'
      or candidate #>> '{readabilityReview,readable}' <> 'true'
      or candidate #>> '{readabilityReview,reactionMatch}' <> 'true'
      or candidate #>> '{readabilityReview,scrollStopping}' <> 'true'
      or (candidate #>> '{readabilityReview,scores,total}')::integer
        not between 80 and 100
      or candidate #>> '{visualFit,overlayVersion}' <> 'hook-overlay-v3'
      or candidate #>> '{visualFit,fits}' <> 'true'
      or (candidate #>> '{visualFit,semanticLineCount}')::integer
        not between 1 and 2
      or (candidate #>> '{visualFit,wordCount}')::integer > 12
      or (candidate #>> '{visualFit,characterCount}')::integer > 78
    then
      raise exception 'trending_hook_generation_invalid_v4_candidate';
    end if;
  end loop;

  persisted_count := public.persist_trending_hook_copy_generation(
    p_job_id,
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    p_prompt_version,
    p_selection_version,
    p_generator_model,
    p_candidates
  );

  select min(suggestion.candidate_index)
  into slot_base
  from public.hook_video_suggestions as suggestion
  where suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.suggestion_context = 'trending';

  if slot_base is null then
    raise exception 'trending_hook_generation_v4_rows_missing';
  end if;

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
    and suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.candidate_index =
      slot_base + (candidate.value ->> 'candidateIndex')::integer;

  return persisted_count;
end;
$$;

revoke all on function public.persist_trending_hook_copy_generation_v4(
  uuid,
  text,
  uuid,
  integer,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.persist_trending_hook_copy_generation_v4(
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
