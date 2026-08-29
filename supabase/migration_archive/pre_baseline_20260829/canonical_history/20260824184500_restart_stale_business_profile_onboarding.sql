alter table public.business_profiles
  drop constraint if exists business_profiles_onboarding_step_check;

-- Older onboarding versions were persisted as completed before the current
-- goal screen existed. Runtime correctly treats those records as incomplete,
-- so restart them at source selection instead of inferring progress from the
-- legacy row or its automatically analyzed business name.
update public.business_profiles
set onboarding_step = case
  when onboarding_status = 'completed' and onboarding_version >= 3 then 3
  else 1
end
where onboarding_step is distinct from case
  when onboarding_status = 'completed' and onboarding_version >= 3 then 3
  else 1
end;

alter table public.business_profiles
  add constraint business_profiles_onboarding_step_check
  check (
    onboarding_step between 1 and 3
    and (
      onboarding_status <> 'completed'
      or onboarding_version < 3
      or onboarding_step = 3
    )
  );

comment on column public.business_profiles.onboarding_step is
  'Last verified onboarding screen; stale completed versions restart at source selection.';
