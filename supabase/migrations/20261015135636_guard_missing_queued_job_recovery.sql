-- Cloud Tasks existence is checked by the recovery service before this call.
-- Lock and compare the inspected snapshot so a concurrent worker claim or
-- another recovery cannot be reset after that external check.
create or replace function public.recover_missing_queued_background_job(
  p_job_id uuid,
  p_expected_updated_at timestamptz
) returns setof public.background_jobs
language plpgsql security definer set search_path = public
as $$
begin
  perform 1 from public.background_jobs
  where id = p_job_id and status = 'queued'
    and updated_at = p_expected_updated_at
  for update;
  if not found then return; end if;
  return query select * from public.recover_background_job(p_job_id);
end;
$$;
revoke all on function public.recover_missing_queued_background_job(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.recover_missing_queued_background_job(uuid, timestamptz) to service_role;
