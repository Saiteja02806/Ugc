revoke all privileges on table public.hook_formats
  from public, anon, authenticated, service_role;
revoke all privileges on table public.hook_format_audio_preferences
  from public, anon, authenticated, service_role;
revoke all privileges on table public.hook_audio_selections
  from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.hook_formats
  to service_role;
grant select, insert, update, delete on table public.hook_format_audio_preferences
  to service_role;
grant select, insert, update, delete on table public.hook_audio_selections
  to service_role;

select pg_notify('pgrst', 'reload schema');
