-- Freeform Wall plans retain the legacy column for schema compatibility, but
-- store an explicit sentinel instead of pretending to use one of the dormant
-- format families.
alter table public.wall_text_content_plan_briefs
  drop constraint if exists wall_text_content_plan_briefs_preferred_format_family_check;

alter table public.wall_text_content_plan_briefs
  add constraint wall_text_content_plan_briefs_preferred_format_family_check
  check (
    preferred_format_family in (
      'common_problem',
      'contrast',
      'emotional_observation',
      'freeform',
      'practical_reframe',
      'relatable_situation',
      'small_story'
    )
  );

-- V6 Wall creatives use the same validated layout contract whether their copy
-- came from a historical named format or the current freeform writer. Keep all
-- older layout versions readable and add only the freeform V6 sentinel.
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
          and jsonb_array_length(text_content #> '{finalLayout,blocks,0,lines}') between 4 and 7
        )
      ),
      false
    )
  ) not valid;

alter table public.wall_text_creatives
  validate constraint wall_text_creatives_text_content_chk;

-- Re-open durable reconciliation for today's feeds that were left with empty
-- Wall slots by the rejected freeform brief. This does not generate inside the
-- migration; the existing recovery scheduler performs the normal idempotent
-- preparation after the compatible constraint is in place.
with affected_users as (
  select distinct feed.user_id
  from public.daily_trending_feeds as feed
  join public.daily_trending_feed_slots as slot
    on slot.feed_id = feed.id
  where feed.local_date = timezone(feed.timezone, now())::date
    and slot.format = 'wall_text'
    and slot.state in ('planned', 'preparing', 'failed')
    and slot.wall_text_assignment_id is null
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
