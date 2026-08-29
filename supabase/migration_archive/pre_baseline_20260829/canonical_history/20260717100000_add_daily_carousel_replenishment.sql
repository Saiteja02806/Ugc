alter table public.business_profiles
  add column if not exists trending_timezone text;

update public.business_profiles as profile
set trending_timezone = latest_feed.timezone
from (
  select distinct on (user_id)
    user_id,
    timezone
  from public.daily_carousel_feeds
  order by user_id, created_at desc, id desc
) as latest_feed
where
  profile.user_id = latest_feed.user_id
  and profile.trending_timezone is null;

alter table public.carousel_generations
  add column if not exists origin_daily_feed_id uuid
    references public.daily_carousel_feeds(id) on delete restrict,
  add column if not exists available_on_local_date date;

alter table public.carousel_generations
  drop constraint if exists carousel_generations_daily_origin_check;

alter table public.carousel_generations
  add constraint carousel_generations_daily_origin_check
  check (
    (origin_daily_feed_id is null and available_on_local_date is null)
    or
    (origin_daily_feed_id is not null and available_on_local_date is not null)
  );

drop index if exists public.carousel_generations_profile_version_candidate_idx;

create unique index if not exists carousel_generations_initial_profile_candidate_uidx
  on public.carousel_generations (
    business_profile_id,
    business_profile_version,
    candidate_index
  )
  where
    business_profile_id is not null
    and business_profile_version is not null
    and origin_daily_feed_id is null;

drop index if exists public.carousel_generations_batch_candidate_idx;

create unique index if not exists carousel_generations_batch_candidate_uidx
  on public.carousel_generations (generation_batch_id, candidate_index);

create index if not exists carousel_generations_daily_availability_idx
  on public.carousel_generations (
    user_id,
    business_profile_id,
    business_profile_version,
    available_on_local_date,
    status,
    updated_at desc
  )
  where origin_daily_feed_id is not null;

create table if not exists public.daily_carousel_refill_batches (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null
    references public.daily_carousel_feeds(id) on delete restrict,
  user_id text not null,
  business_profile_id uuid not null
    references public.business_profiles(id) on delete restrict,
  business_profile_version int not null check (business_profile_version > 0),
  local_date date not null,
  generation_batch_id uuid not null unique default gen_random_uuid(),
  requested_count int not null default 0
    check (requested_count between 0 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (feed_id, business_profile_id, business_profile_version)
);

create index if not exists daily_carousel_refill_batches_profile_date_idx
  on public.daily_carousel_refill_batches (
    user_id,
    business_profile_id,
    business_profile_version,
    local_date desc
  );

alter table public.daily_carousel_refill_batches enable row level security;

revoke all privileges on table public.daily_carousel_refill_batches
  from anon, authenticated;

revoke all privileges on table public.daily_carousel_refill_batches
  from service_role;

grant select, insert, update on table public.daily_carousel_refill_batches
  to service_role;

alter table public.background_jobs
  add column if not exists idempotency_key text,
  add column if not exists last_delivery_at timestamptz;

update public.background_jobs as job
set idempotency_key = 'carousel-generation:' || generation.id::text
from public.carousel_generations as generation
where
  generation.trigger_run_id = job.id::text
  and job.job_type = 'generate_carousel'
  and job.idempotency_key is null;

create unique index if not exists background_jobs_idempotency_key_uidx
  on public.background_jobs (idempotency_key)
  where idempotency_key is not null;

create or replace function public.insert_daily_carousel_feed_items_if_profile_current(
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version int,
  p_items jsonb
)
returns setof public.daily_carousel_feed_items
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_item_count int;
begin
  if
    p_user_id is null
    or length(trim(p_user_id)) = 0
    or p_business_profile_id is null
    or p_business_profile_version is null
    or p_business_profile_version <= 0
    or p_items is null
    or jsonb_typeof(p_items) <> 'array'
  then
    raise exception 'invalid_daily_carousel_feed_items_request';
  end if;

  select jsonb_array_length(p_items) into v_item_count;

  if v_item_count = 0 then
    return;
  end if;

  if v_item_count > 50 then
    raise exception 'too_many_daily_carousel_feed_items';
  end if;

  perform 1
  from public.business_profiles as profile
  where
    profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.profile_version = p_business_profile_version
  for share;

  if not found then
    raise exception 'business_profile_version_changed';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(
      assignment_id uuid,
      carried_from_date date,
      feed_id uuid,
      position int,
      source text
    )
    left join public.daily_carousel_feeds as feed
      on feed.id = item.feed_id
    left join public.user_carousel_assignments as assignment
      on assignment.id = item.assignment_id
    where
      feed.id is null
      or feed.user_id is distinct from p_user_id
      or assignment.id is null
      or assignment.user_id is distinct from p_user_id
      or assignment.business_profile_id is distinct from p_business_profile_id
      or assignment.business_profile_version is distinct from p_business_profile_version
      or item.position is null
      or item.position <= 0
      or item.source not in ('new', 'carried')
  ) then
    raise exception 'daily_carousel_feed_item_ownership_mismatch';
  end if;

  return query
  insert into public.daily_carousel_feed_items (
    assignment_id,
    carried_from_date,
    feed_id,
    position,
    source
  )
  select
    item.assignment_id,
    item.carried_from_date,
    item.feed_id,
    item.position,
    item.source
  from jsonb_to_recordset(p_items) as item(
    assignment_id uuid,
    carried_from_date date,
    feed_id uuid,
    position int,
    source text
  )
  returning *;
end;
$$;

revoke all on function public.insert_daily_carousel_feed_items_if_profile_current(
  text,
  uuid,
  int,
  jsonb
) from public, anon, authenticated;

grant execute on function public.insert_daily_carousel_feed_items_if_profile_current(
  text,
  uuid,
  int,
  jsonb
) to service_role;

create or replace function public.assert_business_profile_version_current(
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version int
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if
    p_user_id is null
    or length(trim(p_user_id)) = 0
    or p_business_profile_id is null
    or p_business_profile_version is null
    or p_business_profile_version <= 0
  then
    raise exception 'invalid_business_profile_version_request';
  end if;

  perform 1
  from public.business_profiles as profile
  where
    profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.profile_version = p_business_profile_version
  for share;

  if not found then
    raise exception 'business_profile_version_changed';
  end if;
end;
$$;

create or replace function public.reserve_daily_carousel_refill_batch_if_profile_current(
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version int,
  p_feed_id uuid,
  p_requested_count int
)
returns public.daily_carousel_refill_batches
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_batch public.daily_carousel_refill_batches%rowtype;
  v_feed_local_date date;
  v_now timestamptz := clock_timestamp();
begin
  if
    p_feed_id is null
    or p_requested_count is null
    or p_requested_count < 0
    or p_requested_count > 50
  then
    raise exception 'invalid_daily_carousel_refill_request';
  end if;

  perform public.assert_business_profile_version_current(
    p_user_id,
    p_business_profile_id,
    p_business_profile_version
  );

  select feed.local_date
  into v_feed_local_date
  from public.daily_carousel_feeds as feed
  where
    feed.id = p_feed_id
    and feed.user_id = p_user_id
  for share;

  if not found then
    raise exception 'daily_carousel_refill_feed_mismatch';
  end if;

  insert into public.daily_carousel_refill_batches (
    business_profile_id,
    business_profile_version,
    feed_id,
    local_date,
    requested_count,
    user_id
  )
  values (
    p_business_profile_id,
    p_business_profile_version,
    p_feed_id,
    v_feed_local_date,
    p_requested_count,
    p_user_id
  )
  on conflict (feed_id, business_profile_id, business_profile_version)
  do update
  set
    requested_count = greatest(
      public.daily_carousel_refill_batches.requested_count,
      excluded.requested_count
    ),
    updated_at = case
      when excluded.requested_count > public.daily_carousel_refill_batches.requested_count
        then v_now
      else public.daily_carousel_refill_batches.updated_at
    end
  where
    public.daily_carousel_refill_batches.user_id = p_user_id
    and public.daily_carousel_refill_batches.local_date = v_feed_local_date
  returning *
  into v_batch;

  if not found then
    raise exception 'daily_carousel_refill_ownership_mismatch';
  end if;

  return v_batch;
end;
$$;

revoke all on function public.assert_business_profile_version_current(
  text,
  uuid,
  int
) from public, anon, authenticated, service_role;

revoke all on function public.reserve_daily_carousel_refill_batch_if_profile_current(
  text,
  uuid,
  int,
  uuid,
  int
) from public, anon, authenticated, service_role;

grant execute on function public.assert_business_profile_version_current(
  text,
  uuid,
  int
) to service_role;

grant execute on function public.reserve_daily_carousel_refill_batch_if_profile_current(
  text,
  uuid,
  int,
  uuid,
  int
) to service_role;

create table if not exists public.daily_carousel_replenishment_sweep_state (
  singleton boolean primary key default true check (singleton),
  cycle_id text,
  cursor uuid,
  status text not null default 'completed'
    check (status in ('active', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),

  check (
    cycle_id is null
    or cycle_id ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
  ),
  check (
    status <> 'active'
    or (cycle_id is not null and started_at is not null and completed_at is null)
  )
);

alter table public.daily_carousel_replenishment_sweep_state
  enable row level security;

revoke all privileges on table public.daily_carousel_replenishment_sweep_state
  from public, anon, authenticated, service_role;

create or replace function public.claim_daily_carousel_replenishment_cycle(
  p_requested_cycle_id text
)
returns table (
  cycle_id text,
  cursor uuid,
  status text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cycle_id text;
  v_cursor uuid;
  v_requested_cycle_at timestamptz;
  v_status text;
  v_now timestamptz := clock_timestamp();
begin
  if
    p_requested_cycle_id is null
    or p_requested_cycle_id !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
  then
    raise exception 'invalid_daily_carousel_replenishment_cycle_id';
  end if;

  begin
    v_requested_cycle_at := p_requested_cycle_id::timestamptz;
  exception
    when datetime_field_overflow or invalid_datetime_format then
      raise exception 'invalid_daily_carousel_replenishment_cycle_id';
  end;

  insert into public.daily_carousel_replenishment_sweep_state (
    singleton,
    status,
    updated_at
  )
  values (true, 'completed', v_now)
  on conflict (singleton) do nothing;

  select
    state.cycle_id,
    state.cursor,
    state.status
  into
    v_cycle_id,
    v_cursor,
    v_status
  from public.daily_carousel_replenishment_sweep_state as state
  where state.singleton = true
  for update;

  if v_status = 'active' then
    return query select v_cycle_id, v_cursor, v_status;
    return;
  end if;

  if
    v_cycle_id is not null
    and v_requested_cycle_at <= v_cycle_id::timestamptz
  then
    return query select v_cycle_id, v_cursor, v_status;
    return;
  end if;

  update public.daily_carousel_replenishment_sweep_state as state
  set
    cycle_id = p_requested_cycle_id,
    cursor = null,
    status = 'active',
    started_at = v_now,
    completed_at = null,
    updated_at = v_now
  where state.singleton = true
  returning
    state.cycle_id,
    state.cursor,
    state.status
  into
    v_cycle_id,
    v_cursor,
    v_status;

  return query select v_cycle_id, v_cursor, v_status;
end;
$$;

create or replace function public.advance_daily_carousel_replenishment_cycle(
  p_cycle_id text,
  p_expected_cursor uuid,
  p_next_cursor uuid,
  p_completed boolean
)
returns table (
  cycle_id text,
  cursor uuid,
  status text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cycle_id text;
  v_cursor uuid;
  v_status text;
  v_now timestamptz := clock_timestamp();
begin
  if
    p_cycle_id is null
    or length(p_cycle_id) = 0
    or length(p_cycle_id) > 128
    or p_completed is null
    or (not p_completed and p_next_cursor is null)
    or (
      p_expected_cursor is not null
      and p_next_cursor is not null
      and p_next_cursor <= p_expected_cursor
    )
  then
    raise exception 'invalid_daily_carousel_replenishment_advance';
  end if;

  select
    state.cycle_id,
    state.cursor,
    state.status
  into
    v_cycle_id,
    v_cursor,
    v_status
  from public.daily_carousel_replenishment_sweep_state as state
  where state.singleton = true
  for update;

  if
    v_status is distinct from 'active'
    or v_cycle_id is distinct from p_cycle_id
    or v_cursor is distinct from p_expected_cursor
  then
    raise exception 'daily_carousel_replenishment_sweep_cursor_changed';
  end if;

  update public.daily_carousel_replenishment_sweep_state as state
  set
    cursor = coalesce(p_next_cursor, state.cursor),
    status = case when p_completed then 'completed' else 'active' end,
    completed_at = case when p_completed then v_now else null end,
    updated_at = v_now
  where state.singleton = true
  returning
    state.cycle_id,
    state.cursor,
    state.status
  into
    v_cycle_id,
    v_cursor,
    v_status;

  return query select v_cycle_id, v_cursor, v_status;
end;
$$;

revoke all on function public.claim_daily_carousel_replenishment_cycle(text)
  from public, anon, authenticated;

revoke all on function public.advance_daily_carousel_replenishment_cycle(
  text,
  uuid,
  uuid,
  boolean
) from public, anon, authenticated;

grant execute on function public.claim_daily_carousel_replenishment_cycle(text)
  to service_role;

grant execute on function public.advance_daily_carousel_replenishment_cycle(
  text,
  uuid,
  uuid,
  boolean
) to service_role;

select pg_notify('pgrst', 'reload schema');
