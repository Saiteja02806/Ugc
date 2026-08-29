alter table public.background_jobs
  drop constraint if exists background_jobs_job_type_check;

alter table public.background_jobs
  add constraint background_jobs_job_type_check
  check (
    job_type in (
      'test_worker_job',
      'render_edit_video',
      'render_demo_video',
      'render_schedule_combination',
      'render_wall_text_video',
      'generate_thumbnail',
      'extract_video_metadata',
      'generate_image',
      'generate_avatar',
      'generate_carousel',
      'generate_hook_video',
      'generate_trending_hook_copy',
      'publish_social_post'
    )
  );

alter table public.hook_video_suggestions
  add column if not exists generation_job_id uuid
    references public.background_jobs(id) on delete set null,
  add column if not exists prompt_version text,
  add column if not exists selection_version text,
  add column if not exists generator_model text,
  add column if not exists influencer_key text,
  add column if not exists reaction_type text,
  add column if not exists visual_group text,
  add column if not exists readability_review jsonb,
  add column if not exists visual_fit jsonb;

alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_generation_metadata_check;

alter table public.hook_video_suggestions
  add constraint hook_video_suggestions_generation_metadata_check
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
      suggestion_context = 'trending'
      and prompt_version is not null
      and char_length(trim(prompt_version)) between 1 and 100
      and selection_version is not null
      and char_length(trim(selection_version)) between 1 and 100
      and generator_model is not null
      and char_length(trim(generator_model)) between 1 and 100
      and generation_job_id is not null
      and jsonb_typeof(readability_review) = 'object'
      and readability_review ->> 'readable' = 'true'
      and readability_review ->> 'reactionMatch' = 'true'
      and readability_review ->> 'scrollStopping' = 'true'
      and jsonb_typeof(visual_fit) = 'object'
      and visual_fit ->> 'fits' = 'true'
    )
  );

alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_trending_candidate_unique;

create unique index if not exists
  hook_video_suggestions_trending_generation_candidate_uidx
  on public.hook_video_suggestions (
    business_profile_id,
    business_profile_version,
    suggestion_context,
    generation_id,
    candidate_index
  )
  where suggestion_context = 'trending';

create index if not exists hook_video_suggestions_generation_job_idx
  on public.hook_video_suggestions (generation_job_id)
  where generation_job_id is not null;

alter table public.user_hook_video_assignments
  drop constraint if exists user_hook_video_assignments_state_check;

alter table public.user_hook_video_assignments
  add constraint user_hook_video_assignments_state_check
  check (
    state in (
      'active',
      'completed_skipped',
      'selected',
      'superseded'
    )
  );

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
  suggestion_id uuid;
  now_at timestamptz := now();
begin
  if p_job_id is null
    or char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or p_business_profile_version is null
    or p_business_profile_version <= 0
    or char_length(trim(coalesce(p_prompt_version, ''))) = 0
    or char_length(p_prompt_version) > 100
    or char_length(trim(coalesce(p_selection_version, ''))) = 0
    or char_length(p_selection_version) > 100
    or char_length(trim(coalesce(p_generator_model, ''))) = 0
    or char_length(p_generator_model) > 100
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'trending_hook_generation_invalid_scope';
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
  ) then
    raise exception 'trending_hook_generation_job_mismatch';
  end if;

  if not exists (
    select 1
    from public.business_profiles as profile
    where profile.id = p_business_profile_id
      and profile.user_id = p_user_id
      and profile.profile_version = p_business_profile_version
  ) then
    raise exception 'trending_hook_generation_profile_mismatch';
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
    if existing_count <> candidate_count then
      raise exception 'trending_hook_generation_partial_state';
    end if;

    return existing_count;
  end if;

  if (
    select count(distinct (item ->> 'candidateIndex')::integer)
    from jsonb_array_elements(p_candidates) as item
  ) <> candidate_count then
    raise exception 'trending_hook_generation_duplicate_candidate';
  end if;

  for candidate in
    select value
    from jsonb_array_elements(p_candidates)
  loop
    if jsonb_typeof(candidate) <> 'object'
      or (candidate ->> 'candidateIndex') is null
      or (candidate ->> 'candidateIndex')::integer < 0
      or (candidate ->> 'durationSeconds')::numeric <= 0
      or (candidate ->> 'sourceDurationSeconds')::numeric <= 0
      or (candidate ->> 'durationSeconds')::numeric
        > (candidate ->> 'sourceDurationSeconds')::numeric
      or (candidate ->> 'trimStart')::numeric < 0
      or char_length(trim(coalesce(candidate ->> 'hookText', '')))
        not between 4 and 120
      or char_length(trim(coalesce(candidate ->> 'influencerId', '')))
        not between 1 and 180
      or char_length(trim(coalesce(candidate ->> 'influencerName', '')))
        not between 1 and 140
      or char_length(trim(coalesce(candidate ->> 'influencerVideoId', '')))
        not between 1 and 180
      or char_length(trim(coalesce(candidate ->> 'influencerVideoTitle', '')))
        not between 1 and 180
      or coalesce(candidate ->> 'sourceKind', '') not in ('catalog', 'user')
      or jsonb_typeof(candidate -> 'readabilityReview') <> 'object'
      or candidate #>> '{readabilityReview,readable}' <> 'true'
      or candidate #>> '{readabilityReview,reactionMatch}' <> 'true'
      or candidate #>> '{readabilityReview,scrollStopping}' <> 'true'
      or (candidate #>> '{readabilityReview,estimatedReadingSeconds}')::numeric
        > (candidate ->> 'durationSeconds')::numeric
      or jsonb_typeof(candidate -> 'visualFit') <> 'object'
      or candidate #>> '{visualFit,fits}' <> 'true'
    then
      raise exception 'trending_hook_generation_invalid_candidate';
    end if;

    if (candidate ->> 'trimEnd') is not null
      and (candidate ->> 'trimEnd')::numeric
        <= (candidate ->> 'trimStart')::numeric
    then
      raise exception 'trending_hook_generation_invalid_trim';
    end if;
  end loop;

  update public.user_hook_video_assignments
  set
    completed_at = coalesce(completed_at, now_at),
    state = 'superseded',
    updated_at = now_at
  where user_id = p_user_id
    and business_profile_id = p_business_profile_id
    and business_profile_version = p_business_profile_version
    and state = 'active';

  for candidate in
    select value
    from jsonb_array_elements(p_candidates)
    order by (value ->> 'candidateIndex')::integer
  loop
    suggestion_id := gen_random_uuid();

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
      visual_fit
    )
    values (
      suggestion_id,
      p_user_id,
      p_business_profile_id,
      p_business_profile_version,
      p_job_id,
      p_job_id,
      (candidate ->> 'candidateIndex')::integer,
      'trending',
      trim(candidate ->> 'influencerId'),
      nullif(trim(candidate ->> 'influencerKey'), ''),
      trim(candidate ->> 'influencerName'),
      trim(candidate ->> 'influencerVideoId'),
      trim(candidate ->> 'influencerVideoTitle'),
      candidate ->> 'sourceKind',
      nullif(trim(candidate ->> 'reactionType'), ''),
      nullif(trim(candidate ->> 'visualGroup'), ''),
      null,
      trim(candidate ->> 'hookText'),
      (candidate ->> 'durationSeconds')::numeric,
      (candidate ->> 'sourceDurationSeconds')::numeric,
      (candidate ->> 'trimStart')::numeric,
      (candidate ->> 'trimEnd')::numeric,
      nullif(trim(candidate ->> 'thumbnailUrl'), ''),
      trim(p_prompt_version),
      trim(p_selection_version),
      trim(p_generator_model),
      candidate -> 'readabilityReview',
      candidate -> 'visualFit'
    );

    insert into public.user_hook_video_assignments (
      user_id,
      business_profile_id,
      business_profile_version,
      hook_suggestion_id,
      position,
      state
    )
    values (
      p_user_id,
      p_business_profile_id,
      p_business_profile_version,
      suggestion_id,
      (candidate ->> 'candidateIndex')::integer,
      'active'
    );
  end loop;

  return candidate_count;
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
