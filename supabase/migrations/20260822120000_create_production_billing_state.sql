insert into public.subscription_entitlements (
  plan_key,
  display_name,
  daily_carousel_limit,
  daily_trending_limit,
  is_active
)
values ('free', 'Free', 1, 3, true)
on conflict (plan_key) do update
set
  display_name = excluded.display_name,
  daily_carousel_limit = excluded.daily_carousel_limit,
  daily_trending_limit = excluded.daily_trending_limit,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists public.billing_customers (
  user_id text primary key,
  dodo_customer_id text not null unique,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  dodo_subscription_id text primary key,
  user_id text not null,
  dodo_customer_id text not null,
  product_id text not null,
  plan_key text not null check (plan_key in ('starter', 'growth')),
  billing_interval text not null check (billing_interval in ('monthly', 'yearly')),
  status text not null check (
    status in ('pending', 'active', 'on_hold', 'paused', 'cancelled', 'failed', 'expired')
  ),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  last_event_at timestamptz not null,
  last_webhook_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_user_event_idx
  on public.billing_subscriptions (user_id, last_event_at desc);
create index if not exists billing_subscriptions_customer_idx
  on public.billing_subscriptions (dodo_customer_id);

create table if not exists public.billing_webhook_events (
  webhook_id text primary key,
  event_type text not null,
  event_timestamp timestamptz not null,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'ignored', 'failed')),
  payload jsonb not null,
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists billing_webhook_events_status_created_idx
  on public.billing_webhook_events (status, created_at);

create table if not exists public.billing_credit_balances (
  user_id text primary key,
  dodo_subscription_id text not null,
  plan_key text not null check (plan_key in ('starter', 'growth')),
  credit_limit integer not null check (credit_limit >= 0),
  used_credits integer not null default 0 check (used_credits >= 0),
  reserved_credits integer not null default 0 check (reserved_credits >= 0),
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end > period_start),
  check (used_credits + reserved_credits <= credit_limit)
);

create table if not exists public.billing_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  idempotency_key text not null,
  job_type text not null,
  amount integer not null check (amount > 0),
  status text not null default 'reserved'
    check (status in ('reserved', 'committed', 'released')),
  background_job_id uuid references public.background_jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists billing_credit_reservations_job_idx
  on public.billing_credit_reservations (background_job_id)
  where background_job_id is not null;

create table if not exists public.billing_usage_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  user_id text not null,
  dodo_customer_id text not null,
  background_job_id uuid not null references public.background_jobs(id) on delete cascade,
  generation_kind text not null check (generation_kind in ('image', 'video')),
  credit_cost integer not null check (credit_cost > 0),
  status text not null default 'pending'
    check (status in ('pending', 'delivered', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  occurred_at timestamptz not null,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_usage_outbox_status_created_idx
  on public.billing_usage_outbox (status, created_at);

create or replace function public.apply_dodo_subscription_event(
  p_webhook_id text,
  p_event_type text,
  p_event_timestamp timestamptz,
  p_user_id text,
  p_customer_id text,
  p_customer_email text,
  p_subscription_id text,
  p_product_id text,
  p_plan_key text,
  p_billing_interval text,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_cancelled_at timestamptz,
  p_metadata jsonb,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_credit_limit integer;
  resolved_legacy_plan text;
  existing_event_status text;
  existing_last_event_at timestamptz;
  active_subscription boolean;
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
    updated_at = now();

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
    update public.user_subscription_plans
    set is_active = false, updated_at = now()
    where user_id = p_user_id and is_active = true;

    update public.billing_credit_reservations
    set status = 'released', settled_at = now(), updated_at = now()
    where user_id = p_user_id and status = 'reserved';

    update public.billing_credit_balances
    set credit_limit = used_credits, reserved_credits = 0, updated_at = now()
    where user_id = p_user_id;
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
$$;

create or replace function public.record_ignored_dodo_webhook_event(
  p_webhook_id text,
  p_event_type text,
  p_event_timestamp timestamptz,
  p_payload jsonb,
  p_reason text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  insert into public.billing_webhook_events (
    webhook_id,
    event_type,
    event_timestamp,
    status,
    payload,
    error_message,
    processed_at
  )
  values (
    p_webhook_id,
    p_event_type,
    p_event_timestamp,
    'ignored',
    p_payload,
    left(p_reason, 1000),
    now()
  )
  on conflict (webhook_id) do nothing
  returning true;
$$;

create or replace function public.reserve_billing_credits(
  p_user_id text,
  p_idempotency_key text,
  p_job_type text,
  p_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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
    set
      used_credits = 0,
      reserved_credits = 0,
      period_start = date_trunc('month', now()),
      period_end = date_trunc('month', now()) + interval '1 month',
      updated_at = now()
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
    amount
  )
  values (p_user_id, p_idempotency_key, p_job_type, p_amount)
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
$$;

create or replace function public.settle_billing_credit_reservation(
  p_user_id text,
  p_idempotency_key text,
  p_background_job_id uuid,
  p_commit boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation public.billing_credit_reservations;
begin
  perform pg_advisory_xact_lock(hashtextextended('billing-credits:' || p_user_id, 0));

  select * into reservation
  from public.billing_credit_reservations
  where user_id = p_user_id and idempotency_key = p_idempotency_key
  for update;

  if reservation.id is null or reservation.status <> 'reserved' then
    return false;
  end if;

  update public.billing_credit_reservations
  set
    background_job_id = coalesce(p_background_job_id, background_job_id),
    status = case when p_commit then 'committed' else 'released' end,
    settled_at = now(),
    updated_at = now()
  where id = reservation.id;

  update public.billing_credit_balances
  set
    reserved_credits = greatest(reserved_credits - reservation.amount, 0),
    used_credits = used_credits + case when p_commit then reservation.amount else 0 end,
    updated_at = now()
  where user_id = p_user_id;

  return true;
end;
$$;

create or replace function public.settle_billing_from_background_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
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

  select amount into resolved_credit_cost
  from public.billing_credit_reservations
  where user_id = new.user_id
    and idempotency_key = new.idempotency_key;

  perform public.settle_billing_credit_reservation(
    new.user_id,
    new.idempotency_key,
    new.id,
    new.status = 'completed'
  );

  if new.status = 'completed' and new.job_type in ('generate_image', 'generate_hook_video') then
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
$$;

drop trigger if exists settle_billing_background_job_trigger
  on public.background_jobs;
create trigger settle_billing_background_job_trigger
after update of status on public.background_jobs
for each row execute function public.settle_billing_from_background_job();

-- This function exists only as a database trigger. Prevent PostgREST clients
-- from invoking the SECURITY DEFINER function directly.
revoke all on function public.settle_billing_from_background_job()
  from public, anon, authenticated;

alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.billing_credit_balances enable row level security;
alter table public.billing_credit_reservations enable row level security;
alter table public.billing_usage_outbox enable row level security;

revoke all privileges on table public.billing_customers from public, anon, authenticated;
revoke all privileges on table public.billing_subscriptions from public, anon, authenticated;
revoke all privileges on table public.billing_webhook_events from public, anon, authenticated;
revoke all privileges on table public.billing_credit_balances from public, anon, authenticated;
revoke all privileges on table public.billing_credit_reservations from public, anon, authenticated;
revoke all privileges on table public.billing_usage_outbox from public, anon, authenticated;

grant select, insert, update on table public.billing_customers to service_role;
grant select, insert, update on table public.billing_subscriptions to service_role;
grant select, insert, update on table public.billing_webhook_events to service_role;
grant select, insert, update on table public.billing_credit_balances to service_role;
grant select, insert, update on table public.billing_credit_reservations to service_role;
grant select, insert, update on table public.billing_usage_outbox to service_role;

revoke all on function public.apply_dodo_subscription_event(
  text, text, timestamptz, text, text, text, text, text, text, text,
  text, timestamptz, timestamptz, boolean, timestamptz, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_dodo_subscription_event(
  text, text, timestamptz, text, text, text, text, text, text, text,
  text, timestamptz, timestamptz, boolean, timestamptz, jsonb, jsonb
) to service_role;

revoke all on function public.record_ignored_dodo_webhook_event(
  text, text, timestamptz, jsonb, text
) from public, anon, authenticated;
grant execute on function public.record_ignored_dodo_webhook_event(
  text, text, timestamptz, jsonb, text
) to service_role;

revoke all on function public.reserve_billing_credits(text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_billing_credits(text, text, text, integer)
  to service_role;

revoke all on function public.settle_billing_credit_reservation(
  text, text, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.settle_billing_credit_reservation(
  text, text, uuid, boolean
) to service_role;

select pg_notify('pgrst', 'reload schema');
