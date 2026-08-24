create table if not exists public.carousel_content_plan_reservations (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id text not null
    check (char_length(trim(user_id)) between 1 and 240),
  reservation_key text not null
    check (char_length(trim(reservation_key)) between 1 and 240),
  requested_count integer not null
    check (requested_count between 1 and 150),
  consumed_count integer not null default 0
    check (consumed_count >= 0 and consumed_count <= requested_count),
  status text not null default 'active'
    check (
      status in (
        'active',
        'completed',
        'released',
        'released_partial',
        'expired',
        'expired_partial'
      )
    ),
  expires_at timestamptz not null,
  completed_at timestamptz,
  released_at timestamptz,
  release_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  foreign key (plan_id, user_id)
    references public.carousel_content_plans (id, user_id)
    on delete cascade,
  unique (user_id, reservation_key),
  check (expires_at > created_at),
  check (
    (
      status = 'active'
      and completed_at is null
      and released_at is null
      and release_reason is null
    )
    or
    (
      status = 'completed'
      and consumed_count = requested_count
      and completed_at is not null
      and released_at is null
      and release_reason is null
    )
    or
    (
      status in ('released', 'released_partial', 'expired', 'expired_partial')
      and completed_at is null
      and released_at is not null
      and nullif(trim(coalesce(release_reason, '')), '') is not null
    )
  ),
  check (
    (status in ('released', 'expired') and consumed_count = 0)
    or (status in ('released_partial', 'expired_partial') and consumed_count > 0)
    or status in ('active', 'completed')
  )
);

alter table public.carousel_content_plan_items
  add constraint carousel_content_plan_items_reservation_fk
  foreign key (reservation_token)
  references public.carousel_content_plan_reservations(id)
  on delete restrict
  deferrable initially deferred;

create index if not exists carousel_content_plan_reservations_plan_status_idx
  on public.carousel_content_plan_reservations (plan_id, status, expires_at);

create index if not exists carousel_content_plan_reservations_expiry_idx
  on public.carousel_content_plan_reservations (expires_at, plan_id)
  where status = 'active';

alter table public.carousel_content_plan_reservations enable row level security;

revoke all privileges on table public.carousel_content_plan_reservations
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.carousel_content_plan_reservations
  to service_role;

create or replace function public.activate_carousel_content_plan(
  p_user_id text,
  p_plan_id uuid
)
returns public.carousel_content_plans
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item_count integer;
  v_minimum_day_count integer;
  v_now timestamptz := timezone('utc', now());
  v_plan public.carousel_content_plans%rowtype;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_plan_id is null then
    raise exception 'carousel_content_plan_activation_input_invalid';
  end if;

  select plan.*
  into v_plan
  from public.carousel_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id;

  if not found then
    raise exception 'carousel_content_plan_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'carousel-content-plan:' || p_user_id || ':' || v_plan.business_profile_id::text,
      641902731
    )
  );

  select plan.*
  into v_plan
  from public.carousel_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
  for update;

  if v_plan.status = 'active' then
    return v_plan;
  end if;

  if v_plan.status <> 'generating' then
    raise exception 'carousel_content_plan_not_activatable';
  end if;

  perform 1
  from public.business_profiles as profile
  where profile.id = v_plan.business_profile_id
    and profile.user_id = p_user_id
    and profile.project_id = v_plan.project_id
    and profile.profile_version = v_plan.business_profile_version
  for share;

  if not found then
    raise exception 'business_profile_version_changed';
  end if;

  if timezone(v_plan.timezone, v_now)::date
       not between v_plan.period_start_date and v_plan.period_end_date then
    raise exception 'carousel_content_plan_period_not_current';
  end if;

  select count(*)::integer
  into v_item_count
  from public.carousel_content_plan_items as item
  where item.plan_id = v_plan.id
    and item.user_id = p_user_id
    and item.status = 'planned';

  select min(day_items.item_count)::integer
  into v_minimum_day_count
  from (
    select item.day_number, count(*)::integer as item_count
    from public.carousel_content_plan_items as item
    where item.plan_id = v_plan.id
      and item.user_id = p_user_id
      and item.status = 'planned'
    group by item.day_number
  ) as day_items;

  if v_item_count < v_plan.target_item_count
     or (
       select count(distinct item.day_number)
       from public.carousel_content_plan_items as item
       where item.plan_id = v_plan.id
         and item.user_id = p_user_id
         and item.status = 'planned'
     ) <> 30
     or coalesce(v_minimum_day_count, 0) < 5 then
    raise exception 'carousel_content_plan_incomplete';
  end if;

  update public.carousel_content_plans as prior_plan
  set
    status = 'superseded',
    superseded_at = v_now,
    superseded_by_plan_id = v_plan.id,
    updated_at = v_now
  where prior_plan.user_id = p_user_id
    and prior_plan.business_profile_id = v_plan.business_profile_id
    and prior_plan.id <> v_plan.id
    and prior_plan.status = 'active';

  update public.carousel_content_plan_items as item
  set
    status = 'available',
    updated_at = v_now
  where item.plan_id = v_plan.id
    and item.user_id = p_user_id
    and item.status = 'planned';

  update public.carousel_content_plans as plan
  set
    status = 'active',
    activated_at = v_now,
    updated_at = v_now
  where plan.id = v_plan.id
  returning plan.* into v_plan;

  return v_plan;
end;
$$;

create or replace function public.reserve_carousel_content_plan_items(
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_requested_count integer,
  p_reservation_key text,
  p_reservation_ttl_seconds integer
)
returns setof public.carousel_content_plan_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_available_ids uuid[];
  v_existing public.carousel_content_plan_reservations%rowtype;
  v_existing_item_count integer;
  v_now timestamptz := timezone('utc', now());
  v_plan public.carousel_content_plans%rowtype;
  v_reserved_count integer;
  v_reservation_id uuid := gen_random_uuid();
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_business_profile_id is null
     or p_business_profile_version is null
     or p_business_profile_version <= 0
     or p_requested_count is null
     or p_requested_count not between 1 and 150
     or nullif(trim(coalesce(p_reservation_key, '')), '') is null
     or char_length(trim(p_reservation_key)) > 240
     or p_reservation_ttl_seconds is null
     or p_reservation_ttl_seconds not between 900 and 86400 then
    raise exception 'carousel_content_plan_reservation_input_invalid';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'carousel-content-plan:' || p_user_id || ':' || p_business_profile_id::text,
      641902731
    )
  );

  select reservation.*
  into v_existing
  from public.carousel_content_plan_reservations as reservation
  where reservation.user_id = p_user_id
    and reservation.reservation_key = trim(p_reservation_key)
  for update;

  if found then
    if v_existing.status = 'active' and v_existing.expires_at <= v_now then
      raise exception 'carousel_content_plan_reservation_expired';
    end if;

    select count(*)::integer
    into v_existing_item_count
    from public.carousel_content_plan_items as item
    join public.carousel_content_plans as plan
      on plan.id = item.plan_id
    where item.reservation_token = v_existing.id
      and item.user_id = p_user_id
      and plan.business_profile_id = p_business_profile_id
      and plan.business_profile_version = p_business_profile_version
      and item.status in ('reserved', 'consumed');

    if v_existing.requested_count <> p_requested_count
       or v_existing_item_count <> p_requested_count
       or v_existing.status not in ('active', 'completed') then
      raise exception 'carousel_content_plan_reservation_idempotency_conflict';
    end if;

    return query
    select item.*
    from public.carousel_content_plan_items as item
    where item.reservation_token = v_existing.id
      and item.user_id = p_user_id
    order by item.sequence_index;
    return;
  end if;

  perform 1
  from public.business_profiles as profile
  where profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.profile_version = p_business_profile_version
  for share;

  if not found then
    raise exception 'business_profile_version_changed';
  end if;

  select plan.*
  into v_plan
  from public.carousel_content_plans as plan
  where plan.user_id = p_user_id
    and plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.status = 'active'
    and timezone(plan.timezone, v_now)::date
      between plan.period_start_date and plan.period_end_date
  order by plan.period_start_date desc, plan.plan_version desc
  limit 1
  for update;

  if not found then
    raise exception 'active_carousel_content_plan_not_found';
  end if;

  update public.carousel_content_plan_items as item
  set
    status = 'available',
    reservation_token = null,
    reservation_key = null,
    reserved_by_job_id = null,
    reserved_at = null,
    reservation_expires_at = null,
    updated_at = v_now
  where item.plan_id = v_plan.id
    and item.user_id = p_user_id
    and item.status = 'reserved'
    and item.reservation_token in (
      select reservation.id
      from public.carousel_content_plan_reservations as reservation
      where reservation.plan_id = v_plan.id
        and reservation.user_id = p_user_id
        and reservation.status = 'active'
        and reservation.expires_at <= v_now
    );

  update public.carousel_content_plan_reservations as reservation
  set
    status = case
      when reservation.consumed_count > 0 then 'expired_partial'
      else 'expired'
    end,
    released_at = v_now,
    release_reason = 'reservation_expired',
    updated_at = v_now
  where reservation.plan_id = v_plan.id
    and reservation.user_id = p_user_id
    and reservation.status = 'active'
    and reservation.expires_at <= v_now;

  select array_agg(available.id order by available.sequence_index)
  into v_available_ids
  from (
    select item.id, item.sequence_index
    from public.carousel_content_plan_items as item
    where item.plan_id = v_plan.id
      and item.user_id = p_user_id
      and item.status = 'available'
    order by item.sequence_index
    limit p_requested_count
    for update skip locked
  ) as available;

  if coalesce(array_length(v_available_ids, 1), 0) <> p_requested_count then
    raise exception 'carousel_content_plan_insufficient_items';
  end if;

  insert into public.carousel_content_plan_reservations (
    id,
    plan_id,
    user_id,
    reservation_key,
    requested_count,
    expires_at
  ) values (
    v_reservation_id,
    v_plan.id,
    p_user_id,
    trim(p_reservation_key),
    p_requested_count,
    v_now + make_interval(secs => p_reservation_ttl_seconds)
  );

  update public.carousel_content_plan_items as item
  set
    status = 'reserved',
    reservation_token = v_reservation_id,
    reservation_key = trim(p_reservation_key),
    reserved_at = v_now,
    reservation_expires_at = v_now + make_interval(secs => p_reservation_ttl_seconds),
    updated_at = v_now
  where item.id = any(v_available_ids)
    and item.plan_id = v_plan.id
    and item.user_id = p_user_id
    and item.status = 'available';

  get diagnostics v_reserved_count = row_count;

  if v_reserved_count <> p_requested_count then
    raise exception 'carousel_content_plan_reservation_race';
  end if;

  return query
  select item.*
  from public.carousel_content_plan_items as item
  where item.reservation_token = v_reservation_id
    and item.user_id = p_user_id
  order by item.sequence_index;
end;
$$;

create or replace function public.attach_carousel_content_plan_items_to_job(
  p_user_id text,
  p_reservation_token uuid,
  p_plan_item_ids uuid[],
  p_job_id uuid
)
returns setof public.carousel_content_plan_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected_count integer;
  v_now timestamptz := timezone('utc', now());
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_reservation_token is null
     or p_plan_item_ids is null
     or coalesce(array_length(p_plan_item_ids, 1), 0) not between 1 and 5
     or p_job_id is null then
    raise exception 'carousel_content_plan_job_attachment_input_invalid';
  end if;

  select count(distinct item_id)::integer
  into v_expected_count
  from unnest(p_plan_item_ids) as item_id;

  if v_expected_count <> array_length(p_plan_item_ids, 1)
     or not exists (
       select 1
       from public.background_jobs as job
       where job.id = p_job_id
         and job.user_id = p_user_id
         and job.job_type = 'generate_carousel'
     ) then
    raise exception 'carousel_content_plan_job_attachment_invalid';
  end if;

  perform 1
  from public.carousel_content_plan_reservations as reservation
  where reservation.id = p_reservation_token
    and reservation.user_id = p_user_id
    and reservation.status = 'active'
    and reservation.expires_at > v_now
  for update;

  if not found then
    raise exception 'carousel_content_plan_reservation_not_active';
  end if;

  if (
    select count(*)
    from public.carousel_content_plan_items as item
    where item.id = any(p_plan_item_ids)
      and item.user_id = p_user_id
      and item.reservation_token = p_reservation_token
      and item.status = 'reserved'
      and (item.reserved_by_job_id is null or item.reserved_by_job_id = p_job_id)
  ) <> v_expected_count then
    raise exception 'carousel_content_plan_job_attachment_mismatch';
  end if;

  update public.carousel_content_plan_items as item
  set
    reserved_by_job_id = p_job_id,
    updated_at = v_now
  where item.id = any(p_plan_item_ids)
    and item.user_id = p_user_id
    and item.reservation_token = p_reservation_token
    and item.status = 'reserved';

  return query
  select item.*
  from public.carousel_content_plan_items as item
  where item.id = any(p_plan_item_ids)
    and item.user_id = p_user_id
  order by item.sequence_index;
end;
$$;

create or replace function public.release_carousel_content_plan_reservation(
  p_user_id text,
  p_reservation_key text,
  p_release_reason text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_released_count integer;
  v_reservation public.carousel_content_plan_reservations%rowtype;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or nullif(trim(coalesce(p_reservation_key, '')), '') is null
     or nullif(trim(coalesce(p_release_reason, '')), '') is null then
    raise exception 'carousel_content_plan_release_input_invalid';
  end if;

  select reservation.*
  into v_reservation
  from public.carousel_content_plan_reservations as reservation
  where reservation.user_id = p_user_id
    and reservation.reservation_key = trim(p_reservation_key)
  for update;

  if not found then
    return 0;
  end if;

  if v_reservation.status in (
    'released',
    'released_partial',
    'expired',
    'expired_partial'
  ) then
    return 0;
  end if;

  if v_reservation.status = 'completed' then
    raise exception 'carousel_content_plan_reservation_already_consumed';
  end if;

  update public.carousel_content_plan_items as item
  set
    status = 'available',
    reservation_token = null,
    reservation_key = null,
    reserved_by_job_id = null,
    reserved_at = null,
    reservation_expires_at = null,
    updated_at = v_now
  where item.user_id = p_user_id
    and item.reservation_token = v_reservation.id
    and item.status = 'reserved';

  get diagnostics v_released_count = row_count;

  update public.carousel_content_plan_reservations as reservation
  set
    status = case
      when reservation.consumed_count > 0 then 'released_partial'
      else 'released'
    end,
    released_at = v_now,
    release_reason = left(trim(p_release_reason), 1000),
    updated_at = v_now
  where reservation.id = v_reservation.id;

  return v_released_count;
end;
$$;

create or replace function public.consume_carousel_content_plan_item(
  p_user_id text,
  p_plan_item_id uuid,
  p_reservation_token uuid,
  p_carousel_generation_id uuid
)
returns public.carousel_content_plan_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.carousel_content_plan_items%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_reservation public.carousel_content_plan_reservations%rowtype;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_plan_item_id is null
     or p_reservation_token is null
     or p_carousel_generation_id is null then
    raise exception 'carousel_content_plan_consumption_input_invalid';
  end if;

  select item.*
  into v_item
  from public.carousel_content_plan_items as item
  where item.id = p_plan_item_id
    and item.user_id = p_user_id
  for update;

  if not found then
    raise exception 'carousel_content_plan_item_not_found';
  end if;

  if v_item.status = 'consumed'
     and v_item.reservation_token = p_reservation_token
     and v_item.consumed_by_carousel_generation_id = p_carousel_generation_id then
    return v_item;
  end if;

  if v_item.status <> 'reserved'
     or v_item.reservation_token is distinct from p_reservation_token then
    raise exception 'carousel_content_plan_item_not_reserved';
  end if;

  perform 1
  from public.carousel_generations as generation
  join public.carousel_content_plans as plan
    on plan.id = v_item.plan_id
  where generation.id = p_carousel_generation_id
    and generation.user_id = p_user_id
    and generation.content_plan_id = v_item.plan_id
    and generation.content_plan_item_id = v_item.id
    and generation.content_plan_reservation_id = p_reservation_token
    and generation.business_profile_id = plan.business_profile_id
    and generation.business_profile_version = plan.business_profile_version
    and generation.status = 'completed'
  for share of generation;

  if not found then
    raise exception 'carousel_content_plan_generation_not_completed';
  end if;

  select reservation.*
  into v_reservation
  from public.carousel_content_plan_reservations as reservation
  where reservation.id = p_reservation_token
    and reservation.user_id = p_user_id
    and reservation.status = 'active'
  for update;

  if not found then
    raise exception 'carousel_content_plan_reservation_not_active';
  end if;

  update public.carousel_content_plan_items as item
  set
    status = 'consumed',
    consumed_by_carousel_generation_id = p_carousel_generation_id,
    consumed_at = v_now,
    updated_at = v_now
  where item.id = p_plan_item_id
  returning item.* into v_item;

  update public.carousel_content_plan_reservations as reservation
  set
    consumed_count = reservation.consumed_count + 1,
    status = case
      when reservation.consumed_count + 1 = reservation.requested_count
        then 'completed'
      else 'active'
    end,
    completed_at = case
      when reservation.consumed_count + 1 = reservation.requested_count
        then v_now
      else null
    end,
    updated_at = v_now
  where reservation.id = p_reservation_token;

  update public.carousel_content_plans as plan
  set
    status = 'exhausted',
    exhausted_at = v_now,
    updated_at = v_now
  where plan.id = v_item.plan_id
    and plan.status = 'active'
    and not exists (
      select 1
      from public.carousel_content_plan_items as remaining
      where remaining.plan_id = plan.id
        and remaining.status in ('planned', 'available', 'reserved')
    );

  return v_item;
end;
$$;

revoke all on function public.activate_carousel_content_plan(text, uuid)
  from public, anon, authenticated;
revoke all on function public.reserve_carousel_content_plan_items(
  text,
  uuid,
  integer,
  integer,
  text,
  integer
) from public, anon, authenticated;
revoke all on function public.attach_carousel_content_plan_items_to_job(
  text,
  uuid,
  uuid[],
  uuid
) from public, anon, authenticated;
revoke all on function public.release_carousel_content_plan_reservation(
  text,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.consume_carousel_content_plan_item(
  text,
  uuid,
  uuid,
  uuid
) from public, anon, authenticated;

grant execute on function public.activate_carousel_content_plan(text, uuid)
  to service_role;
grant execute on function public.reserve_carousel_content_plan_items(
  text,
  uuid,
  integer,
  integer,
  text,
  integer
) to service_role;
grant execute on function public.attach_carousel_content_plan_items_to_job(
  text,
  uuid,
  uuid[],
  uuid
) to service_role;
grant execute on function public.release_carousel_content_plan_reservation(
  text,
  text,
  text
) to service_role;
grant execute on function public.consume_carousel_content_plan_item(
  text,
  uuid,
  uuid,
  uuid
) to service_role;

comment on table public.carousel_content_plan_reservations is
  'Idempotent reservation ledger for arbitrary Carousel content-plan requests. One reservation may be partitioned into writer jobs of at most five items.';
comment on function public.activate_carousel_content_plan(text, uuid) is
  'Activates a current 30-day plan only after at least 150 planned items exist, all 30 organizational days exist, and every day starts with at least five items.';
comment on function public.reserve_carousel_content_plan_items(
  text,
  uuid,
  integer,
  integer,
  text,
  integer
) is
  'Atomically and idempotently reserves an arbitrary requested count from the current shared pool. Day numbers do not limit selection.';

select pg_notify('pgrst', 'reload schema');
