-- Run as a database administrator after the funding migration is applied.
-- This transaction impersonates the real service role and rolls every fixture
-- row back. It never dispatches a worker, calls a provider, or reports usage.
begin;
set local role service_role;
do $smoke$
declare
  v_user text := 'billing-retry-smoke:' || gen_random_uuid()::text;
  v_job_id uuid;
  v_blocked_id uuid;
  v_spent_id uuid;
  v_balance public.free_generation_credit_balances;
  v_reservation public.billing_credit_reservations;
  v_retried public.background_jobs;
  v_rejected boolean := false;
begin
  perform public.ensure_free_generation_credit_balance(v_user);
  perform public.reserve_billing_credits(v_user,'funded-retry','generate_image',1);
  insert into public.background_jobs(user_id,idempotency_key,job_type,queue_name,input_json)
    values(v_user,'funded-retry','generate_image','ai-generation','{}'::jsonb)
    returning id into v_job_id;
  update public.background_jobs set status='failed',failed_at=now() where id=v_job_id;
  select * into v_balance from public.free_generation_credit_balances where user_id=v_user;
  if v_balance.used_credits <> 0 or v_balance.reserved_credits <> 0 then
    raise exception 'retry smoke: failed generation did not refund';
  end if;

  select * into v_retried from public.retry_background_job(v_job_id,v_user);
  select * into v_balance from public.free_generation_credit_balances where user_id=v_user;
  select * into v_reservation from public.billing_credit_reservations
    where user_id=v_user and idempotency_key='funded-retry';
  if v_retried.status <> 'queued' or v_balance.reserved_credits <> 1
    or v_reservation.status <> 'reserved' or v_reservation.settled_at is not null
  then raise exception 'retry smoke: funded retry was not reserved atomically'; end if;
  update public.background_jobs set status='completed',completed_at=now() where id=v_job_id;
  update public.background_jobs set status='completed' where id=v_job_id;
  select * into v_balance from public.free_generation_credit_balances where user_id=v_user;
  if v_balance.used_credits <> 1 or v_balance.reserved_credits <> 0 then
    raise exception 'retry smoke: completion did not consume exactly once';
  end if;

  perform public.reserve_billing_credits(v_user,'blocked-retry','generate_image',1);
  insert into public.background_jobs(user_id,idempotency_key,job_type,queue_name,input_json)
    values(v_user,'blocked-retry','generate_image','ai-generation','{}'::jsonb)
    returning id into v_blocked_id;
  update public.background_jobs set status='failed',failed_at=now() where id=v_blocked_id;
  perform public.reserve_billing_credits(v_user,'spend-last-credit','generate_image',1);
  insert into public.background_jobs(user_id,idempotency_key,job_type,queue_name,input_json)
    values(v_user,'spend-last-credit','generate_image','ai-generation','{}'::jsonb)
    returning id into v_spent_id;
  update public.background_jobs set status='completed',completed_at=now() where id=v_spent_id;

  begin
    perform public.retry_background_job(v_blocked_id,v_user);
  exception when raise_exception then
    if sqlerrm <> 'insufficient_billing_credits' then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'retry smoke: unfunded retry was allowed'; end if;
  select * into v_balance from public.free_generation_credit_balances where user_id=v_user;
  select * into v_reservation from public.billing_credit_reservations
    where user_id=v_user and idempotency_key='blocked-retry';
  if v_balance.used_credits <> 2 or v_balance.reserved_credits <> 0
    or v_reservation.status <> 'released'
    or (select status from public.background_jobs where id=v_blocked_id) <> 'failed'
  then raise exception 'retry smoke: rejected retry changed the job or balance'; end if;
  if exists(select 1 from public.billing_usage_outbox where user_id=v_user) then
    raise exception 'retry smoke: free generation created Dodo usage';
  end if;
  if exists(select 1 from public.background_job_events where job_id=v_blocked_id and event_type='job_retried') then
    raise exception 'retry smoke: rejected retry emitted a retry event';
  end if;
end;
$smoke$;
rollback;
select 'free refund, funded retry, one-time settlement, and exhausted-credit rejection passed; all fixtures rolled back' as result,
  not exists(select 1 from public.background_jobs where user_id like 'billing-retry-smoke:%') as no_fixture_jobs,
  not exists(select 1 from public.free_generation_credit_balances where user_id like 'billing-retry-smoke:%') as no_fixture_balances;
