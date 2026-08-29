create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),

  user_id text,
  project_id text,

  job_type text not null
    check (
      job_type in (
        'test_worker_job',
        'render_edit_video',
        'render_demo_video',
        'generate_thumbnail',
        'extract_video_metadata',
        'generate_image',
        'generate_avatar',
        'generate_carousel',
        'publish_social_post'
      )
    ),
  queue_name text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),

  input_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(input_json) = 'object'),
  output_json jsonb
    check (output_json is null or jsonb_typeof(output_json) = 'object'),
  error_message text,

  attempt_count integer not null default 0
    check (attempt_count >= 0),
  aws_message_id text,
  worker_id text,

  locked_at timestamptz,
  last_heartbeat_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists background_jobs_queue_status_created_idx
  on public.background_jobs (queue_name, status, created_at);

create index if not exists background_jobs_type_status_created_idx
  on public.background_jobs (job_type, status, created_at desc);

create index if not exists background_jobs_user_project_created_idx
  on public.background_jobs (user_id, project_id, created_at desc)
  where user_id is not null;

create index if not exists background_jobs_aws_message_id_idx
  on public.background_jobs (aws_message_id)
  where aws_message_id is not null;

alter table public.background_jobs enable row level security;

revoke all privileges on table public.background_jobs
  from anon, authenticated;

grant select, insert, update on table public.background_jobs
  to service_role;
