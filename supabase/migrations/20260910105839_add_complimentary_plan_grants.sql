-- Complimentary access is a separate, auditable product entitlement. It must
-- never masquerade as a Dodo subscription: Dodo owns payment history while
-- these grants are only available to service-role administration.
create table if not exists public.complimentary_plan_grants (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  plan_key text not null check (plan_key in ('starter', 'growth')),
  credit_limit integer not null check (credit_limit >= 0),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  granted_by_user_id text not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by_user_id text,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > granted_at),
  check (
    (revoked_at is null and revoked_by_user_id is null and revocation_reason is null)
    or (
      revoked_at is not null
      and revoked_by_user_id is not null
      and char_length(btrim(revocation_reason)) between 3 and 1000
    )
  )
);

create index if not exists complimentary_plan_grants_active_user_idx
  on public.complimentary_plan_grants (user_id, granted_at desc)
  where revoked_at is null;

alter table public.complimentary_plan_grants enable row level security;
revoke all privileges on table public.complimentary_plan_grants
  from public, anon, authenticated;
grant select, insert, update on table public.complimentary_plan_grants
  to service_role;

-- Credits have their own balance ledger so complimentary access can be revoked
-- or expire without ever creating a synthetic Dodo subscription/customer.
create table if not exists public.complimentary_plan_credit_balances (
  grant_id uuid primary key references public.complimentary_plan_grants(id)
    on delete restrict,
  user_id text not null,
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

create index if not exists complimentary_plan_credit_balances_user_idx
  on public.complimentary_plan_credit_balances (user_id, period_end);

alter table public.complimentary_plan_credit_balances enable row level security;
revoke all privileges on table public.complimentary_plan_credit_balances
  from public, anon, authenticated;
grant select, insert, update on table public.complimentary_plan_credit_balances
  to service_role;

alter table public.billing_credit_reservations
  add column if not exists complimentary_plan_grant_id uuid
    references public.complimentary_plan_grants(id) on delete restrict;

create index if not exists billing_credit_reservations_complimentary_grant_idx
  on public.billing_credit_reservations (complimentary_plan_grant_id)
  where complimentary_plan_grant_id is not null;

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
    or p_plan_key not in ('starter', 'growth')
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
    when 'growth' then 600
    else 200
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

revoke all on function public.grant_complimentary_plan(text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.grant_complimentary_plan(text, text, text, text, timestamptz)
  to service_role;

create or replace function public.revoke_complimentary_plan(
  p_user_id text,
  p_reason text,
  p_revoked_by_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_grant public.complimentary_plan_grants;
begin
  if nullif(btrim(p_user_id), '') is null
    or nullif(btrim(p_revoked_by_user_id), '') is null
    or char_length(btrim(coalesce(p_reason, ''))) not between 3 and 1000
  then
    raise exception 'invalid_complimentary_plan_revocation';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('complimentary-plan:' || btrim(p_user_id), 0)
  );

  update public.complimentary_plan_grants
  set
    revoked_at = now(),
    revoked_by_user_id = btrim(p_revoked_by_user_id),
    revocation_reason = btrim(p_reason),
    updated_at = now()
  where user_id = btrim(p_user_id)
    and revoked_at is null
  returning * into v_grant;

  return jsonb_build_object(
    'grantId', v_grant.id,
    'revoked', found,
    'userId', btrim(p_user_id)
  );
end;
$function$;

revoke all on function public.revoke_complimentary_plan(text, text, text)
  from public, anon, authenticated;
grant execute on function public.revoke_complimentary_plan(text, text, text)
  to service_role;

-- A complimentary Growth grant beats an active Dodo Starter plan, but an
-- equally capable (or better) Dodo subscription remains the credit source.
create or replace function public.reserve_billing_credits (
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
  order by case plan_key when 'growth' then 2 else 1 end desc, last_event_at desc
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
    or (v_complimentary_grant.plan_key = 'growth' and v_dodo_plan_key = 'starter')
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

create or replace function public.settle_billing_credit_reservation (
  p_user_id           text,
  p_idempotency_key   text,
  p_background_job_id uuid,
  p_commit            boolean
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_complimentary_balance public.complimentary_plan_credit_balances;
  balance public.billing_credit_balances;
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

  if reservation.complimentary_plan_grant_id is not null then
    select * into v_complimentary_balance
    from public.complimentary_plan_credit_balances
    where grant_id = reservation.complimentary_plan_grant_id
    for update;

    if v_complimentary_balance.grant_id is not null
      and reservation.credit_period_start = v_complimentary_balance.period_start
    then
      update public.complimentary_plan_credit_balances
      set
        reserved_credits = greatest(reserved_credits - reservation.amount, 0),
        used_credits = used_credits + case when p_commit then reservation.amount else 0 end,
        updated_at = now()
      where grant_id = reservation.complimentary_plan_grant_id;
    end if;

    return true;
  end if;

  select * into balance
  from public.billing_credit_balances
  where user_id = p_user_id
  for update;

  if balance.user_id is not null and balance.period_end <= now() then
    update public.billing_credit_balances
    set updated_at = now()
    where user_id = p_user_id
    returning * into balance;
  end if;

  if balance.user_id is not null
    and reservation.credit_period_start = balance.period_start
  then
    update public.billing_credit_balances
    set
      reserved_credits = greatest(reserved_credits - reservation.amount, 0),
      used_credits = used_credits + case when p_commit then reservation.amount else 0 end,
      updated_at = now()
    where user_id = p_user_id;
  end if;

  return true;
end;
$function$;

-- Complimentary generations are tracked in the complimentary ledger and must
-- not create Dodo usage events.
create or replace function public.settle_billing_from_background_job()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  resolved_complimentary_grant_id uuid;
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

  select amount, complimentary_plan_grant_id
  into resolved_credit_cost, resolved_complimentary_grant_id
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
$function$;

create or replace function public.enforce_free_trial_daily_trending_feed()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  trial public.free_trial_entitlements%rowtype;
  content_days_used integer := 0;
begin
  if exists (
    select 1
    from public.billing_subscriptions as subscription
    where subscription.user_id = new.user_id
      and subscription.status = 'active'
  ) or exists (
    select 1
    from public.complimentary_plan_grants as complimentary
    where complimentary.user_id = new.user_id
      and complimentary.revoked_at is null
      and (complimentary.expires_at is null or complimentary.expires_at > clock_timestamp())
  ) then
    return new;
  end if;

  select * into trial
  from public.free_trial_entitlements
  where user_id = new.user_id
  for update;

  if not found or trial.expires_at <= clock_timestamp() then
    raise exception using
      errcode = 'P0001',
      message = 'free_trial_content_expired',
      detail = 'An active paid subscription or complimentary grant is required to create another daily content pack.';
  end if;

  if new.daily_limit > trial.daily_content_pieces then
    raise exception using
      errcode = 'P0001',
      message = 'free_trial_daily_content_limit_exceeded',
      detail = 'Free trials may reserve at most 10 content pieces per daily pack.';
  end if;

  select count(*) into content_days_used
  from public.daily_trending_feeds as feed
  where feed.user_id = new.user_id
    and feed.created_at >= trial.started_at;

  if content_days_used >= trial.content_days_limit then
    raise exception using
      errcode = 'P0001',
      message = 'free_trial_content_days_exhausted',
      detail = 'Free trials may create content packs on only three days.';
  end if;

  return new;
end;
$function$;

create or replace function public.enforce_free_trial_instagram_schedule_limit()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  trial public.free_trial_entitlements%rowtype;
  scheduled_post_count integer := 0;
begin
  if new.platform <> 'instagram' then
    return new;
  end if;

  if exists (
    select 1
    from public.billing_subscriptions as subscription
    where subscription.user_id = new.user_id
      and subscription.status = 'active'
  ) or exists (
    select 1
    from public.complimentary_plan_grants as complimentary
    where complimentary.user_id = new.user_id
      and complimentary.revoked_at is null
      and (complimentary.expires_at is null or complimentary.expires_at > clock_timestamp())
  ) then
    return new;
  end if;

  select * into trial
  from public.free_trial_entitlements
  where user_id = new.user_id
  for update;

  if not found or trial.expires_at <= clock_timestamp() then
    raise exception using
      errcode = 'P0001',
      message = 'free_trial_schedule_expired',
      detail = 'Your free trial has ended. Upgrade to schedule another Instagram post.';
  end if;

  select count(*) into scheduled_post_count
  from public.free_trial_instagram_schedule_usage as usage
  where usage.user_id = new.user_id;

  if scheduled_post_count >= trial.instagram_schedule_limit then
    raise exception using
      errcode = 'P0001',
      message = 'free_trial_schedule_limit_reached',
      detail = 'Free trials may schedule up to five Instagram posts in total, including future dates.';
  end if;

  insert into public.free_trial_instagram_schedule_usage (
    user_id,
    scheduled_post_target_id
  ) values (new.user_id, new.id);

  return new;
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
      and plan_key = 'growth'
      and revoked_at is null
      and (expires_at is null or expires_at > clock_timestamp())
  ) or exists (
    select 1 from public.billing_subscriptions
    where user_id = new.user_id
      and plan_key = 'growth'
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

revoke all on function public.enforce_instagram_connection_limit()
  from public, anon, authenticated;
grant execute on function public.enforce_instagram_connection_limit()
  to postgres, service_role;

-- Dodo cancellation must only release Dodo-funded reservations. Without this
-- override, a later Dodo cancellation could inadvertently release a valid
-- complimentary reservation for an account that has both kinds of access.
create or replace function public.apply_dodo_subscription_event (
  p_webhook_id           text,
  p_event_type           text,
  p_event_timestamp      timestamp with time zone,
  p_user_id              text,
  p_customer_id          text,
  p_customer_email       text,
  p_subscription_id      text,
  p_product_id           text,
  p_plan_key             text,
  p_billing_interval     text,
  p_status               text,
  p_period_start         timestamp with time zone,
  p_period_end           timestamp with time zone,
  p_cancel_at_period_end boolean,
  p_cancelled_at         timestamp with time zone,
  p_metadata             jsonb,
  p_payload              jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    where user_id = p_user_id
      and status = 'reserved'
      and complimentary_plan_grant_id is null;

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
$function$;

revoke all on function public.apply_dodo_subscription_event(
  text, text, timestamptz, text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, boolean, timestamptz, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_dodo_subscription_event(
  text, text, timestamptz, text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, boolean, timestamptz, jsonb, jsonb
) to postgres, service_role;

select pg_notify('pgrst', 'reload schema');
