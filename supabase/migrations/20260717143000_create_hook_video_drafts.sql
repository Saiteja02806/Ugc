create table if not exists public.hook_video_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  business_profile_id uuid not null
    references public.business_profiles(id) on delete cascade,
  generation_id uuid not null,
  text text not null
    check (char_length(trim(text)) between 1 and 220),
  created_at timestamptz not null default now()
);

create index if not exists hook_video_suggestions_user_created_idx
  on public.hook_video_suggestions (user_id, created_at desc);

create index if not exists hook_video_suggestions_generation_idx
  on public.hook_video_suggestions (generation_id);

create table if not exists public.hook_video_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,

  influencer_id text not null,
  influencer_video_id text not null,
  influencer_source text not null
    check (influencer_source in ('catalog', 'user')),
  influencer_name text not null
    check (char_length(trim(influencer_name)) between 1 and 140),
  influencer_video_title text not null
    check (char_length(trim(influencer_video_title)) between 1 and 180),

  demo_asset_id uuid not null
    references public.media_assets(id) on delete restrict,
  demo_title text not null
    check (char_length(trim(demo_title)) between 1 and 180),

  selected_hook_id uuid not null
    references public.hook_video_suggestions(id) on delete restrict,
  hook_text text not null
    check (char_length(trim(hook_text)) between 1 and 220),

  trim_start numeric not null default 0
    check (trim_start >= 0),
  trim_end numeric,

  preview_thumbnail_url text,
  status text not null default 'draft'
    check (status in ('draft', 'saved', 'scheduled')),
  scheduled_post_id uuid,
  library_saved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint hook_video_drafts_trim_check check (
    trim_end is null or trim_end > trim_start
  )
);

create index if not exists hook_video_drafts_user_updated_idx
  on public.hook_video_drafts (user_id, updated_at desc);

create index if not exists hook_video_drafts_user_library_idx
  on public.hook_video_drafts (user_id, library_saved_at desc)
  where library_saved_at is not null;

create index if not exists hook_video_drafts_schedule_idx
  on public.hook_video_drafts (scheduled_post_id)
  where scheduled_post_id is not null;

alter table public.hook_video_suggestions enable row level security;
alter table public.hook_video_drafts enable row level security;

revoke all privileges on table public.hook_video_suggestions
  from anon, authenticated;
revoke all privileges on table public.hook_video_drafts
  from anon, authenticated;

grant select, insert, update, delete on table public.hook_video_suggestions
  to service_role;
grant select, insert, update, delete on table public.hook_video_drafts
  to service_role;

select pg_notify('pgrst', 'reload schema');
