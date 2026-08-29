-- The carousel Library save RPC is a SECURITY DEFINER function that accepts a
-- target Firebase UID and trusted rendered-slide metadata. Only server-side
-- callers using the service role may execute it.
revoke all on function public.save_generated_carousel_library_item(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) from public;

revoke all on function public.save_generated_carousel_library_item(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) from anon;

revoke all on function public.save_generated_carousel_library_item(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) from authenticated;

grant execute on function public.save_generated_carousel_library_item(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) to service_role;

select pg_notify('pgrst', 'reload schema');
