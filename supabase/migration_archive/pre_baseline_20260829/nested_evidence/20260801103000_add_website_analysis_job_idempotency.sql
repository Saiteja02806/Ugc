alter table public.website_analyses
  add column if not exists source_job_id uuid
    references public.background_jobs(id) on delete set null;

create unique index if not exists website_analyses_source_job_unique_idx
  on public.website_analyses (source_job_id)
  where source_job_id is not null;

create index if not exists website_analyses_user_source_job_idx
  on public.website_analyses (user_id, source_job_id)
  where source_job_id is not null;
