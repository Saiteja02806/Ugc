-- A preparation retry uses the same durable experiment-batch ID and therefore
-- the same reservation key. A released or expired reservation that never
-- consumed an item is safe to reopen; a partially consumed reservation is not.
CREATE OR REPLACE FUNCTION public.reserve_carousel_content_plan_items (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_requested_count          integer,
  p_reservation_key          text,
  p_reservation_ttl_seconds  integer
)
  RETURNS SETOF public.carousel_content_plan_items
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_available_ids uuid[];
  v_existing public.carousel_content_plan_reservations%rowtype;
  v_existing_generation_item_ids uuid[];
  v_existing_item_count integer;
  v_expected_reopen_item_count integer := 0;
  v_now timestamptz := timezone('utc', now());
  v_plan public.carousel_content_plans%rowtype;
  v_reopen_existing_reservation boolean := false;
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
    -- An active lease can expire before the writer starts. Release only an
    -- entirely unconsumed lease; consumed provenance must never be recycled.
    if v_existing.status = 'active' and v_existing.expires_at <= v_now then
      if v_existing.consumed_count <> 0 then
        raise exception 'carousel_content_plan_reservation_idempotency_conflict';
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
        and item.reservation_token = v_existing.id
        and item.status = 'reserved';

      update public.carousel_content_plan_reservations as reservation
      set
        status = 'expired',
        released_at = v_now,
        release_reason = 'reservation_expired',
        updated_at = v_now
      where reservation.id = v_existing.id;

      v_existing.status := 'expired';
    end if;

    if v_existing.status in ('active', 'completed') then
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
         or v_existing_item_count <> p_requested_count then
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

    if v_existing.status not in ('released', 'expired')
       or v_existing.consumed_count <> 0
       or v_existing.requested_count <> p_requested_count then
      raise exception 'carousel_content_plan_reservation_idempotency_conflict';
    end if;

    v_reservation_id := v_existing.id;
    v_reopen_existing_reservation := true;
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

  -- Existing generation rows keep a composite FK to this reservation's plan.
  -- Reopen only within that exact immutable plan provenance.
  if v_reopen_existing_reservation and v_existing.plan_id <> v_plan.id then
    raise exception 'carousel_content_plan_reservation_idempotency_conflict';
  end if;

  if v_reopen_existing_reservation then
    -- Generation rows can survive a pre-dispatch release. Reopening the
    -- reservation must re-lease their exact item provenance, never substitute
    -- different first-available ideas for those durable generation records.
    -- A durable writer job is a different recovery path: never revive a
    -- reservation after it has been attached to a worker job.
    if exists (
      select 1
      from public.carousel_generations as generation
      where generation.content_plan_reservation_id = v_existing.id
        and generation.user_id = p_user_id
        and (
          generation.status = 'completed'
          or generation.trigger_run_id is not null
        )
    ) then
      raise exception 'carousel_content_plan_reservation_idempotency_conflict';
    end if;

    select coalesce(array_agg(previous_item.item_id), '{}'::uuid[])
    into v_existing_generation_item_ids
    from (
      select distinct generation.content_plan_item_id as item_id
      from public.carousel_generations as generation
      where generation.content_plan_reservation_id = v_existing.id
        and generation.user_id = p_user_id
        and generation.content_plan_item_id is not null
    ) as previous_item;

    v_expected_reopen_item_count := coalesce(
      array_length(v_existing_generation_item_ids, 1),
      0
    );

    -- If some, but not all, generation records survived, the original
    -- unreferenced items are no longer recoverable after release. Do not
    -- silently substitute new ideas into those missing candidate slots:
    -- preserve all five original items or fail this stale batch safely.
    if v_expected_reopen_item_count not in (0, p_requested_count) then
      raise exception 'carousel_content_plan_reservation_idempotency_conflict';
    end if;

    select coalesce(array_agg(reusable.id order by reusable.sequence_index), '{}'::uuid[])
    into v_existing_generation_item_ids
    from (
      select item.id, item.sequence_index
      from public.carousel_content_plan_items as item
      where item.id = any(v_existing_generation_item_ids)
        and item.plan_id = v_plan.id
        and item.user_id = p_user_id
        and item.status = 'available'
      for update
    ) as reusable;

    if coalesce(array_length(v_existing_generation_item_ids, 1), 0)
       <> v_expected_reopen_item_count then
      raise exception 'carousel_content_plan_reservation_idempotency_conflict';
    end if;
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

  if v_reopen_existing_reservation
     and v_expected_reopen_item_count = p_requested_count then
    select array_agg(item.id order by item.sequence_index)
    into v_available_ids
    from public.carousel_content_plan_items as item
    where item.id = any(v_existing_generation_item_ids)
      and item.plan_id = v_plan.id
      and item.user_id = p_user_id
      and item.status = 'available';
  else
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
  end if;

  if coalesce(array_length(v_available_ids, 1), 0) <> p_requested_count then
    raise exception 'carousel_content_plan_insufficient_items';
  end if;

  if v_reopen_existing_reservation then
    update public.carousel_content_plan_reservations as reservation
    set
      status = 'active',
      consumed_count = 0,
      expires_at = v_now + make_interval(secs => p_reservation_ttl_seconds),
      completed_at = null,
      released_at = null,
      release_reason = null,
      updated_at = v_now
    where reservation.id = v_reservation_id;

    -- `fail_unqueued_carousel_preparation` correctly records an interrupted
    -- preparation as failed. Once the exact unconsumed reservation is safely
    -- reopened, return only those jobless rows to the normal dispatcher. The
    -- guards preserve any batch that was ever owned by a writer job.
    update public.carousel_generations as generation
    set
      status = 'processing',
      error_message = null,
      updated_at = v_now
    where generation.content_plan_reservation_id = v_reservation_id
      and generation.user_id = p_user_id
      and generation.status = 'failed'
      and generation.trigger_run_id is null;

    update public.carousel_experiment_assignments as assignment
    set
      status = 'reserved',
      updated_at = v_now
    where assignment.status = 'failed'
      and exists (
        select 1
        from public.carousel_generations as generation
        join public.carousel_experiment_batches as batch
          on batch.id = assignment.experiment_batch_id
        where generation.carousel_experiment_assignment_id = assignment.id
          and generation.content_plan_reservation_id = v_reservation_id
          and generation.user_id = p_user_id
          and generation.trigger_run_id is null
          and batch.planner_job_id is null
      );

    update public.carousel_experiment_batches as batch
    set
      status = 'reserved',
      updated_at = v_now
    where batch.status = 'failed'
      and batch.planner_job_id is null
      and exists (
        select 1
        from public.carousel_generations as generation
        where generation.carousel_experiment_batch_id = batch.id
          and generation.content_plan_reservation_id = v_reservation_id
          and generation.user_id = p_user_id
          and generation.trigger_run_id is null
      );
  else
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
  end if;

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
$function$;

GRANT EXECUTE ON FUNCTION public.reserve_carousel_content_plan_items(text, uuid, integer, integer, text, integer)
  TO postgres, service_role;

REVOKE ALL ON FUNCTION public.reserve_carousel_content_plan_items(text, uuid, integer, integer, text, integer)
  FROM PUBLIC;
