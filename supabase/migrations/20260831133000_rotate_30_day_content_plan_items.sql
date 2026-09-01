-- A 30-day plan is a reusable idea pool, not a one-time inventory. Keep
-- immutable generation/assignment provenance, but select unused ideas first
-- and then the least-recently-used completed idea when volume exceeds 150/200.

ALTER TABLE public.carousel_content_plan_items
  ADD COLUMN IF NOT EXISTS use_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

ALTER TABLE public.wall_text_content_plan_items
  ADD COLUMN IF NOT EXISTS use_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

ALTER TABLE public.carousel_content_plan_items
  DROP CONSTRAINT IF EXISTS carousel_content_plan_items_use_count_check,
  ADD CONSTRAINT carousel_content_plan_items_use_count_check CHECK (use_count >= 0);

ALTER TABLE public.wall_text_content_plan_items
  DROP CONSTRAINT IF EXISTS wall_text_content_plan_items_use_count_check,
  ADD CONSTRAINT wall_text_content_plan_items_use_count_check CHECK (use_count >= 0);

-- The old Wall unique index encoded the one-time-inventory behavior. Output
-- provenance remains on every assignment, while the new use ledger permits a
-- plan item to be assigned again in a later completed batch.
DROP INDEX IF EXISTS public.wall_text_generation_assignments_plan_item_uidx;

CREATE INDEX IF NOT EXISTS wall_text_generation_assignments_plan_item_idx
  ON public.wall_text_generation_assignments (wall_text_content_plan_item_id, created_at DESC)
  WHERE wall_text_content_plan_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.carousel_content_plan_item_uses (
  id                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  plan_item_id             uuid                     NOT NULL,
  plan_id                  uuid                     NOT NULL,
  user_id                  text                     NOT NULL,
  carousel_generation_id   uuid                     NOT NULL,
  reservation_id           uuid                     NOT NULL,
  used_at                  timestamp with time zone NOT NULL DEFAULT timezone('utc', now()),
  created_at               timestamp with time zone NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT carousel_content_plan_item_uses_pkey PRIMARY KEY (id),
  CONSTRAINT carousel_content_plan_item_uses_generation_key UNIQUE (carousel_generation_id),
  CONSTRAINT carousel_content_plan_item_uses_item_owner_fkey
    FOREIGN KEY (plan_item_id, plan_id, user_id)
    REFERENCES public.carousel_content_plan_items (id, plan_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT carousel_content_plan_item_uses_generation_fkey
    FOREIGN KEY (carousel_generation_id)
    REFERENCES public.carousel_generations (id) ON DELETE RESTRICT,
  CONSTRAINT carousel_content_plan_item_uses_reservation_fkey
    FOREIGN KEY (reservation_id)
    REFERENCES public.carousel_content_plan_reservations (id) ON DELETE RESTRICT,
  CONSTRAINT carousel_content_plan_item_uses_user_id_check
    CHECK (char_length(btrim(user_id)) between 1 and 240)
);

ALTER TABLE public.carousel_content_plan_item_uses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.carousel_content_plan_item_uses FROM PUBLIC, anon, authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
  ON TABLE public.carousel_content_plan_item_uses TO postgres, service_role;

CREATE INDEX IF NOT EXISTS carousel_content_plan_item_uses_rotation_idx
  ON public.carousel_content_plan_item_uses (plan_item_id, used_at DESC);

CREATE TABLE IF NOT EXISTS public.wall_text_content_plan_item_uses (
  id                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  plan_item_id             uuid                     NOT NULL,
  plan_id                  uuid                     NOT NULL,
  user_id                  text                     NOT NULL,
  assignment_id            uuid                     NOT NULL,
  batch_id                 uuid                     NOT NULL,
  used_at                  timestamp with time zone NOT NULL DEFAULT timezone('utc', now()),
  created_at               timestamp with time zone NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT wall_text_content_plan_item_uses_pkey PRIMARY KEY (id),
  CONSTRAINT wall_text_content_plan_item_uses_assignment_key UNIQUE (assignment_id),
  CONSTRAINT wall_text_content_plan_item_uses_item_owner_fkey
    FOREIGN KEY (plan_item_id, plan_id, user_id)
    REFERENCES public.wall_text_content_plan_items (id, plan_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT wall_text_content_plan_item_uses_assignment_fkey
    FOREIGN KEY (assignment_id)
    REFERENCES public.wall_text_generation_assignments (id) ON DELETE RESTRICT,
  CONSTRAINT wall_text_content_plan_item_uses_batch_fkey
    FOREIGN KEY (batch_id)
    REFERENCES public.wall_text_generation_batches (id) ON DELETE RESTRICT,
  CONSTRAINT wall_text_content_plan_item_uses_user_id_check
    CHECK (char_length(btrim(user_id)) between 1 and 240)
);

ALTER TABLE public.wall_text_content_plan_item_uses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.wall_text_content_plan_item_uses FROM PUBLIC, anon, authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
  ON TABLE public.wall_text_content_plan_item_uses TO postgres, service_role;

CREATE INDEX IF NOT EXISTS wall_text_content_plan_item_uses_rotation_idx
  ON public.wall_text_content_plan_item_uses (plan_item_id, used_at DESC);

-- Existing completed outputs are already immutable history. Seed the new
-- idempotency ledger from that source before enabling rotation.
INSERT INTO public.carousel_content_plan_item_uses (
  plan_item_id, plan_id, user_id, carousel_generation_id, reservation_id, used_at
)
SELECT
  generation.content_plan_item_id,
  generation.content_plan_id,
  generation.user_id,
  generation.id,
  generation.content_plan_reservation_id,
  generation.updated_at
FROM public.carousel_generations AS generation
WHERE generation.status = 'completed'
  AND generation.content_plan_item_id IS NOT NULL
  AND generation.content_plan_id IS NOT NULL
  AND generation.content_plan_reservation_id IS NOT NULL
ON CONFLICT (carousel_generation_id) DO NOTHING;

INSERT INTO public.wall_text_content_plan_item_uses (
  plan_item_id, plan_id, user_id, assignment_id, batch_id, used_at
)
SELECT
  assignment.wall_text_content_plan_item_id,
  assignment.wall_text_content_plan_id,
  batch.user_id,
  assignment.id,
  batch.id,
  assignment.updated_at
FROM public.wall_text_generation_assignments AS assignment
JOIN public.wall_text_generation_batches AS batch ON batch.id = assignment.batch_id
WHERE assignment.status = 'completed'
  AND assignment.wall_text_content_plan_item_id IS NOT NULL
  AND assignment.wall_text_content_plan_id IS NOT NULL
ON CONFLICT (assignment_id) DO NOTHING;

UPDATE public.carousel_content_plan_items AS item
SET
  use_count = usage.use_count,
  last_used_at = usage.last_used_at,
  updated_at = timezone('utc', now())
FROM (
  SELECT plan_item_id, count(*)::integer AS use_count, max(used_at) AS last_used_at
  FROM public.carousel_content_plan_item_uses
  GROUP BY plan_item_id
) AS usage
WHERE usage.plan_item_id = item.id;

UPDATE public.wall_text_content_plan_items AS item
SET
  use_count = usage.use_count,
  last_used_at = usage.last_used_at,
  updated_at = timezone('utc', now())
FROM (
  SELECT plan_item_id, count(*)::integer AS use_count, max(used_at) AS last_used_at
  FROM public.wall_text_content_plan_item_uses
  GROUP BY plan_item_id
) AS usage
WHERE usage.plan_item_id = item.id;

-- Preserve a conservative last-use marker for any legacy item whose old
-- completion row was not retained, without inventing a new output record.
UPDATE public.carousel_content_plan_items
SET
  use_count = greatest(use_count, 1),
  last_used_at = coalesce(last_used_at, consumed_at, updated_at)
WHERE status = 'consumed';

UPDATE public.wall_text_content_plan_items
SET
  use_count = greatest(use_count, 1),
  last_used_at = coalesce(last_used_at, consumed_at, updated_at)
WHERE status = 'consumed';

CREATE INDEX IF NOT EXISTS carousel_content_plan_items_rotation_idx
  ON public.carousel_content_plan_items (plan_id, status, last_used_at, use_count, sequence_index);

CREATE INDEX IF NOT EXISTS wall_text_content_plan_items_rotation_idx
  ON public.wall_text_content_plan_items (plan_id, status, last_used_at, use_count, sequence_index);

-- An old exhausted status means the one-time pool was depleted. It is still
-- the current 30-day plan and must resume as an active rotating pool.
UPDATE public.carousel_content_plans AS plan
SET status = 'active', exhausted_at = null, updated_at = timezone('utc', now())
WHERE plan.status = 'exhausted'
  AND timezone(plan.timezone, timezone('utc', now()))::date
    BETWEEN plan.period_start_date AND plan.period_end_date;

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
  v_candidate_ids uuid[];
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

  select reservation.* into v_existing
  from public.carousel_content_plan_reservations as reservation
  where reservation.user_id = p_user_id
    and reservation.reservation_key = trim(p_reservation_key)
  for update;

  if found then
    if v_existing.status = 'active' and v_existing.expires_at <= v_now then
      update public.carousel_content_plan_items as item
      set status = 'available', reservation_token = null, reservation_key = null,
          reserved_by_job_id = null, reserved_at = null,
          reservation_expires_at = null, updated_at = v_now
      where item.user_id = p_user_id
        and item.reservation_token = v_existing.id
        and item.status = 'reserved';

      update public.carousel_content_plan_reservations as reservation
      set status = case when reservation.consumed_count > 0 then 'expired_partial' else 'expired' end,
          released_at = v_now, release_reason = 'reservation_expired', updated_at = v_now
      where reservation.id = v_existing.id;

      v_existing.status := case when v_existing.consumed_count > 0 then 'expired_partial' else 'expired' end;
    end if;

    if v_existing.status = 'completed' then
      select count(*)::integer into v_existing_item_count
      from public.carousel_content_plan_item_uses as usage
      where usage.reservation_id = v_existing.id and usage.user_id = p_user_id;

      if v_existing.requested_count <> p_requested_count
         or v_existing_item_count <> p_requested_count then
        raise exception 'carousel_content_plan_reservation_idempotency_conflict';
      end if;

      return query
      select item.*
      from public.carousel_content_plan_item_uses as usage
      join public.carousel_content_plan_items as item on item.id = usage.plan_item_id
      where usage.reservation_id = v_existing.id
        and usage.user_id = p_user_id
      order by item.sequence_index;
      return;
    end if;

    if v_existing.status = 'active' then
      select count(*)::integer into v_existing_item_count
      from public.carousel_content_plan_items as item
      join public.carousel_content_plans as plan on plan.id = item.plan_id
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
      select item.* from public.carousel_content_plan_items as item
      where item.reservation_token = v_existing.id and item.user_id = p_user_id
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

  perform 1 from public.business_profiles as profile
  where profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.profile_version = p_business_profile_version
  for share;
  if not found then
    raise exception 'business_profile_version_changed';
  end if;

  select plan.* into v_plan
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

  if v_reopen_existing_reservation and v_existing.plan_id <> v_plan.id then
    raise exception 'carousel_content_plan_reservation_idempotency_conflict';
  end if;

  if v_reopen_existing_reservation then
    if exists (
      select 1 from public.carousel_generations as generation
      where generation.content_plan_reservation_id = v_existing.id
        and generation.user_id = p_user_id
        and (generation.status = 'completed' or generation.trigger_run_id is not null)
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

    v_expected_reopen_item_count := coalesce(array_length(v_existing_generation_item_ids, 1), 0);
    if v_expected_reopen_item_count not in (0, p_requested_count) then
      raise exception 'carousel_content_plan_reservation_idempotency_conflict';
    end if;
  end if;

  update public.carousel_content_plan_items as item
  set status = 'available', reservation_token = null, reservation_key = null,
      reserved_by_job_id = null, reserved_at = null,
      reservation_expires_at = null, updated_at = v_now
  where item.plan_id = v_plan.id
    and item.user_id = p_user_id
    and item.status = 'reserved'
    and item.reservation_token in (
      select reservation.id from public.carousel_content_plan_reservations as reservation
      where reservation.plan_id = v_plan.id
        and reservation.user_id = p_user_id
        and reservation.status = 'active'
        and reservation.expires_at <= v_now
    );

  update public.carousel_content_plan_reservations as reservation
  set status = case when reservation.consumed_count > 0 then 'expired_partial' else 'expired' end,
      released_at = v_now, release_reason = 'reservation_expired', updated_at = v_now
  where reservation.plan_id = v_plan.id
    and reservation.user_id = p_user_id
    and reservation.status = 'active'
    and reservation.expires_at <= v_now;

  if v_reopen_existing_reservation and v_expected_reopen_item_count = p_requested_count then
    select array_agg(reopen_item.id order by reopen_item.sequence_index) into v_candidate_ids
    from (
      select item.id, item.sequence_index
      from public.carousel_content_plan_items as item
      where item.id = any(v_existing_generation_item_ids)
        and item.plan_id = v_plan.id
        and item.user_id = p_user_id
        and item.status = 'available'
      for update
    ) as reopen_item;
  else
    select array_agg(candidate.id order by candidate.fresh_rank, candidate.last_used_at nulls first, candidate.use_count, candidate.sequence_index)
    into v_candidate_ids
    from (
      select item.id,
             case when item.status = 'available' then 0 else 1 end as fresh_rank,
             item.last_used_at,
             item.use_count,
             item.sequence_index
      from public.carousel_content_plan_items as item
      left join public.carousel_content_plan_reservations as previous_reservation
        on previous_reservation.id = item.reservation_token
      where item.plan_id = v_plan.id
        and item.user_id = p_user_id
        and (
          item.status = 'available'
          or (
            item.status = 'consumed'
            and previous_reservation.status in ('completed', 'expired_partial')
          )
        )
      order by case when item.status = 'available' then 0 else 1 end,
               item.last_used_at nulls first, item.use_count, item.sequence_index
      limit p_requested_count
      for update of item skip locked
    ) as candidate;
  end if;

  if coalesce(array_length(v_candidate_ids, 1), 0) <> p_requested_count then
    raise exception 'carousel_content_plan_insufficient_items';
  end if;

  if v_reopen_existing_reservation then
    update public.carousel_content_plan_reservations as reservation
    set status = 'active', consumed_count = 0,
        expires_at = v_now + make_interval(secs => p_reservation_ttl_seconds),
        completed_at = null, released_at = null, release_reason = null, updated_at = v_now
    where reservation.id = v_reservation_id;

    update public.carousel_generations as generation
    set status = 'processing', error_message = null, updated_at = v_now
    where generation.content_plan_reservation_id = v_reservation_id
      and generation.user_id = p_user_id
      and generation.status = 'failed'
      and generation.trigger_run_id is null;

    update public.carousel_experiment_assignments as assignment
    set status = 'reserved', updated_at = v_now
    where assignment.status = 'failed'
      and exists (
        select 1 from public.carousel_generations as generation
        join public.carousel_experiment_batches as batch on batch.id = assignment.experiment_batch_id
        where generation.carousel_experiment_assignment_id = assignment.id
          and generation.content_plan_reservation_id = v_reservation_id
          and generation.user_id = p_user_id
          and generation.trigger_run_id is null
          and batch.planner_job_id is null
      );

    update public.carousel_experiment_batches as batch
    set status = 'reserved', updated_at = v_now
    where batch.status = 'failed'
      and batch.planner_job_id is null
      and exists (
        select 1 from public.carousel_generations as generation
        where generation.carousel_experiment_batch_id = batch.id
          and generation.content_plan_reservation_id = v_reservation_id
          and generation.user_id = p_user_id
          and generation.trigger_run_id is null
      );
  else
    insert into public.carousel_content_plan_reservations (
      id, plan_id, user_id, reservation_key, requested_count, expires_at
    ) values (
      v_reservation_id, v_plan.id, p_user_id, trim(p_reservation_key), p_requested_count,
      v_now + make_interval(secs => p_reservation_ttl_seconds)
    );
  end if;

  update public.carousel_content_plan_items as item
  set status = 'reserved', reservation_token = v_reservation_id,
      reservation_key = trim(p_reservation_key), reserved_by_job_id = null,
      reserved_at = v_now,
      reservation_expires_at = v_now + make_interval(secs => p_reservation_ttl_seconds),
      consumed_by_carousel_generation_id = null, consumed_at = null,
      updated_at = v_now
  where item.id = any(v_candidate_ids)
    and item.plan_id = v_plan.id
    and item.user_id = p_user_id
    and (
      item.status = 'available'
      or (
        item.status = 'consumed'
        and exists (
          select 1 from public.carousel_content_plan_reservations as previous_reservation
          where previous_reservation.id = item.reservation_token
            and previous_reservation.status in ('completed', 'expired_partial')
        )
      )
    );

  get diagnostics v_reserved_count = row_count;
  if v_reserved_count <> p_requested_count then
    raise exception 'carousel_content_plan_reservation_race';
  end if;

  return query
  select item.* from public.carousel_content_plan_items as item
  where item.reservation_token = v_reservation_id and item.user_id = p_user_id
  order by item.sequence_index;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.reserve_carousel_content_plan_items(text, uuid, integer, integer, text, integer)
  TO postgres, service_role;
REVOKE ALL ON FUNCTION public.reserve_carousel_content_plan_items(text, uuid, integer, integer, text, integer)
  FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.consume_carousel_content_plan_item (
  p_user_id                text,
  p_plan_item_id           uuid,
  p_reservation_token      uuid,
  p_carousel_generation_id uuid
)
  RETURNS public.carousel_content_plan_items
  LANGUAGE plpgsql
  SET search_path TO ''
AS $function$
declare
  v_item public.carousel_content_plan_items%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_reservation public.carousel_content_plan_reservations%rowtype;
  v_usage_id uuid;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_plan_item_id is null
     or p_reservation_token is null
     or p_carousel_generation_id is null then
    raise exception 'carousel_content_plan_consumption_input_invalid';
  end if;

  select item.* into v_item
  from public.carousel_content_plan_items as item
  where item.id = p_plan_item_id and item.user_id = p_user_id
  for update;
  if not found then
    raise exception 'carousel_content_plan_item_not_found';
  end if;

  if exists (
    select 1 from public.carousel_content_plan_item_uses as usage
    where usage.carousel_generation_id = p_carousel_generation_id
      and usage.plan_item_id = p_plan_item_id
      and usage.reservation_id = p_reservation_token
      and usage.user_id = p_user_id
  ) then
    return v_item;
  end if;

  if v_item.status <> 'reserved' or v_item.reservation_token is distinct from p_reservation_token then
    raise exception 'carousel_content_plan_item_not_reserved';
  end if;

  perform 1
  from public.carousel_generations as generation
  join public.carousel_content_plans as plan on plan.id = v_item.plan_id
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

  select reservation.* into v_reservation
  from public.carousel_content_plan_reservations as reservation
  where reservation.id = p_reservation_token
    and reservation.user_id = p_user_id
    and reservation.status = 'active'
  for update;
  if not found then
    raise exception 'carousel_content_plan_reservation_not_active';
  end if;

  insert into public.carousel_content_plan_item_uses (
    plan_item_id, plan_id, user_id, carousel_generation_id, reservation_id, used_at
  ) values (
    v_item.id, v_item.plan_id, p_user_id, p_carousel_generation_id, p_reservation_token, v_now
  ) on conflict (carousel_generation_id) do nothing
  returning id into v_usage_id;

  if v_usage_id is null then
    return v_item;
  end if;

  update public.carousel_content_plan_items as item
  set status = 'consumed', consumed_by_carousel_generation_id = p_carousel_generation_id,
      consumed_at = v_now, use_count = item.use_count + 1, last_used_at = v_now,
      updated_at = v_now
  where item.id = p_plan_item_id
  returning item.* into v_item;

  update public.carousel_content_plan_reservations as reservation
  set consumed_count = reservation.consumed_count + 1,
      status = case when reservation.consumed_count + 1 = reservation.requested_count then 'completed' else 'active' end,
      completed_at = case when reservation.consumed_count + 1 = reservation.requested_count then v_now else null end,
      updated_at = v_now
  where reservation.id = p_reservation_token;

  return v_item;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.consume_carousel_content_plan_item(text, uuid, uuid, uuid)
  TO postgres, service_role;
REVOKE ALL ON FUNCTION public.consume_carousel_content_plan_item(text, uuid, uuid, uuid)
  FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.reserve_wall_text_generation_batch_v1 (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_request_key              text,
  p_request_hash             text,
  p_generator_version        text,
  p_prompt_version           text,
  p_format_library_version   text,
  p_selector_version         text,
  p_assignments              jsonb
)
  RETURNS SETOF public.wall_text_generation_batches
  LANGUAGE plpgsql
  SET search_path TO ''
AS $function$
declare
  assignment_count integer;
  ordinary_assignment_count integer;
  batch_record public.wall_text_generation_batches;
  candidate_start integer;
  v_content_plan_id uuid;
  v_plan_item_ids uuid[];
begin
  assignment_count := jsonb_array_length(p_assignments);
  if jsonb_typeof(p_assignments) <> 'array' or assignment_count < 1 or assignment_count > 50 then
    raise exception 'wall_text_batch_invalid_assignments';
  end if;

  select count(*) into ordinary_assignment_count
  from jsonb_array_elements(p_assignments) as item(value)
  where item.value ->> 'sourceKind' <> 'instagram_reel';

  perform 1 from public.business_profiles as profile
  where profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.profile_version = p_business_profile_version
  for update;
  if not found then
    raise exception 'wall_text_business_profile_changed';
  end if;

  select batch.* into batch_record
  from public.wall_text_generation_batches as batch
  where batch.user_id = p_user_id and batch.request_key = p_request_key;
  if found then
    if batch_record.request_hash <> p_request_hash then
      raise exception 'wall_text_batch_idempotency_mismatch';
    end if;
    return next batch_record;
    return;
  end if;

  if ordinary_assignment_count > 1 and exists (
    select 1 from jsonb_array_elements(p_assignments) as item
    where item ->> 'assignedFormatId' is not null and item ->> 'sourceKind' <> 'instagram_reel'
    group by item ->> 'assignedFormatId'
    having count(*) > floor(ordinary_assignment_count * 0.5)
  ) then
    raise exception 'wall_text_batch_format_share_exceeded';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_assignments) as item(value)
    where item.value ->> 'sourceKind' = 'instagram_reel'
      and not exists (
        select 1 from public.wall_text_instagram_reel_templates as template
        where template.id = nullif(item.value ->> 'instagramReelTemplateId', '')::uuid
          and template.status = 'active'
          and template.template_version = (item.value ->> 'instagramReelTemplateVersion')::integer
          and template.overlay_media_asset_id = (item.value ->> 'overlayMediaAssetId')::uuid
          and template.locked_audio_asset_id = item.value ->> 'instagramLockedAudioAssetId'
          and template.reference_text = item.value ->> 'instagramReferenceText'
          and template.reference_text_hash = item.value ->> 'instagramReferenceTextHash'
          and template.audio_fit_mode = item.value ->> 'instagramAudioFitMode'
          and template.writer_format_id = item.value ->> 'assignedFormatId'
          and abs((template.safe_text_box ->> 'x')::numeric - (item.value #>> '{layout,textBox,x}')::numeric) < 0.000001
          and abs((template.safe_text_box ->> 'y')::numeric - (item.value #>> '{layout,textBox,y}')::numeric) < 0.000001
          and abs((template.safe_text_box ->> 'width')::numeric - (item.value #>> '{layout,textBox,width}')::numeric) < 0.000001
          and abs((template.safe_text_box ->> 'height')::numeric - (item.value #>> '{layout,textBox,height}')::numeric) < 0.000001
      )
  ) then
    raise exception 'wall_text_instagram_reservation_mismatch';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_assignments) as item(value)
    where item.value ->> 'sourceKind' <> 'instagram_reel'
      and (item.value ->> 'instagramReelTemplateId' is not null
        or item.value ->> 'instagramReelTemplateVersion' is not null
        or item.value ->> 'instagramReferenceText' is not null
        or item.value ->> 'instagramReferenceTextHash' is not null
        or item.value ->> 'instagramLockedAudioAssetId' is not null
        or item.value ->> 'instagramAudioFitMode' is not null)
  ) then
    raise exception 'wall_text_non_instagram_snapshot_invalid';
  end if;

  select greatest(
    coalesce((select max(creative.candidate_index) + 1 from public.wall_text_creatives as creative
      where creative.user_id = p_user_id and creative.business_profile_id = p_business_profile_id
        and creative.business_profile_version = p_business_profile_version), 0),
    coalesce((select max(batch.candidate_index_start + batch.requested_count)
      from public.wall_text_generation_batches as batch
      where batch.user_id = p_user_id and batch.business_profile_id = p_business_profile_id
        and batch.business_profile_version = p_business_profile_version), 0)
  ) into candidate_start;

  -- There is deliberately no direct-generation fallback. A pending plan is a
  -- durable planning dependency; an active plan is a rotating source pool.
  select plan.id into v_content_plan_id
  from public.wall_text_content_plans as plan
  where plan.user_id = p_user_id
    and plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.status = 'active'
    and timezone(plan.timezone, timezone('utc', now()))::date
      between plan.period_start_date and plan.period_end_date
  order by plan.period_start_date desc, plan.plan_version desc
  limit 1
  for update;
  if not found then
    raise exception 'wall_text_content_plan_pending';
  end if;

  select array_agg(candidate.id order by candidate.fresh_rank, candidate.last_used_at nulls first, candidate.use_count, candidate.sequence_index)
  into v_plan_item_ids
  from (
    select item.id,
           case when item.status = 'available' then 0 else 1 end as fresh_rank,
           item.last_used_at, item.use_count, item.sequence_index
    from public.wall_text_content_plan_items as item
    where item.plan_id = v_content_plan_id
      and item.user_id = p_user_id
      and (
        item.status = 'available'
        or (
          item.status = 'consumed'
          and not exists (
            select 1
            from public.wall_text_generation_assignments as prior_assignment
            join public.wall_text_generation_batches as prior_batch on prior_batch.id = prior_assignment.batch_id
            where prior_assignment.wall_text_content_plan_item_id = item.id
              and prior_batch.status in ('pending', 'processing')
          )
        )
      )
    order by case when item.status = 'available' then 0 else 1 end,
             item.last_used_at nulls first, item.use_count, item.sequence_index
    limit assignment_count
    for update of item skip locked
  ) as candidate;

  if coalesce(cardinality(v_plan_item_ids), 0) <> assignment_count then
    raise exception 'wall_text_content_plan_inventory_pending';
  end if;

  insert into public.wall_text_generation_batches (
    user_id, business_profile_id, business_profile_version, request_key,
    request_hash, requested_count, chunk_count, candidate_index_start,
    generator_version, prompt_version, format_library_version, selector_version
  ) values (
    p_user_id, p_business_profile_id, p_business_profile_version,
    btrim(p_request_key), p_request_hash, assignment_count,
    ceil(assignment_count / 10.0)::integer, candidate_start,
    p_generator_version, p_prompt_version, p_format_library_version, p_selector_version
  ) returning * into batch_record;

  insert into public.wall_text_generation_chunks (
    batch_id, chunk_index, first_batch_candidate_index, candidate_count,
    idempotency_key, request_hash
  )
  select batch_record.id, chunk_index, chunk_index * 10,
    least(10, assignment_count - chunk_index * 10),
    'wall-text-batch:' || batch_record.id::text || ':chunk:' || chunk_index::text,
    p_request_hash
  from generate_series(0, batch_record.chunk_count - 1) as chunk_index;

  insert into public.wall_text_generation_assignments (
    batch_id, chunk_id, batch_candidate_index, creative_candidate_index,
    assigned_format_id, format_library_version, selection_mode,
    selection_weight_snapshot, source_kind, overlay_media_asset_id,
    instagram_reel_template_id, instagram_reel_template_version,
    instagram_reference_text, instagram_reference_text_hash,
    instagram_locked_audio_asset_id, instagram_audio_fit_mode,
    duration_seconds, layout_json, target_words, max_words, focus_json,
    wall_text_content_plan_id, wall_text_content_plan_item_id
  )
  select
    batch_record.id, chunk.id, item.ordinality - 1,
    candidate_start + item.ordinality - 1, item.value ->> 'assignedFormatId',
    p_format_library_version, item.value ->> 'selectionMode',
    coalesce((item.value ->> 'selectionWeight')::numeric, 1),
    item.value ->> 'sourceKind', (item.value ->> 'overlayMediaAssetId')::uuid,
    nullif(item.value ->> 'instagramReelTemplateId', '')::uuid,
    nullif(item.value ->> 'instagramReelTemplateVersion', '')::integer,
    item.value ->> 'instagramReferenceText', item.value ->> 'instagramReferenceTextHash',
    item.value ->> 'instagramLockedAudioAssetId', item.value ->> 'instagramAudioFitMode',
    (item.value ->> 'durationSeconds')::numeric, item.value -> 'layout',
    (item.value ->> 'targetWords')::integer, (item.value ->> 'maxWords')::integer,
    coalesce(item.value -> 'focus', '{}'::jsonb), v_content_plan_id,
    planned_item.item_id
  from jsonb_array_elements(p_assignments) with ordinality as item(value, ordinality)
  join public.wall_text_generation_chunks as chunk
    on chunk.batch_id = batch_record.id
    and chunk.chunk_index = floor((item.ordinality - 1) / 10.0)::integer
  join unnest(v_plan_item_ids) with ordinality as planned_item(item_id, item_ordinal)
    on planned_item.item_ordinal = item.ordinality;

  update public.wall_text_content_plan_items as item
  set status = 'reserved', reserved_at = timezone('utc', now()), consumed_at = null,
      updated_at = timezone('utc', now())
  where item.plan_id = v_content_plan_id
    and item.user_id = p_user_id
    and item.id = any(v_plan_item_ids)
    and item.status in ('available', 'consumed');

  if (
    select count(*) from public.wall_text_content_plan_items as item
    where item.plan_id = v_content_plan_id
      and item.user_id = p_user_id
      and item.id = any(v_plan_item_ids)
      and item.status = 'reserved'
  ) <> assignment_count then
    raise exception 'wall_text_content_plan_reservation_incomplete';
  end if;

  return next batch_record;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.reserve_wall_text_generation_batch_v1(text, uuid, integer, text, text, text, text, text, text, jsonb)
  TO postgres, service_role;
REVOKE ALL ON FUNCTION public.reserve_wall_text_generation_batch_v1(text, uuid, integer, text, text, text, text, text, text, jsonb)
  FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.save_wall_text_generation_candidate_v1 (
  p_user_id              text,
  p_assignment_id        uuid,
  p_claim_token          uuid,
  p_creative_id          uuid,
  p_generator_model      text,
  p_text_content         jsonb,
  p_layout               jsonb,
  p_normalized_text      text,
  p_content_hash         text,
  p_similarity_signature jsonb
)
  RETURNS SETOF public.wall_text_creatives
  LANGUAGE plpgsql
  SET search_path TO ''
AS $function$
declare
  assignment_record public.wall_text_generation_assignments;
  batch_record public.wall_text_generation_batches;
  saved_creative public.wall_text_creatives;
  v_now timestamptz := timezone('utc', now());
  v_usage_id uuid;
begin
  select assignment.* into assignment_record
  from public.wall_text_generation_assignments as assignment
  join public.wall_text_generation_batches as batch on batch.id = assignment.batch_id
  where assignment.id = p_assignment_id and batch.user_id = p_user_id;
  if not found then
    raise exception 'wall_text_generation_assignment_unavailable';
  end if;

  select batch.* into batch_record
  from public.wall_text_generation_batches as batch
  where batch.id = assignment_record.batch_id;

  if assignment_record.status = 'completed' then
    return query select creative.* from public.wall_text_creatives as creative
      where creative.id = assignment_record.wall_text_creative_id;
    return;
  end if;

  perform 1 from public.wall_text_generation_chunks as chunk
  where chunk.id = assignment_record.chunk_id
    and chunk.status = 'processing'
    and chunk.claim_token = p_claim_token
  for update;
  if not found then
    raise exception 'wall_text_generation_candidate_stale_claim';
  end if;

  select assignment.* into assignment_record
  from public.wall_text_generation_assignments as assignment
  where assignment.id = p_assignment_id
  for update;
  if assignment_record.status = 'completed' then
    return query select creative.* from public.wall_text_creatives as creative
      where creative.id = assignment_record.wall_text_creative_id;
    return;
  end if;

  insert into public.wall_text_creatives (
    id, user_id, business_profile_id, business_profile_version,
    overlay_media_asset_id, generation_id, candidate_index,
    duration_seconds, text_content, layout, generator_version,
    generator_model, status, source_kind, instagram_reel_template_id
  ) values (
    p_creative_id, batch_record.user_id, batch_record.business_profile_id,
    batch_record.business_profile_version, assignment_record.overlay_media_asset_id,
    batch_record.id, assignment_record.creative_candidate_index,
    assignment_record.duration_seconds, p_text_content, p_layout,
    batch_record.generator_version, btrim(p_generator_model), 'preview_ready',
    assignment_record.source_kind, assignment_record.instagram_reel_template_id
  ) returning * into saved_creative;

  insert into public.wall_text_content_history (
    user_id, business_profile_id, wall_text_creative_id, normalized_text,
    content_hash, normalization_version, similarity_signature,
    similarity_version, format_id, format_version, format_attribution,
    performance_eligible, performance_exclusion_reason
  ) values (
    batch_record.user_id, batch_record.business_profile_id, saved_creative.id,
    p_normalized_text, p_content_hash, 'wall-text-normalization-v1',
    p_similarity_signature, 'wall-text-duplicate-signature-v1',
    assignment_record.assigned_format_id, assignment_record.format_version,
    'original', assignment_record.source_kind <> 'instagram_reel',
    case when assignment_record.source_kind = 'instagram_reel'
      then 'instagram_template_performance_is_separate' else null end
  );

  if assignment_record.wall_text_content_plan_item_id is not null then
    insert into public.wall_text_content_plan_item_uses (
      plan_item_id, plan_id, user_id, assignment_id, batch_id, used_at
    ) values (
      assignment_record.wall_text_content_plan_item_id,
      assignment_record.wall_text_content_plan_id,
      batch_record.user_id,
      assignment_record.id,
      assignment_record.batch_id,
      v_now
    ) on conflict (assignment_id) do nothing
    returning id into v_usage_id;

    if v_usage_id is null then
      raise exception 'wall_text_content_plan_item_usage_conflict';
    end if;

    update public.wall_text_content_plan_items as item
    set status = 'consumed', consumed_at = v_now,
        use_count = item.use_count + 1, last_used_at = v_now, updated_at = v_now
    where item.id = assignment_record.wall_text_content_plan_item_id
      and item.plan_id = assignment_record.wall_text_content_plan_id
      and item.user_id = batch_record.user_id
      and item.status = 'reserved';
    if not found then
      raise exception 'wall_text_content_plan_item_not_reserved';
    end if;
  end if;

  update public.wall_text_generation_assignments
  set actual_format_id = assignment_record.assigned_format_id,
      content_attempt_count = content_attempt_count + 1,
      last_failure_code = null, status = 'completed',
      wall_text_creative_id = saved_creative.id, updated_at = v_now
  where id = assignment_record.id;

  if not exists (
    select 1 from public.wall_text_generation_assignments as pending
    where pending.chunk_id = assignment_record.chunk_id and pending.status <> 'completed'
  ) then
    update public.wall_text_generation_chunks
    set status = 'completed', claim_token = null, locked_at = null,
        completed_at = v_now, updated_at = v_now
    where id = assignment_record.chunk_id;
  end if;

  if not exists (
    select 1 from public.wall_text_generation_assignments as pending
    where pending.batch_id = assignment_record.batch_id and pending.status <> 'completed'
  ) then
    update public.wall_text_generation_batches
    set status = 'completed', completed_at = v_now, updated_at = v_now
    where id = assignment_record.batch_id;
  else
    update public.wall_text_generation_batches
    set status = 'processing', updated_at = v_now
    where id = assignment_record.batch_id and status = 'pending';
  end if;

  return next saved_creative;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.save_wall_text_generation_candidate_v1(text, uuid, uuid, uuid, text, jsonb, jsonb, text, text, jsonb)
  TO postgres, service_role;
REVOKE ALL ON FUNCTION public.save_wall_text_generation_candidate_v1(text, uuid, uuid, uuid, text, jsonb, jsonb, text, text, jsonb)
  FROM PUBLIC;

COMMENT ON FUNCTION public.reserve_carousel_content_plan_items(text, uuid, integer, integer, text, integer)
  IS 'Reserves unused Carousel 30-day plan ideas first, then least-recently-used completed ideas; plan exhaustion never starts a new plan early.';

COMMENT ON FUNCTION public.reserve_wall_text_generation_batch_v1(text, uuid, integer, text, text, text, text, text, text, jsonb)
  IS 'Reserves only an active Wall 30-day plan: unused ideas first, then least-recently-used ideas from a terminal batch; it never falls back to direct generation.';
