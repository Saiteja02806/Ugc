alter table public.overlay_media_assets
  drop constraint if exists overlay_media_assets_active_wall_min_duration_chk;

alter table public.overlay_media_assets
  add constraint overlay_media_assets_active_wall_min_duration_chk check (
    status <> 'active'
    or asset_type <> 'video'
    or format_family <> 'wall_text_overlay'
    or (
      duration_seconds is not null
      and duration_seconds >= 6
    )
  ) not valid;

alter table public.overlay_media_assets
  validate constraint overlay_media_assets_active_wall_min_duration_chk;

select pg_notify('pgrst', 'reload schema');
