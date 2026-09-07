-- Cloud Run's Jobs API returns a long-running operation name when the app
-- starts a render. `worker_execution_id` cannot preserve it: a worker claim
-- replaces that field and terminal/retry transitions clear it. Keep the
-- launch operation separately so terminal jobs remain traceable.
alter table public.background_jobs
  add column if not exists cloud_run_operation_id text;

comment on column public.background_jobs.cloud_run_operation_id is
  'Cloud Run Jobs API long-running operation name that launched the current render attempt.';

-- Preserve the launch identity for work that was already running when this
-- migration landed. Terminal jobs have already released their slot and cannot
-- be reconstructed, so limit the backfill to a live, attached operation.
update public.background_jobs as job
set cloud_run_operation_id = slot.worker_execution_id
from public.video_render_execution_slots as slot
where slot.background_job_id = job.id
  and slot.worker_execution_id is not null
  and job.cloud_run_operation_id is null;

select pg_notify('pgrst', 'reload schema');
