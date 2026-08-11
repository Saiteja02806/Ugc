-- Locked Hook audio belongs to an individual catalog video, not to its visual
-- format. A format can contain many videos that need different sound effects.

do $$
begin
  if exists (
    select 1
    from public.hook_formats
    where audio_mode = 'locked'
       or locked_audio_asset_id is not null
  ) then
    raise exception
      'Cannot remove format-level Hook audio locking while locked formats exist';
  end if;
end
$$;

drop index if exists public.hook_formats_locked_audio_asset_idx;

alter table public.hook_formats
  drop constraint if exists hook_formats_locked_audio_check,
  drop constraint if exists hook_formats_audio_mode_check;

alter table public.hook_formats
  add constraint hook_formats_audio_mode_check
  check (audio_mode in ('dynamic', 'preferred')) not valid;

alter table public.hook_formats
  validate constraint hook_formats_audio_mode_check;

alter table public.hook_formats
  drop column if exists locked_audio_asset_id;

alter table public.hook_audio_selections
  drop constraint if exists hook_audio_selections_selection_source_check,
  drop constraint if exists hook_audio_selections_match_score_check;

alter table public.hook_audio_selections
  alter column match_score drop not null;

-- A manually selected lock is not an AI similarity result, so it must not
-- invent a match score. Historical format_locked values are converted
-- defensively after the old checks are removed and before the corrected
-- constraints are installed.
update public.hook_audio_selections
set selection_source = 'video_locked',
    match_score = null
where selection_source = 'format_locked';

alter table public.hook_audio_selections
  add constraint hook_audio_selections_selection_source_check
  check (
    selection_source in ('video_locked', 'format_preferred', 'dynamic')
  ) not valid,
  add constraint hook_audio_selections_match_score_check
  check (
    (
      selection_source = 'video_locked'
      and match_score is null
    )
    or
    (
      selection_source in ('format_preferred', 'dynamic')
      and match_score is not null
      and match_score >= 0
      and match_score <= 1
    )
  ) not valid;

alter table public.hook_audio_selections
  validate constraint hook_audio_selections_selection_source_check,
  validate constraint hook_audio_selections_match_score_check;

create table public.hook_video_audio_locks (
  hook_video_id uuid primary key
    references public.avatar_assets(id) on delete cascade,
  audio_asset_id text not null
    references public.hook_audio_assets(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hook_video_audio_locks_notes_check check (
    notes is null
    or char_length(btrim(notes)) between 1 and 1000
  )
);

create index hook_video_audio_locks_audio_asset_idx
  on public.hook_video_audio_locks (audio_asset_id);

comment on table public.hook_video_audio_locks is
  'Server-only mapping from one catalog Hook video to its manually approved Locked audio. The same audio may be reused by many videos.';

comment on column public.hook_video_audio_locks.hook_video_id is
  'Primary key intentionally limits each Hook video to one Locked audio.';

create or replace function public.validate_hook_video_audio_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  video_row public.avatar_assets%rowtype;
  audio_row public.hook_audio_assets%rowtype;
begin
  select *
  into video_row
  from public.avatar_assets
  where id = new.hook_video_id;

  if not found then
    raise exception 'Hook video % does not exist', new.hook_video_id;
  end if;

  if video_row.avatar_type <> 'global'
     or video_row.status <> 'ready'
     or video_row.deleted_at is not null
     or video_row.has_audio is distinct from false
     or video_row.hook_format_id is null
     or video_row.duration_seconds is null
     or video_row.duration_seconds <= 0
     or video_row.source_video_url !~ '^https://' then
    raise exception
      'Hook video % is not an available, ready, silent catalog video with a format and duration',
      new.hook_video_id;
  end if;

  select *
  into audio_row
  from public.hook_audio_assets
  where id = new.audio_asset_id;

  if not found then
    raise exception 'Hook audio % does not exist', new.audio_asset_id;
  end if;

  if audio_row.status <> 'active'
     or audio_row.review_status <> 'approved'
     or audio_row.loopable is distinct from false
     or audio_row.duration_seconds is null
     or audio_row.duration_seconds <= 0
     or audio_row.audio_url !~ '^https://' then
    raise exception
      'Hook audio % is not approved, active, non-looping, and available',
      new.audio_asset_id;
  end if;

  if audio_row.duration_seconds < video_row.duration_seconds then
    raise exception
      'Hook audio % is shorter than Hook video %',
      new.audio_asset_id,
      new.hook_video_id;
  end if;

  new.updated_at := now();
  return new;
end
$$;

create trigger validate_hook_video_audio_lock_before_write
before insert or update
on public.hook_video_audio_locks
for each row
execute function public.validate_hook_video_audio_lock();

alter table public.hook_video_audio_locks enable row level security;

revoke all privileges on table public.hook_video_audio_locks
  from public, anon, authenticated;
grant select, insert, update, delete on table public.hook_video_audio_locks
  to service_role;

revoke all privileges on function public.validate_hook_video_audio_lock()
  from public, anon, authenticated;
grant execute on function public.validate_hook_video_audio_lock()
  to service_role;

-- Seed the first user-approved mapping with stable source identities. Do not
-- hardcode the generated avatar_assets UUID in a data migration.
do $$
declare
  target_video_id uuid;
  target_audio_id text;
  target_video_count integer;
  target_audio_count integer;
begin
  select count(*)
  into target_video_count
  from public.avatar_assets
  where source_file_sha256 =
    '7851a78d9eac288c787792907f7ec29749e08b4cb83aaacaaa7084739956d702';

  if target_video_count <> 1 then
    raise exception
      'Expected exactly one reviewed EWW reference Hook video, found %',
      target_video_count;
  end if;

  select id
  into target_video_id
  from public.avatar_assets
  where source_file_sha256 =
    '7851a78d9eac288c787792907f7ec29749e08b4cb83aaacaaa7084739956d702';

  select count(*)
  into target_audio_count
  from public.hook_audio_assets
  where id = 'hook_audio_029'
    and source_file_name = 'EWW.mp3';

  if target_audio_count <> 1 then
    raise exception
      'Expected exactly one approved EWW Hook audio asset, found %',
      target_audio_count;
  end if;

  select id
  into target_audio_id
  from public.hook_audio_assets
  where id = 'hook_audio_029'
    and source_file_name = 'EWW.mp3';

  insert into public.hook_video_audio_locks (
    hook_video_id,
    audio_asset_id,
    notes
  )
  values (
    target_video_id,
    target_audio_id,
    'User-approved EWW lock for the reviewed reference Hook video.'
  )
  on conflict (hook_video_id) do update
  set audio_asset_id = excluded.audio_asset_id,
      notes = excluded.notes;
end
$$;
