-- Wall-of-Text V7 is additive. Legacy creatives and the V6 replacement RPC
-- remain readable while all new generation state is persisted separately.

alter table public.overlay_media_assets
  add column if not exists wall_text_source_kind text;

update public.overlay_media_assets
set wall_text_source_kind = case
  when owner_user_id is null then 'ugcpilot'
  else 'creative_asset'
end
where format_family = 'wall_text_overlay'
  and wall_text_source_kind is null;

alter table public.overlay_media_assets
  drop constraint if exists overlay_media_assets_wall_text_source_kind_chk;

alter table public.overlay_media_assets
  add constraint overlay_media_assets_wall_text_source_kind_chk
  check (
    wall_text_source_kind is null
    or wall_text_source_kind in ('ugcpilot', 'creative_asset', 'instagram_reel')
  );

alter table public.wall_audio_assets
  add column if not exists selection_scope text not null default 'matcher_pool';

alter table public.wall_audio_assets
  drop constraint if exists wall_audio_assets_selection_scope_chk;

alter table public.wall_audio_assets
  add constraint wall_audio_assets_selection_scope_chk
  check (selection_scope in ('matcher_pool', 'instagram_reel_locked'));

alter table public.wall_audio_assets
  drop constraint if exists wall_audio_assets_active_review_check;

alter table public.wall_audio_assets
  add constraint wall_audio_assets_active_review_check check (
    status <> 'active'
    or (
      review_status = 'approved'
      and reviewed_at is not null
      and (
        (
          selection_scope = 'matcher_pool'
          and cardinality(moods) between 1 and 3
          and cardinality(message_types) between 1 and 4
          and energy is not null
          and loopable is not null
        )
        or (
          selection_scope = 'instagram_reel_locked'
          and loopable = false
        )
      )
    )
  );

create table if not exists public.wall_text_instagram_reel_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique
    check (template_key ~ '^instagram_reel_[0-9]{3,}$'),
  overlay_media_asset_id uuid not null unique
    references public.overlay_media_assets(id) on delete restrict,
  locked_audio_asset_id text not null unique
    references public.wall_audio_assets(id) on delete restrict,
  reference_text text not null
    check (char_length(btrim(reference_text)) between 8 and 600),
  reference_text_hash text not null
    check (reference_text_hash ~ '^[a-f0-9]{64}$'),
  writer_format_id text not null
    check (writer_format_id in (
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
    )),
  instagram_reference_url text not null
    check (instagram_reference_url ~ '^https://'),
  canonical_reference_url text not null unique
    check (canonical_reference_url ~ '^https://'),
  safe_text_box jsonb not null,
  audio_fit_mode text not null
    check (audio_fit_mode in ('exact', 'trim')),
  template_version integer not null default 1
    check (template_version > 0),
  import_batch text not null
    check (char_length(btrim(import_batch)) > 0),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'inactive', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wall_text_instagram_templates_safe_box_chk check (
    coalesce(
      jsonb_typeof(safe_text_box) = 'object'
      and (safe_text_box ->> 'x')::numeric between 0 and 1
      and (safe_text_box ->> 'y')::numeric between 0 and 1
      and (safe_text_box ->> 'width')::numeric > 0
      and (safe_text_box ->> 'height')::numeric > 0
      and (safe_text_box ->> 'x')::numeric +
        (safe_text_box ->> 'width')::numeric <= 1
      and (safe_text_box ->> 'y')::numeric +
        (safe_text_box ->> 'height')::numeric <= 1,
      false
    )
  )
);

create or replace function public.validate_wall_text_instagram_reel_template()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  audio_record public.wall_audio_assets;
  video_record public.overlay_media_assets;
  playable_duration numeric;
begin
  if tg_op = 'UPDATE'
    and old.status = 'active'
    and row(
      new.template_key,
      new.overlay_media_asset_id,
      new.locked_audio_asset_id,
      new.reference_text,
      new.reference_text_hash,
      new.writer_format_id,
      new.instagram_reference_url,
      new.canonical_reference_url,
      new.safe_text_box,
      new.audio_fit_mode,
      new.template_version,
      new.import_batch
    ) is distinct from row(
      old.template_key,
      old.overlay_media_asset_id,
      old.locked_audio_asset_id,
      old.reference_text,
      old.reference_text_hash,
      old.writer_format_id,
      old.instagram_reference_url,
      old.canonical_reference_url,
      old.safe_text_box,
      old.audio_fit_mode,
      old.template_version,
      old.import_batch
    )
  then
    raise exception 'wall_text_instagram_active_template_immutable';
  end if;

  select asset.* into video_record
  from public.overlay_media_assets as asset
  where asset.id = new.overlay_media_asset_id
    and asset.asset_type = 'video'
    and asset.format_family = 'wall_text_overlay'
    and asset.aspect_ratio = '9:16'
    and asset.status = 'active'
    and asset.analysis_status = 'succeeded'
    and asset.wall_text_source_kind = 'instagram_reel'
    and asset.duration_seconds > 0
    and asset.duration_seconds <= 60
    and asset.preview_url is not null
    and asset.source_file_sha256 is not null
    and asset.source_batch is not null
    and asset.visual_group is not null;
  if not found then
    raise exception 'wall_text_instagram_video_unavailable';
  end if;

  select audio.* into audio_record
  from public.wall_audio_assets as audio
  where audio.id = new.locked_audio_asset_id
    and audio.selection_scope = 'instagram_reel_locked'
    and audio.status = 'active'
    and audio.review_status = 'approved';
  if not found then
    raise exception 'wall_text_instagram_audio_unavailable';
  end if;

  playable_duration := audio_record.duration_seconds - audio_record.cue_start_seconds;
  if new.audio_fit_mode = 'exact'
    and abs(playable_duration - video_record.duration_seconds) > 0.08
  then
    raise exception 'wall_text_instagram_audio_exact_fit_invalid';
  elsif new.audio_fit_mode = 'trim'
    and playable_duration <= video_record.duration_seconds + 0.08
  then
    raise exception 'wall_text_instagram_audio_trim_fit_invalid';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_wall_text_instagram_reel_template_row
  on public.wall_text_instagram_reel_templates;

create trigger validate_wall_text_instagram_reel_template_row
before insert or update on public.wall_text_instagram_reel_templates
for each row
execute function public.validate_wall_text_instagram_reel_template();

revoke all on function public.validate_wall_text_instagram_reel_template()
  from public, anon, authenticated;

alter table public.wall_text_creatives
  add column if not exists source_kind text not null default 'ugcpilot',
  add column if not exists instagram_reel_template_id uuid
    references public.wall_text_instagram_reel_templates(id) on delete restrict;

alter table public.wall_text_creatives
  drop constraint if exists wall_text_creatives_source_kind_chk,
  drop constraint if exists wall_text_creatives_instagram_template_chk,
  drop constraint if exists wall_text_creatives_candidate_index_check;

alter table public.wall_text_creatives
  add constraint wall_text_creatives_source_kind_chk
    check (source_kind in ('ugcpilot', 'creative_asset', 'instagram_reel')),
  add constraint wall_text_creatives_instagram_template_chk
    check (
      (source_kind = 'instagram_reel') =
      (instagram_reel_template_id is not null)
    ),
  add constraint wall_text_creatives_candidate_index_check
    check (candidate_index >= 0 and candidate_index < 1000000);

alter table public.user_wall_text_assignments
  drop constraint if exists user_wall_text_assignments_position_check;

alter table public.user_wall_text_assignments
  add constraint user_wall_text_assignments_position_check
  check (position >= 0 and position < 1000000);

alter table public.wall_text_creatives
  alter column generator_version
    set default 'business-profile-wall-text-v7';

create or replace function public.validate_wall_text_creative()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_asset public.overlay_media_assets;
begin
  if not exists (
    select 1
    from public.business_profiles as profile
    where profile.id = new.business_profile_id
      and profile.user_id = new.user_id
      and profile.profile_version = new.business_profile_version
  ) then
    raise exception 'wall_text_business_profile_changed';
  end if;

  select asset.* into source_asset
  from public.overlay_media_assets as asset
  where asset.id = new.overlay_media_asset_id
    and asset.asset_type = 'video'
    and asset.format_family = 'wall_text_overlay'
    and asset.aspect_ratio = '9:16'
    and asset.status = 'active'
    and asset.analysis_status = 'succeeded'
    and asset.duration_seconds > 0
    and asset.preview_url is not null
    and asset.source_file_sha256 is not null
    and asset.source_batch is not null
    and asset.visual_group is not null;
  if not found then
    raise exception 'wall_text_background_not_ready';
  end if;

  if new.source_kind = 'ugcpilot' and (
    source_asset.wall_text_source_kind <> 'ugcpilot'
    or source_asset.owner_user_id is not null
  ) then
    raise exception 'wall_text_background_source_mismatch';
  elsif new.source_kind = 'creative_asset' and (
    source_asset.wall_text_source_kind <> 'creative_asset'
    or source_asset.owner_user_id is distinct from new.user_id
  ) then
    raise exception 'wall_text_background_owner_mismatch';
  elsif new.source_kind = 'instagram_reel' and not exists (
    select 1
    from public.wall_text_instagram_reel_templates as template
    join public.wall_audio_assets as audio
      on audio.id = template.locked_audio_asset_id
    where template.id = new.instagram_reel_template_id
      and template.overlay_media_asset_id = new.overlay_media_asset_id
      and template.status = 'active'
      and source_asset.wall_text_source_kind = 'instagram_reel'
      and audio.selection_scope = 'instagram_reel_locked'
      and audio.status = 'active'
      and audio.review_status = 'approved'
  ) then
    raise exception 'wall_text_instagram_template_mismatch';
  end if;

  new.duration_seconds := source_asset.duration_seconds;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_wall_text_creative()
  from public, anon, authenticated;

create or replace function public.validate_wall_text_audio_selection()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  creative_record public.wall_text_creatives;
  edit_source_overridden boolean := false;
  expected_locked_audio_id text;
  selected_asset public.wall_audio_assets;
  playable_duration numeric;
begin
  new.user_id := btrim(new.user_id);
  new.updated_at := now();

  select creative.* into creative_record
  from public.wall_text_creatives as creative
  where creative.id = new.wall_text_creative_id
    and creative.user_id = new.user_id
    and creative.status = 'preview_ready';
  if not found then
    raise exception 'wall_text_audio_creative_unavailable'
      using errcode = '42501';
  end if;

  if new.creative_edit_id is not null then
    select edit.source_selection_kind is not null
    into edit_source_overridden
    from public.trending_creative_edits as edit
    where edit.id = new.creative_edit_id
      and edit.user_id = new.user_id
      and edit.creative_id = new.wall_text_creative_id
      and edit.format = 'wall_text'
      and edit.revision = new.creative_edit_revision;
    if not found then
      raise exception 'wall_text_audio_edit_unavailable'
        using errcode = '42501';
    end if;
  end if;

  select asset.* into selected_asset
  from public.wall_audio_assets as asset
  where asset.id = new.audio_asset_id
    and asset.status = 'active'
    and asset.review_status = 'approved';
  if not found then
    raise exception 'wall_text_audio_asset_unavailable'
      using errcode = '23514';
  end if;

  if creative_record.source_kind = 'instagram_reel'
    and not edit_source_overridden
  then
    select template.locked_audio_asset_id into expected_locked_audio_id
    from public.wall_text_instagram_reel_templates as template
    where template.id = creative_record.instagram_reel_template_id
      and template.status = 'active';
    if expected_locked_audio_id is null
      or selected_asset.id <> expected_locked_audio_id
      or selected_asset.selection_scope <> 'instagram_reel_locked'
      or new.fit_mode = 'loop'
    then
      raise exception 'wall_text_instagram_locked_audio_mismatch'
        using errcode = '23514';
    end if;
  elsif selected_asset.selection_scope <> 'matcher_pool' then
    raise exception 'wall_text_matcher_audio_scope_mismatch'
      using errcode = '23514';
  end if;

  if abs(new.cue_start_seconds - selected_asset.cue_start_seconds) > 0.001 then
    raise exception 'wall_text_audio_cue_mismatch'
      using errcode = '23514';
  end if;

  playable_duration :=
    selected_asset.duration_seconds - selected_asset.cue_start_seconds;
  if new.fit_mode = 'exact'
    and abs(playable_duration - new.video_duration_seconds) > 0.08
  then
    raise exception 'wall_text_audio_exact_fit_invalid'
      using errcode = '23514';
  elsif new.fit_mode = 'trim'
    and playable_duration <= new.video_duration_seconds + 0.08
  then
    raise exception 'wall_text_audio_trim_fit_invalid'
      using errcode = '23514';
  elsif new.fit_mode = 'loop'
    and (
      not selected_asset.loopable
      or playable_duration + 0.08 >= new.video_duration_seconds
    )
  then
    raise exception 'wall_text_audio_loop_fit_invalid'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_wall_text_audio_selection()
  from public, anon, authenticated;
grant execute on function public.validate_wall_text_audio_selection()
  to service_role;

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
          and (text_content -> 'finalLayout' ->> 'fontWeight')::integer = 700
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
          and (text_content -> 'finalLayout' ->> 'fontWeight')::integer = 700
          and (text_content -> 'finalLayout' ->> 'fontSizePx')::integer in (44, 46, 48, 50, 52)
          and jsonb_array_length(text_content -> 'finalLayout' -> 'blocks') = 1
          and text_content #>> '{finalLayout,blocks,0,role}' = 'text'
          and jsonb_array_length(text_content #> '{finalLayout,blocks,0,lines}') between 4 and 7
        )
      ),
      false
    )
  );

create table if not exists public.wall_text_generation_batches (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (char_length(btrim(user_id)) > 0),
  business_profile_id uuid not null
    references public.business_profiles(id) on delete cascade,
  business_profile_version integer not null check (business_profile_version > 0),
  request_key text not null check (char_length(btrim(request_key)) > 0),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  requested_count integer not null check (requested_count between 1 and 50),
  chunk_size integer not null default 10 check (chunk_size = 10),
  chunk_count integer not null check (chunk_count > 0),
  candidate_index_start integer not null check (candidate_index_start >= 0),
  generator_version text not null,
  prompt_version text not null,
  format_library_version text not null,
  selector_version text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint wall_text_generation_batches_request_key unique (user_id, request_key)
);

create table if not exists public.wall_text_generation_chunks (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null
    references public.wall_text_generation_batches(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  first_batch_candidate_index integer not null
    check (first_batch_candidate_index >= 0),
  candidate_count integer not null check (candidate_count between 1 and 10),
  idempotency_key text not null unique,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry_pending', 'completed', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  content_retry_count integer not null default 0 check (content_retry_count between 0 and 1),
  claim_token uuid,
  locked_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wall_text_generation_chunks_batch_index_key unique (batch_id, chunk_index)
);

create table if not exists public.wall_text_generation_assignments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null
    references public.wall_text_generation_batches(id) on delete cascade,
  chunk_id uuid not null
    references public.wall_text_generation_chunks(id) on delete cascade,
  batch_candidate_index integer not null check (batch_candidate_index >= 0),
  creative_candidate_index integer not null check (creative_candidate_index >= 0),
  assigned_format_id text,
  actual_format_id text,
  format_version integer not null default 1 check (format_version > 0),
  format_library_version text not null,
  selection_mode text not null
    check (selection_mode in ('controlled_rotation', 'performance_exploration', 'performance_weighted', 'instagram_template')),
  selection_weight_snapshot numeric(8, 4) not null default 1
    check (selection_weight_snapshot > 0),
  source_kind text not null
    check (source_kind in ('ugcpilot', 'creative_asset', 'instagram_reel')),
  overlay_media_asset_id uuid not null
    references public.overlay_media_assets(id) on delete restrict,
  instagram_reel_template_id uuid
    references public.wall_text_instagram_reel_templates(id) on delete restrict,
  instagram_reel_template_version integer,
  instagram_reference_text text,
  instagram_reference_text_hash text,
  instagram_locked_audio_asset_id text
    references public.wall_audio_assets(id) on delete restrict,
  instagram_audio_fit_mode text,
  duration_seconds numeric(8, 3) not null check (duration_seconds > 0),
  layout_json jsonb not null,
  target_words integer not null check (target_words > 0),
  max_words integer not null check (max_words >= target_words),
  focus_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry_pending', 'completed', 'failed')),
  content_attempt_count integer not null default 0 check (content_attempt_count between 0 and 2),
  last_failure_code text,
  wall_text_creative_id uuid unique
    references public.wall_text_creatives(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wall_text_generation_assignments_candidate_key
    unique (batch_id, batch_candidate_index),
  constraint wall_text_generation_assignments_source_chk check (
    (
      source_kind = 'instagram_reel'
      and instagram_reel_template_id is not null
      and instagram_reel_template_version is not null
      and instagram_reel_template_version > 0
      and instagram_reference_text is not null
      and char_length(btrim(instagram_reference_text)) between 8 and 600
      and instagram_reference_text_hash is not null
      and instagram_reference_text_hash ~ '^[a-f0-9]{64}$'
      and instagram_locked_audio_asset_id is not null
      and instagram_audio_fit_mode is not null
      and instagram_audio_fit_mode in ('exact', 'trim')
    )
    or (
      source_kind <> 'instagram_reel'
      and instagram_reel_template_id is null
      and instagram_reel_template_version is null
      and instagram_reference_text is null
      and instagram_reference_text_hash is null
      and instagram_locked_audio_asset_id is null
      and instagram_audio_fit_mode is null
    )
  )
);

create table if not exists public.wall_text_content_history (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (char_length(btrim(user_id)) > 0),
  business_profile_id uuid not null
    references public.business_profiles(id) on delete cascade,
  wall_text_creative_id uuid not null
    references public.wall_text_creatives(id) on delete cascade,
  creative_edit_id uuid
    references public.trending_creative_edits(id) on delete cascade,
  creative_edit_revision integer,
  normalized_text text not null check (char_length(normalized_text) > 0),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  normalization_version text not null,
  similarity_signature jsonb not null,
  similarity_version text not null,
  format_id text,
  format_version integer,
  format_attribution text not null
    check (format_attribution in ('original', 'minor_edit', 'major_edit', 'manual_custom', 'legacy_unknown')),
  performance_eligible boolean not null,
  performance_exclusion_reason text,
  created_at timestamptz not null default now(),
  constraint wall_text_content_history_edit_scope_chk check (
    (creative_edit_id is null and creative_edit_revision is null)
    or (creative_edit_id is not null and creative_edit_revision > 0)
  ),
  constraint wall_text_content_history_performance_chk check (
    (performance_eligible and format_attribution in ('original', 'minor_edit'))
    or (not performance_eligible)
  ),
  constraint wall_text_content_history_exact_duplicate_key
    unique (user_id, business_profile_id, content_hash)
);

create unique index if not exists wall_text_content_history_base_uidx
  on public.wall_text_content_history (wall_text_creative_id)
  where creative_edit_id is null;

create unique index if not exists wall_text_content_history_edit_uidx
  on public.wall_text_content_history (creative_edit_id, creative_edit_revision)
  where creative_edit_id is not null;

create index if not exists wall_text_content_history_profile_recent_idx
  on public.wall_text_content_history
    (user_id, business_profile_id, created_at desc);

create table if not exists public.wall_text_performance_observations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (char_length(btrim(user_id)) > 0),
  business_profile_id uuid not null
    references public.business_profiles(id) on delete cascade,
  wall_text_creative_id uuid not null
    references public.wall_text_creatives(id) on delete cascade,
  content_history_id uuid not null
    references public.wall_text_content_history(id) on delete cascade,
  generation_assignment_id uuid
    references public.wall_text_generation_assignments(id) on delete set null,
  scheduled_post_target_id uuid not null unique,
  social_connection_id uuid,
  platform text not null,
  platform_post_id text not null,
  published_at timestamptz not null,
  observed_at timestamptz not null,
  view_count bigint not null check (view_count >= 0),
  created_at timestamptz not null default now(),
  constraint wall_text_performance_platform_post_key
    unique (platform, platform_post_id),
  constraint wall_text_performance_window_chk check (
    observed_at >= published_at + interval '72 hours'
    and observed_at <= published_at + interval '96 hours'
  )
);

alter table public.trending_creative_edits
  add column if not exists wall_text_edit_classification text,
  add column if not exists wall_text_format_learning_eligible boolean,
  add column if not exists wall_text_content_hash text;

alter table public.trending_creative_edits
  drop constraint if exists trending_creative_edits_wall_attribution_chk;

alter table public.trending_creative_edits
  add constraint trending_creative_edits_wall_attribution_chk check (
    (
      format <> 'wall_text'
      and wall_text_edit_classification is null
      and wall_text_format_learning_eligible is null
      and wall_text_content_hash is null
    )
    or (
      format = 'wall_text'
      and wall_text_edit_classification in ('none', 'minor', 'major')
      and wall_text_format_learning_eligible is not null
      and wall_text_content_hash ~ '^[a-f0-9]{64}$'
    )
  ) not valid;

create or replace function public.save_wall_text_edit_with_history_v1(
  p_user_id text,
  p_assignment_id uuid,
  p_creative_id uuid,
  p_expected_revision integer,
  p_content_json jsonb,
  p_position_json jsonb,
  p_source_selection_kind text,
  p_source_group_id uuid,
  p_source_media_asset_id uuid,
  p_resolved_media_asset_id uuid,
  p_edit_classification text,
  p_normalized_text text,
  p_content_hash text,
  p_similarity_signature jsonb
)
returns setof public.trending_creative_edits
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_edit public.trending_creative_edits;
  saved_edit public.trending_creative_edits;
  creative_record public.wall_text_creatives;
  next_revision integer;
  original_format_id text;
  learning_eligible boolean;
begin
  if p_edit_classification not in ('none', 'minor', 'major') then
    raise exception 'wall_text_edit_classification_invalid';
  end if;

  select creative.* into creative_record
  from public.wall_text_creatives as creative
  join public.user_wall_text_assignments as assignment
    on assignment.wall_text_creative_id = creative.id
  where creative.id = p_creative_id
    and creative.user_id = p_user_id
    and assignment.id = p_assignment_id
    and assignment.user_id = p_user_id
  for update of creative;
  if not found then
    raise exception 'wall_text_edit_unavailable';
  end if;

  select edit.* into existing_edit
  from public.trending_creative_edits as edit
  where edit.user_id = p_user_id
    and edit.format = 'wall_text'
    and edit.creative_id = p_creative_id
  for update;

  if coalesce(existing_edit.revision, 0) <> p_expected_revision then
    raise exception 'wall_text_edit_revision_conflict';
  end if;
  next_revision := coalesce(existing_edit.revision, 0) + 1;
  original_format_id := creative_record.text_content ->> 'formatId';
  learning_eligible :=
    p_edit_classification in ('none', 'minor')
    and original_format_id is not null
    and creative_record.source_kind <> 'instagram_reel';

  if existing_edit.id is null then
    insert into public.trending_creative_edits (
      user_id, assignment_id, creative_id, format, revision, content_json,
      position_json, source_selection_kind, source_group_id,
      source_media_asset_id, resolved_media_asset_id, render_status,
      wall_text_edit_classification, wall_text_format_learning_eligible,
      wall_text_content_hash
    ) values (
      p_user_id, p_assignment_id, p_creative_id, 'wall_text', next_revision,
      p_content_json, p_position_json, p_source_selection_kind,
      p_source_group_id, p_source_media_asset_id, p_resolved_media_asset_id,
      'draft', p_edit_classification, learning_eligible, p_content_hash
    ) returning * into saved_edit;
  else
    update public.trending_creative_edits
    set
      assignment_id = p_assignment_id,
      revision = next_revision,
      content_json = p_content_json,
      position_json = p_position_json,
      source_selection_kind = p_source_selection_kind,
      source_group_id = p_source_group_id,
      source_media_asset_id = p_source_media_asset_id,
      resolved_media_asset_id = p_resolved_media_asset_id,
      render_status = 'draft',
      render_job_id = null,
      render_output_json = null,
      render_error = null,
      wall_text_edit_classification = p_edit_classification,
      wall_text_format_learning_eligible = learning_eligible,
      wall_text_content_hash = p_content_hash,
      updated_at = now()
    where id = existing_edit.id
    returning * into saved_edit;
  end if;

  insert into public.wall_text_content_history (
    user_id, business_profile_id, wall_text_creative_id, creative_edit_id,
    creative_edit_revision, normalized_text, content_hash,
    normalization_version, similarity_signature, similarity_version,
    format_id, format_version, format_attribution, performance_eligible,
    performance_exclusion_reason
  ) values (
    p_user_id, creative_record.business_profile_id, p_creative_id,
    saved_edit.id, saved_edit.revision, p_normalized_text, p_content_hash,
    'wall-text-normalization-v1', p_similarity_signature,
    'wall-text-duplicate-signature-v1', original_format_id, 1,
    case when p_edit_classification = 'major'
      then 'major_edit' else 'minor_edit' end,
    learning_eligible,
    case when learning_eligible then null
      else 'manual_edit_changed_format_or_template' end
  )
  on conflict (user_id, business_profile_id, content_hash) do nothing;

  return next saved_edit;
end;
$$;

create index if not exists wall_text_performance_profile_idx
  on public.wall_text_performance_observations
    (user_id, business_profile_id, observed_at desc);

create index if not exists wall_text_generation_batches_profile_idx
  on public.wall_text_generation_batches
    (user_id, business_profile_id, created_at desc);

create index if not exists wall_text_generation_chunks_status_idx
  on public.wall_text_generation_chunks (status, created_at);

create index if not exists wall_text_generation_assignments_batch_idx
  on public.wall_text_generation_assignments (batch_id, batch_candidate_index);

create or replace function public.reserve_wall_text_generation_batch_v1(
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_request_key text,
  p_request_hash text,
  p_generator_version text,
  p_prompt_version text,
  p_format_library_version text,
  p_selector_version text,
  p_assignments jsonb
)
returns setof public.wall_text_generation_batches
language plpgsql
security invoker
set search_path = ''
as $$
declare
  assignment_count integer;
  ordinary_assignment_count integer;
  batch_record public.wall_text_generation_batches;
  candidate_start integer;
begin
  assignment_count := jsonb_array_length(p_assignments);
  if jsonb_typeof(p_assignments) <> 'array'
    or assignment_count < 1
    or assignment_count > 50
  then
    raise exception 'wall_text_batch_invalid_assignments';
  end if;

  select count(*) into ordinary_assignment_count
  from jsonb_array_elements(p_assignments) as item(value)
  where item.value ->> 'sourceKind' <> 'instagram_reel';

  perform 1
  from public.business_profiles as profile
  where profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.profile_version = p_business_profile_version
  for update;
  if not found then
    raise exception 'wall_text_business_profile_changed';
  end if;

  select batch.* into batch_record
  from public.wall_text_generation_batches as batch
  where batch.user_id = p_user_id
    and batch.request_key = p_request_key;
  if found then
    if batch_record.request_hash <> p_request_hash then
      raise exception 'wall_text_batch_idempotency_mismatch';
    end if;
    return next batch_record;
    return;
  end if;

  if ordinary_assignment_count > 1 and exists (
    select 1
    from jsonb_array_elements(p_assignments) as item
    where item ->> 'assignedFormatId' is not null
      and item ->> 'sourceKind' <> 'instagram_reel'
    group by item ->> 'assignedFormatId'
    having count(*) > floor(ordinary_assignment_count * 0.5)
  ) then
    raise exception 'wall_text_batch_format_share_exceeded';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignments) as item(value)
    where item.value ->> 'sourceKind' = 'instagram_reel'
      and not exists (
        select 1
        from public.wall_text_instagram_reel_templates as template
        where template.id = nullif(
            item.value ->> 'instagramReelTemplateId', ''
          )::uuid
          and template.status = 'active'
          and template.template_version = (
            item.value ->> 'instagramReelTemplateVersion'
          )::integer
          and template.overlay_media_asset_id = (
            item.value ->> 'overlayMediaAssetId'
          )::uuid
          and template.locked_audio_asset_id =
            item.value ->> 'instagramLockedAudioAssetId'
          and template.reference_text =
            item.value ->> 'instagramReferenceText'
          and template.reference_text_hash =
            item.value ->> 'instagramReferenceTextHash'
          and template.audio_fit_mode =
            item.value ->> 'instagramAudioFitMode'
          and template.writer_format_id = item.value ->> 'assignedFormatId'
          and abs(
            (template.safe_text_box ->> 'x')::numeric -
            (item.value #>> '{layout,textBox,x}')::numeric
          ) < 0.000001
          and abs(
            (template.safe_text_box ->> 'y')::numeric -
            (item.value #>> '{layout,textBox,y}')::numeric
          ) < 0.000001
          and abs(
            (template.safe_text_box ->> 'width')::numeric -
            (item.value #>> '{layout,textBox,width}')::numeric
          ) < 0.000001
          and abs(
            (template.safe_text_box ->> 'height')::numeric -
            (item.value #>> '{layout,textBox,height}')::numeric
          ) < 0.000001
      )
  ) then
    raise exception 'wall_text_instagram_reservation_mismatch';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignments) as item(value)
    where item.value ->> 'sourceKind' <> 'instagram_reel'
      and (
        item.value ->> 'instagramReelTemplateId' is not null
        or item.value ->> 'instagramReelTemplateVersion' is not null
        or item.value ->> 'instagramReferenceText' is not null
        or item.value ->> 'instagramReferenceTextHash' is not null
        or item.value ->> 'instagramLockedAudioAssetId' is not null
        or item.value ->> 'instagramAudioFitMode' is not null
      )
  ) then
    raise exception 'wall_text_non_instagram_snapshot_invalid';
  end if;

  select greatest(
    coalesce((
      select max(creative.candidate_index) + 1
      from public.wall_text_creatives as creative
      where creative.user_id = p_user_id
        and creative.business_profile_id = p_business_profile_id
        and creative.business_profile_version = p_business_profile_version
    ), 0),
    coalesce((
      select max(batch.candidate_index_start + batch.requested_count)
      from public.wall_text_generation_batches as batch
      where batch.user_id = p_user_id
        and batch.business_profile_id = p_business_profile_id
        and batch.business_profile_version = p_business_profile_version
    ), 0)
  ) into candidate_start;

  insert into public.wall_text_generation_batches (
    user_id, business_profile_id, business_profile_version, request_key,
    request_hash, requested_count, chunk_count, candidate_index_start,
    generator_version, prompt_version, format_library_version,
    selector_version
  ) values (
    p_user_id, p_business_profile_id, p_business_profile_version,
    btrim(p_request_key), p_request_hash, assignment_count,
    ceil(assignment_count / 10.0)::integer, candidate_start,
    p_generator_version, p_prompt_version, p_format_library_version,
    p_selector_version
  ) returning * into batch_record;

  insert into public.wall_text_generation_chunks (
    batch_id, chunk_index, first_batch_candidate_index, candidate_count,
    idempotency_key, request_hash
  )
  select
    batch_record.id,
    chunk_index,
    chunk_index * 10,
    least(10, assignment_count - chunk_index * 10),
    'wall-text-batch:' || batch_record.id::text || ':chunk:' || chunk_index::text,
    p_request_hash
  from generate_series(0, batch_record.chunk_count - 1) as chunk_index;

  insert into public.wall_text_generation_assignments (
    batch_id, chunk_id, batch_candidate_index, creative_candidate_index,
    assigned_format_id, format_library_version, selection_mode,
    selection_weight_snapshot, source_kind, overlay_media_asset_id,
    instagram_reel_template_id, instagram_reel_template_version,
    instagram_reference_text, instagram_reference_text_hash,
    instagram_locked_audio_asset_id, instagram_audio_fit_mode,
    duration_seconds, layout_json,
    target_words, max_words, focus_json
  )
  select
    batch_record.id,
    chunk.id,
    item.ordinality - 1,
    candidate_start + item.ordinality - 1,
    item.value ->> 'assignedFormatId',
    p_format_library_version,
    item.value ->> 'selectionMode',
    coalesce((item.value ->> 'selectionWeight')::numeric, 1),
    item.value ->> 'sourceKind',
    (item.value ->> 'overlayMediaAssetId')::uuid,
    nullif(item.value ->> 'instagramReelTemplateId', '')::uuid,
    nullif(item.value ->> 'instagramReelTemplateVersion', '')::integer,
    item.value ->> 'instagramReferenceText',
    item.value ->> 'instagramReferenceTextHash',
    item.value ->> 'instagramLockedAudioAssetId',
    item.value ->> 'instagramAudioFitMode',
    (item.value ->> 'durationSeconds')::numeric,
    item.value -> 'layout',
    (item.value ->> 'targetWords')::integer,
    (item.value ->> 'maxWords')::integer,
    coalesce(item.value -> 'focus', '{}'::jsonb)
  from jsonb_array_elements(p_assignments) with ordinality as item(value, ordinality)
  join public.wall_text_generation_chunks as chunk
    on chunk.batch_id = batch_record.id
    and chunk.chunk_index = floor((item.ordinality - 1) / 10.0)::integer;

  return next batch_record;
end;
$$;

create or replace function public.claim_wall_text_generation_chunk_v1(
  p_user_id text,
  p_chunk_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  chunk_record public.wall_text_generation_chunks;
  next_claim_token uuid;
begin
  select chunk.* into chunk_record
  from public.wall_text_generation_chunks as chunk
  join public.wall_text_generation_batches as batch
    on batch.id = chunk.batch_id
  where chunk.id = p_chunk_id
    and batch.user_id = p_user_id
  for update of chunk;
  if not found then
    raise exception 'wall_text_generation_chunk_unavailable';
  end if;

  if chunk_record.status = 'completed' then
    return null;
  end if;
  if chunk_record.status = 'failed' then
    raise exception 'wall_text_generation_chunk_failed';
  end if;
  if chunk_record.status = 'processing'
    and chunk_record.locked_at > now() - interval '15 minutes'
  then
    return null;
  end if;

  next_claim_token := gen_random_uuid();

  update public.wall_text_generation_chunks
  set
    attempt_count = attempt_count + 1,
    claim_token = next_claim_token,
    last_error_code = null,
    last_error_message = null,
    locked_at = now(),
    status = 'processing',
    updated_at = now()
  where id = p_chunk_id;

  update public.wall_text_generation_assignments
  set status = 'processing', updated_at = now()
  where chunk_id = p_chunk_id
    and status <> 'completed';

  update public.wall_text_generation_batches
  set status = 'processing', updated_at = now()
  where id = chunk_record.batch_id
    and status <> 'completed';

  return next_claim_token;
end;
$$;

create or replace function public.record_wall_text_generation_chunk_failure_v1(
  p_user_id text,
  p_chunk_id uuid,
  p_claim_token uuid,
  p_error_code text,
  p_error_message text,
  p_retryable boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  batch_id_value uuid;
begin
  select chunk.batch_id into batch_id_value
  from public.wall_text_generation_chunks as chunk
  join public.wall_text_generation_batches as batch
    on batch.id = chunk.batch_id
  where chunk.id = p_chunk_id
    and batch.user_id = p_user_id
    and chunk.status = 'processing'
    and chunk.claim_token = p_claim_token
  for update of chunk;
  if not found then
    raise exception 'wall_text_generation_chunk_stale_claim';
  end if;

  update public.wall_text_generation_chunks
  set
    content_retry_count = case
      when not p_retryable then 1
      else content_retry_count
    end,
    last_error_code = left(btrim(p_error_code), 120),
    last_error_message = left(btrim(p_error_message), 1000),
    claim_token = null,
    locked_at = null,
    status = case when p_retryable then 'retry_pending' else 'failed' end,
    updated_at = now()
  where id = p_chunk_id
    and status <> 'completed';

  update public.wall_text_generation_assignments
  set
    last_failure_code = left(btrim(p_error_code), 120),
    status = case when p_retryable then 'retry_pending' else 'failed' end,
    updated_at = now()
  where chunk_id = p_chunk_id
    and status <> 'completed';

  if not p_retryable then
    update public.wall_text_generation_batches
    set status = 'failed', updated_at = now()
    where id = batch_id_value
      and status <> 'completed';
  end if;
end;
$$;

create or replace function public.save_wall_text_generation_candidate_v1(
  p_user_id text,
  p_assignment_id uuid,
  p_claim_token uuid,
  p_creative_id uuid,
  p_generator_model text,
  p_text_content jsonb,
  p_layout jsonb,
  p_normalized_text text,
  p_content_hash text,
  p_similarity_signature jsonb
)
returns setof public.wall_text_creatives
language plpgsql
security invoker
set search_path = ''
as $$
declare
  assignment_record public.wall_text_generation_assignments;
  batch_record public.wall_text_generation_batches;
  saved_creative public.wall_text_creatives;
begin
  select assignment.* into assignment_record
  from public.wall_text_generation_assignments as assignment
  join public.wall_text_generation_batches as batch
    on batch.id = assignment.batch_id
  where assignment.id = p_assignment_id
    and batch.user_id = p_user_id;
  if not found then
    raise exception 'wall_text_generation_assignment_unavailable';
  end if;

  select batch.* into batch_record
  from public.wall_text_generation_batches as batch
  where batch.id = assignment_record.batch_id;

  if assignment_record.status = 'completed' then
    return query
    select creative.*
    from public.wall_text_creatives as creative
    where creative.id = assignment_record.wall_text_creative_id;
    return;
  end if;

  perform 1
  from public.wall_text_generation_chunks as chunk
  where chunk.id = assignment_record.chunk_id
    and chunk.status = 'processing'
    and chunk.claim_token = p_claim_token
  for update;
  if not found then
    raise exception 'wall_text_generation_candidate_stale_claim';
  end if;

  select assignment.* into assignment_record
  from public.wall_text_generation_assignments as assignment
  where assignment.id = p_assignment_id
  for update;

  if assignment_record.status = 'completed' then
    return query
    select creative.*
    from public.wall_text_creatives as creative
    where creative.id = assignment_record.wall_text_creative_id;
    return;
  end if;

  insert into public.wall_text_creatives (
    id, user_id, business_profile_id, business_profile_version,
    overlay_media_asset_id, generation_id, candidate_index,
    duration_seconds, text_content, layout, generator_version,
    generator_model, status, source_kind, instagram_reel_template_id
  ) values (
    p_creative_id, batch_record.user_id, batch_record.business_profile_id,
    batch_record.business_profile_version,
    assignment_record.overlay_media_asset_id, batch_record.id,
    assignment_record.creative_candidate_index,
    assignment_record.duration_seconds, p_text_content, p_layout,
    batch_record.generator_version, btrim(p_generator_model), 'preview_ready',
    assignment_record.source_kind,
    assignment_record.instagram_reel_template_id
  ) returning * into saved_creative;

  insert into public.wall_text_content_history (
    user_id, business_profile_id, wall_text_creative_id, normalized_text,
    content_hash, normalization_version, similarity_signature,
    similarity_version, format_id, format_version, format_attribution,
    performance_eligible, performance_exclusion_reason
  ) values (
    batch_record.user_id, batch_record.business_profile_id, saved_creative.id,
    p_normalized_text, p_content_hash, 'wall-text-normalization-v1',
    p_similarity_signature, 'wall-text-duplicate-signature-v1',
    assignment_record.assigned_format_id, assignment_record.format_version,
    'original', assignment_record.source_kind <> 'instagram_reel',
    case when assignment_record.source_kind = 'instagram_reel'
      then 'instagram_template_performance_is_separate' else null end
  );

  update public.wall_text_generation_assignments
  set
    actual_format_id = assignment_record.assigned_format_id,
    content_attempt_count = content_attempt_count + 1,
    last_failure_code = null,
    status = 'completed',
    wall_text_creative_id = saved_creative.id,
    updated_at = now()
  where id = assignment_record.id;

  if not exists (
    select 1
    from public.wall_text_generation_assignments as pending
    where pending.chunk_id = assignment_record.chunk_id
      and pending.status <> 'completed'
  ) then
    update public.wall_text_generation_chunks
    set
      status = 'completed',
      claim_token = null,
      locked_at = null,
      completed_at = now(),
      updated_at = now()
    where id = assignment_record.chunk_id;
  end if;

  if not exists (
    select 1
    from public.wall_text_generation_assignments as pending
    where pending.batch_id = assignment_record.batch_id
      and pending.status <> 'completed'
  ) then
    update public.wall_text_generation_batches
    set status = 'completed', completed_at = now(), updated_at = now()
    where id = assignment_record.batch_id;
  else
    update public.wall_text_generation_batches
    set status = 'processing', updated_at = now()
    where id = assignment_record.batch_id
      and status = 'pending';
  end if;

  return next saved_creative;
end;
$$;

create or replace function public.get_wall_text_format_performance_v1(
  p_user_id text,
  p_business_profile_id uuid
)
returns table (
  format_id text,
  last_generated_at timestamptz,
  published_result_count bigint,
  recent_view_counts bigint[],
  times_generated bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with generated as (
    select
      assignment.assigned_format_id as format_id,
      max(assignment.created_at) as last_generated_at,
      count(*) as times_generated
    from public.wall_text_generation_assignments as assignment
    join public.wall_text_generation_batches as batch
      on batch.id = assignment.batch_id
    where batch.user_id = p_user_id
      and batch.business_profile_id = p_business_profile_id
      and assignment.assigned_format_id is not null
    group by assignment.assigned_format_id
  ), observed as (
    select
      history.format_id,
      count(*) as published_result_count,
      (array_agg(observation.view_count order by observation.observed_at desc))[1:12]
        as recent_view_counts
    from public.wall_text_performance_observations as observation
    join public.wall_text_content_history as history
      on history.id = observation.content_history_id
    where observation.user_id = p_user_id
      and observation.business_profile_id = p_business_profile_id
      and history.performance_eligible
      and history.format_id is not null
    group by history.format_id
  )
  select
    coalesce(generated.format_id, observed.format_id),
    generated.last_generated_at,
    coalesce(observed.published_result_count, 0),
    coalesce(observed.recent_view_counts, '{}'::bigint[]),
    coalesce(generated.times_generated, 0)
  from generated
  full outer join observed using (format_id);
$$;

create or replace function public.record_wall_text_performance_observation_v1(
  p_user_id text,
  p_platform text,
  p_social_connection_id uuid,
  p_platform_post_id text,
  p_published_at timestamptz,
  p_observed_at timestamptz,
  p_view_count bigint
)
returns table(recorded boolean, evaluated boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_business_profile_id uuid;
  v_content_history_id uuid;
  v_creative_id uuid;
  v_generation_assignment_id uuid;
  v_published_at timestamptz;
  v_target_id uuid;
begin
  if nullif(btrim(coalesce(p_user_id, '')), '') is null
    or p_platform <> 'instagram'
    or p_social_connection_id is null
    or nullif(btrim(coalesce(p_platform_post_id, '')), '') is null
    or p_published_at is null
    or p_observed_at is null
    or (p_view_count is not null and p_view_count < 0)
  then
    raise exception 'wall_text_performance_input_invalid';
  end if;

  select
    target.id,
    target.published_at,
    creative.id,
    creative.business_profile_id,
    history.id,
    generation_assignment.id
  into
    v_target_id,
    v_published_at,
    v_creative_id,
    v_business_profile_id,
    v_content_history_id,
    v_generation_assignment_id
  from public.scheduled_post_targets as target
  join public.scheduled_posts as post
    on post.id = target.scheduled_post_id
    and post.user_id = p_user_id
    and post.source_kind = 'media_asset'
  join public.media_assets as media
    on media.id = post.media_asset_id
    and media.user_id = p_user_id
    and media.source_type = 'wall_text_render'
    and media.status = 'ready'
  join public.wall_text_creatives as creative
    on creative.id::text = media.metadata ->> 'creativeId'
    and creative.user_id = p_user_id
  join public.wall_text_content_history as history
    on history.user_id = p_user_id
    and history.business_profile_id = creative.business_profile_id
    and history.content_hash = media.metadata ->> 'contentHash'
  left join public.wall_text_generation_assignments as generation_assignment
    on generation_assignment.wall_text_creative_id = creative.id
  where target.user_id = p_user_id
    and target.platform = p_platform
    and target.social_connection_id = p_social_connection_id
    and target.platform_post_id = btrim(p_platform_post_id)
    and target.status = 'published'
    and target.published_at is not null
    and coalesce((media.metadata ->> 'formatLearningEligible')::boolean, false)
    and history.performance_eligible
  order by target.published_at desc, target.created_at desc
  limit 1;

  if not found
    or abs(extract(epoch from (v_published_at - p_published_at))) > 86400
  then
    return query select false, false;
    return;
  end if;

  if p_observed_at < v_published_at + interval '72 hours'
    or p_observed_at > v_published_at + interval '96 hours'
    or p_view_count is null
  then
    return query select true, false;
    return;
  end if;

  insert into public.wall_text_performance_observations (
    user_id, business_profile_id, wall_text_creative_id,
    content_history_id, generation_assignment_id, scheduled_post_target_id,
    social_connection_id, platform, platform_post_id, published_at,
    observed_at, view_count
  ) values (
    p_user_id, v_business_profile_id, v_creative_id, v_content_history_id,
    v_generation_assignment_id, v_target_id, p_social_connection_id,
    p_platform, btrim(p_platform_post_id), v_published_at,
    p_observed_at, p_view_count
  ) on conflict (scheduled_post_target_id) do nothing;

  return query select true, true;
end;
$$;

alter table public.wall_text_instagram_reel_templates enable row level security;
alter table public.wall_text_generation_batches enable row level security;
alter table public.wall_text_generation_chunks enable row level security;
alter table public.wall_text_generation_assignments enable row level security;
alter table public.wall_text_content_history enable row level security;
alter table public.wall_text_performance_observations enable row level security;

revoke all privileges on table
  public.wall_text_instagram_reel_templates,
  public.wall_text_generation_batches,
  public.wall_text_generation_chunks,
  public.wall_text_generation_assignments,
  public.wall_text_content_history,
  public.wall_text_performance_observations
from public, anon, authenticated;

grant select, insert, update on table
  public.wall_text_instagram_reel_templates,
  public.wall_text_generation_batches,
  public.wall_text_generation_chunks,
  public.wall_text_generation_assignments
to service_role;

grant select, insert on table
  public.wall_text_content_history,
  public.wall_text_performance_observations
to service_role;

revoke all on function public.reserve_wall_text_generation_batch_v1(
  text, uuid, integer, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.reserve_wall_text_generation_batch_v1(
  text, uuid, integer, text, text, text, text, text, text, jsonb
) to service_role;

revoke all on function public.claim_wall_text_generation_chunk_v1(text, uuid)
  from public, anon, authenticated;

grant execute on function public.claim_wall_text_generation_chunk_v1(text, uuid)
  to service_role;

revoke all on function public.record_wall_text_generation_chunk_failure_v1(
  text, uuid, uuid, text, text, boolean
) from public, anon, authenticated;

grant execute on function public.record_wall_text_generation_chunk_failure_v1(
  text, uuid, uuid, text, text, boolean
) to service_role;

revoke all on function public.save_wall_text_generation_candidate_v1(
  text, uuid, uuid, uuid, text, jsonb, jsonb, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.save_wall_text_generation_candidate_v1(
  text, uuid, uuid, uuid, text, jsonb, jsonb, text, text, jsonb
) to service_role;

revoke all on function public.get_wall_text_format_performance_v1(text, uuid)
  from public, anon, authenticated;

grant execute on function public.get_wall_text_format_performance_v1(text, uuid)
  to service_role;

revoke all on function public.save_wall_text_edit_with_history_v1(
  text, uuid, uuid, integer, jsonb, jsonb, text, uuid, uuid, uuid,
  text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.save_wall_text_edit_with_history_v1(
  text, uuid, uuid, integer, jsonb, jsonb, text, uuid, uuid, uuid,
  text, text, text, jsonb
) to service_role;

revoke all on function public.record_wall_text_performance_observation_v1(
  text, text, uuid, text, timestamptz, timestamptz, bigint
) from public, anon, authenticated;

grant execute on function public.record_wall_text_performance_observation_v1(
  text, text, uuid, text, timestamptz, timestamptz, bigint
) to service_role;

select pg_notify('pgrst', 'reload schema');
