create table if not exists public.background_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null
    references public.background_jobs(id) on delete cascade,
  event_type text not null
    check (
      char_length(trim(event_type)) between 1 and 120
    ),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists background_job_events_job_created_idx
  on public.background_job_events (job_id, created_at, id);

alter table public.background_job_events enable row level security;

revoke all privileges on table public.background_job_events
  from public, anon, authenticated;
grant select, insert on table public.background_job_events
  to service_role;

insert into public.background_job_events (job_id, event_type, metadata, created_at)
select
  job.id,
  'job_migrated',
  jsonb_build_object(
    'status', job.status,
    'source', 'shared-background-job-v2'
  ),
  job.updated_at
from public.background_jobs as job
where not exists (
  select 1
  from public.background_job_events as event
  where event.job_id = job.id
);

create or replace function public.capture_background_job_state_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.background_job_events (job_id, event_type, metadata)
    values (
      new.id,
      'job_created',
      jsonb_build_object(
        'status', new.status,
        'stage', new.stage,
        'jobType', new.job_type,
        'queueProvider', new.queue_provider
      )
    );
  elsif
    old.status is distinct from new.status
    or old.stage is distinct from new.stage
    or old.progress is distinct from new.progress then
    insert into public.background_job_events (job_id, event_type, metadata)
    values (
      new.id,
      'job_state_persisted',
      jsonb_build_object(
        'fromStatus', old.status,
        'toStatus', new.status,
        'stage', new.stage,
        'progress', new.progress,
        'attemptCount', new.attempt_count
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists background_jobs_capture_state_event
  on public.background_jobs;
create trigger background_jobs_capture_state_event
after insert or update on public.background_jobs
for each row execute function public.capture_background_job_state_event();

revoke all on function public.capture_background_job_state_event()
  from public, anon, authenticated;
