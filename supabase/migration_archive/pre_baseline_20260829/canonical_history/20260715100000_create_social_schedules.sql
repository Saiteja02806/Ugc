create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),

  user_id text not null,
  project_id text,
  source_kind text not null
    check (source_kind in ('media_asset', 'library_item')),
  media_asset_id uuid references public.media_assets(id) on delete restrict,
  library_item_id uuid references public.library_items(id) on delete restrict,

  title text not null default 'Scheduled post'
    check (char_length(trim(title)) > 0 and char_length(title) <= 160),
  caption text not null default ''
    check (char_length(caption) <= 5000),
  timezone text not null default 'UTC'
    check (char_length(trim(timezone)) > 0 and char_length(timezone) <= 100),
  scheduled_for timestamptz,
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'scheduling',
        'scheduled',
        'publishing',
        'published',
        'partially_failed',
        'failed',
        'cancelled'
      )
    ),
  idempotency_key text,
  last_error_code text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),

  cancelled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    (source_kind = 'media_asset' and media_asset_id is not null and library_item_id is null) or
    (source_kind = 'library_item' and library_item_id is not null and media_asset_id is null)
  )
);

create unique index if not exists scheduled_posts_user_idempotency_idx
  on public.scheduled_posts (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists scheduled_posts_user_status_time_idx
  on public.scheduled_posts (user_id, status, scheduled_for desc);

create index if not exists scheduled_posts_user_updated_idx
  on public.scheduled_posts (user_id, updated_at desc);

create table if not exists public.scheduled_post_targets (
  id uuid primary key default gen_random_uuid(),
  scheduled_post_id uuid not null
    references public.scheduled_posts(id) on delete cascade,
  user_id text not null,
  social_connection_id uuid not null
    references public.social_connections(id) on delete restrict,
  platform text not null
    check (platform in ('instagram', 'tiktok', 'youtube')),

  scheduled_for timestamptz not null,
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'scheduling',
        'scheduled',
        'publishing',
        'published',
        'failed',
        'cancelled',
        'skipped'
      )
    ),
  scheduler_schedule_name text,
  scheduler_schedule_arn text,
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  platform_post_id text,
  platform_post_url text
    check (platform_post_url is null or platform_post_url ~ '^https?://'),
  last_error_code text,
  last_error_message text
    check (last_error_message is null or char_length(last_error_message) <= 500),
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),

  cancelled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists scheduled_post_targets_post_connection_idx
  on public.scheduled_post_targets (scheduled_post_id, social_connection_id);

create unique index if not exists scheduled_post_targets_scheduler_name_idx
  on public.scheduled_post_targets (scheduler_schedule_name)
  where scheduler_schedule_name is not null;

create index if not exists scheduled_post_targets_user_status_time_idx
  on public.scheduled_post_targets (user_id, status, scheduled_for desc);

create index if not exists scheduled_post_targets_due_idx
  on public.scheduled_post_targets (status, scheduled_for)
  where status in ('scheduled', 'publishing');

create table if not exists public.social_publish_attempts (
  id uuid primary key default gen_random_uuid(),
  scheduled_post_target_id uuid not null
    references public.scheduled_post_targets(id) on delete cascade,
  user_id text not null,
  attempt_number integer not null default 1
    check (attempt_number > 0),
  stage text not null
    check (char_length(trim(stage)) > 0 and char_length(stage) <= 80),
  status text not null
    check (status in ('started', 'succeeded', 'failed', 'skipped')),
  error_code text,
  error_message text
    check (error_message is null or char_length(error_message) <= 500),
  provider_request_id text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists social_publish_attempts_target_created_idx
  on public.social_publish_attempts (scheduled_post_target_id, created_at desc);

alter table public.scheduled_posts enable row level security;
alter table public.scheduled_post_targets enable row level security;
alter table public.social_publish_attempts enable row level security;

revoke all privileges on table public.scheduled_posts
  from anon, authenticated;

revoke all privileges on table public.scheduled_post_targets
  from anon, authenticated;

revoke all privileges on table public.social_publish_attempts
  from anon, authenticated;

grant select, insert, update, delete on table public.scheduled_posts
  to service_role;

grant select, insert, update, delete on table public.scheduled_post_targets
  to service_role;

grant select, insert on table public.social_publish_attempts
  to service_role;

select pg_notify('pgrst', 'reload schema');
