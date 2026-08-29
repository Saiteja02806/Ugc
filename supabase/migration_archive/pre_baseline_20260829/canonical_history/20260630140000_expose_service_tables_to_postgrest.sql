-- Supabase REST builds its schema cache from tables visible to API roles.
-- RLS remains enabled and there are no anon/authenticated policies, so these
-- grants expose schema shape for service-role backend calls without allowing
-- browser clients to read or write rows.

alter table public.editable_videos enable row level security;
alter table public.video_render_jobs enable row level security;
alter table public.background_jobs enable row level security;

grant select, insert, update on table public.editable_videos
  to anon, authenticated, service_role;

grant select, insert, update on table public.video_render_jobs
  to anon, authenticated, service_role;

grant select, insert, update on table public.background_jobs
  to anon, authenticated, service_role;

select pg_notify('pgrst', 'reload schema');
