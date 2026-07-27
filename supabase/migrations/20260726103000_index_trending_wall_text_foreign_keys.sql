create index if not exists wall_text_creatives_business_profile_idx
  on public.wall_text_creatives (business_profile_id);

create index if not exists wall_text_creatives_overlay_asset_idx
  on public.wall_text_creatives (overlay_media_asset_id);

create index if not exists user_wall_text_assignments_business_profile_idx
  on public.user_wall_text_assignments (business_profile_id);

create index if not exists user_wall_text_assignments_creative_idx
  on public.user_wall_text_assignments (wall_text_creative_id);

select pg_notify('pgrst', 'reload schema');
