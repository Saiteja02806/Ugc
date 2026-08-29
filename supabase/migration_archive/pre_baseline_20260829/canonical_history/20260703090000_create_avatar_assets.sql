create table if not exists public.avatar_assets (
  id uuid primary key default gen_random_uuid(),

  name text not null
    check (char_length(trim(name)) > 0 and char_length(name) <= 140),
  description text,
  avatar_type text not null default 'global'
    check (avatar_type in ('global')),

  source_s3_key text not null
    check (char_length(trim(source_s3_key)) > 0),
  source_video_url text not null
    check (source_video_url ~ '^https?://'),
  thumbnail_url text
    check (thumbnail_url is null or thumbnail_url ~ '^https?://'),

  duration_seconds numeric
    check (duration_seconds is null or duration_seconds > 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  ratio text not null default '9:16'
    check (ratio in ('9:16', '1:1', '4:5', '16:9', 'other')),

  status text not null default 'ready'
    check (status in ('ready', 'disabled', 'processing', 'failed')),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists avatar_assets_source_s3_key_idx
  on public.avatar_assets (source_s3_key)
  where deleted_at is null;

create index if not exists avatar_assets_status_sort_idx
  on public.avatar_assets (status, sort_order, created_at desc)
  where deleted_at is null;

create table if not exists public.user_avatar_preferences (
  id uuid primary key default gen_random_uuid(),

  user_id text not null,
  avatar_asset_id uuid not null
    references public.avatar_assets(id) on delete cascade,

  trim_start numeric,
  trim_end numeric,
  is_trimmed boolean not null default false,

  last_used_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_avatar_preferences_trim_check check (
    (
      is_trimmed = false
      and trim_start is null
      and trim_end is null
    )
    or
    (
      is_trimmed = true
      and trim_start is not null
      and trim_end is not null
      and trim_start >= 0
      and trim_end > trim_start
      and (trim_end - trim_start) >= 0.5
    )
  )
);

create unique index if not exists user_avatar_preferences_user_avatar_idx
  on public.user_avatar_preferences (user_id, avatar_asset_id);

create index if not exists user_avatar_preferences_user_updated_idx
  on public.user_avatar_preferences (user_id, updated_at desc);

create index if not exists user_avatar_preferences_avatar_idx
  on public.user_avatar_preferences (avatar_asset_id);

alter table public.avatar_assets enable row level security;
alter table public.user_avatar_preferences enable row level security;

-- The app accesses avatar assets/preferences from server routes with the
-- service-role key. RLS stays enabled and no browser policies are added here.
revoke all privileges on table public.avatar_assets
  from anon, authenticated;

revoke all privileges on table public.user_avatar_preferences
  from anon, authenticated;

grant select, insert, update on table public.avatar_assets
  to anon, authenticated, service_role;

grant select, insert, update, delete on table public.user_avatar_preferences
  to anon, authenticated, service_role;

select pg_notify('pgrst', 'reload schema');
