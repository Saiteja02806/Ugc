create index if not exists user_hook_video_assignments_business_profile_idx
  on public.user_hook_video_assignments (business_profile_id);

create index if not exists user_hook_video_assignments_hook_suggestion_idx
  on public.user_hook_video_assignments (hook_suggestion_id);
