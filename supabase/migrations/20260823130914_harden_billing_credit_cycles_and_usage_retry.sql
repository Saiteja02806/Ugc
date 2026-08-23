update public.subscription_entitlements
set
  daily_trending_limit = 10,
  display_name = 'Free',
  is_active = true,
  updated_at = now()
where plan_key = 'free';

create or replace function public.resolve_billing_credit_cycle(
  p_anchor timestamptz,
  p_at timestamptz
)
returns table(period_start timestamptz, period_end timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
declare
  anchor_utc timestamp without time zone;
  at_utc timestamp without time zone;
  month_offset integer;
  candidate_start timestamp without time zone;
begin
  if p_anchor is null or p_at is null then
    raise exception 'invalid_billing_credit_cycle';
  end if;

  anchor_utc := p_anchor at time zone 'UTC';
  at_utc := p_at at time zone 'UTC';
  month_offset := greatest(
    (extract(year from at_utc)::integer - extract(year from anchor_utc)::integer) * 12
      + extract(month from at_utc)::integer
      - extract(month from anchor_utc)::integer,
    0
  );
  candidate_start := anchor_utc + make_interval(months => month_offset);

  if candidate_start > at_utc and month_offset > 0 then
    month_offset := month_offset - 1;
  end if;

  return query
  select
    (anchor_utc + make_interval(months => month_offset)) at time zone 'UTC',
    (anchor_utc + make_interval(months => month_offset + 1)) at time zone 'UTC';
end;
$$;

revoke all on function public.resolve_billing_credit_cycle(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.resolve_billing_credit_cycle(timestamptz, timestamptz)
  to service_role;

alter table public.billing_credit_balances
  add column if not exists credit_cycle_anchor timestamptz;

alter table public.billing_credit_reservations
  add column if not exists credit_period_start timestamptz;

alter table public.billing_usage_outbox
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_attempt_at timestamptz default now();

update public.billing_credit_balances as balance
set credit_cycle_anchor = coalesce(
  subscription.current_period_start,
  subscription.last_event_at,
  balance.period_start,
  balance.created_at
)
from public.billing_subscriptions as subscription
where subscription.dodo_subscription_id = balance.dodo_subscription_id
  and balance.credit_cycle_anchor is null;

update public.billing_credit_balances
set credit_cycle_anchor = coalesce(period_start, created_at)
where credit_cycle_anchor is null;

update public.billing_credit_reservations as reservation
set credit_period_start = coalesce(balance.period_start, reservation.created_at)
from public.billing_credit_balances as balance
where balance.user_id = reservation.user_id
  and reservation.credit_period_start is null;

update public.billing_credit_reservations
set credit_period_start = created_at
where credit_period_start is null;

with resolved_cycles as (
  select
    balance.user_id,
    cycle.period_end,
    cycle.period_start
  from public.billing_credit_balances as balance
  cross join lateral public.resolve_billing_credit_cycle(
    balance.credit_cycle_anchor,
    now()
  ) as cycle
)
update public.billing_credit_balances as balance
set
  used_credits = case
    when balance.period_start = resolved.period_start then balance.used_credits
    else 0
  end,
  reserved_credits = case
    when balance.period_start = resolved.period_start then balance.reserved_credits
    else 0
  end,
  period_start = resolved.period_start,
  period_end = resolved.period_end,
  updated_at = now()
from resolved_cycles as resolved
where resolved.user_id = balance.user_id;

alter table public.billing_credit_balances
  alter column credit_cycle_anchor set not null;

alter table public.billing_credit_reservations
  alter column credit_period_start set not null;

update public.billing_usage_outbox
set next_attempt_at = coalesce(next_attempt_at, now())
where status in ('pending', 'failed') and attempt_count < 10;

create index if not exists billing_usage_outbox_retry_idx
  on public.billing_usage_outbox (next_attempt_at, created_at)
  where status in ('pending', 'failed') and attempt_count < 10;

create or replace function public.normalize_billing_credit_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_anchor timestamptz;
  resolved_period_end timestamptz;
  resolved_period_start timestamptz;
  should_reset boolean;
begin
  if tg_op = 'INSERT' then
    select coalesce(
      subscription.current_period_start,
      subscription.last_event_at,
      now()
    )
    into resolved_anchor
    from public.billing_subscriptions as subscription
    where subscription.dodo_subscription_id = new.dodo_subscription_id;

    new.credit_cycle_anchor := coalesce(
      resolved_anchor,
      new.credit_cycle_anchor,
      now()
    );
    should_reset := true;
  elsif new.dodo_subscription_id is distinct from old.dodo_subscription_id then
    select coalesce(
      subscription.current_period_start,
      subscription.last_event_at,
      now()
    )
    into resolved_anchor
    from public.billing_subscriptions as subscription
    where subscription.dodo_subscription_id = new.dodo_subscription_id;

    new.credit_cycle_anchor := coalesce(resolved_anchor, now());
    should_reset := true;
  else
    new.credit_cycle_anchor := old.credit_cycle_anchor;
    should_reset := old.period_end <= now();
  end if;

  if should_reset then
    select cycle.period_start, cycle.period_end
    into resolved_period_start, resolved_period_end
    from public.resolve_billing_credit_cycle(new.credit_cycle_anchor, now()) as cycle;

    new.period_start := resolved_period_start;
    new.period_end := resolved_period_end;
    new.used_credits := 0;
    new.reserved_credits := 0;
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_billing_credit_cycle_trigger
  on public.billing_credit_balances;
create trigger normalize_billing_credit_cycle_trigger
before insert or update on public.billing_credit_balances
for each row execute function public.normalize_billing_credit_cycle();

revoke all on function public.normalize_billing_credit_cycle()
  from public, anon, authenticated;

create or replace function public.refresh_billing_credit_balance(p_user_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  refreshed boolean := false;
begin
  if p_user_id is null or char_length(trim(p_user_id)) = 0 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('billing-credits:' || p_user_id, 0));

  update public.billing_credit_balances
  set updated_at = now()
  where user_id = p_user_id and period_end <= now();

  refreshed := found;
  return refreshed;
end;
$$;

revoke all on function public.refresh_billing_credit_balance(text)
  from public, anon, authenticated;
grant execute on function public.refresh_billing_credit_balance(text)
  to service_role;

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

  update public.billing_credit_reservations
  set
    background_job_id = coalesce(p_background_job_id, background_job_id),
    status = case when p_commit then 'committed' else 'released' end,
    settled_at = now(),
    updated_at = now()
  where id = reservation.id;

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
$$;

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
