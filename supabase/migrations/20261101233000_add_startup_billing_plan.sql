-- Startup is a third paid plan. Credits: Starter 360, Growth 720, Startup 1800.
-- Existing balances only move upward. The free trial account remains.

do $$
declare r record;
begin
  for r in
    select con.conname, rel.relname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname in (
        'billing_credit_balances',
        'billing_subscriptions',
        'complimentary_plan_credit_balances',
        'complimentary_plan_grants'
      )
      and pg_get_constraintdef(con.oid) ilike '%starter%'
      and pg_get_constraintdef(con.oid) ilike '%growth%'
  loop
    execute format('alter table public.%I drop constraint %I', r.relname, r.conname);
  end loop;
end
$$;

alter table public.billing_subscriptions
  add constraint billing_subscriptions_plan_key_check
  check (plan_key = any (array['starter','growth','startup']));
alter table public.billing_credit_balances
  add constraint billing_credit_balances_plan_key_check
  check (plan_key = any (array['starter','growth','startup']));
alter table public.complimentary_plan_grants
  add constraint complimentary_plan_grants_plan_key_check
  check (plan_key in ('starter', 'growth', 'startup'));
alter table public.complimentary_plan_credit_balances
  add constraint complimentary_plan_credit_balances_plan_key_check
  check (plan_key in ('starter', 'growth', 'startup'));


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
  resolved_legacy_plan := case when p_plan_key in ('growth', 'startup') then 'creator' else 'pro' end;
  resolved_credit_limit := case p_plan_key when 'startup' then 1800 when 'growth' then 720 when 'starter' then 360 else 360 end;

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
$function$;

create or replace function public.grant_complimentary_plan(
  p_user_id text,
  p_plan_key text,
  p_reason text,
  p_granted_by_user_id text,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_credit_limit integer;
  v_grant public.complimentary_plan_grants;
begin
  if nullif(btrim(p_user_id), '') is null
    or nullif(btrim(p_granted_by_user_id), '') is null
    or char_length(btrim(coalesce(p_reason, ''))) not between 3 and 1000
    or p_plan_key not in ('starter', 'growth', 'startup')
    or (p_expires_at is not null and p_expires_at <= now())
  then
    raise exception 'invalid_complimentary_plan_grant';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('complimentary-plan:' || btrim(p_user_id), 0)
  );

  -- Preserve a complete history. A replacement is a revocation plus a new
  -- grant, never an in-place change to the originally granted plan.
  update public.complimentary_plan_grants
  set
    revoked_at = now(),
    revoked_by_user_id = btrim(p_granted_by_user_id),
    revocation_reason = 'Replaced by a newer complimentary plan grant.',
    updated_at = now()
  where user_id = btrim(p_user_id)
    and revoked_at is null;

  v_credit_limit := case p_plan_key
    when 'startup' then 1800
    when 'growth' then 720
    when 'starter' then 360
    else 0
  end;

  insert into public.complimentary_plan_grants (
    user_id,
    plan_key,
    credit_limit,
    reason,
    granted_by_user_id,
    expires_at
  )
  values (
    btrim(p_user_id),
    p_plan_key,
    v_credit_limit,
    btrim(p_reason),
    btrim(p_granted_by_user_id),
    p_expires_at
  )
  returning * into v_grant;

  insert into public.complimentary_plan_credit_balances (
    grant_id,
    user_id,
    plan_key,
    credit_limit,
    period_start,
    period_end
  )
  values (
    v_grant.id,
    v_grant.user_id,
    v_grant.plan_key,
    v_grant.credit_limit,
    date_trunc('month', now()),
    date_trunc('month', now()) + interval '1 month'
  );

  return jsonb_build_object(
    'creditLimit', v_grant.credit_limit,
    'expiresAt', v_grant.expires_at,
    'grantId', v_grant.id,
    'planKey', v_grant.plan_key,
    'userId', v_grant.user_id
  );
end;
$function$;

create or replace function public.reserve_subscription_billing_credits (
  p_user_id         text,
  p_idempotency_key text,
  p_job_type        text,
  p_amount          integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_complimentary_balance public.complimentary_plan_credit_balances;
  v_complimentary_grant public.complimentary_plan_grants;
  v_dodo_plan_key text;
  existing_reservation public.billing_credit_reservations;
  balance public.billing_credit_balances;
begin
  if p_amount < 1 or char_length(trim(p_idempotency_key)) = 0 then
    raise exception 'invalid_billing_credit_reservation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('billing-credits:' || p_user_id, 0));

  select * into existing_reservation
  from public.billing_credit_reservations
  where user_id = p_user_id and idempotency_key = p_idempotency_key;

  if existing_reservation.id is not null then
    return jsonb_build_object(
      'amount', existing_reservation.amount,
      'reservationId', existing_reservation.id,
      'status', existing_reservation.status
    );
  end if;

  select plan_key into v_dodo_plan_key
  from public.billing_subscriptions
  where user_id = p_user_id and status = 'active'
  order by case plan_key when 'startup' then 3 when 'growth' then 2 else 1 end desc, last_event_at desc
  limit 1;

  select * into v_complimentary_grant
  from public.complimentary_plan_grants
  where user_id = p_user_id
    and revoked_at is null
    and (expires_at is null or expires_at > now())
  order by granted_at desc
  limit 1
  for update;

  if found and (
    v_dodo_plan_key is null
    or (case v_complimentary_grant.plan_key when 'startup' then 3 when 'growth' then 2 else 1 end > case v_dodo_plan_key when 'startup' then 3 when 'growth' then 2 else 1 end)
  ) then
    select * into v_complimentary_balance
    from public.complimentary_plan_credit_balances
    where grant_id = v_complimentary_grant.id
    for update;

    if not found then
      raise exception 'complimentary_credit_balance_missing';
    end if;

    if v_complimentary_balance.period_end <= now() then
      update public.complimentary_plan_credit_balances
      set
        period_start = date_trunc('month', now()),
        period_end = date_trunc('month', now()) + interval '1 month',
        reserved_credits = 0,
        updated_at = now(),
        used_credits = 0
      where grant_id = v_complimentary_grant.id
      returning * into v_complimentary_balance;
    end if;

    if v_complimentary_balance.credit_limit
      - v_complimentary_balance.used_credits
      - v_complimentary_balance.reserved_credits < p_amount
    then
      raise exception 'insufficient_billing_credits';
    end if;

    insert into public.billing_credit_reservations (
      user_id,
      idempotency_key,
      job_type,
      amount,
      credit_period_start,
      complimentary_plan_grant_id
    )
    values (
      p_user_id,
      p_idempotency_key,
      p_job_type,
      p_amount,
      v_complimentary_balance.period_start,
      v_complimentary_grant.id
    )
    returning * into existing_reservation;

    update public.complimentary_plan_credit_balances
    set reserved_credits = reserved_credits + p_amount, updated_at = now()
    where grant_id = v_complimentary_grant.id;

    return jsonb_build_object(
      'amount', existing_reservation.amount,
      'reservationId', existing_reservation.id,
      'status', existing_reservation.status
    );
  end if;

  select * into balance
  from public.billing_credit_balances
  where user_id = p_user_id
  for update;

  if balance.user_id is null or not exists (
    select 1 from public.billing_subscriptions
    where user_id = p_user_id
      and dodo_subscription_id = balance.dodo_subscription_id
      and status = 'active'
  ) then
    raise exception 'paid_subscription_required';
  end if;

  if balance.period_end <= now() then
    update public.billing_credit_balances
    set updated_at = now()
    where user_id = p_user_id
    returning * into balance;
  end if;

  if balance.credit_limit - balance.used_credits - balance.reserved_credits < p_amount then
    raise exception 'insufficient_billing_credits';
  end if;

  insert into public.billing_credit_reservations (
    user_id,
    idempotency_key,
    job_type,
    amount,
    credit_period_start
  )
  values (
    p_user_id,
    p_idempotency_key,
    p_job_type,
    p_amount,
    balance.period_start
  )
  returning * into existing_reservation;

  update public.billing_credit_balances
  set reserved_credits = reserved_credits + p_amount, updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object(
    'amount', existing_reservation.amount,
    'reservationId', existing_reservation.id,
    'status', existing_reservation.status
  );
end;
$function$;

create or replace function public.enforce_instagram_connection_limit()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  account_limit integer := 1;
  active_connection_count integer := 0;
begin
  if new.platform <> 'instagram' or new.revoked_at is not null then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.platform = 'instagram'
    and old.revoked_at is null
    and old.user_id = new.user_id
  then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instagram-connections:' || new.user_id, 0)
  );

  if exists (
    select 1 from public.complimentary_plan_grants
    where user_id = new.user_id
      and plan_key in ('growth', 'startup')
      and revoked_at is null
      and (expires_at is null or expires_at > clock_timestamp())
  ) or exists (
    select 1 from public.billing_subscriptions
    where user_id = new.user_id
      and plan_key in ('growth', 'startup')
      and status = 'active'
  ) then
    account_limit := 5;
  elsif exists (
    select 1 from public.complimentary_plan_grants
    where user_id = new.user_id
      and plan_key = 'starter'
      and revoked_at is null
      and (expires_at is null or expires_at > clock_timestamp())
  ) or exists (
    select 1 from public.billing_subscriptions
    where user_id = new.user_id
      and plan_key = 'starter'
      and status = 'active'
  ) then
    account_limit := 3;
  end if;

  select count(*) into active_connection_count
  from public.social_connections
  where user_id = new.user_id
    and platform = 'instagram'
    and revoked_at is null
    and id <> new.id;

  if active_connection_count >= account_limit then
    raise exception using
      errcode = 'P0001',
      message = 'instagram_account_limit_reached',
      detail = pg_catalog.format(
        'The current plan supports %s active Instagram account(s).',
        account_limit
      );
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_paid_trending_prebuild()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  v_idempotency_key text;
  v_period_key text;
begin
  if new.status <> 'active'
     or new.plan_key not in ('starter', 'growth', 'startup') then
    return new;
  end if;

  -- A subscription can be delivered more than once by Dodo. A period start
  -- makes renewals eligible while keeping all duplicate deliveries in the same
  -- billing period bound to this one durable job. Older payloads without a
  -- period start fall back to one job for that subscription and plan.
  v_period_key := coalesce(
    to_char(
      new.current_period_start at time zone 'UTC',
      'YYYYMMDD"T"HH24MISS"Z"'
    ),
    'subscription'
  );
  v_idempotency_key := concat_ws(
    ':',
    'paid-trending-prebuild',
    'v1',
    new.dodo_subscription_id,
    new.plan_key,
    v_period_key
  );

  insert into public.background_jobs (
    user_id,
    job_type,
    queue_name,
    queue_provider,
    status,
    stage,
    queued_at,
    max_attempts,
    idempotency_key,
    input_reference,
    input_json,
    updated_at
  )
  values (
    new.user_id,
    'paid_trending_prebuild',
    'ai-generation',
    'gcp',
    'queued',
    'queued',
    now(),
    5,
    v_idempotency_key,
    'billing-subscription:' || new.dodo_subscription_id,
    jsonb_build_object(
      'expectedPlanKey', new.plan_key,
      'subscriptionId', new.dodo_subscription_id,
      'periodStart', new.current_period_start
    ),
    now()
  )
  on conflict do nothing;

  return new;
end;
$function$;


update public.billing_credit_balances
set credit_limit = case plan_key when 'starter' then 360 when 'growth' then 720 else credit_limit end,
    updated_at = now()
where (plan_key = 'starter' and credit_limit < 360)
   or (plan_key = 'growth' and credit_limit < 720);

update public.complimentary_plan_credit_balances
set credit_limit = case plan_key when 'starter' then 360 when 'growth' then 720 else credit_limit end,
    updated_at = now()
where (plan_key = 'starter' and credit_limit < 360)
   or (plan_key = 'growth' and credit_limit < 720);

