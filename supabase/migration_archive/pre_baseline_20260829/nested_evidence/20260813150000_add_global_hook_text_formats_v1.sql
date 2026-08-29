-- Global Hook Text Formats V1.
--
-- Writing formats are deliberately separate from visual Hook formats. This
-- migration does not change hook_formats, hook_format_id, video assets, audio
-- locks, or historical pattern_id values.

create table if not exists public.hook_text_formats (
  id text primary key check (id ~ '^GF_[0-9]{3}$'),
  family text not null unique
    check (family ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(trim(name)) between 1 and 120),
  canonical_template text not null
    check (char_length(trim(canonical_template)) between 1 and 500),
  required_variables text[] not null default '{}',
  optional_variables text[] not null default '{}',
  psychology text[] not null default '{}',
  initial_confidence text not null
    check (initial_confidence in ('tier_a', 'tier_b', 'tier_c')),
  global_status text not null default 'global_v1'
    check (global_status in ('global_v1', 'global_candidate', 'retired')),
  allowed_tones text[] not null default '{}',
  generation_rules jsonb not null default '{}'::jsonb
    check (jsonb_typeof(generation_rules) = 'object'),
  library_version text not null default 'global-hook-text-formats-v1',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hook_text_format_variants (
  id text primary key check (id ~ '^GF_[0-9]{3}_[A-Z]$'),
  hook_text_format_id text not null
    references public.hook_text_formats(id) on delete cascade,
  template text not null
    check (char_length(trim(template)) between 1 and 500),
  instruction text not null
    check (char_length(trim(instruction)) between 1 and 1000),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hook_text_format_id, id)
);

create table if not exists public.hook_text_format_evidence (
  id uuid primary key default gen_random_uuid(),
  hook_text_format_id text not null
    references public.hook_text_formats(id) on delete cascade,
  observed_hook_text text not null
    check (char_length(trim(observed_hook_text)) between 1 and 1000),
  source_reference text not null
    check (char_length(trim(source_reference)) between 1 and 500),
  source_platform text check (
    source_platform is null or source_platform in ('instagram', 'tiktok')
  ),
  evidence_version text not null default 'global-v1-corpus',
  created_at timestamptz not null default now(),
  unique (hook_text_format_id, observed_hook_text, source_reference)
);

comment on table public.hook_text_formats is
  'Reusable Hook writing structures. Independent of visual hook_formats and audio mappings.';
comment on table public.hook_text_format_evidence is
  'Original observed Hook wording retained as evidence after format extraction.';

alter table public.hook_text_formats enable row level security;
alter table public.hook_text_format_variants enable row level security;
alter table public.hook_text_format_evidence enable row level security;

revoke all privileges on table public.hook_text_formats
  from anon, authenticated;
revoke all privileges on table public.hook_text_format_variants
  from anon, authenticated;
revoke all privileges on table public.hook_text_format_evidence
  from anon, authenticated;

grant select, insert, update, delete on table public.hook_text_formats
  to service_role;
grant select, insert, update, delete on table public.hook_text_format_variants
  to service_role;
grant select, insert, update, delete on table public.hook_text_format_evidence
  to service_role;

insert into public.hook_text_formats (
  id, family, name, canonical_template, required_variables,
  optional_variables, psychology, initial_confidence, global_status,
  allowed_tones, generation_rules
) values
  ('GF_001', 'extreme_gratitude', 'Extreme gratitude', 'I could {KISS/MARRY} the {PERSON} who showed me THIS', '{}', array['person'], array['gratitude','surprise','curiosity'], 'tier_a', 'global_v1', array['casual','shock'], '{"rhetoricalFirstPersonAllowed":true,"neverInventFacts":true}'::jsonb),
  ('GF_002', 'pain_vs_hidden_solution', 'Pain vs hidden solution', 'Imagine {PAIN} when THIS exists', array['pain'], array['hidden_solution'], array['pain','curiosity','fomo'], 'tier_a', 'global_v1', array['casual','shock'], '{"neverInventFacts":true}'::jsonb),
  ('GF_003', 'delayed_discovery', 'Delayed discovery', '{TIME/EXPERIENCE} doing {THING} and I JUST found this', array['verified_time_or_experience','activity'], '{}', array['regret','curiosity','discovery'], 'tier_a', 'global_v1', array['casual','shock'], '{"requiresSuppliedNumberOrDuration":true,"neverInventPersonalHistory":true}'::jsonb),
  ('GF_004', 'forbidden_advantage', 'Forbidden advantage', 'How is this {LEGAL/POSSIBLE}?', '{}', array['capability'], array['forbidden_information','shock','curiosity'], 'tier_a', 'global_v1', array['shock'], '{"rhetoricalOnly":true,"restrictedForSensitiveBusinesses":true}'::jsonb),
  ('GF_005', 'secret_gatekeeping', 'Secret or gatekeeping', '{GROUP} does not want you to know about this', array['audience'], array['group'], array['secrecy','information_asymmetry','curiosity'], 'tier_a', 'global_v1', array['casual','shock'], '{"preferNonAccusatoryVariant":true,"neverInventCompetitors":true}'::jsonb),
  ('GF_006', 'pov_mini_story', 'POV mini-story', 'POV: {RELATABLE_SITUATION}', '{}', array['pain','audience','outcome'], array['self_identification','story','curiosity'], 'tier_a', 'global_v1', array['casual','story'], '{"singleScenarioOnly":true,"neverInventFacts":true}'::jsonb),
  ('GF_007', 'audience_callout', 'Audience callout', '{AUDIENCE} are gonna {LOVE/KISS} me after seeing this', array['audience'], '{}', array['identity','recognition','gratitude'], 'tier_b', 'global_v1', array['casual','playful'], '{"rhetoricalFirstPersonAllowed":true,"neverPromiseResults":true}'::jsonb),
  ('GF_008', 'identity_pain', 'Identity pain', '{PAINFUL_IDENTITY_OR_STATE} plus discovery', array['pain'], '{}', array['identity','pain','recognition'], 'tier_b', 'global_v1', array['casual','serious'], '{"neverInventSpeakerSituation":true}'::jsonb),
  ('GF_009', 'old_way_vs_new_way', 'Old way vs new way', '{OLD_METHOD} X {NEW_METHOD} check', array['old_method','new_method'], '{}', array['contrast','simplicity','transformation'], 'tier_b', 'global_v1', array['clear','casual'], '{"neverAddSpeedOrResultClaims":true}'::jsonb),
  ('GF_010', 'combination_equation', 'Combination or equation', '{THING_A} + {THING_B} = {OUTCOME}', array['thing_a','thing_b','outcome'], '{}', array['combination','simplicity','curiosity'], 'tier_b', 'global_v1', array['clear','playful'], '{"neverInventFinancialResults":true}'::jsonb),
  ('GF_011', 'specific_transformation', 'Specific transformation', '{RESULT} in {TIME/NUMBER}', array['verified_result','verified_time_or_number'], '{}', array['specificity','transformation','proof'], 'tier_a', 'global_v1', array['clear','shock'], '{"requiresSuppliedNumberOrDuration":true,"neverInferNumbers":true}'::jsonb),
  ('GF_012', 'conversational_disbelief', 'Conversational disbelief', 'I am sorry... THIS can {THING} now??', '{}', array['capability','problem_reframe'], array['disbelief','conversation','curiosity'], 'tier_b', 'global_v1', array['casual','shock'], '{"rhetoricalFirstPersonAllowed":true,"neverInventFacts":true}'::jsonb),
  ('GF_013', 'wdym_surprise', 'WDYM surprise', 'WDYM {SURPRISING_THING_OR_OUTCOME}?', '{}', array['audience','pain','capability','outcome'], array['slang','surprise','curiosity'], 'tier_c', 'global_v1', array['casual','playful'], '{"avoidFormalAudiences":true,"neverInventFacts":true}'::jsonb),
  ('GF_014', 'credit_owe_outcome', 'Credit or owe outcome', 'I owe {OUTCOME} to {PERSON/THING} that showed me this', array['verified_outcome','verified_source'], '{}', array['attribution','gratitude','outcome'], 'tier_b', 'global_v1', array['casual','story'], '{"requiresVerifiedOutcome":true,"neverInventTestimonials":true}'::jsonb),
  ('GF_015', 'discovery_opener', 'Discovery opener', 'I/FINALLY/JUST found {THING}', '{}', array['capability','solution'], array['discovery','novelty','curiosity'], 'tier_a', 'global_v1', array['casual','story'], '{"rhetoricalFirstPersonAllowed":true,"neverInventPersonalHistory":true}'::jsonb),
  ('GF_016', 'replacement_discovery', 'Replacement discovery', 'Is THIS the new {KNOWN_TOOL_OR_METHOD}?!', array['comparison'], array['capability'], array['comparison','disruption','curiosity'], 'tier_b', 'global_v1', array['casual','shock'], '{"requiresSuppliedComparison":true,"neverClaimEquivalence":true}'::jsonb),
  ('GF_017', 'audience_threat', 'Are we cooked', '{AUDIENCE}, are we cooked?', array['audience'], '{}', array['identity','threat','curiosity'], 'tier_c', 'global_v1', array['casual','playful'], '{"rhetoricalOnly":true,"avoidFormalAudiences":true}'::jsonb),
  ('GF_018', 'speed_challenge', 'Speed challenge', 'Making {DESIRED_RESULT} in {TIME} without {EFFORT}', array['verified_result','verified_time','painful_effort'], '{}', array['challenge','speed','transformation'], 'tier_b', 'global_v1', array['casual','shock'], '{"requiresSuppliedNumberOrDuration":true,"neverInventResults":true}'::jsonb)
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
  library_version = 'global-hook-text-formats-v1',
  enabled = true,
  updated_at = now();

insert into public.hook_text_format_variants (
  id, hook_text_format_id, template, instruction
) values
  ('GF_001_A','GF_001','I could literally KISS whoever showed me this','Use KISS as an obvious playful reaction.'),
  ('GF_001_B','GF_001','I could MARRY whoever showed me this','Use MARRY as an obvious playful reaction.'),
  ('GF_002_A','GF_002','Imagine {current_pain} when this exists','Use the direct Imagine structure.'),
  ('GF_002_B','GF_002','Imagine still {current_pain} when this exists','Use a still-doing-the-pain variation.'),
  ('GF_003_A','GF_003','{experience} doing {activity} and I JUST found this','Use only supplied experience.'),
  ('GF_003_B','GF_003','{time} doing this and I only just found THIS','Use only supplied time.'),
  ('GF_004_A','GF_004','How is this even possible?','Frame as surprising possibility.'),
  ('GF_004_B','GF_004','This feels illegal to know','Use illegal only as obvious hyperbole.'),
  ('GF_005_A','GF_005','Do not tell {audience} about this','Address a supplied audience without accusation.'),
  ('GF_005_B','GF_005','I finally understand why {group} gatekeeps this','Require a supplied group.'),
  ('GF_006_A','GF_006','POV: {pain_scenario}','Use one supplied pain scenario.'),
  ('GF_006_B','GF_006','POV: {discovery_or_outcome_scenario}','Use one supplied discovery or outcome scenario.'),
  ('GF_007_A','GF_007','{audience} are gonna love me after seeing this','Use love as rhetorical reaction.'),
  ('GF_007_B','GF_007','{audience} are gonna KISS me after seeing this','Use KISS only for a casual audience.'),
  ('GF_008_A','GF_008','{painful_identity_or_state}','State the supplied painful identity directly.'),
  ('GF_008_B','GF_008','Imagine being {painful_state}','Use Imagine plus the supplied state.'),
  ('GF_009_A','GF_009','{old_method} X {new_method} check','Use compact visual contrast.'),
  ('GF_009_B','GF_009','Still {old_method} when {new_method} exists?','Use natural sentence contrast.'),
  ('GF_010_A','GF_010','{thing_a} + {thing_b} = {outcome}','Use two supplied things and one supplied outcome.'),
  ('GF_011_A','GF_011','{verified_result} in {verified_time_or_number}','Use only supplied values.'),
  ('GF_011_B','GF_011','{verified_before} to {verified_after} in {verified_time}','Use only supplied before, after, and time.'),
  ('GF_012_A','GF_012','I am sorry... THIS can {capability} now??','Use one supplied capability.'),
  ('GF_012_B','GF_012','I am sorry... THIS is how {supplied_idea} works now??','Use one supplied process or outcome.'),
  ('GF_013_A','GF_013','WDYM {surprising_supplied_idea}?','Use one supplied surprising idea.'),
  ('GF_014_A','GF_014','I owe {verified_outcome} to {verified_source}','Use only supplied outcome and source.'),
  ('GF_015_A','GF_015','I just found {supplied_thing}','Use one supplied idea.'),
  ('GF_015_B','GF_015','FINALLY found {supplied_thing}','Use one supplied idea.'),
  ('GF_016_A','GF_016','Is THIS the new {known_tool_or_method}?!','Use only a supplied comparison.'),
  ('GF_016_B','GF_016','I''m sorry... is THIS the new {known_tool_or_method}?!','Use I''m sorry only with the supplied comparison.'),
  ('GF_017_A','GF_017','{audience}, are we cooked?','Use only a supplied audience and rhetorical concern.'),
  ('GF_018_A','GF_018','Making {verified_result} in {verified_time} without {painful_effort}','Use only supplied result, time, and effort.')
on conflict (id) do update set
  hook_text_format_id = excluded.hook_text_format_id,
  template = excluded.template,
  instruction = excluded.instruction,
  enabled = true,
  updated_at = now();

insert into public.hook_text_format_evidence (
  hook_text_format_id, observed_hook_text, source_reference, source_platform
) values
  ('GF_001','I could literally KISS the startup guy that sent me this','final-18-format-classification','instagram'),
  ('GF_002','Imagine stressing over ZERO app downloads when this exists','final-18-format-classification','instagram'),
  ('GF_003','9 years using Canva and I JUST found this','final-18-format-classification','instagram'),
  ('GF_004','How is this even legal?','final-18-format-classification','instagram'),
  ('GF_005','Do not tell anyone how apps are blowing up from a single post','final-18-format-classification','instagram'),
  ('GF_006','POV: you gave the app founder a chance and he sent THIS','final-18-format-classification','instagram'),
  ('GF_007','Unemployed people are gonna KISS me after seeing this','final-18-format-classification','instagram'),
  ('GF_008','My 9-5 is my only income','final-18-format-classification','instagram'),
  ('GF_009','Part time job X Kids YouTube + AI check','final-18-format-classification','instagram'),
  ('GF_010','AI + YouTube = $$$','final-18-format-classification','instagram'),
  ('GF_011','$1,200 in 6 minutes','final-18-format-classification','instagram'),
  ('GF_012','I am sorry is THIS the new CapCut?!','final-18-format-classification','instagram'),
  ('GF_013','WDYM my random app found its people overnight','final-18-format-classification','instagram'),
  ('GF_014','I owe my entire bank balance to the guy who showed me THIS','final-18-format-classification','instagram'),
  ('GF_015','FINALLY found a game where you have to stalk a missing girl''s phone','final-18-format-classification','instagram'),
  ('GF_016','Is THIS the new Canva?!','final-18-format-classification','instagram'),
  ('GF_017','game devs, are we cooked?','final-18-format-classification','instagram'),
  ('GF_018','Making your monthly salary in one day without yapping','final-18-format-classification','instagram')
on conflict (hook_text_format_id, observed_hook_text, source_reference)
  do nothing;

create index if not exists hook_text_format_variants_format_idx
  on public.hook_text_format_variants (hook_text_format_id, enabled);
create index if not exists hook_text_format_evidence_format_idx
  on public.hook_text_format_evidence (hook_text_format_id, created_at);

alter table public.hook_video_suggestions
  add column if not exists hook_text_format_id text
    references public.hook_text_formats(id),
  add column if not exists hook_text_variant_id text
    references public.hook_text_format_variants(id),
  add column if not exists hook_text_format_library_version text;

comment on column public.hook_video_suggestions.hook_text_format_id is
  'Global Hook writing format for V7+ generations; separate from visual hook_format_id.';
comment on column public.hook_video_suggestions.pattern_id is
  'Legacy writing pattern retained for historical generations. V7+ uses hook_text_format_id.';

create index if not exists hook_video_suggestions_text_format_idx
  on public.hook_video_suggestions (
    user_id, business_profile_id, hook_text_format_id, created_at desc
  ) where hook_text_format_id is not null;

alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_text_variant_format_check;
alter table public.hook_video_suggestions
  add constraint hook_video_suggestions_text_variant_format_check
  check (
    (hook_text_format_id is null and hook_text_variant_id is null)
    or (hook_text_format_id is not null and hook_text_variant_id is not null)
  ) not valid;

alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_text_variant_parent_fkey;
alter table public.hook_video_suggestions
  add constraint hook_video_suggestions_text_variant_parent_fkey
  foreign key (hook_text_format_id, hook_text_variant_id)
  references public.hook_text_format_variants (hook_text_format_id, id)
  not valid;

alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_v5_metadata_check;
alter table public.hook_video_suggestions
  add constraint hook_video_suggestions_v5_metadata_check
  check (
    (
      opening_lines is null
      and pattern_id is null
      and hook_text_format_id is null
      and pattern_library_version is null
      and hook_text_format_library_version is null
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
      and validator_version = 'trending-hook-validator-v3'
      and (
        (
          pattern_id in (
            'mystery_discovery','direct_capability','problem_observation',
            'skeptical_challenge','problem_reversal','workflow_exposed',
            'outcome_without_friction','professional_transformation'
          )
          and pattern_library_version in (
            'trending-hook-patterns-v1','trending-hook-patterns-v2',
            'trending-hook-patterns-v3'
          )
          and hook_text_format_id is null
          and hook_text_variant_id is null
          and hook_text_format_library_version is null
        )
        or
        (
          pattern_id is null
          and pattern_library_version is null
          and hook_text_format_id ~ '^GF_[0-9]{3}$'
          and hook_text_variant_id ~ '^GF_[0-9]{3}_[A-Z]$'
          and hook_text_format_library_version =
            'global-hook-text-formats-v1'
          and industry_pack_id is null
        )
      )
      and (
        suggestion_context = 'trending'
        or (demo_asset_id is not null and campaign_purpose is not null)
      )
    )
  ) not valid;

alter table public.hook_video_suggestions
  drop constraint if exists hook_video_suggestions_v7_audio_intent_required;
alter table public.hook_video_suggestions
  add constraint hook_video_suggestions_v7_audio_intent_required
  check (
    prompt_version is distinct from 'trending-hook-copy-v7'
    or (
      audio_intent is not null
      and hook_text_format_id is not null
      and hook_text_variant_id is not null
    )
  ) not valid;

create or replace function public.hook_copy_v7_candidate_is_valid(
  p_candidate jsonb
)
returns boolean
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_format_id text;
  v_variant_id text;
  v_legacy_candidate jsonb;
begin
  if jsonb_typeof(p_candidate) <> 'object'
    or p_candidate ? 'patternId'
    or p_candidate ? 'industryPackId'
    or coalesce(p_candidate ->> 'hookTextFormatLibraryVersion', '') <>
      'global-hook-text-formats-v1'
  then
    return false;
  end if;

  v_format_id := p_candidate ->> 'hookTextFormatId';
  v_variant_id := p_candidate ->> 'hookTextVariantId';

  if not exists (
    select 1
    from public.hook_text_formats as format
    join public.hook_text_format_variants as variant
      on variant.hook_text_format_id = format.id
    where format.id = v_format_id
      and variant.id = v_variant_id
      and format.enabled
      and variant.enabled
      and format.library_version = 'global-hook-text-formats-v1'
  ) then
    return false;
  end if;

  -- Reuse the already deployed semantic, visual-fit, audio-intent, truth, and
  -- line-count gates. The temporary legacy fields exist only inside this
  -- validator call and are never stored on a V7 suggestion.
  v_legacy_candidate := p_candidate || jsonb_build_object(
    'patternId', 'mystery_discovery',
    'patternLibraryVersion', 'trending-hook-patterns-v3',
    'industryPackId', 'general'
  );

  return public.hook_copy_v6_candidate_is_valid(v_legacy_candidate);
exception
  when others then
    return false;
end
$$;

revoke all on function public.hook_copy_v7_candidate_is_valid(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.hook_copy_v7_candidate_is_valid(jsonb)
  to service_role;

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
    or p_selection_version <> 'global-format-rotation-v1'
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

create or replace function public.persist_validated_hook_composition_generation_v7(
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
  legacy_candidates jsonb;
  updated_count integer;
begin
  if p_prompt_version <> 'trending-hook-copy-v7'
    or p_selection_version <> 'global-format-rotation-v1'
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'hook_composition_generation_invalid_v7_contract';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 4 or candidate_count > 8 or (
    select count(distinct (item.value ->> 'candidateIndex')::integer)
    from jsonb_array_elements(p_candidates) as item(value)
  ) <> candidate_count then
    raise exception 'hook_composition_generation_invalid_v7_candidates';
  end if;

  for candidate in select value from jsonb_array_elements(p_candidates)
  loop
    if not public.hook_copy_v7_candidate_is_valid(candidate) then
      raise exception 'hook_composition_generation_invalid_v7_candidate';
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

  perform public.persist_validated_hook_composition_generation_v6(
    p_job_id,
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    p_demo_asset_id,
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
    raise exception 'hook_composition_generation_v7_persistence_mismatch';
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

revoke all on function public.persist_validated_hook_composition_generation_v7(
  uuid, text, uuid, integer, uuid, text, text, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.persist_validated_hook_composition_generation_v7(
  uuid, text, uuid, integer, uuid, text, text, text, jsonb
) to service_role;

create table if not exists public.user_hook_text_format_performance (
  user_id text not null,
  business_profile_id uuid not null
    references public.business_profiles(id) on delete cascade,
  hook_text_format_id text not null
    references public.hook_text_formats(id) on delete cascade,
  campaign_purpose text,
  times_used integer not null default 0 check (times_used >= 0),
  recent_results jsonb not null default '[]'::jsonb
    check (jsonb_typeof(recent_results) = 'array'),
  median_views numeric check (median_views is null or median_views >= 0),
  average_views numeric check (average_views is null or average_views >= 0),
  consistency_score numeric not null default 0.5
    check (consistency_score between 0 and 1),
  performance_score numeric not null default 1
    check (performance_score >= 0),
  confidence_score numeric not null default 0
    check (confidence_score between 0 and 1),
  selection_weight numeric not null default 1
    check (selection_weight between 0.8 and 1.3),
  temporary_boost numeric not null default 0
    check (temporary_boost between 0 and 0.12),
  published_result_count integer not null default 0
    check (published_result_count >= 0),
  last_used_at timestamptz,
  refreshed_at timestamptz not null default now(),
  primary key (user_id, business_profile_id, hook_text_format_id)
);

comment on table public.user_hook_text_format_performance is
  'Per-user Global Hook text-format learning. V1 learns from attributed Instagram views only.';

alter table public.user_hook_text_format_performance enable row level security;
revoke all privileges on table public.user_hook_text_format_performance
  from anon, authenticated;
grant select, insert, update, delete
  on table public.user_hook_text_format_performance to service_role;

create index if not exists user_hook_text_format_performance_profile_idx
  on public.user_hook_text_format_performance (
    user_id, business_profile_id, selection_weight desc
  );

create or replace function public.get_hook_text_format_performance_profiles(
  p_user_id text,
  p_business_profile_id uuid
)
returns table(
  hook_text_format_id text,
  campaign_purpose text,
  times_generated bigint,
  last_generated_at timestamptz,
  published_result_count bigint,
  recent_view_counts bigint[],
  median_views numeric,
  selection_weight numeric,
  temporary_boost numeric
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or not exists (
      select 1
      from public.business_profiles as profile
      where profile.id = p_business_profile_id
        and profile.user_id = p_user_id
    )
  then
    return;
  end if;

  with generation_stats as (
    select
      suggestion.hook_text_format_id,
      count(*)::bigint as times_generated,
      max(suggestion.created_at) as last_generated_at,
      (array_agg(
        suggestion.campaign_purpose
        order by suggestion.created_at desc
      ) filter (where suggestion.campaign_purpose is not null))[1]
        as campaign_purpose
    from public.hook_video_suggestions as suggestion
    where suggestion.user_id = p_user_id
      and suggestion.business_profile_id = p_business_profile_id
      and suggestion.hook_text_format_id is not null
      and suggestion.suggestion_context in ('trending', 'composition')
    group by suggestion.hook_text_format_id
  ), ranked_views as (
    select
      suggestion.hook_text_format_id,
      observation.view_count,
      observation.observed_at,
      row_number() over (
        partition by suggestion.hook_text_format_id
        order by observation.observed_at desc, observation.id desc
      ) as result_rank
    from public.hook_performance_observations as observation
    join public.hook_video_suggestions as suggestion
      on suggestion.id = observation.hook_video_suggestion_id
      and suggestion.user_id = p_user_id
    where observation.user_id = p_user_id
      and observation.platform = 'instagram'
      and observation.view_count is not null
      and suggestion.business_profile_id = p_business_profile_id
      and suggestion.hook_text_format_id is not null
  ), result_stats as (
    select
      ranked.hook_text_format_id,
      count(*)::bigint as published_result_count,
      array_agg(
        ranked.view_count order by ranked.observed_at desc
      )::bigint[] as recent_view_counts,
      percentile_cont(0.5) within group (
        order by ranked.view_count
      )::numeric as median_views,
      avg(ranked.view_count)::numeric as average_views,
      greatest(
        0::numeric,
        least(
          1::numeric,
          1 - coalesce(
            stddev_pop(ranked.view_count)::numeric /
              nullif(avg(ranked.view_count)::numeric, 0),
            0
          )
        )
      ) as consistency_score
    from ranked_views as ranked
    where ranked.result_rank <= 12
    group by ranked.hook_text_format_id
  ), combined as (
    select
      format.id as hook_text_format_id,
      generation.campaign_purpose,
      coalesce(generation.times_generated, 0)::bigint as times_generated,
      generation.last_generated_at,
      coalesce(results.published_result_count, 0)::bigint
        as published_result_count,
      coalesce(results.recent_view_counts, '{}'::bigint[])
        as recent_view_counts,
      results.median_views,
      results.average_views,
      coalesce(results.consistency_score, 0.5) as consistency_score
    from public.hook_text_formats as format
    left join generation_stats as generation
      on generation.hook_text_format_id = format.id
    left join result_stats as results
      on results.hook_text_format_id = format.id
    where format.enabled
      and format.global_status = 'global_v1'
  ), baseline as (
    select percentile_cont(0.5) within group (
      order by combined.median_views
    )::numeric as median_views
    from combined
    where combined.median_views is not null
  ), scored as (
    select
      combined.*,
      case
        when combined.median_views is not null
          and baseline.median_views > 0
          then combined.median_views / baseline.median_views
        else 1::numeric
      end as performance_score,
      least(1::numeric, combined.published_result_count::numeric / 5)
        as confidence_score
    from combined
    cross join baseline
  ), final_scores as (
    select
      scored.*,
      case
        when scored.published_result_count = 1
          and scored.performance_score >= 1.2 then 0.08::numeric
        else 0::numeric
      end as temporary_boost,
      greatest(
        0.8::numeric,
        least(
          1.3::numeric,
          1 +
          case
            when scored.published_result_count >= 2 then greatest(
              -0.12::numeric,
              least(
                0.22::numeric,
                (scored.performance_score - 1) * 0.16 *
                  least(
                    1::numeric,
                    greatest(
                      0::numeric,
                      (scored.published_result_count - 1)::numeric / 5
                    )
                  )
              )
            )
            else 0::numeric
          end +
          case
            when scored.published_result_count >= 3
              then (scored.consistency_score - 0.5) * 0.04
            else 0::numeric
          end
        )
      ) as selection_weight
    from scored
  )
  insert into public.user_hook_text_format_performance (
    user_id,
    business_profile_id,
    hook_text_format_id,
    campaign_purpose,
    times_used,
    recent_results,
    median_views,
    average_views,
    consistency_score,
    performance_score,
    confidence_score,
    selection_weight,
    temporary_boost,
    published_result_count,
    last_used_at,
    refreshed_at
  )
  select
    p_user_id,
    p_business_profile_id,
    final_scores.hook_text_format_id,
    final_scores.campaign_purpose,
    final_scores.times_generated::integer,
    to_jsonb(final_scores.recent_view_counts),
    final_scores.median_views,
    final_scores.average_views,
    final_scores.consistency_score,
    final_scores.performance_score,
    final_scores.confidence_score,
    final_scores.selection_weight,
    final_scores.temporary_boost,
    final_scores.published_result_count::integer,
    final_scores.last_generated_at,
    now()
  from final_scores
  on conflict (user_id, business_profile_id, hook_text_format_id)
  do update set
    campaign_purpose = excluded.campaign_purpose,
    times_used = excluded.times_used,
    recent_results = excluded.recent_results,
    median_views = excluded.median_views,
    average_views = excluded.average_views,
    consistency_score = excluded.consistency_score,
    performance_score = excluded.performance_score,
    confidence_score = excluded.confidence_score,
    selection_weight = excluded.selection_weight,
    temporary_boost = excluded.temporary_boost,
    published_result_count = excluded.published_result_count,
    last_used_at = excluded.last_used_at,
    refreshed_at = excluded.refreshed_at;

  return query
    select
      performance.hook_text_format_id,
      performance.campaign_purpose,
      performance.times_used::bigint,
      performance.last_used_at,
      performance.published_result_count::bigint,
      array(
        select jsonb_array_elements_text(performance.recent_results)::bigint
      ),
      performance.median_views,
      performance.selection_weight,
      performance.temporary_boost
    from public.user_hook_text_format_performance as performance
    where performance.user_id = p_user_id
      and performance.business_profile_id = p_business_profile_id
    order by performance.hook_text_format_id;
end
$$;

revoke all on function public.get_hook_text_format_performance_profiles(
  text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.get_hook_text_format_performance_profiles(
  text, uuid
) to service_role;

select pg_notify('pgrst', 'reload schema');
