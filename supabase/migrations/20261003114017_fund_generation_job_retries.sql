-- Refunded generations must reserve their original cost before they can retry.
-- Preserve ownership, status and attempt guards, and every recorded credit source.
CREATE OR REPLACE FUNCTION public.retry_background_job(p_job_id uuid, p_user_id text)
 RETURNS SETOF background_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current public.background_jobs%rowtype;
  v_now timestamptz := now();
  v_reservation public.billing_credit_reservations;
  v_free_balance public.free_generation_credit_balances;
  v_paid_balance public.billing_credit_balances;
  v_complimentary_grant public.complimentary_plan_grants;
  v_complimentary_balance public.complimentary_plan_credit_balances;
  v_requires_reservation boolean;
  v_period_start timestamptz;
begin
  select job.*
  into v_current
  from public.background_jobs as job
  where job.id = p_job_id
    and job.user_id = p_user_id
  for update;

  if not found then
    return;
  end if;

  if v_current.status not in ('failed', 'stalled') then
    raise exception 'background job is not retryable';
  end if;

  if v_current.attempt_count >= v_current.max_attempts then
    raise exception 'background job maximum attempts exceeded';
  end if;

  -- Lock the job before billing, matching the terminal-job settlement trigger.
  -- Re-funding and requeue commit together; never switch the recorded source.
  select * into v_reservation
  from public.billing_credit_reservations
  where user_id = p_user_id and idempotency_key = v_current.idempotency_key;
  if found then
    perform pg_advisory_xact_lock(hashtextextended('billing-credits:' || p_user_id, 0));
    select * into v_reservation
    from public.billing_credit_reservations
    where user_id = p_user_id and idempotency_key = v_current.idempotency_key
    for update;

    if v_reservation.job_type is distinct from v_current.job_type
      or (v_reservation.background_job_id is not null and v_reservation.background_job_id <> p_job_id)
    then
      raise exception 'billing_retry_reservation_conflict';
    end if;
    if v_reservation.status = 'committed' then
      raise exception 'billing_retry_already_committed';
    elsif v_reservation.status not in ('reserved', 'released') then
      raise exception 'billing_retry_reservation_conflict';
    end if;

    if v_reservation.uses_free_generation_credits then
      select * into v_free_balance
      from public.free_generation_credit_balances
      where user_id = p_user_id for update;
      if not found then
        raise exception 'free_generation_credit_balance_missing';
      end if;
      v_requires_reservation := v_reservation.status = 'released';
      v_period_start := v_free_balance.granted_at;
      if v_requires_reservation then
        if v_free_balance.credit_limit - v_free_balance.used_credits - v_free_balance.reserved_credits < v_reservation.amount then
          raise exception 'insufficient_billing_credits';
        end if;
        update public.free_generation_credit_balances
        set reserved_credits = reserved_credits + v_reservation.amount, updated_at = v_now
        where user_id = p_user_id;
      end if;
    elsif v_reservation.complimentary_plan_grant_id is not null then
      select * into v_complimentary_grant
      from public.complimentary_plan_grants
      where id = v_reservation.complimentary_plan_grant_id and user_id = p_user_id
        and revoked_at is null and (expires_at is null or expires_at > v_now)
      for update;
      if not found then raise exception 'complimentary_generation_access_required'; end if;
      select * into v_complimentary_balance
      from public.complimentary_plan_credit_balances
      where grant_id = v_reservation.complimentary_plan_grant_id for update;
      if not found then raise exception 'complimentary_credit_balance_missing'; end if;
      if v_complimentary_balance.period_end <= v_now then
        update public.complimentary_plan_credit_balances
        set period_start = date_trunc('month', v_now),
          period_end = date_trunc('month', v_now) + interval '1 month',
          used_credits = 0, reserved_credits = 0, updated_at = v_now
        where grant_id = v_reservation.complimentary_plan_grant_id
        returning * into v_complimentary_balance;
      end if;
      v_requires_reservation := v_reservation.status = 'released'
        or v_reservation.credit_period_start is distinct from v_complimentary_balance.period_start;
      v_period_start := v_complimentary_balance.period_start;
      if v_requires_reservation then
        if v_complimentary_balance.credit_limit - v_complimentary_balance.used_credits - v_complimentary_balance.reserved_credits < v_reservation.amount then
          raise exception 'insufficient_billing_credits';
        end if;
        update public.complimentary_plan_credit_balances
        set reserved_credits = reserved_credits + v_reservation.amount, updated_at = v_now
        where grant_id = v_reservation.complimentary_plan_grant_id;
      end if;
    else
      select * into v_paid_balance
      from public.billing_credit_balances where user_id = p_user_id for update;
      if not found or not exists (
        select 1 from public.billing_subscriptions
        where user_id = p_user_id and dodo_subscription_id = v_paid_balance.dodo_subscription_id and status = 'active'
      ) then raise exception 'paid_subscription_required'; end if;
      -- Keep the deployed anniversary-cycle normalization trigger.
      if v_paid_balance.period_end <= v_now then
        update public.billing_credit_balances set updated_at = v_now
        where user_id = p_user_id returning * into v_paid_balance;
      end if;
      v_requires_reservation := v_reservation.status = 'released'
        or v_reservation.credit_period_start is distinct from v_paid_balance.period_start;
      v_period_start := v_paid_balance.period_start;
      if v_requires_reservation then
        if v_paid_balance.credit_limit - v_paid_balance.used_credits - v_paid_balance.reserved_credits < v_reservation.amount then
          raise exception 'insufficient_billing_credits';
        end if;
        update public.billing_credit_balances
        set reserved_credits = reserved_credits + v_reservation.amount, updated_at = v_now
        where user_id = p_user_id;
      end if;
    end if;

    if v_requires_reservation then
      update public.billing_credit_reservations
      set status = 'reserved', settled_at = null, updated_at = v_now,
        background_job_id = p_job_id, credit_period_start = v_period_start
      where id = v_reservation.id;
    end if;
  end if;

  update public.background_jobs as job
  set
    status = 'queued',
    stage = 'queued',
    progress = null,
    error_code = null,
    error_message = null,
    failed_at = null,
    completed_at = null,
    cancel_requested_at = null,
    queued_at = v_now,
    next_attempt_at = null,
    queue_message_id = null,
    last_delivery_at = null,
    last_heartbeat_at = null,
    locked_at = null,
    claim_token = null,
    worker_id = null,
    worker_execution_id = null,
    updated_at = v_now
  where job.id = p_job_id;

  perform public.append_background_job_event(
    p_job_id,
    'job_retried',
    jsonb_build_object('attemptCount', v_current.attempt_count)
  );

  return query
  select job.* from public.background_jobs as job where job.id = p_job_id;
end;
$function$;
revoke all on function public.retry_background_job(uuid,text) from public, anon, authenticated;
grant execute on function public.retry_background_job(uuid,text) to service_role;
select pg_notify('pgrst', 'reload schema');

