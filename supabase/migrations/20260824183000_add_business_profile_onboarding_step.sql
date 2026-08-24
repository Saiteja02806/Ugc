do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'business_profiles'
      and column_name = 'onboarding_step'
  ) then
    alter table public.business_profiles
      add column onboarding_step smallint not null default 1;

    -- Completed profiles remain complete. A saved identity proves that the
    -- source and identity screens were finished. Every other legacy
    -- incomplete row restarts at source selection instead of being mistaken
    -- for a verified step-one submission.
    update public.business_profiles
    set onboarding_step = case
      when onboarding_status = 'completed' then 3
      when nullif(btrim(context_json ->> 'businessName'), '') is not null then 3
      else 1
    end;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_profiles_onboarding_step_check'
      and conrelid = 'public.business_profiles'::regclass
  ) then
    alter table public.business_profiles
      add constraint business_profiles_onboarding_step_check
      check (
        onboarding_step between 1 and 3
        and (onboarding_status <> 'completed' or onboarding_step = 3)
      );
  end if;
end
$$;

comment on column public.business_profiles.onboarding_step is
  'Last verified onboarding screen: 1 source selection, 2 identity, 3 goals.';
