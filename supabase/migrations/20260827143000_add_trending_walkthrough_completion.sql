alter table public.business_profiles
  add column if not exists trending_walkthrough_completed_at timestamptz;

comment on column public.business_profiles.trending_walkthrough_completed_at is
  'The first time an owner completes the visual Trending walkthrough.';
