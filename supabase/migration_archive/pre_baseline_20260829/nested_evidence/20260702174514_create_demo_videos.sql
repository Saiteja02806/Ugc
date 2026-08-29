create table if not exists public.demo_videos (
  id uuid primary key default gen_random_uuid(),

  user_id text not null,
  project_id text not null,

  title text not null,
  source_s3_key text not null,
  source_video_url text not null,
  thumbnail_url text,

  file_name text not null,
  file_type text not null
    check (file_type in ('video/mp4', 'video/quicktime', 'video/webm')),
  file_size_bytes bigint not null
    check (
      file_size_bytes > 0
      and file_size_bytes <= 104857600
    ),

  duration_seconds numeric check (
    duration_seconds is null
    or (
      duration_seconds >= 1
      and duration_seconds <= 60
    )
  ),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  ratio text not null default '9:16'
    check (ratio in ('9:16', '1:1', '4:5', '16:9', 'other')),

  draft_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(draft_json) = 'object'),

  rendered_video_url text,
  latest_render_id uuid,

  status text not null default 'uploading'
    check (
      status in (
        'uploading',
        'processing',
        'ready',
        'draft',
        'rendering',
        'rendered',
        'failed'
      )
    ),
  error_message text,
  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists demo_videos_user_project_source_key_idx
  on public.demo_videos (user_id, project_id, source_s3_key)
  where deleted_at is null;

create index if not exists demo_videos_user_project_updated_idx
  on public.demo_videos (user_id, project_id, updated_at desc)
  where deleted_at is null;

create index if not exists demo_videos_user_project_status_idx
  on public.demo_videos (user_id, project_id, status, updated_at desc)
  where deleted_at is null;

create index if not exists demo_videos_latest_render_idx
  on public.demo_videos (latest_render_id)
  where latest_render_id is not null;

alter table public.demo_videos enable row level security;

-- The app accesses demo videos from server routes with the service-role key.
-- RLS stays enabled and no browser policies are added in this slice.
revoke all privileges on table public.demo_videos
  from anon, authenticated;

grant select, insert, update on table public.demo_videos
  to anon, authenticated, service_role;

select pg_notify('pgrst', 'reload schema');
