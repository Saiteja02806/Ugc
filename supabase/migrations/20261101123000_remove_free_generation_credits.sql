-- Free accounts no longer receive spendable AI credits.
alter table public.free_generation_credit_balances
  drop constraint if exists free_generation_credit_balances_credit_limit_check;

alter table public.free_generation_credit_balances
  alter column credit_limit set default 0;

alter table public.free_generation_credit_balances
  add constraint free_generation_credit_balances_credit_limit_check
  check (credit_limit >= 0);

update public.free_generation_credit_balances
set credit_limit = used_credits + reserved_credits,
    updated_at = now()
where credit_limit > used_credits + reserved_credits;

create or replace function public.reserve_billing_credits(
  p_user_id text, p_idempotency_key text, p_job_type text, p_amount integer
)
returns jsonb language plpgsql security invoker set search_path = ''
as $function$
declare
  v_existing public.billing_credit_reservations;
begin
  if nullif(pg_catalog.btrim(p_user_id), '') is null
    or nullif(pg_catalog.btrim(p_idempotency_key), '') is null
    or p_amount is null or p_amount < 1
  then raise exception 'invalid_billing_credit_reservation'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('billing-credits:' || p_user_id, 0));
  select * into v_existing from public.billing_credit_reservations
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.uses_free_generation_credits and (
      v_existing.amount is distinct from p_amount or v_existing.job_type is distinct from p_job_type
    ) then raise exception 'billing_credit_idempotency_conflict'; end if;
    if v_existing.uses_free_generation_credits and v_existing.status = 'released' then
      raise exception 'billing_credit_reservation_released';
    end if;
    return pg_catalog.jsonb_build_object(
      'amount', v_existing.amount, 'reservationId', v_existing.id, 'status', v_existing.status
    );
  end if;

  if exists(select 1 from public.billing_subscriptions where user_id = p_user_id and status = 'active')
    or exists(select 1 from public.complimentary_plan_grants
      where user_id = p_user_id and revoked_at is null and (expires_at is null or expires_at > pg_catalog.now()))
  then
    return public.reserve_subscription_billing_credits(p_user_id,p_idempotency_key,p_job_type,p_amount);
  end if;

  if p_job_type not in ('generate_image','generate_hook_video') or p_job_type is null then
    raise exception 'invalid_free_generation_job_type';
  end if;
  -- Existing rows can still settle. New free reservations are refused.
  raise exception 'insufficient_billing_credits';
end;
$function$;
