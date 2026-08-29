alter table public.overlay_media_assets
  add column if not exists source_file_sha256 text,
  add column if not exists source_batch text,
  add column if not exists visual_group text;

alter table public.overlay_media_assets
  drop constraint if exists overlay_media_assets_source_file_sha256_chk,
  add constraint overlay_media_assets_source_file_sha256_chk check (
    source_file_sha256 is null
    or source_file_sha256 ~ '^[0-9a-f]{64}$'
  ),
  drop constraint if exists overlay_media_assets_source_batch_chk,
  add constraint overlay_media_assets_source_batch_chk check (
    source_batch is null
    or char_length(trim(source_batch)) > 0
  ),
  drop constraint if exists overlay_media_assets_visual_group_chk,
  add constraint overlay_media_assets_visual_group_chk check (
    visual_group is null
    or char_length(trim(visual_group)) > 0
  ),
  drop constraint if exists overlay_media_assets_active_wall_video_metadata_chk,
  add constraint overlay_media_assets_active_wall_video_metadata_chk check (
    status <> 'active'
    or asset_type <> 'video'
    or format_family <> 'wall_text_overlay'
    or (
      source_file_sha256 is not null
      and source_batch is not null
      and visual_group is not null
    )
  );

create unique index if not exists overlay_media_assets_wall_video_sha256_idx
  on public.overlay_media_assets (source_file_sha256)
  where asset_type = 'video'
    and format_family = 'wall_text_overlay'
    and source_file_sha256 is not null;

create index if not exists overlay_media_assets_wall_video_selection_idx
  on public.overlay_media_assets (
    visual_group,
    usage_count,
    last_used_at,
    created_at desc
  )
  where asset_type = 'video'
    and format_family = 'wall_text_overlay'
    and aspect_ratio = '9:16'
    and status = 'active'
    and analysis_status = 'succeeded';

alter table public.wall_text_creatives
  drop constraint if exists wall_text_creatives_layout_chk,
  add constraint wall_text_creatives_layout_chk check (
    coalesce(
      jsonb_typeof(layout) = 'object'
      and layout ->> 'version' in (
        'wall-text-layout-v1',
        'wall-text-layout-v2'
      ),
      false
    )
  );

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
    and asset.duration_seconds > 0
    and asset.preview_url is not null
    and asset.source_file_sha256 is not null
    and asset.source_batch is not null
    and asset.visual_group is not null;

  if source_duration is null then
    raise exception 'wall_text_background_not_ready';
  end if;

  new.duration_seconds := source_duration;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_wall_text_creative()
  from public, anon, authenticated;

select pg_notify('pgrst', 'reload schema');
