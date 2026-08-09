alter table public.business_profiles
  add column if not exists primary_goals text[] not null default '{}'::text[];

-- Preserve every previously selected single goal without inventing new data.
update public.business_profiles
set primary_goals = array[primary_goal]
where primary_goal is not null
  and cardinality(primary_goals) = 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_profiles_primary_goals_values_check'
      and conrelid = 'public.business_profiles'::regclass
  ) then
    alter table public.business_profiles
      add constraint business_profiles_primary_goals_values_check
      check (
        cardinality(primary_goals) <= 10
        and primary_goals <@ array[
          'increase_revenue',
          'generate_leads',
          'increase_signups',
          'increase_installs',
          'grow_views',
          'brand_awareness',
          'grow_following',
          'increase_engagement',
          'website_traffic',
          'product_launch'
        ]::text[]
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_profiles_completed_goals_check'
      and conrelid = 'public.business_profiles'::regclass
  ) then
    alter table public.business_profiles
      add constraint business_profiles_completed_goals_check
      check (
        onboarding_status <> 'completed'
        or onboarding_version < 3
        or cardinality(primary_goals) >= 1
      );
  end if;
end
$$;

comment on column public.business_profiles.primary_goals is
  'Ordered onboarding goals selected by the user. Empty until onboarding completion.';
