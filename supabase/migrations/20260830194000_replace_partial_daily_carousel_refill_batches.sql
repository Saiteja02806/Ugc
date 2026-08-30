-- A partial Carousel reservation cannot be replayed: its completed content-plan
-- items are already consumed and must retain their original generation batch.
-- Keep that historical refill row immutable and create a fresh replacement
-- batch for only the still-missing daily-feed slots.
ALTER TABLE public.daily_carousel_refill_batches
  ADD COLUMN IF NOT EXISTS replacement_sequence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by_batch_id uuid;

ALTER TABLE public.daily_carousel_refill_batches
  DROP CONSTRAINT IF EXISTS daily_carousel_refill_batches_feed_id_business_profile_id_b_key;

ALTER TABLE public.daily_carousel_refill_batches
  DROP CONSTRAINT IF EXISTS daily_carousel_refill_batches_replacement_sequence_check;

ALTER TABLE public.daily_carousel_refill_batches
  ADD CONSTRAINT daily_carousel_refill_batches_replacement_sequence_check
  CHECK (replacement_sequence >= 0);

ALTER TABLE public.daily_carousel_refill_batches
  DROP CONSTRAINT IF EXISTS daily_carousel_refill_batches_superseded_by_batch_id_fkey;

ALTER TABLE public.daily_carousel_refill_batches
  ADD CONSTRAINT daily_carousel_refill_batches_superseded_by_batch_id_fkey
  FOREIGN KEY (superseded_by_batch_id)
  REFERENCES public.daily_carousel_refill_batches(id)
  ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS daily_carousel_refill_batches_sequence_uidx
  ON public.daily_carousel_refill_batches (
    feed_id,
    business_profile_id,
    business_profile_version,
    replacement_sequence
  );

CREATE UNIQUE INDEX IF NOT EXISTS daily_carousel_refill_batches_active_uidx
  ON public.daily_carousel_refill_batches (
    feed_id,
    business_profile_id,
    business_profile_version
  )
  WHERE superseded_at IS NULL;

-- The active row is selected under one feed-scoped advisory lock rather than
-- the former immutable unique constraint. Superseded rows are never extended.
CREATE OR REPLACE FUNCTION public.reserve_daily_carousel_refill_batch_if_profile_current (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_feed_id                  uuid,
  p_requested_count          integer
)
  RETURNS public.daily_carousel_refill_batches
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
declare
  v_batch public.daily_carousel_refill_batches%rowtype;
  v_feed_local_date date;
  v_next_replacement_sequence integer;
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
  where feed.id = p_feed_id
    and feed.user_id = p_user_id
  for share;

  if not found then
    raise exception 'daily_carousel_refill_feed_mismatch';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('daily-carousel-refill:' || p_feed_id::text, 152039841)
  );

  select batch.*
  into v_batch
  from public.daily_carousel_refill_batches as batch
  where batch.feed_id = p_feed_id
    and batch.business_profile_id = p_business_profile_id
    and batch.business_profile_version = p_business_profile_version
    and batch.superseded_at is null
  for update;

  if found then
    if v_batch.user_id <> p_user_id
       or v_batch.local_date <> v_feed_local_date then
      raise exception 'daily_carousel_refill_ownership_mismatch';
    end if;

    update public.daily_carousel_refill_batches as batch
    set
      requested_count = greatest(batch.requested_count, p_requested_count),
      updated_at = case
        when p_requested_count > batch.requested_count then v_now
        else batch.updated_at
      end
    where batch.id = v_batch.id
    returning * into v_batch;

    return v_batch;
  end if;

  select coalesce(max(batch.replacement_sequence), -1) + 1
  into v_next_replacement_sequence
  from public.daily_carousel_refill_batches as batch
  where batch.feed_id = p_feed_id
    and batch.business_profile_id = p_business_profile_id
    and batch.business_profile_version = p_business_profile_version;

  insert into public.daily_carousel_refill_batches (
    business_profile_id,
    business_profile_version,
    feed_id,
    local_date,
    replacement_sequence,
    requested_count,
    user_id
  ) values (
    p_business_profile_id,
    p_business_profile_version,
    p_feed_id,
    v_feed_local_date,
    v_next_replacement_sequence,
    p_requested_count,
    p_user_id
  )
  returning * into v_batch;

  return v_batch;
end;
$function$;

-- Returns null when the feed no longer points at this exact durable batch or
-- when it has no released partial reservation. That is an expected race/no-op:
-- the caller reloads the active row and continues ordinary reconciliation.
CREATE OR REPLACE FUNCTION public.replace_partial_daily_carousel_refill_batch_if_profile_current (
  p_user_id                      text,
  p_business_profile_id          uuid,
  p_business_profile_version     integer,
  p_feed_id                      uuid,
  p_expected_generation_batch_id uuid,
  p_requested_count              integer
)
  RETURNS public.daily_carousel_refill_batches
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
declare
  v_existing public.daily_carousel_refill_batches%rowtype;
  v_feed_local_date date;
  v_replacement public.daily_carousel_refill_batches%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if
    p_feed_id is null
    or p_expected_generation_batch_id is null
    or p_requested_count is null
    or p_requested_count < 1
    or p_requested_count > 50
  then
    raise exception 'invalid_daily_carousel_refill_replacement_request';
  end if;

  perform public.assert_business_profile_version_current(
    p_user_id,
    p_business_profile_id,
    p_business_profile_version
  );

  select feed.local_date
  into v_feed_local_date
  from public.daily_carousel_feeds as feed
  where feed.id = p_feed_id
    and feed.user_id = p_user_id
  for share;

  if not found then
    raise exception 'daily_carousel_refill_feed_mismatch';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('daily-carousel-refill:' || p_feed_id::text, 152039841)
  );

  select batch.*
  into v_existing
  from public.daily_carousel_refill_batches as batch
  where batch.feed_id = p_feed_id
    and batch.business_profile_id = p_business_profile_id
    and batch.business_profile_version = p_business_profile_version
    and batch.superseded_at is null
  for update;

  if not found
     or v_existing.generation_batch_id <> p_expected_generation_batch_id then
    return null;
  end if;

  if v_existing.user_id <> p_user_id
     or v_existing.local_date <> v_feed_local_date then
    raise exception 'daily_carousel_refill_ownership_mismatch';
  end if;

  -- Do not abandon a still-running candidate. A failed/cancelled background
  -- job is terminal even if its generation row has not yet been updated.
  if exists (
    select 1
    from public.carousel_generations as generation
    left join public.background_jobs as job
      on job.id::text = generation.trigger_run_id
    where generation.generation_batch_id = v_existing.generation_batch_id
      and generation.status = 'processing'
      and coalesce(job.status, 'processing') not in ('failed', 'cancelled')
  ) then
    return null;
  end if;

  if not exists (
    select 1
    from public.carousel_generations as generation
    left join public.background_jobs as job
      on job.id::text = generation.trigger_run_id
    where generation.generation_batch_id = v_existing.generation_batch_id
      and (
        generation.status = 'failed'
        or job.status in ('failed', 'cancelled')
      )
  ) then
    return null;
  end if;

  -- Partial reservations are deliberately not reusable. This condition also
  -- proves at least one completed item is already immutable provenance.
  if not exists (
    select 1
    from public.carousel_generations as generation
    join public.carousel_content_plan_reservations as reservation
      on reservation.id = generation.content_plan_reservation_id
      and reservation.user_id = generation.user_id
    where generation.generation_batch_id = v_existing.generation_batch_id
      and reservation.user_id = p_user_id
      and reservation.status in ('released_partial', 'expired_partial')
      and reservation.consumed_count > 0
  ) then
    return null;
  end if;

  -- Retire the active row before inserting because the partial unique index
  -- intentionally allows exactly one active batch for this feed/profile.
  update public.daily_carousel_refill_batches as batch
  set
    superseded_at = v_now,
    updated_at = v_now
  where batch.id = v_existing.id
    and batch.superseded_at is null;

  if not found then
    raise exception 'daily_carousel_refill_replacement_race';
  end if;

  insert into public.daily_carousel_refill_batches (
    business_profile_id,
    business_profile_version,
    feed_id,
    local_date,
    replacement_sequence,
    requested_count,
    user_id
  ) values (
    p_business_profile_id,
    p_business_profile_version,
    p_feed_id,
    v_feed_local_date,
    v_existing.replacement_sequence + 1,
    p_requested_count,
    p_user_id
  )
  returning * into v_replacement;

  update public.daily_carousel_refill_batches as batch
  set
    superseded_by_batch_id = v_replacement.id,
    updated_at = v_now
  where batch.id = v_existing.id
    and batch.superseded_at = v_now;

  return v_replacement;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.reserve_daily_carousel_refill_batch_if_profile_current(text, uuid, integer, uuid, integer)
  TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.replace_partial_daily_carousel_refill_batch_if_profile_current(text, uuid, integer, uuid, uuid, integer)
  TO postgres, service_role;

REVOKE ALL ON FUNCTION public.reserve_daily_carousel_refill_batch_if_profile_current(text, uuid, integer, uuid, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_partial_daily_carousel_refill_batch_if_profile_current(text, uuid, integer, uuid, uuid, integer)
  FROM PUBLIC;
