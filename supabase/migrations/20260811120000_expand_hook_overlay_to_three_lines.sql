-- Hook references regularly use three short display lines. Keep the same
-- twelve-word and seventy-eight-character safety limits while allowing that
-- third intentional line through both the table and v5/v6 persistence path.
alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_v5_metadata_check;

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
      and jsonb_array_length(opening_lines) between 1 and 3
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
     jsonb_array_length(v_lines) not between 1 and 3 or
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
    and (p_candidate #>> '{visualFit,semanticLineCount}')::integer between 1 and 3
    and (p_candidate #>> '{visualFit,renderedLineCount}')::integer between 1 and 3
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

select pg_notify('pgrst', 'reload schema');
