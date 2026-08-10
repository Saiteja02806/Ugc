create table if not exists public.hook_formats (
  id text primary key
    check (
      char_length(id) between 1 and 100
      and id ~ '^[a-z0-9]+(_[a-z0-9]+)*$'
    ),
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 140),
  description text not null
    check (char_length(btrim(description)) between 1 and 500),
  audio_mode text not null default 'dynamic'
    check (audio_mode in ('dynamic', 'preferred', 'locked')),
  locked_audio_asset_id text
    references public.hook_audio_assets(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint hook_formats_locked_audio_check check (
    (audio_mode = 'locked' and locked_audio_asset_id is not null)
    or (audio_mode <> 'locked' and locked_audio_asset_id is null)
  )
);

insert into public.hook_formats (
  id,
  display_name,
  description,
  audio_mode,
  status
)
values
  (
    'bedroom_reaction',
    'Bedroom reaction',
    'Influencer reacting in a bedroom or bed setting.',
    'dynamic',
    'active'
  ),
  (
    'cafe_reaction',
    'Cafe reaction',
    'Influencer seated in a cafe or restaurant environment.',
    'dynamic',
    'active'
  ),
  (
    'desk_laptop_reaction',
    'Desk or laptop reaction',
    'Influencer reacting while a laptop or desk setup is visually prominent.',
    'dynamic',
    'active'
  ),
  (
    'fitness_workspace_reaction',
    'Fitness workspace reaction',
    'Fitness-styled influencer moving beside a laptop or workspace.',
    'dynamic',
    'active'
  ),
  (
    'headphones_reaction',
    'Headphones reaction',
    'Headphones are a prominent part of the influencer reaction.',
    'dynamic',
    'active'
  ),
  (
    'indoor_selfie_closeup',
    'Indoor selfie close-up',
    'Indoor face-led selfie or close-up reaction without a dominant prop.',
    'dynamic',
    'active'
  ),
  (
    'indoor_selfie_medium',
    'Indoor selfie medium',
    'Indoor medium-framed reaction showing more torso or surrounding room.',
    'dynamic',
    'active'
  ),
  (
    'office_selfie',
    'Office selfie',
    'Influencer in a recognizable office or shared-workspace setting.',
    'dynamic',
    'active'
  ),
  (
    'phone_reaction',
    'Phone reaction',
    'A phone is visibly involved in the influencer reaction.',
    'dynamic',
    'active'
  ),
  (
    'sofa_reaction',
    'Sofa reaction',
    'Influencer reacting while seated on a sofa or lounge chair.',
    'dynamic',
    'active'
  )
on conflict (id) do nothing;

alter table public.avatar_assets
  add column if not exists hook_format_id text;

alter table public.avatar_assets
  drop constraint if exists avatar_assets_hook_format_id_check,
  add constraint avatar_assets_hook_format_id_check check (
    hook_format_id is null
    or (
      char_length(hook_format_id) between 1 and 100
      and hook_format_id ~ '^[a-z0-9]+(_[a-z0-9]+)*$'
    )
  );

do $$
declare
  expected_hook_count constant integer := 78;
  expected_format_count constant integer := 10;
  hook_count integer;
  format_count integer;
  invalid_format_count integer;
begin
  select
    count(*),
    count(distinct asset.visual_group),
    count(*) filter (
      where asset.visual_group is null
        or asset.visual_group not in (
          'bedroom_reaction',
          'cafe_reaction',
          'desk_laptop_reaction',
          'fitness_workspace_reaction',
          'headphones_reaction',
          'indoor_selfie_closeup',
          'indoor_selfie_medium',
          'office_selfie',
          'phone_reaction',
          'sofa_reaction'
        )
    )
  into hook_count, format_count, invalid_format_count
  from public.avatar_assets as asset
  where asset.source_batch = 'hook-silent-2026-07-29'
    and asset.status = 'ready'
    and asset.deleted_at is null;

  if hook_count <> expected_hook_count then
    raise exception
      'hook_format_backfill_expected_%_videos_but_found_%',
      expected_hook_count,
      hook_count;
  end if;

  if format_count <> expected_format_count or invalid_format_count <> 0 then
    raise exception
      'hook_format_backfill_expected_%_valid_formats_but_found_%_with_%_invalid_rows',
      expected_format_count,
      format_count,
      invalid_format_count;
  end if;
end
$$;

update public.avatar_assets as asset
set
  hook_format_id = asset.visual_group,
  updated_at = now()
where asset.source_batch = 'hook-silent-2026-07-29'
  and asset.status = 'ready'
  and asset.deleted_at is null
  and asset.hook_format_id is distinct from asset.visual_group;

do $$
declare
  populated_hook_count integer;
begin
  select count(*)
  into populated_hook_count
  from public.avatar_assets as asset
  where asset.source_batch = 'hook-silent-2026-07-29'
    and asset.status = 'ready'
    and asset.deleted_at is null
    and asset.hook_format_id = asset.visual_group;

  if populated_hook_count <> 78 then
    raise exception
      'hook_format_backfill_expected_78_populated_videos_but_found_%',
      populated_hook_count;
  end if;
end
$$;

alter table public.avatar_assets
  drop constraint if exists avatar_assets_hook_format_id_fkey,
  add constraint avatar_assets_hook_format_id_fkey
    foreign key (hook_format_id)
    references public.hook_formats(id)
    on delete restrict
    not valid;

alter table public.avatar_assets
  validate constraint avatar_assets_hook_format_id_fkey;

create index if not exists avatar_assets_hook_format_id_idx
  on public.avatar_assets (hook_format_id, sort_order, created_at desc)
  where status = 'ready'
    and deleted_at is null
    and hook_format_id is not null;

comment on column public.avatar_assets.hook_format_id is
  'Stable visual Hook format used to choose Dynamic, Preferred, or Locked Hook audio behavior. Existing visual_group remains unchanged.';

create table if not exists public.hook_format_audio_preferences (
  hook_format_id text not null
    references public.hook_formats(id) on delete cascade,
  audio_asset_id text not null
    references public.hook_audio_assets(id) on delete restrict,
  priority smallint not null
    check (priority between 1 and 100),
  status text not null default 'inactive'
    check (status in ('active', 'inactive')),
  notes text
    check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (hook_format_id, audio_asset_id),
  constraint hook_format_audio_preferences_priority_unique
    unique (hook_format_id, priority)
);

create index if not exists hook_format_audio_preferences_asset_idx
  on public.hook_format_audio_preferences (audio_asset_id);

create index if not exists hook_format_audio_preferences_active_idx
  on public.hook_format_audio_preferences (
    hook_format_id,
    priority,
    audio_asset_id
  )
  where status = 'active';

create table if not exists public.hook_audio_selections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null
    check (
      char_length(btrim(user_id)) between 1 and 200
    ),
  hook_video_suggestion_id uuid not null
    references public.hook_video_suggestions(id) on delete cascade,
  hook_video_draft_id uuid
    references public.hook_video_drafts(id) on delete set null,
  hook_video_id text not null
    check (char_length(btrim(hook_video_id)) between 1 and 200),
  hook_video_source text not null
    check (hook_video_source in ('catalog', 'user')),
  hook_format_id text not null
    references public.hook_formats(id) on delete restrict,
  audio_asset_id text not null
    references public.hook_audio_assets(id) on delete restrict,
  content_fingerprint text not null
    check (content_fingerprint ~ '^[a-f0-9]{64}$'),
  audio_intent jsonb not null,
  selection_source text not null
    check (
      selection_source in (
        'format_locked',
        'format_preferred',
        'dynamic'
      )
    ),
  match_score numeric(5, 4) not null
    check (match_score between 0 and 1),
  matching_version text not null
    check (char_length(btrim(matching_version)) between 1 and 100),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint hook_audio_selections_intent_check check (
    coalesce(
      jsonb_typeof(audio_intent) = 'object'
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
  )
);

create unique index if not exists hook_audio_selections_suggestion_uidx
  on public.hook_audio_selections (user_id, hook_video_suggestion_id);

create index if not exists hook_audio_selections_draft_idx
  on public.hook_audio_selections (hook_video_draft_id)
  where hook_video_draft_id is not null;

create index if not exists hook_audio_selections_asset_idx
  on public.hook_audio_selections (audio_asset_id);

create index if not exists hook_audio_selections_recent_user_idx
  on public.hook_audio_selections (
    user_id,
    updated_at desc,
    audio_asset_id
  );

alter table public.hook_formats enable row level security;
alter table public.hook_format_audio_preferences enable row level security;
alter table public.hook_audio_selections enable row level security;

revoke all privileges on table public.hook_formats
  from public, anon, authenticated;
revoke all privileges on table public.hook_format_audio_preferences
  from public, anon, authenticated;
revoke all privileges on table public.hook_audio_selections
  from public, anon, authenticated;

grant select, insert, update, delete on table public.hook_formats
  to service_role;
grant select, insert, update, delete on table public.hook_format_audio_preferences
  to service_role;
grant select, insert, update, delete on table public.hook_audio_selections
  to service_role;

select pg_notify('pgrst', 'reload schema');
