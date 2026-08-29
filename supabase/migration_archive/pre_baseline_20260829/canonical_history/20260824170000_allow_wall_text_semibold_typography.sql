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
          and (text_content -> 'finalLayout' ->> 'fontWeight')::integer in (600, 700)
          and (text_content -> 'finalLayout' ->> 'fontSizePx')::integer in (44, 46, 48, 50, 52)
          and jsonb_typeof(text_content -> 'finalLayout' -> 'textBox') = 'object'
          and jsonb_typeof(text_content -> 'finalLayout' -> 'blocks') = 'array'
          and jsonb_array_length(text_content -> 'finalLayout' -> 'blocks') between 1 and 6
        )
        or (
          text_content ->> 'layoutVersion' = 'wall-text-overlay-v6'
          and text_content ->> 'formatId' in (
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
          and (text_content -> 'finalLayout' ->> 'fontWeight')::integer in (600, 700)
          and (text_content -> 'finalLayout' ->> 'fontSizePx')::integer in (44, 46, 48, 50, 52)
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
