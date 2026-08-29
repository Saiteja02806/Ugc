revoke all privileges on table public.background_jobs
  from service_role;

grant select, insert, update on table public.background_jobs
  to service_role;
