-- One lifetime allocation per Firebase account. This ledger never rolls over,
-- expires with a trial, or touches a paid/complimentary balance.
create table public.free_generation_credit_balances (
  user_id text primary key check (length(btrim(user_id)) > 0),
  credit_limit integer not null default 2 check (credit_limit = 2),
  used_credits integer not null default 0 check (used_credits >= 0),
  reserved_credits integer not null default 0 check (reserved_credits >= 0),
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint free_generation_credit_budget_check check (used_credits + reserved_credits <= credit_limit)
);
alter table public.free_generation_credit_balances enable row level security;
revoke all on table public.free_generation_credit_balances from public, anon, authenticated;
grant select, insert, update on table public.free_generation_credit_balances to service_role;

alter table public.billing_credit_reservations
  add column uses_free_generation_credits boolean not null default false,
  add constraint billing_credit_reservations_source_check
    check (not uses_free_generation_credits or complimentary_plan_grant_id is null);

-- Only server-verified Firebase IDs reach this service-role RPC.
create function public.ensure_free_generation_credit_balance(p_user_id text)
returns jsonb language plpgsql security invoker set search_path = ''
as $function$
declare v_balance public.free_generation_credit_balances;
begin
  if nullif(pg_catalog.btrim(p_user_id), '') is null then
    raise exception 'invalid_free_generation_user';
  end if;
  insert into public.free_generation_credit_balances(user_id) values(p_user_id)
  on conflict(user_id) do nothing;
  select * into v_balance from public.free_generation_credit_balances where user_id = p_user_id;
  return pg_catalog.jsonb_build_object(
    'granted', v_balance.credit_limit,
    'remaining', v_balance.credit_limit - v_balance.used_credits - v_balance.reserved_credits,
    'reserved', v_balance.reserved_credits,
    'used', v_balance.used_credits
  );
end;
$function$;
revoke all on function public.ensure_free_generation_credit_balance(text) from public, anon, authenticated;
grant execute on function public.ensure_free_generation_credit_balance(text) to service_role;

-- Keep deployed paid and complimentary reservation behavior as the underlying
-- implementation. New free reservations use the same per-account lock.
alter function public.reserve_billing_credits(text,text,text,integer)
  rename to reserve_subscription_billing_credits;
revoke all on function public.reserve_subscription_billing_credits(text,text,text,integer) from public, anon, authenticated;
grant execute on function public.reserve_subscription_billing_credits(text,text,text,integer) to service_role;
create function public.reserve_billing_credits(
  p_user_id text, p_idempotency_key text, p_job_type text, p_amount integer
)
returns jsonb language plpgsql security invoker set search_path = ''
as $function$
declare
  v_existing public.billing_credit_reservations;
  v_balance public.free_generation_credit_balances;
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
      where user_id = p_user_id and revoked_at is null and (expires_at is null or expires_at > now()))
  then
    return public.reserve_subscription_billing_credits(p_user_id,p_idempotency_key,p_job_type,p_amount);
  end if;

  if p_job_type not in ('generate_image','generate_hook_video') or p_job_type is null then
    raise exception 'invalid_free_generation_job_type';
  end if;
  perform public.ensure_free_generation_credit_balance(p_user_id);
  select * into v_balance from public.free_generation_credit_balances
  where user_id = p_user_id for update;
  if v_balance.credit_limit - v_balance.used_credits - v_balance.reserved_credits < p_amount then
    raise exception 'insufficient_billing_credits';
  end if;
  insert into public.billing_credit_reservations(
    user_id,idempotency_key,job_type,amount,credit_period_start,uses_free_generation_credits
  ) values(p_user_id,p_idempotency_key,p_job_type,p_amount,v_balance.granted_at,true)
  returning * into v_existing;
  update public.free_generation_credit_balances
  set reserved_credits = reserved_credits + p_amount, updated_at = now()
  where user_id = p_user_id;
  return pg_catalog.jsonb_build_object(
    'amount', v_existing.amount, 'reservationId', v_existing.id, 'status', v_existing.status
  );
end;
$function$;
revoke all on function public.reserve_billing_credits(text,text,text,integer) from public, anon, authenticated;
grant execute on function public.reserve_billing_credits(text,text,text,integer) to service_role;

alter function public.settle_billing_credit_reservation(text,text,uuid,boolean)
  rename to settle_subscription_billing_credit_reservation;
revoke all on function public.settle_subscription_billing_credit_reservation(text,text,uuid,boolean) from public, anon, authenticated;
grant execute on function public.settle_subscription_billing_credit_reservation(text,text,uuid,boolean) to service_role;
create function public.settle_billing_credit_reservation(
  p_user_id text,p_idempotency_key text,p_background_job_id uuid,p_commit boolean
)
returns boolean language plpgsql security invoker set search_path = ''
as $function$
declare v_reservation public.billing_credit_reservations;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('billing-credits:' || p_user_id, 0));
  select * into v_reservation from public.billing_credit_reservations
  where user_id = p_user_id and idempotency_key = p_idempotency_key for update;
  if not found or not v_reservation.uses_free_generation_credits then
    return public.settle_subscription_billing_credit_reservation(
      p_user_id,p_idempotency_key,p_background_job_id,p_commit
    );
  end if;
  if v_reservation.status <> 'reserved' then return false; end if;
  update public.billing_credit_reservations set
    status = case when p_commit then 'committed' else 'released' end,
    background_job_id = coalesce(p_background_job_id,background_job_id),
    settled_at = now(),updated_at = now()
  where id = v_reservation.id;
  update public.free_generation_credit_balances set
    reserved_credits = reserved_credits - v_reservation.amount,
    used_credits = used_credits + case when p_commit then v_reservation.amount else 0 end,
    updated_at = now()
  where user_id = p_user_id;
  return true;
end;
$function$;
revoke all on function public.settle_billing_credit_reservation(text,text,uuid,boolean) from public, anon, authenticated;
grant execute on function public.settle_billing_credit_reservation(text,text,uuid,boolean) to service_role;

-- Free completions settle their own source and never produce paid usage.
CREATE OR REPLACE FUNCTION public.settle_billing_from_background_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  resolved_complimentary_grant_id uuid;
  resolved_uses_free_credits boolean;
  resolved_customer_id text;
  resolved_credit_cost integer;
  resolved_kind text;
begin
  if new.status not in ('completed', 'failed', 'cancelled')
    or new.user_id is null
    or new.idempotency_key is null
    or (old.status = new.status)
  then
    return new;
  end if;

  select amount, complimentary_plan_grant_id, uses_free_generation_credits
  into resolved_credit_cost, resolved_complimentary_grant_id, resolved_uses_free_credits
  from public.billing_credit_reservations
  where user_id = new.user_id
    and idempotency_key = new.idempotency_key;

  perform public.settle_billing_credit_reservation(
    new.user_id,
    new.idempotency_key,
    new.id,
    new.status = 'completed'
  );

  if new.status = 'completed'
    and resolved_complimentary_grant_id is null
    and resolved_uses_free_credits = false
    and new.job_type in ('generate_image', 'generate_hook_video')
  then
    select dodo_customer_id into resolved_customer_id
    from public.billing_customers
    where user_id = new.user_id;

    resolved_kind := case when new.job_type = 'generate_image' then 'image' else 'video' end;

    if resolved_customer_id is not null and resolved_credit_cost is not null then
      insert into public.billing_usage_outbox (
        event_id,
        user_id,
        dodo_customer_id,
        background_job_id,
        generation_kind,
        credit_cost,
        occurred_at
      )
      values (
        'generation:' || new.id::text,
        new.user_id,
        resolved_customer_id,
        new.id,
        resolved_kind,
        resolved_credit_cost,
        coalesce(new.completed_at, now())
      )
      on conflict (event_id) do nothing;
    end if;
  end if;

  return new;
end;
$function$
;

-- Preserve subscription ownership recovery and exclude lifetime free reservations
-- from the current subscription's cancellation/hold cleanup.
CREATE OR REPLACE FUNCTION public.apply_dodo_subscription_event(p_webhook_id text, p_event_type text, p_event_timestamp timestamp with time zone, p_user_id text, p_customer_id text, p_customer_email text, p_subscription_id text, p_product_id text, p_plan_key text, p_billing_interval text, p_status text, p_period_start timestamp with time zone, p_period_end timestamp with time zone, p_cancel_at_period_end boolean, p_cancelled_at timestamp with time zone, p_metadata jsonb, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  resolved_credit_limit integer;
  resolved_legacy_plan text;
  existing_event_status text;
  existing_last_event_at timestamptz;
  active_subscription boolean;
  owns_credit_balance boolean;
  has_other_active_subscription boolean;
begin
  if p_webhook_id is null or char_length(trim(p_webhook_id)) = 0
    or p_user_id is null or char_length(trim(p_user_id)) = 0
    or p_customer_id is null or char_length(trim(p_customer_id)) = 0
    or p_subscription_id is null or char_length(trim(p_subscription_id)) = 0
  then
    raise exception 'invalid_dodo_subscription_event';
  end if;

  insert into public.billing_webhook_events (
    webhook_id,
    event_type,
    event_timestamp,
    payload
  )
  values (p_webhook_id, p_event_type, p_event_timestamp, p_payload)
  on conflict (webhook_id) do nothing;

  if not found then
    select status into existing_event_status
    from public.billing_webhook_events
    where webhook_id = p_webhook_id;

    return jsonb_build_object(
      'duplicate', true,
      'status', coalesce(existing_event_status, 'unknown')
    );
  end if;

  -- Serialize entitlement changes with credit reservations and other subscriptions.
  perform pg_advisory_xact_lock(hashtextextended('billing-credits:' || p_user_id, 0));
  perform pg_advisory_xact_lock(
    hashtextextended('billing-subscription:' || p_subscription_id, 0)
  );

  select last_event_at into existing_last_event_at
  from public.billing_subscriptions
  where dodo_subscription_id = p_subscription_id;

  if existing_last_event_at is not null
    and existing_last_event_at > p_event_timestamp
  then
    update public.billing_webhook_events
    set status = 'ignored', processed_at = now()
    where webhook_id = p_webhook_id;

    return jsonb_build_object('duplicate', false, 'stale', true);
  end if;

  insert into public.billing_customers (
    user_id,
    dodo_customer_id,
    email,
    updated_at
  )
  values (p_user_id, p_customer_id, nullif(trim(p_customer_email), ''), now())
  on conflict (user_id) do update
  set
    dodo_customer_id = excluded.dodo_customer_id,
    email = coalesce(excluded.email, public.billing_customers.email),
    updated_at = now()
  where p_status = 'active'
    or public.billing_customers.dodo_customer_id = excluded.dodo_customer_id
    or exists (
      select 1 from public.billing_credit_balances
      where user_id = p_user_id and dodo_subscription_id = p_subscription_id
    );

  insert into public.billing_subscriptions (
    dodo_subscription_id,
    user_id,
    dodo_customer_id,
    product_id,
    plan_key,
    billing_interval,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    cancelled_at,
    last_event_at,
    last_webhook_id,
    metadata,
    updated_at
  )
  values (
    p_subscription_id,
    p_user_id,
    p_customer_id,
    p_product_id,
    p_plan_key,
    p_billing_interval,
    p_status,
    p_period_start,
    p_period_end,
    p_cancel_at_period_end,
    p_cancelled_at,
    p_event_timestamp,
    p_webhook_id,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (dodo_subscription_id) do update
  set
    user_id = excluded.user_id,
    dodo_customer_id = excluded.dodo_customer_id,
    product_id = excluded.product_id,
    plan_key = excluded.plan_key,
    billing_interval = excluded.billing_interval,
    status = excluded.status,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    cancelled_at = excluded.cancelled_at,
    last_event_at = excluded.last_event_at,
    last_webhook_id = excluded.last_webhook_id,
    metadata = excluded.metadata,
    updated_at = now();

  active_subscription := p_status = 'active';
  resolved_legacy_plan := case when p_plan_key = 'growth' then 'creator' else 'pro' end;
  resolved_credit_limit := case when p_plan_key = 'growth' then 600 else 200 end;

  if active_subscription then
    update public.billing_subscriptions
    set status = 'cancelled', updated_at = now()
    where user_id = p_user_id
      and dodo_subscription_id <> p_subscription_id
      and status = 'active';

    if exists (
      select 1 from public.user_subscription_plans
      where user_id = p_user_id and is_active = true
    ) then
      update public.user_subscription_plans
      set
        plan_key = resolved_legacy_plan,
        source = 'billing',
        updated_at = now()
      where user_id = p_user_id and is_active = true;
    else
      insert into public.user_subscription_plans (
        user_id,
        plan_key,
        is_active,
        source,
        updated_at
      )
      values (p_user_id, resolved_legacy_plan, true, 'billing', now());
    end if;

    insert into public.billing_credit_balances (
      user_id,
      dodo_subscription_id,
      plan_key,
      credit_limit,
      period_start,
      period_end,
      updated_at
    )
    values (
      p_user_id,
      p_subscription_id,
      p_plan_key,
      resolved_credit_limit,
      date_trunc('month', now()),
      date_trunc('month', now()) + interval '1 month',
      now()
    )
    on conflict (user_id) do update
    set
      dodo_subscription_id = excluded.dodo_subscription_id,
      plan_key = excluded.plan_key,
      credit_limit = excluded.credit_limit,
      used_credits = case
        when public.billing_credit_balances.period_end <= now()
          or public.billing_credit_balances.dodo_subscription_id <> excluded.dodo_subscription_id
        then 0
        else least(public.billing_credit_balances.used_credits, excluded.credit_limit)
      end,
      reserved_credits = case
        when public.billing_credit_balances.period_end <= now()
          or public.billing_credit_balances.dodo_subscription_id <> excluded.dodo_subscription_id
        then 0
        else least(
          public.billing_credit_balances.reserved_credits,
          greatest(excluded.credit_limit - public.billing_credit_balances.used_credits, 0)
        )
      end,
      period_start = case
        when public.billing_credit_balances.period_end <= now()
          or public.billing_credit_balances.dodo_subscription_id <> excluded.dodo_subscription_id
        then excluded.period_start
        else public.billing_credit_balances.period_start
      end,
      period_end = case
        when public.billing_credit_balances.period_end <= now()
          or public.billing_credit_balances.dodo_subscription_id <> excluded.dodo_subscription_id
        then excluded.period_end
        else public.billing_credit_balances.period_end
      end,
      updated_at = now();
  else
    select exists (
      select 1 from public.billing_subscriptions
      where user_id = p_user_id and status = 'active'
        and dodo_subscription_id <> p_subscription_id
    ) into has_other_active_subscription;
    select exists (
      select 1 from public.billing_credit_balances
      where user_id = p_user_id and dodo_subscription_id = p_subscription_id
    ) into owns_credit_balance;

    -- Record the old subscription's status without revoking a different owner's access.
    if not has_other_active_subscription and owns_credit_balance then
      update public.user_subscription_plans
      set is_active = false, updated_at = now()
      where user_id = p_user_id and is_active = true and source = 'billing';

      update public.billing_credit_reservations
      set status = 'released', settled_at = now(), updated_at = now()
      where user_id = p_user_id
        and status = 'reserved'
        and complimentary_plan_grant_id is null
        and uses_free_generation_credits = false;

      update public.billing_credit_balances
      set credit_limit = used_credits, reserved_credits = 0, updated_at = now()
      where user_id = p_user_id and dodo_subscription_id = p_subscription_id;
    end if;
  end if;

  update public.billing_webhook_events
  set status = 'processed', processed_at = now()
  where webhook_id = p_webhook_id;

  return jsonb_build_object(
    'active', active_subscription,
    'duplicate', false,
    'stale', false
  );
exception
  when others then
    update public.billing_webhook_events
    set status = 'failed', error_message = left(sqlerrm, 1000)
    where webhook_id = p_webhook_id;
    raise;
end;
$function$
;

select pg_notify('pgrst', 'reload schema');

