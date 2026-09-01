-- Preserve every validated legacy layout branch while extending the current
-- plaintext Wall contract with the versioned Arial Bold treatment. Existing
-- Inter payloads retain their recorded V1/V2 typography and are never
-- rewritten by this migration.
do $$
declare
  v_constraint_definition text;
  v_constraint_tail constant text := ', false))';
  v_arial_v7_branch constant text := $wall_text_v7$
 or (
  text_content ->> 'layoutVersion' = 'wall-text-overlay-v7'
  and text_content ->> 'formatId' in (
    'freeform',
    'hidden_alternative', 'manual_automatic', 'secret_advantage',
    'outcome_mystery', 'authority_reaction', 'personal_obsession',
    'numbered_curiosity', 'rule_checklist', 'hidden_cause',
    'contrarian_opinion', 'niche_pov', 'community_question',
    'transformation_timeframe', 'method_framework', 'emotional_reframe',
    'personal_manifesto', 'relatable_situation', 'desire_identity_stack',
    'old_way_regret', 'retrospective_lesson', 'self_audit', 'warning_alert',
    'personal_stance', 'future_snapshot', 'metaphor_reframe',
    'swap_upgrade_stack', 'niche_milestones', 'insider_truths',
    'aspirational_archetype', 'internal_conflict'
  )
  and jsonb_typeof(text_content -> 'fullText') = 'string'
  and char_length(trim(text_content ->> 'fullText')) between 8 and 600
  and text_content -> 'sourceContent' ->> 'kind' = 'text'
  and jsonb_typeof(text_content -> 'sourceContent' -> 'text') = 'string'
  and text_content -> 'finalLayout' ->> 'version' = 'wall-text-final-layout-v3'
  and text_content -> 'finalLayout' ->> 'fontFamily' = 'Arial'
  and (text_content -> 'finalLayout' ->> 'fontWeight')::integer = 500
  and (text_content -> 'finalLayout' ->> 'fontSizePx')::integer in (36, 38, 40, 42, 44, 46, 48, 50, 52)
  and jsonb_array_length(text_content -> 'finalLayout' -> 'blocks') = 1
  and text_content #>> '{finalLayout,blocks,0,role}' = 'text'
  and (
    (generator_version = 'business-profile-wall-text-v9'
      and jsonb_array_length(text_content #> '{finalLayout,blocks,0,lines}') between 5 and 8)
    or
    (generator_version <> 'business-profile-wall-text-v9'
      and jsonb_array_length(text_content #> '{finalLayout,blocks,0,lines}') between 4 and 7)
  )
 )
$wall_text_v7$;
begin
  select pg_get_constraintdef(constraint_row.oid, true)
    into v_constraint_definition
  from pg_constraint as constraint_row
  where constraint_row.conrelid = 'public.wall_text_creatives'::regclass
    and constraint_row.conname = 'wall_text_creatives_text_content_chk';

  if v_constraint_definition is null then
    raise exception 'wall_text_creatives_text_content_chk is missing';
  end if;

  if right(v_constraint_definition, length(v_constraint_tail)) <> v_constraint_tail then
    raise exception 'Unexpected wall-text content constraint shape: %', v_constraint_definition;
  end if;

  v_constraint_definition :=
    left(v_constraint_definition, length(v_constraint_definition) - length(v_constraint_tail)) ||
    v_arial_v7_branch ||
    v_constraint_tail;

  alter table public.wall_text_creatives
    drop constraint wall_text_creatives_text_content_chk;

  execute format(
    'alter table public.wall_text_creatives add constraint wall_text_creatives_text_content_chk %s not valid',
    v_constraint_definition
  );

  alter table public.wall_text_creatives
    validate constraint wall_text_creatives_text_content_chk;
end;
$$;
