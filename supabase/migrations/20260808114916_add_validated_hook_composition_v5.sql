-- Both the Trending feed and the demo-composition flow now use the same
-- validated Hook engine. Keep the extra context durable so performance can be
-- attributed without exposing technical scoring to customers.
alter table public.hook_video_suggestions
  add column if not exists campaign_purpose text,
  add column if not exists industry_pack_id text;

-- This used to be a table-wide constraint despite its name. Composition
-- suggestions reuse candidate indexes for each new demo, so it caused a real
-- collision after a user generated suggestions for more than one demo. Only
-- the Trending feed needs a stable unique candidate slot.
alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_trending_candidate_unique;

create unique index if not exists hook_video_suggestions_trending_candidate_unique_idx
  on public.hook_video_suggestions (
    business_profile_id,
    business_profile_version,
    candidate_index
  )
  where suggestion_context = 'trending'
    and candidate_index is not null;

alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_campaign_purpose_check;

alter table public.hook_video_suggestions
  add constraint hook_video_suggestions_campaign_purpose_check
  check (
    campaign_purpose is null or campaign_purpose in (
      'product_discovery',
      'education',
      'conversion',
      'retargeting',
      'app_install'
    )
  ) not valid;

alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_industry_pack_check;

alter table public.hook_video_suggestions
  add constraint hook_video_suggestions_industry_pack_check
  check (
    industry_pack_id is null or industry_pack_id in (
      'mobile_app',
      'ecommerce',
      'saas',
      'agency_services',
      'health_wellness',
      'finance',
      'education',
      'food_hospitality',
      'general'
    )
  ) not valid;

create index if not exists hook_video_suggestions_learning_idx
  on public.hook_video_suggestions (
    business_profile_id,
    campaign_purpose,
    industry_pack_id,
    pattern_id
  )
  where pattern_id is not null;

-- Keep the strict v5 validation in the persistence functions below. The table
-- check remains deliberately compatible with older, already-persisted v1-v4
-- Trending rows so they can still be read and edited safely.
alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_generation_metadata_check;

alter table public.hook_video_suggestions
  add constraint hook_video_suggestions_generation_metadata_v5_check
  check (
    (
      prompt_version is null
      and selection_version is null
      and generator_model is null
      and generation_job_id is null
      and readability_review is null
      and visual_fit is null
    )
    or
    (
      suggestion_context in ('trending', 'composition')
      and prompt_version is not null
      and selection_version is not null
      and generator_model is not null
      and generation_job_id is not null
      and jsonb_typeof(readability_review) = 'object'
      and readability_review ->> 'readable' = 'true'
      and readability_review ->> 'reactionMatch' = 'true'
      and readability_review ->> 'scrollStopping' = 'true'
      and jsonb_typeof(visual_fit) = 'object'
      and visual_fit ->> 'fits' = 'true'
    )
  ) not valid;

alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_v4_metadata_check;

alter table public.hook_video_suggestions
  add constraint hook_video_suggestions_v5_metadata_check
  check (
    (
      opening_lines is null
      and pattern_id is null
      and pattern_library_version is null
      and validator_version is null
      and input_context_hash is null
      and validation_metadata is null
      and quality_score is null
      and campaign_purpose is null
      and industry_pack_id is null
    )
    or
    (
      suggestion_context in ('trending', 'composition')
      and jsonb_typeof(opening_lines) = 'array'
      and jsonb_array_length(opening_lines) between 1 and 2
      and input_context_hash ~ '^[a-f0-9]{64}$'
      and jsonb_typeof(validation_metadata) = 'object'
      and validation_metadata ->> 'passed' = 'true'
      and quality_score between 80 and 100
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
      and pattern_library_version in (
        'trending-hook-patterns-v1',
        'trending-hook-patterns-v2',
        'trending-hook-patterns-v3'
      )
      and validator_version in (
        'trending-hook-validator-v1',
        'trending-hook-validator-v2',
        'trending-hook-validator-v3'
      )
      and (
        suggestion_context = 'trending'
        or (
          demo_asset_id is not null
          and campaign_purpose is not null
          and industry_pack_id is not null
        )
      )
    )
  ) not valid;

create or replace function public.hook_copy_v5_candidate_is_valid(
  p_candidate jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_lines jsonb;
  v_text text;
  v_line_count integer;
  v_word_count integer;
  v_character_count integer;
  v_score integer;
begin
  if jsonb_typeof(p_candidate) <> 'object' then
    return false;
  end if;

  v_lines := p_candidate -> 'openingLines';
  v_text := trim(coalesce(p_candidate ->> 'hookText', ''));

  if jsonb_typeof(v_lines) <> 'array' or
     jsonb_array_length(v_lines) not between 1 and 2 or
     coalesce(
       (
         select string_agg(line.value #>> '{}', E'\n' order by line.ordinality)
         from jsonb_array_elements(v_lines)
           with ordinality as line(value, ordinality)
       ),
       ''
     ) <> v_text or
     exists (
       select 1
       from jsonb_array_elements(v_lines) as line(value)
       where jsonb_typeof(line.value) <> 'string'
         or char_length(trim(line.value #>> '{}')) not between 1 and 78
     ) then
    return false;
  end if;

  v_word_count := cardinality(regexp_split_to_array(v_text, '\s+'));
  v_character_count := char_length(replace(v_text, E'\n', ' '));
  v_score := (p_candidate #>> '{readabilityReview,scores,total}')::integer;

  return
    (p_candidate ->> 'candidateIndex') ~ '^\d+$'
    and (p_candidate ->> 'durationSeconds')::numeric > 0
    and (p_candidate ->> 'sourceDurationSeconds')::numeric > 0
    and (p_candidate ->> 'durationSeconds')::numeric <=
      (p_candidate ->> 'sourceDurationSeconds')::numeric
    and (p_candidate ->> 'trimStart')::numeric >= 0
    and (
      (p_candidate ->> 'trimEnd') is null or
      (p_candidate ->> 'trimEnd')::numeric >
        (p_candidate ->> 'trimStart')::numeric
    )
    and char_length(trim(coalesce(p_candidate ->> 'influencerId', '')))
      between 1 and 180
    and char_length(trim(coalesce(p_candidate ->> 'influencerName', '')))
      between 1 and 140
    and char_length(trim(coalesce(p_candidate ->> 'influencerVideoId', '')))
      between 1 and 180
    and char_length(trim(coalesce(p_candidate ->> 'influencerVideoTitle', '')))
      between 1 and 180
    and coalesce(p_candidate ->> 'sourceKind', '') in ('catalog', 'user')
    and coalesce(p_candidate ->> 'patternId', '') in (
      'mystery_discovery',
      'direct_capability',
      'problem_observation',
      'skeptical_challenge',
      'problem_reversal',
      'workflow_exposed',
      'outcome_without_friction',
      'professional_transformation'
    )
    and p_candidate ->> 'patternLibraryVersion' =
      'trending-hook-patterns-v3'
    and p_candidate ->> 'validatorVersion' =
      'trending-hook-validator-v3'
    and coalesce(p_candidate ->> 'inputContextHash', '') ~ '^[a-f0-9]{64}$'
    and coalesce(p_candidate ->> 'campaignPurpose', '') in (
      'product_discovery',
      'education',
      'conversion',
      'retargeting',
      'app_install'
    )
    and coalesce(p_candidate ->> 'industryPackId', '') in (
      'mobile_app',
      'ecommerce',
      'saas',
      'agency_services',
      'health_wellness',
      'finance',
      'education',
      'food_hospitality',
      'general'
    )
    and jsonb_typeof(p_candidate -> 'validation') = 'object'
    and p_candidate #>> '{validation,passed}' = 'true'
    and p_candidate #>> '{validation,evidenceBindingPassed}' = 'true'
    and jsonb_typeof(p_candidate #> '{validation,evidenceBindings}') = 'array'
    and jsonb_array_length(p_candidate #> '{validation,evidenceBindings}')
      between 1 and 2
    and p_candidate #>> '{validation,multipleMessagesPassed}' = 'true'
    and p_candidate #>> '{validation,demoExplanationPassed}' = 'true'
    and p_candidate #>> '{validation,secondaryBenefitPassed}' = 'true'
    and p_candidate #>> '{validation,aiLikeLanguagePassed}' = 'true'
    and p_candidate #>> '{validation,intentionalLineBreaksPassed}' = 'true'
    and p_candidate #>> '{validation,textFitPassed}' = 'true'
    and p_candidate #>> '{readabilityReview,truthful}' = 'true'
    and p_candidate #>> '{readabilityReview,claimSafe}' = 'true'
    and p_candidate #>> '{readabilityReview,humanVoice}' = 'true'
    and p_candidate #>> '{readabilityReview,openingOnly}' = 'true'
    and p_candidate #>> '{readabilityReview,singleIdea}' = 'true'
    and p_candidate #>> '{readabilityReview,readable}' = 'true'
    and p_candidate #>> '{readabilityReview,reactionMatch}' = 'true'
    and p_candidate #>> '{readabilityReview,scrollStopping}' = 'true'
    and v_score between 80 and 100
    and (p_candidate #>> '{readabilityReview,estimatedReadingSeconds}')::numeric > 0
    and (p_candidate #>> '{readabilityReview,estimatedReadingSeconds}')::numeric <=
      (p_candidate ->> 'durationSeconds')::numeric
    and jsonb_typeof(p_candidate -> 'visualFit') = 'object'
    and p_candidate #>> '{visualFit,overlayVersion}' = 'hook-overlay-v3'
    and p_candidate #>> '{visualFit,fits}' = 'true'
    and (p_candidate #>> '{visualFit,semanticLineCount}')::integer between 1 and 2
    and (p_candidate #>> '{visualFit,renderedLineCount}')::integer between 1 and 2
    and (p_candidate #>> '{visualFit,wordCount}')::integer = v_word_count
    and (p_candidate #>> '{visualFit,characterCount}')::integer = v_character_count
    and v_word_count between 2 and 12
    and v_character_count between 8 and 78;
exception
  when others then
    return false;
end
$$;

revoke all on function public.hook_copy_v5_candidate_is_valid(jsonb)
  from public, anon, authenticated;

create or replace function public.persist_trending_hook_copy_generation_v5(
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
set search_path = public, pg_temp
as $$
declare
  candidate jsonb;
  candidate_count integer;
  persisted_count integer;
  slot_base integer;
  slotted_candidates jsonb;
begin
  if p_prompt_version <> 'trending-hook-copy-v5'
    or p_selection_version <> 'purpose-industry-diversity-v5'
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'trending_hook_generation_invalid_v5_contract';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 1 or candidate_count > 12 then
    raise exception 'trending_hook_generation_invalid_candidate_count';
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
    raise exception 'trending_hook_generation_scope_mismatch';
  end if;

  for candidate in select value from jsonb_array_elements(p_candidates)
  loop
    if not public.hook_copy_v5_candidate_is_valid(candidate) then
      raise exception 'trending_hook_generation_invalid_v5_candidate';
    end if;
  end loop;

  if (
    select count(distinct (item.value ->> 'candidateIndex')::integer)
    from jsonb_array_elements(p_candidates) as item(value)
  ) <> candidate_count then
    raise exception 'trending_hook_generation_duplicate_candidate';
  end if;

  select count(*) into persisted_count
  from public.hook_video_suggestions as suggestion
  where suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.suggestion_context = 'trending';

  if persisted_count > 0 then
    if persisted_count <> candidate_count then
      raise exception 'trending_hook_generation_partial_state';
    end if;

    return persisted_count;
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
      to_jsonb(slot_base + (item.value ->> 'candidateIndex')::integer),
      false
    )
    order by item.ordinality
  )
  into slotted_candidates
  from jsonb_array_elements(p_candidates)
    with ordinality as item(value, ordinality);

  persisted_count := public.persist_trending_hook_copy_generation_slot_internal(
    p_job_id,
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    p_prompt_version,
    p_selection_version,
    p_generator_model,
    slotted_candidates
  );

  update public.hook_video_suggestions as suggestion
  set
    opening_lines = candidate.value -> 'openingLines',
    pattern_id = candidate.value ->> 'patternId',
    pattern_library_version = candidate.value ->> 'patternLibraryVersion',
    validator_version = candidate.value ->> 'validatorVersion',
    input_context_hash = candidate.value ->> 'inputContextHash',
    validation_metadata = candidate.value -> 'validation',
    quality_score = (candidate.value #>> '{readabilityReview,scores,total}')::integer,
    campaign_purpose = candidate.value ->> 'campaignPurpose',
    industry_pack_id = candidate.value ->> 'industryPackId'
  from jsonb_array_elements(p_candidates) as candidate(value)
  where suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.suggestion_context = 'trending'
    and suggestion.candidate_index =
      slot_base + (candidate.value ->> 'candidateIndex')::integer;

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
end
$$;

revoke all on function public.persist_trending_hook_copy_generation_v5(
  uuid, text, uuid, integer, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.persist_trending_hook_copy_generation_v5(
  uuid, text, uuid, integer, text, text, text, jsonb
) to service_role;

create or replace function public.persist_validated_hook_composition_generation(
  p_job_id uuid,
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_demo_asset_id uuid,
  p_prompt_version text,
  p_selection_version text,
  p_generator_model text,
  p_candidates jsonb
)
returns table(id uuid, text text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  candidate jsonb;
  candidate_count integer;
begin
  if p_prompt_version <> 'trending-hook-copy-v5'
    or p_selection_version <> 'purpose-industry-diversity-v5'
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'hook_composition_generation_invalid_v5_contract';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 4 or candidate_count > 8 then
    raise exception 'hook_composition_generation_invalid_candidate_count';
  end if;

  if not exists (
    select 1
    from public.background_jobs as job
    where job.id = p_job_id
      and job.user_id = p_user_id
      and job.job_type = 'hook_text_generation'
  ) or not exists (
    select 1
    from public.business_profiles as profile
    where profile.id = p_business_profile_id
      and profile.user_id = p_user_id
      and profile.profile_version = p_business_profile_version
  ) or not exists (
    select 1
    from public.media_assets as asset
    where asset.id = p_demo_asset_id
      and asset.user_id = p_user_id
  ) then
    raise exception 'hook_composition_generation_scope_mismatch';
  end if;

  if exists (
    select 1
    from public.hook_video_suggestions as suggestion
    where suggestion.generation_job_id = p_job_id
      and suggestion.user_id = p_user_id
      and suggestion.suggestion_context = 'composition'
  ) then
    return query
      select suggestion.id, suggestion.text
      from public.hook_video_suggestions as suggestion
      where suggestion.generation_job_id = p_job_id
        and suggestion.user_id = p_user_id
        and suggestion.suggestion_context = 'composition'
      order by suggestion.candidate_index, suggestion.created_at;
    return;
  end if;

  if (
    select count(distinct (item.value ->> 'candidateIndex')::integer)
    from jsonb_array_elements(p_candidates) as item(value)
  ) <> candidate_count then
    raise exception 'hook_composition_generation_duplicate_candidate';
  end if;

  for candidate in select value from jsonb_array_elements(p_candidates)
  loop
    if not public.hook_copy_v5_candidate_is_valid(candidate) then
      raise exception 'hook_composition_generation_invalid_v5_candidate';
    end if;
  end loop;

  insert into public.hook_video_suggestions (
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
    industry_pack_id
  )
  select
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    p_job_id,
    p_job_id,
    (candidate.value ->> 'candidateIndex')::integer,
    'composition',
    trim(candidate.value ->> 'influencerId'),
    nullif(trim(candidate.value ->> 'influencerKey'), ''),
    trim(candidate.value ->> 'influencerName'),
    trim(candidate.value ->> 'influencerVideoId'),
    trim(candidate.value ->> 'influencerVideoTitle'),
    candidate.value ->> 'sourceKind',
    nullif(trim(candidate.value ->> 'reactionType'), ''),
    nullif(trim(candidate.value ->> 'visualGroup'), ''),
    p_demo_asset_id,
    trim(candidate.value ->> 'hookText'),
    (candidate.value ->> 'durationSeconds')::numeric,
    (candidate.value ->> 'sourceDurationSeconds')::numeric,
    (candidate.value ->> 'trimStart')::numeric,
    (candidate.value ->> 'trimEnd')::numeric,
    nullif(trim(candidate.value ->> 'thumbnailUrl'), ''),
    p_prompt_version,
    p_selection_version,
    p_generator_model,
    candidate.value -> 'readabilityReview',
    candidate.value -> 'visualFit',
    candidate.value -> 'openingLines',
    candidate.value ->> 'patternId',
    candidate.value ->> 'patternLibraryVersion',
    candidate.value ->> 'validatorVersion',
    candidate.value ->> 'inputContextHash',
    candidate.value -> 'validation',
    (candidate.value #>> '{readabilityReview,scores,total}')::integer,
    candidate.value ->> 'campaignPurpose',
    candidate.value ->> 'industryPackId'
  from jsonb_array_elements(p_candidates) as candidate(value)
  order by (candidate.value ->> 'candidateIndex')::integer;

  return query
    select suggestion.id, suggestion.text
    from public.hook_video_suggestions as suggestion
    where suggestion.generation_job_id = p_job_id
      and suggestion.user_id = p_user_id
      and suggestion.suggestion_context = 'composition'
    order by suggestion.candidate_index, suggestion.created_at;
end
$$;

revoke all on function public.persist_validated_hook_composition_generation(
  uuid, text, uuid, integer, uuid, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.persist_validated_hook_composition_generation(
  uuid, text, uuid, integer, uuid, text, text, text, jsonb
) to service_role;

select pg_notify('pgrst', 'reload schema');
