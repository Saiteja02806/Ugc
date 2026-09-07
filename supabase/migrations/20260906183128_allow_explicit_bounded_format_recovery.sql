-- Explicit retries grant a new bounded recovery window without rewriting
-- prior batch sequence numbers, generations, reservations, or ready content.
ALTER TABLE public.daily_carousel_refill_batches
ADD COLUMN recovery_budget_start_sequence integer NOT NULL DEFAULT 0
CHECK (recovery_budget_start_sequence >= 0 AND recovery_budget_start_sequence <= replacement_sequence);

CREATE OR REPLACE FUNCTION public.replace_partial_daily_carousel_refill_batch_if_profile_current(p_user_id text, p_business_profile_id uuid, p_business_profile_version integer, p_feed_id uuid, p_expected_generation_batch_id uuid, p_requested_count integer)
 RETURNS daily_carousel_refill_batches
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

  -- A new batch resets the physical worker's retry count. Bound the whole
  -- daily recovery chain so persistent validation errors cannot create
  -- unlimited chargeable jobs. A new feed/profile starts its own budget.
  if v_existing.replacement_sequence - v_existing.recovery_budget_start_sequence >= 3 then return null; end if;

  -- Do not abandon a still-running candidate. A failed/cancelled background
  -- job is terminal even if its generation row has not yet been updated.
  if exists (
    select 1
    from public.carousel_generations as generation
    left join public.background_jobs as job
      on job.id::text = generation.trigger_run_id
    where generation.generation_batch_id = v_existing.generation_batch_id
      and (
        job.status not in ('failed', 'cancelled', 'completed')
        or (generation.status = 'processing' and job.id is null)
      )
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

  -- Partial reservations and fully failed reservations attached to a durable
  -- writer must not be reopened. Preserve their history and start a successor.
  -- Jobless, unconsumed preparations retain their existing exact-item recovery.
  if not exists (
    select 1
    from public.carousel_generations as generation
    join public.carousel_content_plan_reservations as reservation
      on reservation.id = generation.content_plan_reservation_id
      and reservation.user_id = generation.user_id
    where generation.generation_batch_id = v_existing.generation_batch_id
      and reservation.user_id = p_user_id
      and (
        (reservation.status in ('released_partial', 'expired_partial')
          and reservation.consumed_count > 0)
        or (reservation.status in ('released', 'expired')
          and reservation.consumed_count = 0
          and generation.trigger_run_id is not null)
      )
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
    recovery_budget_start_sequence,
    requested_count,
    user_id
  ) values (
    p_business_profile_id,
    p_business_profile_version,
    p_feed_id,
    v_feed_local_date,
    v_existing.replacement_sequence + 1,
    v_existing.recovery_budget_start_sequence,
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
$function$
;
CREATE OR REPLACE FUNCTION public.reserve_daily_carousel_refill_batch_if_profile_current(p_user_id text, p_business_profile_id uuid, p_business_profile_version integer, p_feed_id uuid, p_requested_count integer)
 RETURNS daily_carousel_refill_batches
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

    -- Older application revisions fall back to cumulative extension when a
    -- replacement returns NULL. Fence that path at the same recovery budget.
    if v_batch.replacement_sequence - v_batch.recovery_budget_start_sequence >= 3
       and p_requested_count > v_batch.requested_count then
      return v_batch;
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
$function$
;
CREATE OR REPLACE FUNCTION public.restart_failed_daily_trending_feed_slots(p_feed_id uuid, p_user_id text)
RETURNS uuid LANGUAGE plpgsql SET search_path TO '' AS $function$
declare
  feed_record public.daily_trending_feeds;
  restarted_count integer := 0;
  retry_key uuid;
  retry_carousel boolean;
  legacy_feed_id uuid;
begin
  select * into feed_record from public.daily_trending_feeds
  where id = p_feed_id and user_id = p_user_id;
  if feed_record.id is null then raise exception 'daily_trending_feed_not_found'; end if;
  -- Match the daily-plan writer's advisory-lock-before-row-lock order.
  perform pg_advisory_xact_lock(
    hashtextextended(feed_record.user_id || ':' || feed_record.local_date::text, 0)
  );
  select * into feed_record from public.daily_trending_feeds
  where id = p_feed_id and user_id = p_user_id for update;
  if feed_record.id is null then raise exception 'daily_trending_feed_not_found'; end if;
  if feed_record.local_date <> (now() at time zone feed_record.timezone)::date then return null; end if;

  select exists (
    select 1 from public.daily_trending_feed_slots
    where feed_id = p_feed_id and format = 'carousel' and state = 'failed'
      and carousel_assignment_id is null
  ) into retry_carousel;

  update public.daily_trending_feed_slots
  set state = 'planned', updated_at = now()
  where feed_id = p_feed_id and state = 'failed'
    and carousel_assignment_id is null and hook_video_assignment_id is null
    and wall_text_assignment_id is null and reaction_assignment_id is null;
  get diagnostics restarted_count = row_count;
  if restarted_count = 0 then return null; end if;

  if retry_carousel then
    select id into legacy_feed_id from public.daily_carousel_feeds
    where user_id = p_user_id and local_date = feed_record.local_date for share;
    if legacy_feed_id is not null then
      perform pg_advisory_xact_lock(
        hashtextextended('daily-carousel-refill:' || legacy_feed_id::text, 152039841)
      );
      update public.daily_carousel_refill_batches as batch
      set recovery_budget_start_sequence = batch.replacement_sequence, updated_at = now()
      where batch.feed_id = legacy_feed_id and batch.user_id = p_user_id
        and batch.business_profile_id = feed_record.business_profile_id
        and batch.business_profile_version = feed_record.business_profile_version
        and batch.superseded_at is null
        and not exists (
          select 1 from public.carousel_generations as generation
          left join public.background_jobs as job on job.id::text = generation.trigger_run_id
          where generation.generation_batch_id = batch.generation_batch_id
            and (job.status not in ('failed', 'cancelled', 'completed')
              or (generation.status = 'processing' and job.id is null))
        );
    end if;
  end if;
  retry_key := gen_random_uuid();
  update public.daily_trending_feeds
  set status = 'preparing', last_error = null, wall_text_retry_key = retry_key,
      recovery_attempt_count = 0, last_recovery_at = null, last_recovery_error = null,
      updated_at = now()
  where id = p_feed_id and user_id = p_user_id;
  return retry_key;
end;
$function$;
REVOKE ALL ON FUNCTION public.restart_failed_daily_trending_feed_slots(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restart_failed_daily_trending_feed_slots(uuid,text) TO service_role, postgres;
