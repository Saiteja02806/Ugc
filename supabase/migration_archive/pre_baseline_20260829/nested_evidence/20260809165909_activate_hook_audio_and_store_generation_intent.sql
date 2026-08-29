-- The product owner reviewed and approved the complete deduplicated Hook audio
-- catalog. Activate only that exact 52-asset set, then make the v6 Hook writer's
-- controlled audio intent durable without exposing audio filenames to the model.
do $$
declare
  approved_count integer;
  expected_count constant integer := 52;
  total_count integer;
begin
  select count(*) into total_count
  from public.hook_audio_assets;

  if total_count <> expected_count then
    raise exception
      'hook_audio_approval_expected_%_assets_found_%',
      expected_count,
      total_count;
  end if;

  if exists (
    select 1
    from generate_series(1, expected_count) as expected(sequence_number)
    where not exists (
      select 1
      from public.hook_audio_assets as asset
      where asset.id = format(
        'hook_audio_%s',
        lpad(expected.sequence_number::text, 3, '0')
      )
    )
  ) then
    raise exception 'hook_audio_approval_expected_id_set_is_incomplete';
  end if;

  if (
    select count(*)
    from public.hook_audio_assets as asset
    where asset.review_status = 'pending'
      and asset.status = 'inactive'
      and asset.reviewed_at is null
      and cardinality(asset.moods) between 1 and 2
      and cardinality(asset.hook_types) between 2 and 4
      and asset.energy is not null
      and asset.loopable = false
  ) <> expected_count then
    raise exception 'hook_audio_approval_catalog_is_not_fully_reviewable';
  end if;

  update public.hook_audio_assets
  set
    review_status = 'approved',
    reviewed_at = now(),
    review_notes = concat_ws(
      E'\n',
      nullif(btrim(review_notes), ''),
      'Approved by the product owner for Hook audio matching on 2026-08-09.'
    ),
    status = 'active',
    updated_at = now()
  where review_status = 'pending'
    and status = 'inactive'
    and reviewed_at is null;

  get diagnostics approved_count = row_count;

  if approved_count <> expected_count then
    raise exception
      'hook_audio_approval_expected_%_updates_found_%',
      expected_count,
      approved_count;
  end if;
end
$$;

alter table public.hook_video_suggestions
  add column if not exists audio_intent jsonb;

comment on column public.hook_video_suggestions.audio_intent is
  'Hidden controlled Hook sound requirements. This stores meaning only and never an audio filename or asset choice.';

alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_audio_intent_check;

alter table public.hook_video_suggestions
  add constraint hook_video_suggestions_audio_intent_check
  check (
    audio_intent is null
    or coalesce(
      jsonb_typeof(audio_intent) = 'object'
      and audio_intent - array['mood', 'hookType', 'energy'] = '{}'::jsonb
      and audio_intent ->> 'mood' in (
        'curious',
        'uplifting',
        'serious',
        'calm',
        'urgent',
        'playful'
      )
      and audio_intent ->> 'hookType' in (
        'curiosity',
        'problem',
        'warning',
        'transformation',
        'benefit',
        'story',
        'authority'
      )
      and audio_intent ->> 'energy' in ('low', 'medium', 'high'),
      false
    )
  ) not valid;

alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_v6_audio_intent_required;

alter table public.hook_video_suggestions
  add constraint hook_video_suggestions_v6_audio_intent_required
  check (
    prompt_version is distinct from 'trending-hook-copy-v6'
    or audio_intent is not null
  ) not valid;

create or replace function public.hook_copy_v6_candidate_is_valid(
  p_candidate jsonb
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(
    public.hook_copy_v5_candidate_is_valid(p_candidate)
    and jsonb_typeof(p_candidate -> 'audioIntent') = 'object'
    and (p_candidate -> 'audioIntent')
      - array['mood', 'hookType', 'energy'] = '{}'::jsonb
    and p_candidate #>> '{audioIntent,mood}' in (
      'curious',
      'uplifting',
      'serious',
      'calm',
      'urgent',
      'playful'
    )
    and p_candidate #>> '{audioIntent,hookType}' in (
      'curiosity',
      'problem',
      'warning',
      'transformation',
      'benefit',
      'story',
      'authority'
    )
    and p_candidate #>> '{audioIntent,energy}' in (
      'low',
      'medium',
      'high'
    ),
    false
  )
$$;

revoke all on function public.hook_copy_v6_candidate_is_valid(jsonb)
  from public, anon, authenticated, service_role;

grant execute on function public.hook_copy_v6_candidate_is_valid(jsonb)
  to service_role;

create or replace function public.persist_trending_hook_copy_generation_v6(
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
  updated_count integer;
begin
  if p_prompt_version <> 'trending-hook-copy-v6'
    or p_selection_version <> 'purpose-industry-diversity-v5'
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'trending_hook_generation_invalid_v6_contract';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 1 or candidate_count > 12 then
    raise exception 'trending_hook_generation_invalid_candidate_count';
  end if;

  if (
    select count(distinct (item.value ->> 'candidateIndex')::integer)
    from jsonb_array_elements(p_candidates) as item(value)
  ) <> candidate_count then
    raise exception 'trending_hook_generation_duplicate_candidate';
  end if;

  for candidate in select value from jsonb_array_elements(p_candidates)
  loop
    if not public.hook_copy_v6_candidate_is_valid(candidate) then
      raise exception 'trending_hook_generation_invalid_v6_candidate';
    end if;
  end loop;

  -- Reuse the proven v5 slot and assignment transaction, then add the new v6
  -- fields before this outer transaction can commit.
  persisted_count := public.persist_trending_hook_copy_generation_v5(
    p_job_id,
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    'trending-hook-copy-v5',
    p_selection_version,
    p_generator_model,
    p_candidates
  );

  update public.hook_video_suggestions as suggestion
  set
    audio_intent = candidate.value -> 'audioIntent',
    prompt_version = p_prompt_version
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

  if updated_count <> candidate_count
    or persisted_count <> candidate_count
  then
    raise exception 'trending_hook_generation_v6_persistence_mismatch';
  end if;

  return persisted_count;
end
$$;

revoke all on function public.persist_trending_hook_copy_generation_v6(
  uuid, text, uuid, integer, text, text, text, jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.persist_trending_hook_copy_generation_v6(
  uuid, text, uuid, integer, text, text, text, jsonb
) to service_role;

create or replace function public.persist_validated_hook_composition_generation_v6(
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
  updated_count integer;
begin
  if p_prompt_version <> 'trending-hook-copy-v6'
    or p_selection_version <> 'purpose-industry-diversity-v5'
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'hook_composition_generation_invalid_v6_contract';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 4 or candidate_count > 8 then
    raise exception 'hook_composition_generation_invalid_candidate_count';
  end if;

  if (
    select count(distinct (item.value ->> 'candidateIndex')::integer)
    from jsonb_array_elements(p_candidates) as item(value)
  ) <> candidate_count then
    raise exception 'hook_composition_generation_duplicate_candidate';
  end if;

  for candidate in select value from jsonb_array_elements(p_candidates)
  loop
    if not public.hook_copy_v6_candidate_is_valid(candidate) then
      raise exception 'hook_composition_generation_invalid_v6_candidate';
    end if;
  end loop;

  perform public.persist_validated_hook_composition_generation(
    p_job_id,
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    p_demo_asset_id,
    'trending-hook-copy-v5',
    p_selection_version,
    p_generator_model,
    p_candidates
  );

  update public.hook_video_suggestions as suggestion
  set
    audio_intent = candidate.value -> 'audioIntent',
    prompt_version = p_prompt_version
  from jsonb_array_elements(p_candidates) as candidate(value)
  where suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.demo_asset_id = p_demo_asset_id
    and suggestion.suggestion_context = 'composition'
    and suggestion.candidate_index =
      (candidate.value ->> 'candidateIndex')::integer;

  get diagnostics updated_count = row_count;

  if updated_count <> candidate_count then
    raise exception 'hook_composition_generation_v6_persistence_mismatch';
  end if;

  return query
    select suggestion.id, suggestion.text
    from public.hook_video_suggestions as suggestion
    where suggestion.generation_job_id = p_job_id
      and suggestion.user_id = p_user_id
      and suggestion.suggestion_context = 'composition'
    order by suggestion.candidate_index, suggestion.created_at;
end
$$;

revoke all on function public.persist_validated_hook_composition_generation_v6(
  uuid, text, uuid, integer, uuid, text, text, text, jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.persist_validated_hook_composition_generation_v6(
  uuid, text, uuid, integer, uuid, text, text, text, jsonb
) to service_role;

select pg_notify('pgrst', 'reload schema');
