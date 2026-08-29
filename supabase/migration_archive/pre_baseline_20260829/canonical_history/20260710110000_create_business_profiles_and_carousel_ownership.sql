alter table public.website_analyses
  alter column website_url drop not null,
  alter column normalized_domain drop not null,
  add column if not exists source_type text not null default 'website'
    check (source_type in ('website', 'mobile_app_ai_prompt', 'manual')),
  add column if not exists source_context text;

create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  project_id text not null default 'default-project',
  intake_type text not null
    check (intake_type in ('website', 'mobile_app_ai_prompt', 'manual')),
  analysis_id uuid references public.website_analyses(id) on delete set null,
  context_json jsonb not null check (jsonb_typeof(context_json) = 'object'),
  source_url text,
  source_context text,
  content_hash text not null,
  profile_version integer not null default 1 check (profile_version > 0),
  preparation_status text not null default 'preparing'
    check (preparation_status in ('preparing', 'failed')),
  preparation_error text,
  latest_generation_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_profiles enable row level security;
revoke all privileges on table public.business_profiles from anon, authenticated;
grant select, insert, update on table public.business_profiles to service_role;

create index if not exists business_profiles_user_updated_idx
  on public.business_profiles (user_id, updated_at desc);

alter table public.carousel_generations
  add column if not exists business_profile_id uuid references public.business_profiles(id) on delete set null,
  add column if not exists business_profile_version integer,
  add column if not exists generation_source text not null default 'manual'
    check (generation_source in ('auto_generated', 'manual'));

create index if not exists carousel_generations_profile_updated_idx
  on public.carousel_generations (business_profile_id, updated_at desc)
  where business_profile_id is not null;

create unique index if not exists carousel_generations_profile_version_candidate_idx
  on public.carousel_generations (business_profile_id, business_profile_version, candidate_index)
  where business_profile_id is not null and business_profile_version is not null;
