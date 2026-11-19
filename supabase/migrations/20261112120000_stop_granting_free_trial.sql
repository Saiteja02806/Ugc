-- User decision, 2026-11-12: Vidmake is paid-only. New accounts must not
-- receive a free trial or any free daily content; every usable feature
-- requires a paid plan. The onboarding trigger is kept in place but now does
-- nothing, so no new entitlement row is created. Existing trial rows are left
-- untouched: they keep their own expiry and are never restarted.
create or replace function public.grant_free_trial_on_onboarding_completion()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  return new;
end;
$function$;

revoke all on function public.grant_free_trial_on_onboarding_completion()
  from public, anon, authenticated;
grant execute on function public.grant_free_trial_on_onboarding_completion()
  to postgres, service_role;

select pg_notify('pgrst', 'reload schema');
