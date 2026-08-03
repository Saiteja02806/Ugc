alter table public.background_jobs
  add column if not exists queue_message_id text,
  add column if not exists stage text,
  add column if not exists progress smallint,
  add column if not exists input_reference text,
  add column if not exists output_reference text,
  add column if not exists error_code text,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists worker_execution_id text,
  add column if not exists queued_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists cancel_requested_at timestamptz,
  add column if not exists queue_provider text not null default 'gcp';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'background_jobs'
      and column_name = 'aws_message_id'
  ) then
    update public.background_jobs
    set queue_message_id = aws_message_id
    where queue_message_id is null
      and aws_message_id is not null;
  end if;
end;
$$;

create or replace function public.sync_background_job_queue_message_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.queue_message_id is null then
      new.queue_message_id := new.aws_message_id;
    elsif new.aws_message_id is null then
      new.aws_message_id := new.queue_message_id;
    end if;
  elsif new.queue_message_id is distinct from old.queue_message_id then
    new.aws_message_id := new.queue_message_id;
  elsif new.aws_message_id is distinct from old.aws_message_id then
    new.queue_message_id := new.aws_message_id;
  end if;

  return new;
end;
$$;

drop trigger if exists background_jobs_sync_queue_message_id
  on public.background_jobs;
create trigger background_jobs_sync_queue_message_id
before insert or update of queue_message_id, aws_message_id
on public.background_jobs
for each row execute function public.sync_background_job_queue_message_id();

update public.background_jobs
set
  queued_at = coalesce(queued_at, created_at),
  failed_at = case
    when status = 'failed' then coalesce(failed_at, completed_at, updated_at)
    else failed_at
  end,
  stage = coalesce(
    stage,
    case status
      when 'queued' then 'queued'
      when 'processing' then 'processing'
      when 'completed' then 'completed'
      when 'failed' then 'failed'
      when 'cancelled' then 'cancelled'
      else null
    end
  ),
  queue_provider = 'gcp'
where
  queued_at is null
  or (status = 'failed' and failed_at is null)
  or stage is null
  or queue_provider <> 'gcp';

alter table public.background_jobs
  drop constraint if exists background_jobs_status_check,
  drop constraint if exists background_jobs_job_type_check,
  drop constraint if exists background_jobs_progress_check,
  drop constraint if exists background_jobs_max_attempts_check,
  drop constraint if exists background_jobs_queue_provider_check;

alter table public.background_jobs
  add constraint background_jobs_status_check
    check (
      status in (
        'created',
        'queued',
        'processing',
        'waiting_external_service',
        'rendering',
        'uploading_output',
        'completed',
        'failed',
        'cancel_requested',
        'cancelled',
        'stalled'
      )
    ),
  add constraint background_jobs_job_type_check
    check (
      job_type in (
        'hook_text_generation',
        'wall_text_generation',
        'carousel_generation',
        'image_generation',
        'video_generation',
        'preview_render',
        'final_render',
        'media_analysis',
        'social_publish',
        'analytics_sync',
        'generate_avatar',
        'generate_carousel',
        'generate_hook_video',
        'generate_image',
        'generate_thumbnail',
        'generate_trending_hook_copy',
        'extract_video_metadata',
        'publish_social_post',
        'render_demo_video',
        'render_edit_video',
        'render_schedule_combination',
        'render_wall_text_video',
        'test_worker_job'
      )
    ),
  add constraint background_jobs_progress_check
    check (progress is null or progress between 0 and 100),
  add constraint background_jobs_max_attempts_check
    check (max_attempts between 1 and 20),
  add constraint background_jobs_queue_provider_check
    check (queue_provider = 'gcp');

drop index if exists public.background_jobs_idempotency_key_uidx;

create index if not exists background_jobs_queue_message_id_idx
  on public.background_jobs (queue_message_id)
  where queue_message_id is not null;

create unique index if not exists background_jobs_owner_type_idempotency_uidx
  on public.background_jobs (
    coalesce(user_id, ''),
    job_type,
    idempotency_key
  )
  where idempotency_key is not null;

create index if not exists background_jobs_user_active_created_idx
  on public.background_jobs (user_id, created_at desc)
  where
    user_id is not null
    and status in (
      'created',
      'queued',
      'processing',
      'waiting_external_service',
      'rendering',
      'uploading_output',
      'cancel_requested',
      'stalled'
    );

create index if not exists background_jobs_recovery_heartbeat_idx
  on public.background_jobs (last_heartbeat_at, updated_at)
  where
    status in (
      'processing',
      'waiting_external_service',
      'rendering',
      'uploading_output',
      'cancel_requested'
    );

comment on column public.background_jobs.progress is
  'Real measured progress only. Null when a workload cannot report truthful progress.';
comment on column public.background_jobs.input_reference is
  'Reference to a typed feature record; input_json is retained temporarily for legacy workers.';
comment on column public.background_jobs.output_reference is
  'Stable typed record or Cloud Storage object reference written before completion.';
comment on column public.background_jobs.queue_provider is
  'UGC Pilot runtime queue provider. GCP is the only supported value.';
comment on column public.background_jobs.aws_message_id is
  'Temporary rollout compatibility alias for queue_message_id. It does not select or enable AWS.';
