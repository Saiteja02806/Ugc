-- V9 widens the measured Wall reading column and requires newly written copy
-- to resolve to 5-8 balanced lines. Historical V2 layouts remain readable so
-- selected drafts are not broken during the rollout.

alter table public.wall_text_creatives
  alter column generator_version
    set default 'business-profile-wall-text-v9';

alter table public.wall_text_creatives
  drop constraint if exists wall_text_creatives_text_content_chk;

alter table public.wall_text_creatives
  add constraint wall_text_creatives_text_content_chk
  check (
    coalesce(
      jsonb_typeof(text_content) = 'object'
      and text_content ->> 'kind' = 'wall_text'
      and (
        text_content ->> 'layoutVersion' in (
          'wall-text-overlay-v1',
          'wall-text-overlay-v2',
          'wall-text-overlay-v3',
          'wall-text-overlay-v4'
        )
        or (
          text_content ->> 'layoutVersion' = 'wall-text-overlay-v5'
          and text_content ->> 'formatId' in (
            'identity_mirror', 'recognizable_moment', 'hidden_truth',
            'contrarian_reframe', 'personal_confession',
            'aspiration_redefinition', 'pain_beneath_the_pain',
            'niche_insight', 'list_rules', 'community_prompt',
            'analogy_reframe', 'progression_sequence'
          )
          and jsonb_typeof(text_content -> 'fullText') = 'string'
          and char_length(trim(text_content ->> 'fullText')) between 1 and 600
          and jsonb_typeof(text_content -> 'sourceContent') = 'object'
          and text_content -> 'sourceContent' ->> 'kind' in ('prose', 'list')
          and jsonb_typeof(text_content -> 'finalLayout') = 'object'
          and text_content -> 'finalLayout' ->> 'version' = 'wall-text-final-layout-v1'
          and text_content -> 'finalLayout' ->> 'fontFamily' = 'Inter'
          and (text_content -> 'finalLayout' ->> 'fontWeight')::integer in (400, 600, 700)
          and (text_content -> 'finalLayout' ->> 'fontSizePx')::integer in (36, 38, 40, 42, 44, 46, 48, 50, 52)
          and jsonb_typeof(text_content -> 'finalLayout' -> 'textBox') = 'object'
          and jsonb_typeof(text_content -> 'finalLayout' -> 'blocks') = 'array'
          and jsonb_array_length(text_content -> 'finalLayout' -> 'blocks') between 1 and 6
        )
        or (
          text_content ->> 'layoutVersion' = 'wall-text-overlay-v6'
          and text_content ->> 'formatId' in (
            'freeform',
            'hidden_alternative', 'manual_automatic', 'secret_advantage',
            'outcome_mystery', 'authority_reaction', 'personal_obsession',
            'numbered_curiosity', 'rule_checklist', 'hidden_cause',
            'contrarian_opinion', 'niche_pov', 'community_question',
            'transformation_timeframe', 'method_framework',
            'emotional_reframe', 'personal_manifesto', 'relatable_situation',
            'desire_identity_stack', 'old_way_regret',
            'retrospective_lesson', 'self_audit', 'warning_alert',
            'personal_stance', 'future_snapshot', 'metaphor_reframe',
            'swap_upgrade_stack', 'niche_milestones', 'insider_truths',
            'aspirational_archetype', 'internal_conflict'
          )
          and jsonb_typeof(text_content -> 'fullText') = 'string'
          and char_length(trim(text_content ->> 'fullText')) between 8 and 600
          and text_content -> 'sourceContent' ->> 'kind' = 'text'
          and jsonb_typeof(text_content -> 'sourceContent' -> 'text') = 'string'
          and text_content -> 'finalLayout' ->> 'version' = 'wall-text-final-layout-v2'
          and text_content -> 'finalLayout' ->> 'fontFamily' = 'Inter'
          and (text_content -> 'finalLayout' ->> 'fontWeight')::integer in (400, 600, 700)
          and (text_content -> 'finalLayout' ->> 'fontSizePx')::integer in (36, 38, 40, 42, 44, 46, 48, 50, 52)
          and jsonb_array_length(text_content -> 'finalLayout' -> 'blocks') = 1
          and text_content #>> '{finalLayout,blocks,0,role}' = 'text'
          and (
            (
              generator_version = 'business-profile-wall-text-v9'
              and jsonb_array_length(text_content #> '{finalLayout,blocks,0,lines}') between 5 and 8
            )
            or (
              generator_version <> 'business-profile-wall-text-v9'
              and jsonb_array_length(text_content #> '{finalLayout,blocks,0,lines}') between 4 and 7
            )
          )
        )
      ),
      false
    )
  ) not valid;

alter table public.wall_text_creatives
  validate constraint wall_text_creatives_text_content_chk;

create or replace function public.replace_wall_text_creative_copy_v9(
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_generator_model text,
  p_updates jsonb
)
returns setof public.wall_text_creatives
language plpgsql
security invoker
set search_path = public
as $$
declare
  expected_count integer;
  matched_count integer;
  replacement_generation_id uuid := gen_random_uuid();
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or p_business_profile_version is null
    or p_business_profile_version <= 0
    or char_length(trim(coalesce(p_generator_model, ''))) = 0
  then
    raise exception 'wall_text_regeneration_invalid_scope';
  end if;

  if jsonb_typeof(p_updates) <> 'array' then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  expected_count := jsonb_array_length(p_updates);

  if expected_count < 1 or expected_count > 50 then
    raise exception 'wall_text_regeneration_invalid_count';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_updates) as update_item
    where jsonb_typeof(update_item) is distinct from 'object'
      or jsonb_typeof(update_item -> 'text_content') is distinct from 'object'
      or jsonb_typeof(update_item -> 'layout') is distinct from 'object'
      or update_item ->> 'id' is null
      or update_item ->> 'candidate_index' is null
  ) then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  if (
    select count(distinct update_item ->> 'id')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  or (
    select count(distinct update_item ->> 'candidate_index')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  then
    raise exception 'wall_text_regeneration_duplicate_updates';
  end if;

  select count(*)
  into matched_count
  from public.wall_text_creatives as creative
  join jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
    on update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  if matched_count <> expected_count then
    raise exception 'wall_text_regeneration_mismatch';
  end if;

  update public.wall_text_creatives as creative
  set
    error_message = null,
    generation_id = replacement_generation_id,
    generator_model = trim(p_generator_model),
    generator_version = 'business-profile-wall-text-v9',
    layout = update_item.layout,
    status = 'preview_ready',
    text_content = update_item.text_content,
    updated_at = now()
  from jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
  where update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
    and creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  return query
  select creative.*
  from public.wall_text_creatives as creative
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version
    and creative.status = 'preview_ready'
  order by creative.candidate_index;
end;
$$;

revoke all on function public.replace_wall_text_creative_copy_v9(
  text,
  uuid,
  integer,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.replace_wall_text_creative_copy_v9(
  text,
  uuid,
  integer,
  text,
  jsonb
) to service_role;

-- A ready current-day slot pins its assignment for source-library stability.
-- Do not let that pin bypass this layout upgrade: reopen only ready Wall slots
-- that point to V8-or-older copy. Decided user choices remain untouched.
with reopened_slots as (
  update public.daily_trending_feed_slots as slot
  set
    wall_text_assignment_id = null,
    state = 'planned',
    updated_at = now()
  from public.daily_trending_feeds as feed,
    public.user_wall_text_assignments as assignment,
    public.wall_text_creatives as creative
  where slot.feed_id = feed.id
    and assignment.id = slot.wall_text_assignment_id
    and creative.id = assignment.wall_text_creative_id
    and feed.local_date = timezone(feed.timezone, now())::date
    and slot.format = 'wall_text'
    and slot.state = 'ready'
    and creative.generator_version <> 'business-profile-wall-text-v9'
  returning slot.feed_id
), reopened_feeds as (
  update public.daily_trending_feeds as feed
  set
    status = 'preparing',
    last_error = null,
    updated_at = now()
  where feed.id in (select distinct feed_id from reopened_slots)
  returning feed.user_id
), affected_users as (
  select distinct creative.user_id
  from public.wall_text_creatives as creative
  where creative.status = 'preview_ready'
    and creative.generator_version <> 'business-profile-wall-text-v9'
  union
  select user_id
  from reopened_feeds
), recovery_sources as (
  select distinct on (job.user_id)
    job.id as source_job_id,
    job.user_id
  from affected_users as affected
  join public.background_jobs as job
    on job.user_id = affected.user_id
  where job.status = 'completed'
    and job.job_type in (
      'carousel_content_plan_generation',
      'generate_carousel',
      'generate_trending_hook_copy',
      'wall_text_content_plan_generation',
      'wall_text_generation'
    )
  order by job.user_id, job.completed_at desc nulls last, job.created_at desc
)
insert into public.trending_feed_reconciliation_outbox (
  source_job_id,
  user_id,
  status,
  attempt_count,
  next_attempt_at
)
select
  source.source_job_id,
  source.user_id,
  'pending',
  0,
  now()
from recovery_sources as source
on conflict (source_job_id) do update
set
  status = 'pending',
  attempt_count = 0,
  next_attempt_at = now(),
  locked_at = null,
  last_attempt_at = null,
  last_error = null,
  completed_at = null,
  updated_at = now();

select pg_notify('pgrst', 'reload schema');
