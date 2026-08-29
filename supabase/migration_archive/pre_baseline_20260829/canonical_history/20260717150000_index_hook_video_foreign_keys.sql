create index if not exists hook_video_suggestions_profile_idx
  on public.hook_video_suggestions (business_profile_id);

create index if not exists hook_video_suggestions_demo_idx
  on public.hook_video_suggestions (demo_asset_id);

create index if not exists hook_video_drafts_demo_idx
  on public.hook_video_drafts (demo_asset_id);

create index if not exists hook_video_drafts_selected_hook_idx
  on public.hook_video_drafts (selected_hook_id);
