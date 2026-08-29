alter table public.business_profiles
  add column if not exists primary_goal text,
  add column if not exists logo_storage_key text,
  add column if not exists logo_url text,
  add column if not exists logo_mime_type text,
  add column if not exists logo_file_size_bytes bigint,
  add column if not exists logo_width integer,
  add column if not exists logo_height integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_profiles_primary_goal_check'
      and conrelid = 'public.business_profiles'::regclass
  ) then
    alter table public.business_profiles
      add constraint business_profiles_primary_goal_check
      check (
        primary_goal is null
        or primary_goal in (
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
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_profiles_logo_mime_type_check'
      and conrelid = 'public.business_profiles'::regclass
  ) then
    alter table public.business_profiles
      add constraint business_profiles_logo_mime_type_check
      check (
        logo_mime_type is null
        or logo_mime_type in ('image/jpeg', 'image/png', 'image/webp')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_profiles_logo_metadata_check'
      and conrelid = 'public.business_profiles'::regclass
  ) then
    alter table public.business_profiles
      add constraint business_profiles_logo_metadata_check
      check (
        (
          logo_storage_key is null
          and logo_url is null
          and logo_mime_type is null
          and logo_file_size_bytes is null
          and logo_width is null
          and logo_height is null
        )
        or (
          logo_storage_key is not null
          and logo_url is not null
          and logo_mime_type is not null
          and logo_file_size_bytes between 1 and 2097152
          and logo_width between 64 and 4096
          and logo_height between 64 and 4096
        )
      );
  end if;
end
$$;

-- Onboarding v3 adds a required primary goal. Existing profiles keep their
-- previous goal-free state and are asked to choose instead of receiving an
-- invented default. Business logos remain optional.
