create table if not exists public.editable_videos (
  id uuid primary key default gen_random_uuid(),

  user_id text not null,
  project_id text not null,
  source_video_id text not null,

  source text not null
    check (source in ('hook', 'demo', 'draft', 'final')),
  title text not null,
  ratio text not null default '9:16'
    check (ratio in ('9:16', '1:1', '4:5', '16:9')),

  source_video_url text,
  thumbnail_url text,
  duration_seconds numeric check (
    duration_seconds is null or duration_seconds >= 0
  ),

  draft_json jsonb check (
    draft_json is null or jsonb_typeof(draft_json) = 'object'
  ),

  rendered_video_url text,
  latest_render_id uuid,

  status text not null default 'ready'
    check (status in ('ready', 'draft', 'rendering', 'rendered', 'failed')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, project_id, source_video_id)
);

create index if not exists editable_videos_user_project_updated_idx
  on public.editable_videos (user_id, project_id, updated_at desc);

create index if not exists editable_videos_latest_render_idx
  on public.editable_videos (latest_render_id)
  where latest_render_id is not null;

alter table public.editable_videos enable row level security;

revoke all privileges on table public.editable_videos
  from anon, authenticated;

grant select, insert, update on table public.editable_videos
  to service_role;

create table if not exists public.video_render_jobs (
  render_id uuid primary key,
  trigger_run_id text unique,

  user_id text not null,
  project_id text not null,
  source_video_id text not null,
  source_video_url text not null,

  ratio text not null default '9:16'
    check (ratio in ('9:16', '1:1', '4:5', '16:9')),
  draft_json jsonb not null check (jsonb_typeof(draft_json) = 'object'),

  status text not null default 'queued'
    check (status in ('queued', 'rendering', 'completed', 'failed')),

  output_s3_key text,
  output_url text,
  error_message text,

  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_render_jobs_user_project_created_idx
  on public.video_render_jobs (user_id, project_id, created_at desc);

create index if not exists video_render_jobs_source_video_idx
  on public.video_render_jobs (user_id, project_id, source_video_id, created_at desc);

alter table public.video_render_jobs enable row level security;

revoke all privileges on table public.video_render_jobs
  from anon, authenticated;

grant select, insert, update on table public.video_render_jobs
  to service_role;
