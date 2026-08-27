-- Reaction-mapped Trending Hook formats.
--
-- GF_013 and GF_017 remain in the catalog for historical suggestions and
-- performance records, but no new generation may select them. New format ids
-- preserve that historical meaning instead of rewriting it in place.

update public.hook_text_formats
set
  enabled = false,
  global_status = 'retired',
  updated_at = now()
where id in ('GF_013', 'GF_017');

update public.hook_text_format_variants
set
  enabled = false,
  updated_at = now()
where hook_text_format_id in ('GF_013', 'GF_017');

insert into public.hook_text_formats (
  id,
  family,
  name,
  canonical_template,
  required_variables,
  optional_variables,
  psychology,
  initial_confidence,
  global_status,
  allowed_tones,
  generation_rules,
  library_version,
  enabled
) values
  (
    'GF_019',
    'clear_playful_surprise',
    'Clear playful surprise',
    'Wait, what? {SURPRISING_CAPABILITY}?',
    array['capability'],
    '{}',
    array['playful_surprise', 'clarity', 'curiosity'],
    'tier_b',
    'global_v1',
    array['casual', 'clear', 'playful'],
    '{"reactionType":"amusement_laughter","neverUseAbbreviations":true,"neverInventFacts":true}'::jsonb,
    'global-hook-text-formats-v1',
    true
  ),
  (
    'GF_020',
    'skeptical_challenge',
    'Skeptical challenge',
    'Why are we still {OLD_METHOD}?',
    array['old_method_or_workflow_pain'],
    '{}',
    array['skepticism', 'recognition', 'curiosity'],
    'tier_b',
    'global_v1',
    array['casual', 'clear', 'serious'],
    '{"reactionType":"confusion_skepticism","neverUseThreatSlang":true,"neverInventFacts":true}'::jsonb,
    'global-hook-text-formats-v1',
    true
  )
on conflict (id) do update set
  family = excluded.family,
  name = excluded.name,
  canonical_template = excluded.canonical_template,
  required_variables = excluded.required_variables,
  optional_variables = excluded.optional_variables,
  psychology = excluded.psychology,
  initial_confidence = excluded.initial_confidence,
  global_status = excluded.global_status,
  allowed_tones = excluded.allowed_tones,
  generation_rules = excluded.generation_rules,
  library_version = excluded.library_version,
  enabled = excluded.enabled,
  updated_at = now();

insert into public.hook_text_format_variants (
  id,
  hook_text_format_id,
  template,
  instruction,
  enabled
) values
  (
    'GF_019_A',
    'GF_019',
    'Wait, what? {verified_capability}?',
    'Use the complete, plain-language surprise before one verified capability.',
    true
  ),
  (
    'GF_020_A',
    'GF_020',
    'Why are we still {verified_old_method}?',
    'Ask why the supplied old method or workflow pain is still accepted.',
    true
  )
on conflict (id) do update set
  hook_text_format_id = excluded.hook_text_format_id,
  template = excluded.template,
  instruction = excluded.instruction,
  enabled = excluded.enabled,
  updated_at = now();

-- The existing V7 persistence function remains the entry point so in-flight
-- V7 jobs keep working. V7 rotation and V2 reaction mapping are both valid
-- generation histories under the same prompt version.
create or replace function public.persist_trending_hook_copy_generation_v7(
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
  legacy_candidates jsonb;
  persisted_count integer;
  updated_count integer;
begin
  if p_prompt_version <> 'trending-hook-copy-v7'
    or p_selection_version not in (
      'global-format-rotation-v1',
      'reaction-format-map-v2'
    )
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'trending_hook_generation_invalid_v7_contract';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 1 or candidate_count > 12 or (
    select count(distinct (item.value ->> 'candidateIndex')::integer)
    from jsonb_array_elements(p_candidates) as item(value)
  ) <> candidate_count then
    raise exception 'trending_hook_generation_invalid_v7_candidates';
  end if;

  for candidate in select value from jsonb_array_elements(p_candidates)
  loop
    if not public.hook_copy_v7_candidate_is_valid(candidate) then
      raise exception 'trending_hook_generation_invalid_v7_candidate';
    end if;
  end loop;

  select jsonb_agg(
    item.value || jsonb_build_object(
      'patternId', 'mystery_discovery',
      'patternLibraryVersion', 'trending-hook-patterns-v3',
      'industryPackId', 'general'
    ) order by item.ordinality
  )
  into legacy_candidates
  from jsonb_array_elements(p_candidates)
    with ordinality as item(value, ordinality);

  persisted_count := public.persist_trending_hook_copy_generation_v6(
    p_job_id,
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    'trending-hook-copy-v6',
    'purpose-industry-diversity-v5',
    p_generator_model,
    legacy_candidates
  );

  update public.hook_video_suggestions as suggestion
  set
    hook_text_format_id = candidate.value ->> 'hookTextFormatId',
    hook_text_variant_id = candidate.value ->> 'hookTextVariantId',
    hook_text_format_library_version =
      candidate.value ->> 'hookTextFormatLibraryVersion',
    pattern_id = null,
    pattern_library_version = null,
    industry_pack_id = null,
    audio_intent = candidate.value -> 'audioIntent',
    prompt_version = p_prompt_version,
    selection_version = p_selection_version
  from public.user_hook_video_assignments as assignment,
    jsonb_array_elements(p_candidates) as candidate(value)
  where assignment.hook_suggestion_id = suggestion.id
    and assignment.user_id = p_user_id
    and assignment.business_profile_id = p_business_profile_id
    and assignment.business_profile_version = p_business_profile_version
    and assignment.position =
      (candidate.value ->> 'candidateIndex')::integer
    and suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.suggestion_context = 'trending';

  get diagnostics updated_count = row_count;

  if persisted_count <> candidate_count or updated_count <> candidate_count then
    raise exception 'trending_hook_generation_v7_persistence_mismatch';
  end if;

  return persisted_count;
end
$$;

revoke all on function public.persist_trending_hook_copy_generation_v7(
  uuid, text, uuid, integer, text, text, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.persist_trending_hook_copy_generation_v7(
  uuid, text, uuid, integer, text, text, text, jsonb
) to service_role;

select pg_notify('pgrst', 'reload schema');
