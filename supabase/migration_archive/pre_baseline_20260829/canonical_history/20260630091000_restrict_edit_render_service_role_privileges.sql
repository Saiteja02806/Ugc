revoke all privileges on table public.editable_videos
  from service_role;

revoke all privileges on table public.video_render_jobs
  from service_role;

grant select, insert, update on table public.editable_videos
  to service_role;

grant select, insert, update on table public.video_render_jobs
  to service_role;
