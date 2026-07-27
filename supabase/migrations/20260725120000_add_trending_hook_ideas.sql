alter table public.hook_video_suggestions
  alter column demo_asset_id drop not null;

alter table public.hook_video_suggestions
  add column if not exists suggestion_context text not null default 'composition'
    check (suggestion_context in ('composition', 'trending')),
  add column if not exists business_profile_version integer,
  add column if not exists candidate_index integer,
  add column if not exists duration_seconds numeric,
  add column if not exists source_duration_seconds numeric,
  add column if not exists trim_start numeric,
  add column if not exists trim_end numeric,
  add column if not exists influencer_name text,
  add column if not exists influencer_video_title text,
  add column if not exists thumbnail_url text;

alter table public.hook_video_suggestions
  add constraint hook_video_suggestions_context_fields_check check (
    (
      suggestion_context = 'composition'
      and demo_asset_id is not null
    )
    or
    (
      suggestion_context = 'trending'
      and demo_asset_id is null
      and business_profile_version is not null
      and business_profile_version > 0
      and candidate_index is not null
      and candidate_index >= 0
      and duration_seconds is not null
      and duration_seconds > 0
      and source_duration_seconds is not null
      and source_duration_seconds > 0
      and trim_start is not null
      and trim_start >= 0
      and (trim_end is null or trim_end > trim_start)
      and influencer_name is not null
      and char_length(trim(influencer_name)) between 1 and 140
      and influencer_video_title is not null
      and char_length(trim(influencer_video_title)) between 1 and 180
    )
  );

alter table public.hook_video_suggestions
  add constraint hook_video_suggestions_trending_candidate_unique unique (
    business_profile_id,
    business_profile_version,
    suggestion_context,
    candidate_index
  );

create index if not exists hook_video_suggestions_trending_profile_idx
  on public.hook_video_suggestions (
    user_id,
    business_profile_id,
    business_profile_version,
    candidate_index
  )
  where suggestion_context = 'trending';

create table if not exists public.user_hook_video_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  business_profile_id uuid not null
    references public.business_profiles(id) on delete cascade,
  business_profile_version integer not null
    check (business_profile_version > 0),
  hook_suggestion_id uuid not null
    references public.hook_video_suggestions(id) on delete cascade,
  position integer not null
    check (position >= 0),
  state text not null default 'active'
    check (state in ('active', 'completed_skipped', 'selected')),
  last_opened_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, hook_suggestion_id)
);

create index if not exists user_hook_video_assignments_active_profile_idx
  on public.user_hook_video_assignments (
    user_id,
    business_profile_id,
    business_profile_version,
    position
  )
  where state = 'active';

alter table public.user_hook_video_assignments enable row level security;

revoke all privileges on table public.user_hook_video_assignments
  from anon, authenticated;

grant select, insert, update, delete on table public.user_hook_video_assignments
  to service_role;

select pg_notify('pgrst', 'reload schema');
