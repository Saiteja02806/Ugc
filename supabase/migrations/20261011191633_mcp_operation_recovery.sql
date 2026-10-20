-- Agent controls use the existing cancellation/retry and credit transactions.
-- Persist a request receipt atomically so a lost response never repeats a control
-- against a later job revision or reserves another retry's credits.
create table public.mcp_job_control_requests (
  user_id text not null check (length(btrim(user_id)) > 0),
  request_id uuid not null,
  job_id uuid not null references public.background_jobs(id),
  action text not null check (action in ('cancel', 'retry')),
  expected_updated_at timestamptz not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.mcp_job_control_requests enable row level security;
revoke all on public.mcp_job_control_requests from public, anon, authenticated;
grant select, insert on public.mcp_job_control_requests to service_role;

create index background_jobs_owner_history_page_idx
  on public.background_jobs (user_id, created_at desc, id desc);

create function public.mcp_control_background_job(
  p_user_id text, p_request_id uuid, p_job_id uuid,
  p_expected_updated_at timestamptz, p_action text, p_retry_allowed boolean
) returns jsonb
language plpgsql security invoker set search_path = '' as $function$
declare
  v_receipt public.mcp_job_control_requests%rowtype;
  v_job public.background_jobs%rowtype;
begin
  if p_user_id is null or length(btrim(p_user_id)) = 0 or p_request_id is null
    or p_job_id is null or p_expected_updated_at is null
    or p_action is null or p_action not in ('cancel', 'retry') then
    raise exception 'mcp_operation_input_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'mcp-job-control:' || p_user_id || ':' || p_request_id::text, 0));
  select * into v_receipt from public.mcp_job_control_requests
    where user_id = p_user_id and request_id = p_request_id;
  if found then
    if v_receipt.job_id <> p_job_id or v_receipt.action <> p_action
      or v_receipt.expected_updated_at <> p_expected_updated_at then
      raise exception 'mcp_operation_request_conflict';
    end if;
    return jsonb_build_object('job_id', v_receipt.job_id, 'request_id', p_request_id,
      'replayed', true, 'accepted_at', v_receipt.accepted_at);
  end if;

  select * into v_job from public.background_jobs
    where id = p_job_id and user_id = p_user_id for update;
  if not found or v_job.job_type = 'test_worker_job' then
    raise exception 'mcp_operation_not_found';
  end if;
  if v_job.updated_at <> p_expected_updated_at then
    raise exception 'mcp_operation_changed';
  end if;
  if p_action = 'retry' then
    -- This value is computed by the authenticated server using the existing
    -- public retry policy. It is never taken from MCP arguments. The exact
    -- revision guard keeps that decision valid under concurrent workers.
    if p_retry_allowed is distinct from true then
      raise exception 'mcp_operation_not_retryable';
    end if;
    perform public.retry_background_job(p_job_id, p_user_id);
  else
    perform public.request_background_job_cancel(p_job_id, p_user_id);
  end if;
  insert into public.mcp_job_control_requests
    (user_id, request_id, job_id, action, expected_updated_at)
    values (p_user_id, p_request_id, p_job_id, p_action, p_expected_updated_at)
    returning * into v_receipt;
  return jsonb_build_object('job_id', p_job_id, 'request_id', p_request_id,
    'replayed', false, 'accepted_at', v_receipt.accepted_at);
end;
$function$;
revoke all on function public.mcp_control_background_job(text,uuid,uuid,timestamptz,text,boolean)
  from public, anon, authenticated;
grant execute on function public.mcp_control_background_job(text,uuid,uuid,timestamptz,text,boolean)
  to service_role;
select pg_notify('pgrst', 'reload schema');
