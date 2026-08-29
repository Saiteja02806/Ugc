alter table public.business_profiles
  add column if not exists onboarding_status text not null default 'incomplete',
  add column if not exists onboarding_version integer not null default 0,
  add column if not exists onboarding_completed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_profiles_onboarding_status_check'
      and conrelid = 'public.business_profiles'::regclass
  ) then
    alter table public.business_profiles
      add constraint business_profiles_onboarding_status_check
      check (onboarding_status in ('incomplete', 'completed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_profiles_onboarding_state_check'
      and conrelid = 'public.business_profiles'::regclass
  ) then
    alter table public.business_profiles
      add constraint business_profiles_onboarding_state_check
      check (
        (
          onboarding_status = 'incomplete'
          and onboarding_version = 0
          and onboarding_completed_at is null
        )
        or (
          onboarding_status = 'completed'
          and onboarding_version > 0
          and onboarding_completed_at is not null
        )
      );
  end if;
end
$$;

-- Onboarding v2 asks for only one user-entered value after source analysis:
-- the customer-facing business name. Existing profiles that already contain a
-- name can safely pass the new gate; profiles without one remain incomplete.
update public.business_profiles
set onboarding_status = case
      when nullif(btrim(context_json ->> 'businessName'), '') is not null
        then 'completed'
      else 'incomplete'
    end,
    onboarding_version = case
      when nullif(btrim(context_json ->> 'businessName'), '') is not null
        then 2
      else 0
    end,
    onboarding_completed_at = case
      when nullif(btrim(context_json ->> 'businessName'), '') is not null
        then coalesce(onboarding_completed_at, updated_at, now())
      else null
    end;

create index if not exists business_profiles_completed_onboarding_idx
  on public.business_profiles (onboarding_version, id)
  where onboarding_status = 'completed';
