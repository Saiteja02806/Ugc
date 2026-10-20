-- One complimentary collection attempt for a verified already-completed task.
-- No provider operation, input references, fingerprint or credit balance is reset.
create or replace function public.recover_completed_provider_output(p_job_id uuid, p_user_id text)
returns setof public.background_jobs
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_job public.background_jobs%rowtype;
begin
  select * into v_job from public.background_jobs
  where id = p_job_id and user_id = p_user_id for update;
  if not found then return; end if;
  if v_job.job_type <> 'generate_hook_video' or v_job.status <> 'failed'
    or v_job.attempt_count >= 20
    or v_job.error_code is distinct from 'PROVIDER_OUTPUT_COLLECTION_FAILED'
    or v_job.input_json->>'userId' is distinct from p_user_id
    or v_job.input_json->>'provider' is distinct from 'reapi'
    or coalesce(v_job.input_json->>'model', '') not in ('seedance_2_5', 'wan_3_0')
    or v_job.input_json ? 'providerOutputRecovery'
  then raise exception 'completed_output_recovery_not_allowed'; end if;

  -- The saved operation belongs to this owner through the locked job. Lock it
  -- too, and permit neither an uncertain task nor a potentially new submission.
  perform 1 from public.generation_provider_operations
  where job_id = p_job_id and operation_key = 'primary-reapi' and provider = 'reapi'
    and status in ('provider_succeeded', 'output_persisted')
    and nullif(btrim(provider_operation_id), '') is not null
  for update;
  if not found then raise exception 'completed_provider_operation_required'; end if;

  -- A released reservation stays released; an original committed charge stays
  -- committed. Outstanding reservations require separate settlement, not this RPC.
  perform 1 from public.billing_credit_reservations
  where user_id = p_user_id and idempotency_key = v_job.idempotency_key
    and job_type = v_job.job_type and background_job_id = p_job_id
    and status in ('released', 'committed') for update;
  if not found then raise exception 'settled_original_reservation_required'; end if;

  update public.background_jobs set status = 'queued', stage = 'collecting_existing_output',
    input_json = input_json || jsonb_build_object('providerOutputRecovery', 'collection-only-v1'),
    max_attempts = attempt_count + 1,
    progress = null, error_code = null, error_message = null, failed_at = null,
    completed_at = null, cancel_requested_at = null, queued_at = now(),
    next_attempt_at = null, queue_message_id = null, last_delivery_at = null,
    last_heartbeat_at = null, locked_at = null, claim_token = null,
    worker_id = null, worker_execution_id = null, updated_at = now()
  where id = p_job_id;
  perform public.append_background_job_event(p_job_id, 'completed_provider_output_recovery',
    jsonb_build_object('collectionOnly', true, 'additionalCredits', 0, 'attemptCount', v_job.attempt_count));
  return query select * from public.background_jobs where id = p_job_id;
end;
$function$;
revoke all on function public.recover_completed_provider_output(uuid,text) from public, anon, authenticated;
grant execute on function public.recover_completed_provider_output(uuid,text) to service_role;

-- This marked pass only collects a previously paid provider task. Exclude it
-- from both credit settlement and metered usage emission. All ordinary jobs
-- retain the existing trigger function and its full billing rules.
create or replace function public.is_verified_completed_output_recovery(
  p_job_id uuid, p_user_id text, p_job_type text, p_input jsonb, p_idempotency_key text)
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(p_job_type = 'generate_hook_video'
    and p_input->>'providerOutputRecovery' = 'collection-only-v1'
    and p_input->>'userId' = p_user_id and p_input->>'provider' = 'reapi'
    and p_input->>'model' in ('seedance_2_5', 'wan_3_0')
    and exists (select 1 from public.background_job_events
      where job_id = p_job_id and event_type = 'completed_provider_output_recovery')
    and exists (select 1 from public.generation_provider_operations
      where job_id = p_job_id and operation_key = 'primary-reapi' and provider = 'reapi'
        and status in ('provider_succeeded', 'output_persisted')
        and nullif(btrim(provider_operation_id), '') is not null)
    and exists (select 1 from public.billing_credit_reservations
      where user_id = p_user_id and idempotency_key = p_idempotency_key
        and background_job_id = p_job_id and job_type = p_job_type
        and status in ('released', 'committed')), false);
$function$;
revoke all on function public.is_verified_completed_output_recovery(uuid,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.is_verified_completed_output_recovery(uuid,text,text,jsonb,text) to service_role;
drop trigger settle_billing_background_job_trigger on public.background_jobs;
create trigger settle_billing_background_job_trigger
after update of status on public.background_jobs for each row
when (not public.is_verified_completed_output_recovery(new.id, new.user_id, new.job_type, new.input_json, new.idempotency_key))
execute function public.settle_billing_from_background_job();
select pg_notify('pgrst', 'reload schema');
