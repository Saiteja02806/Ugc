create table if not exists public.wall_audio_assets (
  id text primary key
    check (id ~ '^audio_[0-9]{3}(_segment_[0-9]{2})?$'),
  source_audio_id text not null
    check (source_audio_id ~ '^audio_[0-9]{3}$'),
  storage_provider text not null default 'gcp'
    check (storage_provider = 'gcp'),
  storage_key text not null unique
    check (char_length(btrim(storage_key)) > 0),
  audio_url text not null
    check (audio_url ~ '^https://'),
  duration_seconds numeric(10, 3) not null
    check (duration_seconds > 0 and duration_seconds <= 600),
  source_start_seconds numeric(10, 3) not null default 0
    check (source_start_seconds >= 0),
  source_end_seconds numeric(10, 3) not null
    check (source_end_seconds > source_start_seconds),
  cue_start_seconds numeric(10, 3) not null default 0
    check (cue_start_seconds >= 0 and cue_start_seconds < duration_seconds),
  moods text[] not null default '{}'::text[],
  message_types text[] not null default '{}'::text[],
  energy text
    check (energy is null or energy in ('low', 'medium', 'high')),
  loopable boolean,
  measured_integrated_lufs numeric(6, 2) not null,
  measured_true_peak_db numeric(6, 2) not null,
  sha256 text not null unique
    check (sha256 ~ '^[a-f0-9]{64}$'),
  file_size_bytes bigint not null
    check (file_size_bytes > 0),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  review_notes text,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'active', 'inactive')),
  schema_version text not null default 'wall-audio-library-v2'
    check (char_length(btrim(schema_version)) > 0),
  preparation_version text not null default 'wall-audio-preparation-v2'
    check (char_length(btrim(preparation_version)) > 0),
  tagging_version text not null default 'wall-audio-tagging-v1'
    check (char_length(btrim(tagging_version)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint wall_audio_assets_moods_check check (
    moods <@ array[
      'curious',
      'uplifting',
      'serious',
      'calm',
      'urgent',
      'playful'
    ]::text[]
    and cardinality(moods) <= 3
  ),
  constraint wall_audio_assets_message_types_check check (
    message_types <@ array[
      'curiosity',
      'problem',
      'warning',
      'transformation',
      'benefit',
      'story',
      'authority'
    ]::text[]
    and cardinality(message_types) <= 4
  ),
  constraint wall_audio_assets_active_review_check check (
    status <> 'active'
    or (
      review_status = 'approved'
      and reviewed_at is not null
      and cardinality(moods) between 1 and 3
      and cardinality(message_types) between 1 and 4
      and energy is not null
      and loopable is not null
    )
  )
);

create index if not exists wall_audio_assets_active_duration_idx
  on public.wall_audio_assets (energy, duration_seconds, id)
  where status = 'active' and review_status = 'approved';

create table if not exists public.wall_text_audio_selections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null
    check (
      char_length(btrim(user_id)) > 0
      and char_length(btrim(user_id)) <= 200
    ),
  wall_text_creative_id uuid not null
    references public.wall_text_creatives(id) on delete cascade,
  creative_edit_id uuid
    references public.trending_creative_edits(id) on delete cascade,
  creative_edit_revision integer
    check (creative_edit_revision is null or creative_edit_revision > 0),
  content_fingerprint text not null
    check (content_fingerprint ~ '^[a-f0-9]{64}$'),
  video_duration_seconds numeric(10, 3) not null
    check (video_duration_seconds > 0 and video_duration_seconds <= 60),
  audio_asset_id text not null
    references public.wall_audio_assets(id) on delete restrict,
  audio_intent jsonb not null,
  fit_mode text not null
    check (fit_mode in ('exact', 'trim', 'loop')),
  cue_start_seconds numeric(10, 3) not null
    check (cue_start_seconds >= 0),
  output_duration_seconds numeric(10, 3) not null
    check (output_duration_seconds > 0 and output_duration_seconds <= 60),
  fade_out_seconds numeric(5, 3) not null default 0.2
    check (fade_out_seconds >= 0 and fade_out_seconds <= 1),
  match_score numeric(5, 4) not null
    check (match_score >= 0 and match_score <= 1),
  matching_version text not null
    check (char_length(btrim(matching_version)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint wall_text_audio_selections_edit_scope_check check (
    (creative_edit_id is null and creative_edit_revision is null)
    or (creative_edit_id is not null and creative_edit_revision is not null)
  ),
  constraint wall_text_audio_selections_duration_snapshot_check check (
    abs(output_duration_seconds - video_duration_seconds) <= 0.001
  ),
  constraint wall_text_audio_selections_intent_check check (
    coalesce(
      jsonb_typeof(audio_intent) = 'object'
      and jsonb_typeof(audio_intent -> 'moods') = 'array'
      and jsonb_array_length(audio_intent -> 'moods') between 1 and 3
      and jsonb_typeof(audio_intent -> 'messageTypes') = 'array'
      and jsonb_array_length(audio_intent -> 'messageTypes') between 1 and 3
      and audio_intent ->> 'energy' in ('low', 'medium', 'high'),
      false
    )
  )
);

create unique index if not exists wall_text_audio_selections_base_uidx
  on public.wall_text_audio_selections (user_id, wall_text_creative_id)
  where creative_edit_id is null;

create unique index if not exists wall_text_audio_selections_edit_uidx
  on public.wall_text_audio_selections (
    user_id,
    creative_edit_id,
    creative_edit_revision
  )
  where creative_edit_id is not null;

create index if not exists wall_text_audio_selections_creative_idx
  on public.wall_text_audio_selections (wall_text_creative_id);

create index if not exists wall_text_audio_selections_edit_idx
  on public.wall_text_audio_selections (creative_edit_id)
  where creative_edit_id is not null;

create index if not exists wall_text_audio_selections_asset_idx
  on public.wall_text_audio_selections (audio_asset_id);

create index if not exists wall_text_audio_selections_recent_user_idx
  on public.wall_text_audio_selections (
    user_id,
    updated_at desc,
    audio_asset_id
  );

create or replace function public.validate_wall_text_audio_selection()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_asset public.wall_audio_assets;
  playable_duration numeric;
begin
  new.user_id := btrim(new.user_id);
  new.updated_at := now();

  if not exists (
    select 1
    from public.wall_text_creatives as creative
    where creative.id = new.wall_text_creative_id
      and creative.user_id = new.user_id
      and creative.status = 'preview_ready'
  ) then
    raise exception 'wall_text_audio_creative_unavailable'
      using errcode = '42501';
  end if;

  if new.creative_edit_id is not null and not exists (
    select 1
    from public.trending_creative_edits as edit
    where edit.id = new.creative_edit_id
      and edit.user_id = new.user_id
      and edit.creative_id = new.wall_text_creative_id
      and edit.format = 'wall_text'
      and edit.revision = new.creative_edit_revision
  ) then
    raise exception 'wall_text_audio_edit_unavailable'
      using errcode = '42501';
  end if;

  select asset.*
  into selected_asset
  from public.wall_audio_assets as asset
  where asset.id = new.audio_asset_id
    and asset.status = 'active'
    and asset.review_status = 'approved';

  if not found then
    raise exception 'wall_text_audio_asset_unavailable'
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

drop trigger if exists validate_wall_text_audio_selection_row
  on public.wall_text_audio_selections;

create trigger validate_wall_text_audio_selection_row
before insert or update on public.wall_text_audio_selections
for each row
execute function public.validate_wall_text_audio_selection();

create or replace function public.save_wall_text_audio_selection(
  p_user_id text,
  p_wall_text_creative_id uuid,
  p_creative_edit_id uuid,
  p_creative_edit_revision integer,
  p_content_fingerprint text,
  p_video_duration_seconds numeric,
  p_audio_asset_id text,
  p_audio_intent jsonb,
  p_fit_mode text,
  p_cue_start_seconds numeric,
  p_output_duration_seconds numeric,
  p_fade_out_seconds numeric,
  p_match_score numeric,
  p_matching_version text
)
returns setof public.wall_text_audio_selections
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_creative_edit_id is null then
    return query
    insert into public.wall_text_audio_selections (
      user_id,
      wall_text_creative_id,
      creative_edit_id,
      creative_edit_revision,
      content_fingerprint,
      video_duration_seconds,
      audio_asset_id,
      audio_intent,
      fit_mode,
      cue_start_seconds,
      output_duration_seconds,
      fade_out_seconds,
      match_score,
      matching_version
    )
    values (
      p_user_id,
      p_wall_text_creative_id,
      null,
      null,
      p_content_fingerprint,
      p_video_duration_seconds,
      p_audio_asset_id,
      p_audio_intent,
      p_fit_mode,
      p_cue_start_seconds,
      p_output_duration_seconds,
      p_fade_out_seconds,
      p_match_score,
      p_matching_version
    )
    on conflict (user_id, wall_text_creative_id)
      where creative_edit_id is null
    do update set
      content_fingerprint = excluded.content_fingerprint,
      video_duration_seconds = excluded.video_duration_seconds,
      audio_asset_id = excluded.audio_asset_id,
      audio_intent = excluded.audio_intent,
      fit_mode = excluded.fit_mode,
      cue_start_seconds = excluded.cue_start_seconds,
      output_duration_seconds = excluded.output_duration_seconds,
      fade_out_seconds = excluded.fade_out_seconds,
      match_score = excluded.match_score,
      matching_version = excluded.matching_version,
      updated_at = now()
    returning *;
  else
    return query
    insert into public.wall_text_audio_selections (
      user_id,
      wall_text_creative_id,
      creative_edit_id,
      creative_edit_revision,
      content_fingerprint,
      video_duration_seconds,
      audio_asset_id,
      audio_intent,
      fit_mode,
      cue_start_seconds,
      output_duration_seconds,
      fade_out_seconds,
      match_score,
      matching_version
    )
    values (
      p_user_id,
      p_wall_text_creative_id,
      p_creative_edit_id,
      p_creative_edit_revision,
      p_content_fingerprint,
      p_video_duration_seconds,
      p_audio_asset_id,
      p_audio_intent,
      p_fit_mode,
      p_cue_start_seconds,
      p_output_duration_seconds,
      p_fade_out_seconds,
      p_match_score,
      p_matching_version
    )
    on conflict (user_id, creative_edit_id, creative_edit_revision)
      where creative_edit_id is not null
    do update set
      wall_text_creative_id = excluded.wall_text_creative_id,
      content_fingerprint = excluded.content_fingerprint,
      video_duration_seconds = excluded.video_duration_seconds,
      audio_asset_id = excluded.audio_asset_id,
      audio_intent = excluded.audio_intent,
      fit_mode = excluded.fit_mode,
      cue_start_seconds = excluded.cue_start_seconds,
      output_duration_seconds = excluded.output_duration_seconds,
      fade_out_seconds = excluded.fade_out_seconds,
      match_score = excluded.match_score,
      matching_version = excluded.matching_version,
      updated_at = now()
    returning *;
  end if;
end;
$$;

alter table public.wall_audio_assets enable row level security;
alter table public.wall_text_audio_selections enable row level security;

revoke all privileges on table public.wall_audio_assets
  from public, anon, authenticated;
revoke all privileges on table public.wall_text_audio_selections
  from public, anon, authenticated;

grant select, insert, update on table public.wall_audio_assets
  to service_role;
grant select, insert, update on table public.wall_text_audio_selections
  to service_role;

revoke all on function public.validate_wall_text_audio_selection()
  from public, anon, authenticated;
grant execute on function public.validate_wall_text_audio_selection()
  to service_role;

revoke all on function public.save_wall_text_audio_selection(
  text,
  uuid,
  uuid,
  integer,
  text,
  numeric,
  text,
  jsonb,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  text
) from public, anon, authenticated;
grant execute on function public.save_wall_text_audio_selection(
  text,
  uuid,
  uuid,
  integer,
  text,
  numeric,
  text,
  jsonb,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  text
) to service_role;

select pg_notify('pgrst', 'reload schema');
