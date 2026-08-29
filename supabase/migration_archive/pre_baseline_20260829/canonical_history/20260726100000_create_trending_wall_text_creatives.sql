create table if not exists public.wall_text_creatives (
  id uuid primary key default gen_random_uuid(),

  user_id text not null
    check (char_length(trim(user_id)) > 0),
  business_profile_id uuid not null
    references public.business_profiles(id) on delete cascade,
  business_profile_version integer not null
    check (business_profile_version > 0),
  overlay_media_asset_id uuid not null
    references public.overlay_media_assets(id) on delete restrict,

  generation_id uuid not null,
  candidate_index integer not null
    check (candidate_index >= 0 and candidate_index < 12),
  duration_seconds numeric not null
    check (duration_seconds > 0),

  text_content jsonb not null,
  layout jsonb not null,
  generator_version text not null default 'business-profile-wall-text-v1'
    check (char_length(trim(generator_version)) > 0),
  generator_model text
    check (
      generator_model is null
      or char_length(trim(generator_model)) > 0
    ),

  status text not null default 'preview_ready'
    check (status in ('preview_ready', 'failed', 'archived')),
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint wall_text_creatives_text_content_chk check (
    coalesce(
      jsonb_typeof(text_content) = 'object'
      and text_content ->> 'kind' = 'wall_text'
      and text_content ->> 'layoutVersion' = 'wall-text-overlay-v1'
      and jsonb_typeof(text_content -> 'blocks') = 'array'
      and jsonb_array_length(text_content -> 'blocks') between 2 and 4,
      false
    )
  ),
  constraint wall_text_creatives_layout_chk check (
    coalesce(
      jsonb_typeof(layout) = 'object'
      and layout ->> 'version' = 'wall-text-layout-v1',
      false
    )
  ),
  constraint wall_text_creatives_profile_candidate_key unique (
    user_id,
    business_profile_id,
    business_profile_version,
    candidate_index
  ),
  constraint wall_text_creatives_profile_asset_key unique (
    user_id,
    business_profile_id,
    business_profile_version,
    overlay_media_asset_id
  )
);

create index if not exists wall_text_creatives_profile_idx
  on public.wall_text_creatives (
    user_id,
    business_profile_id,
    business_profile_version,
    status,
    candidate_index
  );

create index if not exists wall_text_creatives_recent_assets_idx
  on public.wall_text_creatives (
    user_id,
    created_at desc,
    overlay_media_asset_id
  );

create index if not exists wall_text_creatives_business_profile_idx
  on public.wall_text_creatives (business_profile_id);

create index if not exists wall_text_creatives_overlay_asset_idx
  on public.wall_text_creatives (overlay_media_asset_id);

create table if not exists public.user_wall_text_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null
    check (char_length(trim(user_id)) > 0),
  business_profile_id uuid not null
    references public.business_profiles(id) on delete cascade,
  business_profile_version integer not null
    check (business_profile_version > 0),
  wall_text_creative_id uuid not null
    references public.wall_text_creatives(id) on delete cascade,

  position integer not null
    check (position >= 0 and position < 100),
  state text not null default 'active'
    check (state in ('active', 'completed_skipped', 'selected')),
  last_opened_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_wall_text_assignments_creative_key unique (
    user_id,
    wall_text_creative_id
  )
);

create index if not exists user_wall_text_assignments_active_idx
  on public.user_wall_text_assignments (
    user_id,
    business_profile_id,
    business_profile_version,
    state,
    position
  )
  where state = 'active';

create index if not exists user_wall_text_assignments_business_profile_idx
  on public.user_wall_text_assignments (business_profile_id);

create index if not exists user_wall_text_assignments_creative_idx
  on public.user_wall_text_assignments (wall_text_creative_id);

create or replace function public.validate_wall_text_creative()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_duration numeric;
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

  select asset.duration_seconds
  into source_duration
  from public.overlay_media_assets as asset
  where asset.id = new.overlay_media_asset_id
    and asset.asset_type = 'video'
    and asset.format_family = 'wall_text_overlay'
    and asset.aspect_ratio = '9:16'
    and asset.status = 'active'
    and asset.analysis_status = 'succeeded'
    and asset.duration_seconds is not null
    and asset.duration_seconds >= 6
    and asset.preview_url is not null
    and coalesce(asset.motion_level, '') <> 'high'
    and coalesce(asset.text_capacity, '') <> 'low';

  if source_duration is null then
    raise exception 'wall_text_background_not_ready';
  end if;

  new.duration_seconds := source_duration;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_wall_text_creative_trigger
  on public.wall_text_creatives;

create trigger validate_wall_text_creative_trigger
before insert or update of
  user_id,
  business_profile_id,
  business_profile_version,
  overlay_media_asset_id
on public.wall_text_creatives
for each row
execute function public.validate_wall_text_creative();

create or replace function public.validate_wall_text_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.wall_text_creatives as creative
    where creative.id = new.wall_text_creative_id
      and creative.user_id = new.user_id
      and creative.business_profile_id = new.business_profile_id
      and creative.business_profile_version = new.business_profile_version
      and creative.status = 'preview_ready'
  ) then
    raise exception 'wall_text_assignment_mismatch';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_wall_text_assignment_trigger
  on public.user_wall_text_assignments;

create trigger validate_wall_text_assignment_trigger
before insert or update of
  user_id,
  business_profile_id,
  business_profile_version,
  wall_text_creative_id
on public.user_wall_text_assignments
for each row
execute function public.validate_wall_text_assignment();

create or replace function public.track_wall_text_asset_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.overlay_media_assets as asset
  set
    usage_count = asset.usage_count + 1,
    last_used_at = now(),
    updated_at = now()
  from public.wall_text_creatives as creative
  where creative.id = new.wall_text_creative_id
    and asset.id = creative.overlay_media_asset_id;

  return new;
end;
$$;

drop trigger if exists track_wall_text_asset_assignment_trigger
  on public.user_wall_text_assignments;

create trigger track_wall_text_asset_assignment_trigger
after insert on public.user_wall_text_assignments
for each row
execute function public.track_wall_text_asset_assignment();

alter table public.wall_text_creatives enable row level security;
alter table public.user_wall_text_assignments enable row level security;

revoke all privileges on table public.wall_text_creatives
  from anon, authenticated;
revoke all privileges on table public.user_wall_text_assignments
  from anon, authenticated;

grant select, insert, update on table public.wall_text_creatives
  to service_role;
grant select, insert, update on table public.user_wall_text_assignments
  to service_role;

revoke all on function public.validate_wall_text_creative()
  from public, anon, authenticated;
revoke all on function public.validate_wall_text_assignment()
  from public, anon, authenticated;
revoke all on function public.track_wall_text_asset_assignment()
  from public, anon, authenticated;

select pg_notify('pgrst', 'reload schema');
