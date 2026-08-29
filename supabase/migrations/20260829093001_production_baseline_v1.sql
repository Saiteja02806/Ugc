-- Production schema baseline captured after migration-history reconciliation.
-- Existing production must mark this migration applied; never execute it there.
set check_function_bodies = off;
create schema if not exists public;

-- source: public/schema.sql
COMMENT ON SCHEMA "public" IS 'standard public schema';

REVOKE ALL ON SCHEMA "public" FROM PUBLIC;

GRANT USAGE ON SCHEMA "public" TO PUBLIC;

REVOKE ALL ON SCHEMA "public" FROM "anon";

GRANT USAGE ON SCHEMA "public" TO "anon";

REVOKE ALL ON SCHEMA "public" FROM "authenticated";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

REVOKE ALL ON SCHEMA "public" FROM "pg_database_owner";

GRANT CREATE, USAGE ON SCHEMA "public" TO "pg_database_owner";

REVOKE ALL ON SCHEMA "public" FROM "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres";

REVOKE ALL ON SCHEMA "public" FROM "service_role";

GRANT USAGE ON SCHEMA "public" TO "service_role";


-- source: _cluster/extensions/pgcrypto.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA "extensions";

COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


-- source: _cluster/extensions/uuid-ossp.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA "extensions";

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


-- source: public/default_privileges.sql
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "service_role";


-- source: public/functions/capture_background_job_state_event.sql
CREATE OR REPLACE FUNCTION public.capture_background_job_state_event()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.background_job_events (job_id, event_type, metadata)
    values (
      new.id,
      'job_created',
      jsonb_build_object(
        'status', new.status,
        'stage', new.stage,
        'jobType', new.job_type,
        'queueProvider', new.queue_provider
      )
    );
  elsif
    old.status is distinct from new.status
    or old.stage is distinct from new.stage
    or old.progress is distinct from new.progress then
    insert into public.background_job_events (job_id, event_type, metadata)
    values (
      new.id,
      'job_state_persisted',
      jsonb_build_object(
        'fromStatus', old.status,
        'toStatus', new.status,
        'stage', new.stage,
        'progress', new.progress,
        'attemptCount', new.attempt_count
      )
    );
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."capture_background_job_state_event"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."capture_background_job_state_event"() FROM PUBLIC;


-- source: public/functions/complete_trending_hook_generation_chunk_dispatch_trigger_v1.sql
CREATE OR REPLACE FUNCTION public.complete_trending_hook_generation_chunk_dispatch_trigger_v1()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
begin
  if new.background_job_id is not null or new.status <> 'reserved' then
    update public.trending_hook_generation_dispatch_outbox
    set
      status = 'completed',
      completed_at = now(),
      claim_token = null,
      claimed_at = null,
      updated_at = now()
    where chunk_id = new.id
      and status <> 'completed';
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."complete_trending_hook_generation_chunk_dispatch_trigger_v1"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."complete_trending_hook_generation_chunk_dispatch_trigger_v1"() FROM PUBLIC;


-- source: public/functions/enforce_free_trial_daily_trending_feed.sql
CREATE OR REPLACE FUNCTION public.enforce_free_trial_daily_trending_feed()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  trial public.free_trial_entitlements%rowtype;
  content_days_used integer := 0;
begin
  -- Active subscribers are never limited by the free-trial ledger.
  if exists (
    select 1
    from public.billing_subscriptions as subscription
    where subscription.user_id = new.user_id
      and subscription.status = 'active'
  ) then
    return new;
  end if;

  select *
  into trial
  from public.free_trial_entitlements
  where user_id = new.user_id
  for update;

  if not found or trial.expires_at <= clock_timestamp() then
    raise exception using
      errcode = 'P0001',
      message = 'free_trial_content_expired',
      detail = 'An active paid subscription is required to create another daily content pack.';
  end if;

  if new.daily_limit > trial.daily_content_pieces then
    raise exception using
      errcode = 'P0001',
      message = 'free_trial_daily_content_limit_exceeded',
      detail = 'Free trials may reserve at most 10 content pieces per daily pack.';
  end if;

  select count(*)
  into content_days_used
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

GRANT EXECUTE ON FUNCTION "public"."enforce_free_trial_daily_trending_feed"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."enforce_free_trial_daily_trending_feed"() FROM PUBLIC;


-- source: public/functions/enforce_free_trial_instagram_schedule_limit.sql
CREATE OR REPLACE FUNCTION public.enforce_free_trial_instagram_schedule_limit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  trial public.free_trial_entitlements%rowtype;
  scheduled_post_count integer := 0;
begin
  if new.platform <> 'instagram' then
    return new;
  end if;

  -- Paid accounts retain their existing scheduling entitlement.
  if exists (
    select 1
    from public.billing_subscriptions as subscription
    where subscription.user_id = new.user_id
      and subscription.status = 'active'
  ) then
    return new;
  end if;

  -- Serialise free scheduling per user. This makes the five-post cap safe
  -- when multiple schedule requests arrive simultaneously.
  select *
  into trial
  from public.free_trial_entitlements
  where user_id = new.user_id
  for update;

  if not found or trial.expires_at <= clock_timestamp() then
    raise exception using
      errcode = 'P0001',
      message = 'free_trial_schedule_expired',
      detail = 'Your free trial has ended. Upgrade to schedule another Instagram post.';
  end if;

  select count(*)
  into scheduled_post_count
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
  )
  values (new.user_id, new.id);

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."enforce_free_trial_instagram_schedule_limit"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."enforce_free_trial_instagram_schedule_limit"() FROM PUBLIC;


-- source: public/functions/enforce_instagram_connection_limit.sql
CREATE OR REPLACE FUNCTION public.enforce_instagram_connection_limit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  account_limit integer := 1;
  active_connection_count integer := 0;
begin
  if new.platform <> 'instagram' or new.revoked_at is not null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.platform = 'instagram'
      and old.revoked_at is null
      and old.user_id = new.user_id
    then
      return new;
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('instagram-connections:' || new.user_id, 0)
  );

  if exists (
    select 1
    from public.billing_subscriptions
    where user_id = new.user_id
      and plan_key = 'growth'
      and status = 'active'
  ) then
    account_limit := 3;
  end if;

  select count(*)
  into active_connection_count
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

GRANT EXECUTE ON FUNCTION "public"."enforce_instagram_connection_limit"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."enforce_instagram_connection_limit"() FROM PUBLIC;


-- source: public/functions/enqueue_completed_trending_feed_reconciliation.sql
CREATE OR REPLACE FUNCTION public.enqueue_completed_trending_feed_reconciliation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  should_reconcile boolean := true;
begin
  -- Preserve the durable Hook-run cleanup introduced with chunked Hook
  -- generation. Its candidates must be released before reconciliation wakes
  -- the next chunk.
  if new.status in ('failed', 'cancelled')
    and new.job_type = 'generate_trending_hook_copy'
    and new.input_json ? 'generationRunId'
  then
    perform public.fail_trending_hook_generation_chunk_v1(
      new.id,
      coalesce(new.error_message, 'The Hook generation worker failed.')
    );
  end if;

  -- Only a Carousel job that owns daily-feed inventory should prepare a daily
  -- replacement. Manual and non-daily Carousel failures remain isolated.
  if new.status in ('failed', 'cancelled')
    and new.job_type = 'generate_carousel'
  then
    select exists (
      select 1
      from public.carousel_generations as generation
      where generation.trigger_run_id = new.id::text
        and generation.origin_daily_feed_id is not null
    )
    into should_reconcile;
  end if;

  if not should_reconcile then
    return new;
  end if;

  insert into public.trending_feed_reconciliation_outbox (
    source_job_id,
    user_id,
    status,
    next_attempt_at
  ) values (
    new.id,
    new.user_id,
    'pending',
    now()
  )
  on conflict (source_job_id) do nothing;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."enqueue_completed_trending_feed_reconciliation"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";


-- source: public/functions/enqueue_paid_trending_prebuild.sql
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
     or new.plan_key not in ('starter', 'growth') then
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

GRANT EXECUTE ON FUNCTION "public"."enqueue_paid_trending_prebuild"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."enqueue_paid_trending_prebuild"() FROM PUBLIC;


-- source: public/functions/enqueue_trending_hook_generation_chunk_dispatch_v1.sql
CREATE OR REPLACE FUNCTION public.enqueue_trending_hook_generation_chunk_dispatch_v1()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_user_id text;
begin
  select run.user_id
  into v_user_id
  from public.trending_hook_generation_runs as run
  where run.id = new.run_id;

  if not found then
    raise exception 'trending_hook_generation_dispatch_run_not_found';
  end if;

  insert into public.trending_hook_generation_dispatch_outbox (
    run_id,
    chunk_id,
    user_id
  ) values (
    new.run_id,
    new.id,
    v_user_id
  )
  on conflict (chunk_id) do nothing;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."enqueue_trending_hook_generation_chunk_dispatch_v1"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."enqueue_trending_hook_generation_chunk_dispatch_v1"() FROM PUBLIC;


-- source: public/functions/grant_free_trial_on_onboarding_completion.sql
CREATE OR REPLACE FUNCTION public.grant_free_trial_on_onboarding_completion()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if new.onboarding_status <> 'completed'
    or new.onboarding_version < 3
    or new.onboarding_completed_at is null
  then
    return new;
  end if;

  insert into public.free_trial_entitlements (
    user_id,
    started_at,
    expires_at,
    content_days_limit,
    daily_content_pieces,
    instagram_schedule_limit
  )
  values (
    new.user_id,
    new.onboarding_completed_at,
    new.onboarding_completed_at + interval '3 days',
    3,
    10,
    5
  )
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."grant_free_trial_on_onboarding_completion"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."grant_free_trial_on_onboarding_completion"() FROM PUBLIC;


-- source: public/functions/initialize_carousel_requested_structure.sql
CREATE OR REPLACE FUNCTION public.initialize_carousel_requested_structure()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  new.requested_structure_id := coalesce(
    new.requested_structure_id,
    new.structure_id
  );
  new.requested_structure_version := coalesce(
    new.requested_structure_version,
    new.structure_version
  );
  new.requested_structure_batch_sequence := coalesce(
    new.requested_structure_batch_sequence,
    new.structure_batch_sequence
  );
  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."initialize_carousel_requested_structure"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."initialize_carousel_requested_structure"() FROM PUBLIC;


-- source: public/functions/normalize_billing_credit_cycle.sql
CREATE OR REPLACE FUNCTION public.normalize_billing_credit_cycle()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."normalize_billing_credit_cycle"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."normalize_billing_credit_cycle"() FROM PUBLIC;


-- source: public/functions/prepare_creative_asset_group.sql
CREATE OR REPLACE FUNCTION public.prepare_creative_asset_group()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  new.user_id := btrim(new.user_id);
  new.name := btrim(new.name);
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'A creative asset group cannot change owners.' using errcode = '42501';
    end if;
    if new.media_type is distinct from old.media_type then
      raise exception 'A creative asset group cannot change media type.' using errcode = '23514';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."prepare_creative_asset_group"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."prepare_creative_asset_group"() FROM PUBLIC;


-- source: public/functions/preserve_current_daily_hook_assignment_on_supersede.sql
CREATE OR REPLACE FUNCTION public.preserve_current_daily_hook_assignment_on_supersede()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if old.state = 'active'
    and new.state = 'superseded'
    and exists (
      select 1
      from public.daily_trending_feed_slots as slot
      join public.daily_trending_feeds as feed
        on feed.id = slot.feed_id
      where slot.hook_video_assignment_id = old.id
        and slot.state = 'ready'
        and feed.local_date = (now() at time zone feed.timezone)::date
    )
  then
    new.state := old.state;
    new.completed_at := old.completed_at;
    new.updated_at := old.updated_at;
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."preserve_current_daily_hook_assignment_on_supersede"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."preserve_current_daily_hook_assignment_on_supersede"() FROM PUBLIC;


-- source: public/functions/prevent_carousel_batch_structure_assignment_change.sql
CREATE OR REPLACE FUNCTION public.prevent_carousel_batch_structure_assignment_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_takeover_batch_id text;
begin
  v_takeover_batch_id := current_setting(
    'app.carousel_structure_takeover_batch_id',
    true
  );

  if nullif(v_takeover_batch_id, '') is not null
     and new.id::text = v_takeover_batch_id then
    return new;
  end if;

  if new.structure_planning_attempt_count < old.structure_planning_attempt_count then
    raise exception 'carousel_structure_planning_attempt_count_cannot_decrease';
  end if;

  if new.requested_structure_id is distinct from old.requested_structure_id
     or new.requested_structure_version is distinct from old.requested_structure_version
     or new.requested_structure_batch_sequence is distinct from old.requested_structure_batch_sequence
     or new.structure_resolution_mode is distinct from old.structure_resolution_mode
     or new.structure_fallback_reason is distinct from old.structure_fallback_reason
     or new.structure_resolved_at is distinct from old.structure_resolved_at
     or new.structure_id is distinct from old.structure_id
     or new.structure_version is distinct from old.structure_version
     or new.structure_selection_mode is distinct from old.structure_selection_mode
     or new.structure_mode_snapshot is distinct from old.structure_mode_snapshot
     or new.structure_batch_sequence is distinct from old.structure_batch_sequence
     or new.structure_rotation_sequence is distinct from old.structure_rotation_sequence then
    raise exception 'carousel_batch_structure_assignment_is_immutable';
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."prevent_carousel_batch_structure_assignment_change"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."prevent_carousel_batch_structure_assignment_change"() FROM PUBLIC;


-- source: public/functions/prevent_carousel_slide_story_identity_change.sql
CREATE OR REPLACE FUNCTION public.prevent_carousel_slide_story_identity_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if new.structure_id is distinct from old.structure_id
     or new.structure_version is distinct from old.structure_version
     or new.story_format_id is distinct from old.story_format_id
     or new.story_role is distinct from old.story_role then
    raise exception 'carousel_slide_story_identity_is_immutable';
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."prevent_carousel_slide_story_identity_change"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."prevent_carousel_slide_story_identity_change"() FROM PUBLIC;


-- source: public/functions/prevent_carousel_structure_identity_change.sql
CREATE OR REPLACE FUNCTION public.prevent_carousel_structure_identity_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_parent_batch_id text;
  v_takeover_batch_id text;
begin
  v_takeover_batch_id := current_setting(
    'app.carousel_structure_takeover_batch_id',
    true
  );
  v_parent_batch_id := coalesce(
    to_jsonb(new) ->> 'experiment_batch_id',
    to_jsonb(new) ->> 'carousel_experiment_batch_id'
  );

  if nullif(v_takeover_batch_id, '') is not null
     and v_parent_batch_id = v_takeover_batch_id then
    return new;
  end if;

  if new.structure_id is distinct from old.structure_id
     or new.structure_version is distinct from old.structure_version then
    raise exception 'carousel_structure_identity_is_immutable';
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."prevent_carousel_structure_identity_change"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."prevent_carousel_structure_identity_change"() FROM PUBLIC;


-- source: public/functions/prevent_freeform_wall_text_format_learning.sql
CREATE OR REPLACE FUNCTION public.prevent_freeform_wall_text_format_learning()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if new.format_id is null then
    new.performance_eligible := false;
    new.performance_exclusion_reason := 'freeform_copy_has_no_format_learning';
  end if;
  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."prevent_freeform_wall_text_format_learning"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";


-- source: public/functions/release_social_publish_account_lane_on_operation_change.sql
CREATE OR REPLACE FUNCTION public.release_social_publish_account_lane_on_operation_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_connection_id uuid;
begin
  if old.active_job_id is null or old.active_claim_token is null then
    return new;
  end if;

  if new.active_job_id is not distinct from old.active_job_id
    and new.active_claim_token is not distinct from old.active_claim_token then
    return new;
  end if;

  select target.social_connection_id
  into v_connection_id
  from public.scheduled_post_targets as target
  where target.id = old.scheduled_post_target_id;

  if found then
    update public.social_publish_account_lanes as lane
    set
      active_job_id = null,
      active_claim_token = null,
      claimed_at = null,
      updated_at = now()
    where lane.platform = old.platform
      and lane.social_connection_id = v_connection_id
      and lane.active_job_id = old.active_job_id
      and lane.active_claim_token = old.active_claim_token;
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."release_social_publish_account_lane_on_operation_change"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";


-- source: public/functions/release_video_render_slot_on_background_job_state_change.sql
CREATE OR REPLACE FUNCTION public.release_video_render_slot_on_background_job_state_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if new.status is distinct from old.status
    and new.status in ('queued', 'completed', 'failed', 'cancelled', 'stalled') then
    update public.video_render_execution_slots as slot
    set
      background_job_id = null,
      claim_token = null,
      claimed_at = null,
      updated_at = now(),
      worker_execution_id = null
    where slot.background_job_id = new.id;
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."release_video_render_slot_on_background_job_state_change"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";


-- source: public/functions/require_active_demo_for_media.sql
CREATE OR REPLACE FUNCTION public.require_active_demo_for_media()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_demo_id text;
begin
  if new.source_type <> 'demo_upload' or new.deleted_at is not null then
    return new;
  end if;

  v_demo_id := coalesce(nullif(trim(new.source_record_id), ''), new.id::text);

  if new.project_id is null or not exists (
    select 1
    from public.demo_videos as demo
    where demo.id::text = v_demo_id
      and demo.user_id = new.user_id
      and demo.project_id = new.project_id
      and demo.deleted_at is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'Active demo media requires an active matching demo video.';
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."require_active_demo_for_media"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."require_active_demo_for_media"() FROM PUBLIC;


-- source: public/functions/settle_billing_from_background_job.sql
CREATE OR REPLACE FUNCTION public.settle_billing_from_background_job()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."settle_billing_from_background_job"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."settle_billing_from_background_job"() FROM PUBLIC;


-- source: public/functions/sync_background_job_queue_message_id.sql
CREATE OR REPLACE FUNCTION public.sync_background_job_queue_message_id()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
begin
  if tg_op = 'INSERT' then
    if new.queue_message_id is null then
      new.queue_message_id := new.aws_message_id;
    elsif new.aws_message_id is null then
      new.aws_message_id := new.queue_message_id;
    end if;
  elsif new.queue_message_id is distinct from old.queue_message_id then
    new.aws_message_id := new.queue_message_id;
  elsif new.aws_message_id is distinct from old.aws_message_id then
    new.queue_message_id := new.aws_message_id;
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."sync_background_job_queue_message_id"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";


-- source: public/functions/sync_deleted_demo_media.sql
CREATE OR REPLACE FUNCTION public.sync_deleted_demo_media()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_demo_asset_ids uuid[] := array[]::uuid[];
begin
  if old.deleted_at is null and new.deleted_at is not null then
    select coalesce(array_agg(media.id), array[]::uuid[])
    into v_demo_asset_ids
    from public.media_assets as media
    where media.user_id = new.user_id
      and media.source_type = 'demo_upload'
      and (
        media.source_record_id = new.id::text
        or media.id = new.id
      )
      and (
        media.project_id is null
        or media.project_id = new.project_id
      );

    with recursive retired_asset_ids as (
      select unnest(v_demo_asset_ids) as id

      union

      select child.id
      from public.media_assets as child
      join retired_asset_ids as parent
        on parent.id = child.parent_asset_id
      where child.user_id = new.user_id
        and child.source_type = 'edit_export'
    )
    update public.media_assets as media
    set
      deleted_at = new.deleted_at,
      updated_at = new.deleted_at
    where media.id in (select retired.id from retired_asset_ids as retired)
      and media.user_id = new.user_id
      and media.deleted_at is null;

    update public.editable_videos as editable
    set
      deleted_at = new.deleted_at,
      updated_at = new.deleted_at
    where editable.user_id = new.user_id
      and editable.project_id = new.project_id
      and editable.source = 'demo'
      and editable.deleted_at is null
      and (
        editable.source_video_id = new.id::text
        or exists (
          select 1
          from unnest(v_demo_asset_ids) as media_id
          where editable.source_video_id = media_id::text
        )
      );
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."sync_deleted_demo_media"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."sync_deleted_demo_media"() FROM PUBLIC;


-- source: public/functions/sync_deleted_demo_source.sql
CREATE OR REPLACE FUNCTION public.sync_deleted_demo_source()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_demo_id text;
begin
  if old.deleted_at is null
    and new.deleted_at is not null
    and new.source_type = 'demo_upload'
  then
    v_demo_id := coalesce(
      nullif(trim(new.source_record_id), ''),
      new.id::text
    );

    update public.demo_videos as demo
    set
      deleted_at = new.deleted_at,
      updated_at = new.deleted_at
    where demo.id::text = v_demo_id
      and demo.user_id = new.user_id
      and (
        new.project_id is null
        or demo.project_id = new.project_id
      )
      and demo.deleted_at is null;
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."sync_deleted_demo_source"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."sync_deleted_demo_source"() FROM PUBLIC;


-- source: public/functions/track_wall_text_asset_assignment.sql
CREATE OR REPLACE FUNCTION public.track_wall_text_asset_assignment()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  update public.overlay_media_assets as asset
  set
    usage_count = asset.usage_count + 1,
    last_used_at = now(),
    updated_at = now()
  from public.wall_text_creatives as creative
  where creative.id = new.wall_text_creative_id
    and asset.id = creative.overlay_media_asset_id;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."track_wall_text_asset_assignment"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."track_wall_text_asset_assignment"() FROM PUBLIC;


-- source: public/functions/validate_creative_asset_group_item.sql
CREATE OR REPLACE FUNCTION public.validate_creative_asset_group_item()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  asset_collection text;
  asset_deleted_at timestamptz;
  asset_status text;
  asset_user_id text;
  group_media_type text;
  group_user_id text;
begin
  new.user_id := btrim(new.user_id);
  select asset_group.user_id, asset_group.media_type
  into group_user_id, group_media_type
  from public.creative_asset_groups as asset_group
  where asset_group.id = new.group_id for share;
  if not found then
    raise exception 'Creative asset group does not exist.' using errcode = '23503';
  end if;
  if group_user_id is distinct from new.user_id then
    raise exception 'Creative asset group belongs to another user.' using errcode = '42501';
  end if;
  select asset.user_id, asset.collection, asset.status, asset.deleted_at
  into asset_user_id, asset_collection, asset_status, asset_deleted_at
  from public.media_assets as asset
  where asset.id = new.media_asset_id for share;
  if not found then
    raise exception 'Media asset does not exist.' using errcode = '23503';
  end if;
  if asset_user_id is distinct from new.user_id then
    raise exception 'Media asset belongs to another user.' using errcode = '42501';
  end if;
  if asset_status <> 'ready' or asset_deleted_at is not null then
    raise exception 'Only ready, active media assets can be added to a group.' using errcode = '23514';
  end if;
  if (group_media_type = 'image' and asset_collection <> 'image')
    or (group_media_type = 'video' and asset_collection not in ('video', 'influencer')) then
    raise exception 'Media asset type does not match the group.' using errcode = '23514';
  end if;
  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."validate_creative_asset_group_item"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."validate_creative_asset_group_item"() FROM PUBLIC;


-- source: public/functions/validate_hook_video_audio_lock.sql
CREATE OR REPLACE FUNCTION public.validate_hook_video_audio_lock()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  video_row public.avatar_assets%rowtype;
  audio_row public.hook_audio_assets%rowtype;
begin
  select *
  into video_row
  from public.avatar_assets
  where id = new.hook_video_id;

  if not found then
    raise exception 'Hook video % does not exist', new.hook_video_id;
  end if;

  if video_row.avatar_type <> 'global'
     or video_row.status <> 'ready'
     or video_row.deleted_at is not null
     or video_row.has_audio is distinct from false
     or video_row.hook_format_id is null
     or video_row.duration_seconds is null
     or video_row.duration_seconds <= 0
     or video_row.source_video_url !~ '^https://' then
    raise exception
      'Hook video % is not an available, ready, silent catalog video with a format and duration',
      new.hook_video_id;
  end if;

  select *
  into audio_row
  from public.hook_audio_assets
  where id = new.audio_asset_id;

  if not found then
    raise exception 'Hook audio % does not exist', new.audio_asset_id;
  end if;

  if audio_row.status <> 'active'
     or audio_row.review_status <> 'approved'
     or audio_row.loopable is distinct from false
     or audio_row.duration_seconds is null
     or audio_row.duration_seconds <= 0
     or audio_row.audio_url !~ '^https://' then
    raise exception
      'Hook audio % is not approved, active, non-looping, and available',
      new.audio_asset_id;
  end if;

  if audio_row.duration_seconds < video_row.duration_seconds then
    raise exception
      'Hook audio % is shorter than Hook video %',
      new.audio_asset_id,
      new.hook_video_id;
  end if;

  new.updated_at := now();
  return new;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."validate_hook_video_audio_lock"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."validate_hook_video_audio_lock"() FROM PUBLIC;


-- source: public/functions/validate_trending_creative_edit.sql
CREATE OR REPLACE FUNCTION public.validate_trending_creative_edit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  assignment_is_valid boolean := false;
  source_is_valid boolean := false;
begin
  new.user_id := btrim(new.user_id);
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
      or new.assignment_id is distinct from old.assignment_id
      or new.creative_id is distinct from old.creative_id
      or new.format is distinct from old.format
    then
      raise exception 'trending_creative_edit_scope_immutable'
        using errcode = '42501';
    end if;

    if new.revision < old.revision then
      raise exception 'trending_creative_edit_revision_regressed'
        using errcode = '23514';
    end if;
  end if;

  case new.format
    when 'carousel' then
      select exists (
        select 1
        from public.user_carousel_assignments as assignment
        where assignment.id = new.assignment_id
          and assignment.user_id = new.user_id
          and assignment.carousel_id = new.creative_id
          and assignment.state in ('pending', 'in_progress', 'accepted')
      ) into assignment_is_valid;
    when 'hook_video' then
      select exists (
        select 1
        from public.user_hook_video_assignments as assignment
        where assignment.id = new.assignment_id
          and assignment.user_id = new.user_id
          and assignment.hook_suggestion_id = new.creative_id
          and assignment.state in ('active', 'selected')
      ) into assignment_is_valid;
    when 'wall_text' then
      select exists (
        select 1
        from public.user_wall_text_assignments as assignment
        where assignment.id = new.assignment_id
          and assignment.user_id = new.user_id
          and assignment.wall_text_creative_id = new.creative_id
          and assignment.state in ('active', 'selected')
      ) into assignment_is_valid;
  end case;

  if not coalesce(assignment_is_valid, false) then
    raise exception 'trending_creative_edit_assignment_unavailable'
      using errcode = '42501';
  end if;

  if new.source_selection_kind = 'asset' then
    select exists (
      select 1
      from public.media_assets as asset
      where asset.id = new.resolved_media_asset_id
        and asset.user_id = new.user_id
        and asset.collection in ('video', 'influencer')
        and asset.mime_type like 'video/%'
        and asset.status = 'ready'
        and asset.deleted_at is null
    ) into source_is_valid;
  elsif new.source_selection_kind = 'group' then
    select exists (
      select 1
      from public.creative_asset_groups as asset_group
      join public.creative_asset_group_items as group_item
        on group_item.group_id = asset_group.id
       and group_item.user_id = asset_group.user_id
      join public.media_assets as asset
        on asset.id = group_item.media_asset_id
       and asset.user_id = asset_group.user_id
      where asset_group.id = new.source_group_id
        and asset_group.user_id = new.user_id
        and asset_group.media_type = 'video'
        and asset.id = new.resolved_media_asset_id
        and asset.collection in ('video', 'influencer')
        and asset.mime_type like 'video/%'
        and asset.status = 'ready'
        and asset.deleted_at is null
    ) into source_is_valid;
  else
    source_is_valid := true;
  end if;

  if not coalesce(source_is_valid, false) then
    raise exception 'trending_creative_edit_source_unavailable'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."validate_trending_creative_edit"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."validate_trending_creative_edit"() FROM PUBLIC;


-- source: public/functions/validate_trending_video_source_selection.sql
CREATE OR REPLACE FUNCTION public.validate_trending_video_source_selection()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare target_is_valid boolean;
begin
  new.user_id := trim(new.user_id);
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id or new.format is distinct from old.format then
      raise exception 'trending_video_source_scope_immutable';
    end if;
  end if;
  if new.selection_kind = 'group' then
    select exists (
      select 1 from public.creative_asset_groups as asset_group
      where asset_group.id = new.group_id and asset_group.user_id = new.user_id and asset_group.media_type = 'video'
    ) into target_is_valid;
  else
    select exists (
      select 1 from public.media_assets as asset
      where asset.id = new.media_asset_id and asset.user_id = new.user_id
        and asset.collection in ('video', 'influencer') and asset.status = 'ready'
        and asset.deleted_at is null and asset.mime_type like 'video/%'
    ) into target_is_valid;
  end if;
  if not coalesce(target_is_valid, false) then
    raise exception 'trending_video_source_not_available';
  end if;
  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."validate_trending_video_source_selection"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."validate_trending_video_source_selection"() FROM PUBLIC;


-- source: public/functions/validate_viral_hook_reference_section.sql
CREATE OR REPLACE FUNCTION public.validate_viral_hook_reference_section()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if not exists (
    select 1
    from public.viral_references as reference
    where reference.id = new.reference_id
      and reference.section = 'hook_video'
  ) then
    raise exception 'viral_hook_reference_must_be_hook_video';
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."validate_viral_hook_reference_section"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."validate_viral_hook_reference_section"() FROM PUBLIC;


-- source: public/functions/validate_wall_text_assignment.sql
CREATE OR REPLACE FUNCTION public.validate_wall_text_assignment()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if not exists (
    select 1
    from public.wall_text_creatives as creative
    where creative.id = new.wall_text_creative_id
      and creative.user_id = new.user_id
      and creative.business_profile_id = new.business_profile_id
      and creative.business_profile_version = new.business_profile_version
      and creative.status = 'preview_ready'
  ) then
    raise exception 'wall_text_assignment_mismatch';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."validate_wall_text_assignment"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."validate_wall_text_assignment"() FROM PUBLIC;


-- source: public/functions/validate_wall_text_audio_selection.sql
CREATE OR REPLACE FUNCTION public.validate_wall_text_audio_selection()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  creative_record public.wall_text_creatives;
  edit_source_overridden boolean := false;
  expected_locked_audio_id text;
  selected_asset public.wall_audio_assets;
  playable_duration numeric;
begin
  new.user_id := btrim(new.user_id);
  new.updated_at := now();

  select creative.* into creative_record
  from public.wall_text_creatives as creative
  where creative.id = new.wall_text_creative_id
    and creative.user_id = new.user_id
    and creative.status = 'preview_ready';
  if not found then
    raise exception 'wall_text_audio_creative_unavailable'
      using errcode = '42501';
  end if;

  if new.creative_edit_id is not null then
    select edit.source_selection_kind is not null
    into edit_source_overridden
    from public.trending_creative_edits as edit
    where edit.id = new.creative_edit_id
      and edit.user_id = new.user_id
      and edit.creative_id = new.wall_text_creative_id
      and edit.format = 'wall_text'
      and edit.revision = new.creative_edit_revision;
    if not found then
      raise exception 'wall_text_audio_edit_unavailable'
        using errcode = '42501';
    end if;
  end if;

  select asset.* into selected_asset
  from public.wall_audio_assets as asset
  where asset.id = new.audio_asset_id
    and asset.status = 'active'
    and asset.review_status = 'approved';
  if not found then
    raise exception 'wall_text_audio_asset_unavailable'
      using errcode = '23514';
  end if;

  if creative_record.source_kind = 'instagram_reel'
    and not edit_source_overridden
  then
    select template.locked_audio_asset_id into expected_locked_audio_id
    from public.wall_text_instagram_reel_templates as template
    where template.id = creative_record.instagram_reel_template_id
      and template.status = 'active';
    if expected_locked_audio_id is null
      or selected_asset.id <> expected_locked_audio_id
      or selected_asset.selection_scope <> 'instagram_reel_locked'
      or new.fit_mode = 'loop'
    then
      raise exception 'wall_text_instagram_locked_audio_mismatch'
        using errcode = '23514';
    end if;
  elsif selected_asset.selection_scope <> 'matcher_pool' then
    raise exception 'wall_text_matcher_audio_scope_mismatch'
      using errcode = '23514';
  end if;

  if abs(new.cue_start_seconds - selected_asset.cue_start_seconds) > 0.001 then
    raise exception 'wall_text_audio_cue_mismatch'
      using errcode = '23514';
  end if;

  playable_duration :=
    selected_asset.duration_seconds - selected_asset.cue_start_seconds;
  if new.fit_mode = 'exact'
    and abs(playable_duration - new.video_duration_seconds) > 0.08
  then
    raise exception 'wall_text_audio_exact_fit_invalid'
      using errcode = '23514';
  elsif new.fit_mode = 'trim'
    and playable_duration <= new.video_duration_seconds + 0.08
  then
    raise exception 'wall_text_audio_trim_fit_invalid'
      using errcode = '23514';
  elsif new.fit_mode = 'loop'
    and (
      not selected_asset.loopable
      or playable_duration + 0.08 >= new.video_duration_seconds
    )
  then
    raise exception 'wall_text_audio_loop_fit_invalid'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."validate_wall_text_audio_selection"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."validate_wall_text_audio_selection"() FROM PUBLIC;


-- source: public/functions/validate_wall_text_creative.sql
CREATE OR REPLACE FUNCTION public.validate_wall_text_creative()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  source_asset public.overlay_media_assets;
begin
  if not exists (
    select 1
    from public.business_profiles as profile
    where profile.id = new.business_profile_id
      and profile.user_id = new.user_id
      and profile.profile_version = new.business_profile_version
  ) then
    raise exception 'wall_text_business_profile_changed';
  end if;

  select asset.* into source_asset
  from public.overlay_media_assets as asset
  where asset.id = new.overlay_media_asset_id
    and asset.asset_type = 'video'
    and asset.format_family = 'wall_text_overlay'
    and asset.aspect_ratio = '9:16'
    and asset.status = 'active'
    and asset.analysis_status = 'succeeded'
    and asset.duration_seconds > 0
    and asset.preview_url is not null
    and asset.source_file_sha256 is not null
    and asset.source_batch is not null
    and asset.visual_group is not null;
  if not found then
    raise exception 'wall_text_background_not_ready';
  end if;

  if new.source_kind = 'ugcpilot' and (
    source_asset.wall_text_source_kind <> 'ugcpilot'
    or source_asset.owner_user_id is not null
  ) then
    raise exception 'wall_text_background_source_mismatch';
  elsif new.source_kind = 'creative_asset' and (
    source_asset.wall_text_source_kind <> 'creative_asset'
    or source_asset.owner_user_id is distinct from new.user_id
  ) then
    raise exception 'wall_text_background_owner_mismatch';
  elsif new.source_kind = 'instagram_reel' and not exists (
    select 1
    from public.wall_text_instagram_reel_templates as template
    join public.wall_audio_assets as audio
      on audio.id = template.locked_audio_asset_id
    where template.id = new.instagram_reel_template_id
      and template.overlay_media_asset_id = new.overlay_media_asset_id
      and template.status = 'active'
      and source_asset.wall_text_source_kind = 'instagram_reel'
      and audio.selection_scope = 'instagram_reel_locked'
      and audio.status = 'active'
      and audio.review_status = 'approved'
  ) then
    raise exception 'wall_text_instagram_template_mismatch';
  end if;

  new.duration_seconds := source_asset.duration_seconds;
  new.updated_at := now();
  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."validate_wall_text_creative"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."validate_wall_text_creative"() FROM PUBLIC;


-- source: public/functions/validate_wall_text_instagram_reel_template.sql
CREATE OR REPLACE FUNCTION public.validate_wall_text_instagram_reel_template()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  audio_record public.wall_audio_assets;
  video_record public.overlay_media_assets;
  playable_duration numeric;
begin
  if tg_op = 'UPDATE'
    and old.status = 'active'
    and row(
      new.template_key,
      new.overlay_media_asset_id,
      new.locked_audio_asset_id,
      new.reference_text,
      new.reference_text_hash,
      new.writer_format_id,
      new.instagram_reference_url,
      new.canonical_reference_url,
      new.safe_text_box,
      new.audio_fit_mode,
      new.template_version,
      new.import_batch
    ) is distinct from row(
      old.template_key,
      old.overlay_media_asset_id,
      old.locked_audio_asset_id,
      old.reference_text,
      old.reference_text_hash,
      old.writer_format_id,
      old.instagram_reference_url,
      old.canonical_reference_url,
      old.safe_text_box,
      old.audio_fit_mode,
      old.template_version,
      old.import_batch
    )
  then
    raise exception 'wall_text_instagram_active_template_immutable';
  end if;

  select asset.* into video_record
  from public.overlay_media_assets as asset
  where asset.id = new.overlay_media_asset_id
    and asset.asset_type = 'video'
    and asset.format_family = 'wall_text_overlay'
    and asset.aspect_ratio = '9:16'
    and asset.status = 'active'
    and asset.analysis_status = 'succeeded'
    and asset.wall_text_source_kind = 'instagram_reel'
    and asset.duration_seconds > 0
    and asset.duration_seconds <= 60
    and asset.preview_url is not null
    and asset.source_file_sha256 is not null
    and asset.source_batch is not null
    and asset.visual_group is not null;
  if not found then
    raise exception 'wall_text_instagram_video_unavailable';
  end if;

  select audio.* into audio_record
  from public.wall_audio_assets as audio
  where audio.id = new.locked_audio_asset_id
    and audio.selection_scope = 'instagram_reel_locked'
    and audio.status = 'active'
    and audio.review_status = 'approved';
  if not found then
    raise exception 'wall_text_instagram_audio_unavailable';
  end if;

  playable_duration := audio_record.duration_seconds - audio_record.cue_start_seconds;
  if new.audio_fit_mode = 'exact'
    and abs(playable_duration - video_record.duration_seconds) > 0.08
  then
    raise exception 'wall_text_instagram_audio_exact_fit_invalid';
  elsif new.audio_fit_mode = 'trim'
    and playable_duration <= video_record.duration_seconds + 0.08
  then
    raise exception 'wall_text_instagram_audio_trim_fit_invalid';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."validate_wall_text_instagram_reel_template"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."validate_wall_text_instagram_reel_template"() FROM PUBLIC;


-- source: public/tables/background_jobs.sql
CREATE TABLE "public"."background_jobs" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"             text,
  "project_id"          text,
  "job_type"            text                     NOT NULL,
  "queue_name"          text                     NOT NULL,
  "status"              text                     NOT NULL DEFAULT 'queued'::text,
  "input_json"          jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "output_json"         jsonb,
  "error_message"       text,
  "attempt_count"       integer                  NOT NULL DEFAULT 0,
  "aws_message_id"      text,
  "worker_id"           text,
  "locked_at"           timestamp with time zone,
  "last_heartbeat_at"   timestamp with time zone,
  "started_at"          timestamp with time zone,
  "completed_at"        timestamp with time zone,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "claim_token"         uuid,
  "next_attempt_at"     timestamp with time zone,
  "idempotency_key"     text,
  "last_delivery_at"    timestamp with time zone,
  "queue_message_id"    text,
  "stage"               text,
  "progress"            smallint,
  "input_reference"     text,
  "output_reference"    text,
  "error_code"          text,
  "max_attempts"        integer                  NOT NULL DEFAULT 3,
  "worker_execution_id" text,
  "queued_at"           timestamp with time zone,
  "failed_at"           timestamp with time zone,
  "cancel_requested_at" timestamp with time zone,
  "queue_provider"      text                     NOT NULL DEFAULT 'gcp'::text,
  CONSTRAINT "background_jobs_attempt_count_check" CHECK ((attempt_count >= 0)),
  CONSTRAINT "background_jobs_input_json_check" CHECK ((jsonb_typeof(input_json) = 'object'::text)),
  CONSTRAINT "background_jobs_job_type_check"
    CHECK
    ((job_type = ANY (ARRAY['hook_text_generation'::text, 'wall_text_generation'::text, 'wall_text_content_plan_generation'::text, 'carousel_generation'::text,
    'carousel_content_plan_generation'::text,
    'paid_trending_prebuild'::text,
    'image_generation'::text,
    'video_generation'::text,
    'preview_render'::text,
    'final_render'::text,
    'media_analysis'::text,
    'social_publish'::text,
    'analytics_sync'::text,
    'generate_avatar'::text,
    'generate_carousel'::text,
    'generate_hook_video'::text,
    'generate_image'::text,
    'generate_thumbnail'::text,
    'generate_trending_hook_copy'::text,
    'extract_video_metadata'::text,
    'publish_social_post'::text,
    'render_demo_video'::text,
    'render_edit_video'::text, 'render_schedule_combination'::text, 'render_trending_carousel_edit'::text, 'render_wall_text_video'::text, 'test_worker_job'::text]))),
  CONSTRAINT "background_jobs_max_attempts_check" CHECK (((max_attempts >= 1) AND (max_attempts <= 20))),
  CONSTRAINT "background_jobs_output_json_check" CHECK (((output_json IS NULL) OR (jsonb_typeof(output_json) = 'object'::text))),
  CONSTRAINT "background_jobs_pkey" PRIMARY KEY (id),
  CONSTRAINT "background_jobs_progress_check" CHECK (((progress IS NULL) OR ((progress >= 0) AND (progress <= 100)))),
  CONSTRAINT "background_jobs_queue_provider_check" CHECK ((queue_provider = 'gcp'::text)),
  CONSTRAINT "background_jobs_status_check"
    CHECK
    ((status = ANY (ARRAY['created'::text, 'queued'::text, 'processing'::text, 'waiting_external_service'::text, 'rendering'::text, 'uploading_output'::text, 'completed'::text,
    'failed'::text, 'cancel_requested'::text, 'cancelled'::text, 'stalled'::text])))
);

ALTER TABLE "public"."background_jobs"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX background_jobs_aws_message_id_idx ON public.background_jobs USING btree (aws_message_id)
  WHERE (aws_message_id IS NOT NULL);

CREATE UNIQUE INDEX background_jobs_owner_type_idempotency_uidx ON public.background_jobs USING btree (COALESCE(user_id, ''::text), job_type, idempotency_key)
  WHERE (idempotency_key IS NOT NULL);

CREATE INDEX background_jobs_processing_heartbeat_idx ON public.background_jobs USING btree (last_heartbeat_at)
  WHERE (status = 'processing'::text);

CREATE INDEX background_jobs_queue_message_id_idx ON public.background_jobs USING btree (queue_message_id)
  WHERE (queue_message_id IS NOT NULL);

CREATE INDEX background_jobs_queue_status_created_idx ON public.background_jobs USING btree (queue_name, status, created_at);

CREATE INDEX background_jobs_recovery_heartbeat_idx ON public.background_jobs USING btree (last_heartbeat_at, updated_at)
  WHERE (status = ANY (ARRAY['processing'::text, 'waiting_external_service'::text, 'rendering'::text, 'uploading_output'::text, 'cancel_requested'::text]));

CREATE INDEX background_jobs_social_retry_due_idx ON public.background_jobs USING btree (next_attempt_at, created_at)
  WHERE ((job_type = 'publish_social_post'::text) AND (status = 'queued'::text));

CREATE INDEX background_jobs_type_status_created_idx ON public.background_jobs USING btree (job_type, status, created_at DESC);

CREATE INDEX background_jobs_user_active_created_idx ON public.background_jobs USING btree (user_id, created_at DESC)
  WHERE ((user_id IS
    NOT NULL) AND
    (status = ANY (ARRAY['created'::text, 'queued'::text, 'processing'::text, 'waiting_external_service'::text, 'rendering'::text, 'uploading_output'::text,
    'cancel_requested'::text, 'stalled'::text])));

CREATE INDEX background_jobs_user_project_created_idx ON public.background_jobs USING btree (user_id, project_id, created_at DESC)
  WHERE (user_id IS NOT NULL);

CREATE TRIGGER background_jobs_capture_state_event
  AFTER INSERT OR UPDATE ON public.background_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_background_job_state_event();

CREATE TRIGGER background_jobs_sync_queue_message_id
  BEFORE INSERT OR UPDATE OF queue_message_id, aws_message_id ON public.background_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_background_job_queue_message_id();

CREATE TRIGGER enqueue_completed_trending_feed_reconciliation
  AFTER UPDATE OF status ON public.background_jobs
  FOR EACH ROW
  WHEN (((old.status IS DISTINCT FROM new.status) AND (new.user_id IS
    NOT NULL) AND
    (((new.status = 'completed'::text) AND (new.job_type = ANY (ARRAY['carousel_content_plan_generation'::text, 'generate_carousel'::text, 'generate_trending_hook_copy'::text,
    'wall_text_content_plan_generation'::text,
    'wall_text_generation'::text]))) OR
    ((new.status = ANY (ARRAY['failed'::text, 'cancelled'::text])) AND (new.job_type = 'generate_trending_hook_copy'::text) AND (new.input_json ? 'generationRunId'::text)) OR
    ((new.status = ANY (ARRAY['failed'::text, 'cancelled'::text])) AND (new.job_type = 'generate_carousel'::text)))))
  EXECUTE FUNCTION public.enqueue_completed_trending_feed_reconciliation();

CREATE TRIGGER release_video_render_slot_on_background_job_state_change
  AFTER UPDATE OF status ON public.background_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.release_video_render_slot_on_background_job_state_change();

CREATE TRIGGER settle_billing_background_job_trigger
  AFTER UPDATE OF status ON public.background_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.settle_billing_from_background_job();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."background_jobs" TO "postgres";

COMMENT ON COLUMN "public"."background_jobs"."aws_message_id" IS 'Temporary rollout compatibility alias for queue_message_id. It does not select or enable AWS.';

COMMENT ON COLUMN "public"."background_jobs"."input_reference" IS 'Reference to a typed feature record; input_json is retained temporarily for legacy workers.';

COMMENT ON COLUMN "public"."background_jobs"."output_reference" IS 'Stable typed record or Cloud Storage object reference written before completion.';

COMMENT ON COLUMN "public"."background_jobs"."progress" IS 'Real measured progress only. Null when a workload cannot report truthful progress.';

COMMENT ON COLUMN "public"."background_jobs"."queue_provider" IS 'UGC Pilot runtime queue provider. GCP is the only supported value.';

REVOKE ALL ON TABLE "public"."background_jobs" FROM "anon";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."background_jobs" TO "anon";

REVOKE ALL ON TABLE "public"."background_jobs" FROM "authenticated";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."background_jobs" TO "authenticated";

REVOKE ALL ON TABLE "public"."background_jobs" FROM "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."background_jobs" TO "service_role";


-- source: public/tables/billing_credit_balances.sql
CREATE TABLE "public"."billing_credit_balances" (
  "user_id"              text                     NOT NULL,
  "dodo_subscription_id" text                     NOT NULL,
  "plan_key"             text                     NOT NULL,
  "credit_limit"         integer                  NOT NULL,
  "used_credits"         integer                  NOT NULL DEFAULT 0,
  "reserved_credits"     integer                  NOT NULL DEFAULT 0,
  "period_start"         timestamp with time zone NOT NULL,
  "period_end"           timestamp with time zone NOT NULL,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "credit_cycle_anchor"  timestamp with time zone NOT NULL,
  CONSTRAINT "billing_credit_balances_check1" CHECK (((used_credits + reserved_credits) <= credit_limit)),
  CONSTRAINT "billing_credit_balances_check" CHECK ((period_end > period_start)),
  CONSTRAINT "billing_credit_balances_credit_limit_check" CHECK ((credit_limit >= 0)),
  CONSTRAINT "billing_credit_balances_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "billing_credit_balances_plan_key_check" CHECK ((plan_key = ANY (ARRAY['starter'::text, 'growth'::text]))),
  CONSTRAINT "billing_credit_balances_reserved_credits_check" CHECK ((reserved_credits >= 0)),
  CONSTRAINT "billing_credit_balances_used_credits_check" CHECK ((used_credits >= 0))
);

ALTER TABLE "public"."billing_credit_balances"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER normalize_billing_credit_cycle_trigger
  BEFORE INSERT OR UPDATE ON public.billing_credit_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_billing_credit_cycle();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."billing_credit_balances" TO "postgres", "service_role";


-- source: public/tables/billing_customers.sql
CREATE TABLE "public"."billing_customers" (
  "user_id"          text                     NOT NULL,
  "dodo_customer_id" text                     NOT NULL,
  "email"            text,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "billing_customers_dodo_customer_id_key" UNIQUE (dodo_customer_id),
  CONSTRAINT "billing_customers_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "public"."billing_customers"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."billing_customers" TO "postgres", "service_role";


-- source: public/tables/billing_subscriptions.sql
CREATE TABLE "public"."billing_subscriptions" (
  "dodo_subscription_id" text                     NOT NULL,
  "user_id"              text                     NOT NULL,
  "dodo_customer_id"     text                     NOT NULL,
  "product_id"           text                     NOT NULL,
  "plan_key"             text                     NOT NULL,
  "billing_interval"     text                     NOT NULL,
  "status"               text                     NOT NULL,
  "current_period_start" timestamp with time zone,
  "current_period_end"   timestamp with time zone,
  "cancel_at_period_end" boolean                  NOT NULL DEFAULT false,
  "cancelled_at"         timestamp with time zone,
  "last_event_at"        timestamp with time zone NOT NULL,
  "last_webhook_id"      text                     NOT NULL,
  "metadata"             jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "billing_subscriptions_billing_interval_check" CHECK ((billing_interval = ANY (ARRAY['monthly'::text, 'yearly'::text]))),
  CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY (dodo_subscription_id),
  CONSTRAINT "billing_subscriptions_plan_key_check" CHECK ((plan_key = ANY (ARRAY['starter'::text, 'growth'::text]))),
  CONSTRAINT "billing_subscriptions_status_check"
    CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'on_hold'::text, 'paused'::text, 'cancelled'::text, 'failed'::text, 'expired'::text])))
);

ALTER TABLE "public"."billing_subscriptions"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX billing_subscriptions_customer_idx ON public.billing_subscriptions USING btree (dodo_customer_id);

CREATE INDEX billing_subscriptions_user_event_idx ON public.billing_subscriptions USING btree (user_id, last_event_at DESC);

CREATE TRIGGER billing_subscriptions_enqueue_paid_trending_prebuild
  AFTER INSERT OR UPDATE OF status, plan_key, current_period_start, user_id ON public.billing_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_paid_trending_prebuild();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."billing_subscriptions" TO "postgres", "service_role";


-- source: public/tables/billing_webhook_events.sql
CREATE TABLE "public"."billing_webhook_events" (
  "webhook_id"      text                     NOT NULL,
  "event_type"      text                     NOT NULL,
  "event_timestamp" timestamp with time zone NOT NULL,
  "status"          text                     NOT NULL DEFAULT 'processing'::text,
  "payload"         jsonb                    NOT NULL,
  "error_message"   text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "processed_at"    timestamp with time zone,
  CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY (webhook_id),
  CONSTRAINT "billing_webhook_events_status_check" CHECK ((status = ANY (ARRAY['processing'::text, 'processed'::text, 'ignored'::text, 'failed'::text])))
);

ALTER TABLE "public"."billing_webhook_events"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX billing_webhook_events_status_created_idx ON public.billing_webhook_events USING btree (status, created_at);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."billing_webhook_events" TO "postgres", "service_role";


-- source: public/tables/carousel_global_settings.sql
CREATE TABLE "public"."carousel_global_settings" (
  "singleton"                boolean                  NOT NULL DEFAULT true,
  "structure_mode"           text                     NOT NULL DEFAULT 'structure_1_only'::text,
  "structure_config_version" integer                  NOT NULL DEFAULT 1,
  "updated_by_user_id"       text,
  "created_at"               timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "carousel_global_settings_pkey" PRIMARY KEY (singleton),
  CONSTRAINT "carousel_global_settings_singleton_check" CHECK (singleton),
  CONSTRAINT "carousel_global_settings_structure_config_version_check" CHECK ((structure_config_version >= 1)),
  CONSTRAINT "carousel_global_settings_structure_mode_check" CHECK ((structure_mode = ANY (ARRAY['rotate'::text, 'structure_1_only'::text, 'structure_2_only'::text])))
);

ALTER TABLE "public"."carousel_global_settings"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."carousel_global_settings" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."carousel_global_settings"."structure_mode" IS 'Global owner-controlled structure mode. Deployment keeps Structure 1 selected until the new database, worker, and application are verified together; the release then explicitly enables strict batch-level rotation.';

COMMENT ON TABLE "public"."carousel_global_settings" IS 'Service-only singleton controlling the global Carousel structure mode. It is seeded to structure_1_only so this foundation migration cannot activate unfinished Structure 2 behavior.';


-- source: public/tables/creative_asset_groups.sql
CREATE TABLE "public"."creative_asset_groups" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    text                     NOT NULL,
  "name"       text                     NOT NULL,
  "media_type" text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "creative_asset_groups_media_type_check" CHECK ((media_type = ANY (ARRAY['video'::text, 'image'::text]))),
  CONSTRAINT "creative_asset_groups_name_check" CHECK (((char_length(btrim(name)) > 0) AND (char_length(btrim(name)) <= 80))),
  CONSTRAINT "creative_asset_groups_pkey" PRIMARY KEY (id),
  CONSTRAINT "creative_asset_groups_user_id_check" CHECK (((char_length(btrim(user_id)) > 0) AND (char_length(btrim(user_id)) <= 200)))
);

ALTER TABLE "public"."creative_asset_groups"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX creative_asset_groups_owner_type_updated_idx ON public.creative_asset_groups USING btree (user_id, media_type, updated_at DESC);

CREATE TRIGGER prepare_creative_asset_group_row
  BEFORE INSERT OR UPDATE ON public.creative_asset_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_creative_asset_group();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."creative_asset_groups" TO "postgres", "service_role";


-- source: public/tables/daily_carousel_replenishment_sweep_state.sql
CREATE TABLE "public"."daily_carousel_replenishment_sweep_state" (
  "singleton"    boolean                  NOT NULL DEFAULT true,
  "cycle_id"     text,
  "cursor"       uuid,
  "status"       text                     NOT NULL DEFAULT 'completed'::text,
  "started_at"   timestamp with time zone,
  "completed_at" timestamp with time zone,
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "daily_carousel_replenishment_sweep_state_check" CHECK (((status <> 'active'::text) OR ((cycle_id IS NOT NULL) AND (started_at IS
    NOT NULL) AND (completed_at IS NULL)))),
  CONSTRAINT "daily_carousel_replenishment_sweep_state_cycle_id_check"
    CHECK (((cycle_id IS NULL) OR (cycle_id ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'::text))),
  CONSTRAINT "daily_carousel_replenishment_sweep_state_pkey" PRIMARY KEY (singleton),
  CONSTRAINT "daily_carousel_replenishment_sweep_state_singleton_check" CHECK (singleton),
  CONSTRAINT "daily_carousel_replenishment_sweep_state_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text])))
);

ALTER TABLE "public"."daily_carousel_replenishment_sweep_state"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_carousel_replenishment_sweep_state" TO "postgres";


-- source: public/tables/demo_videos.sql
CREATE TABLE "public"."demo_videos" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"            text                     NOT NULL,
  "project_id"         text                     NOT NULL,
  "title"              text                     NOT NULL,
  "source_s3_key"      text                     NOT NULL,
  "source_video_url"   text                     NOT NULL,
  "thumbnail_url"      text,
  "file_name"          text                     NOT NULL,
  "file_type"          text                     NOT NULL,
  "file_size_bytes"    bigint                   NOT NULL,
  "duration_seconds"   numeric,
  "width"              integer,
  "height"             integer,
  "ratio"              text                     NOT NULL DEFAULT '9:16'::text,
  "draft_json"         jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "rendered_video_url" text,
  "latest_render_id"   uuid,
  "status"             text                     NOT NULL DEFAULT 'uploading'::text,
  "error_message"      text,
  "deleted_at"         timestamp with time zone,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "demo_videos_draft_json_check" CHECK ((jsonb_typeof(draft_json) = 'object'::text)),
  CONSTRAINT "demo_videos_duration_seconds_check" CHECK (((duration_seconds IS NULL) OR ((duration_seconds >= (1)::numeric) AND (duration_seconds <= (60)::numeric)))),
  CONSTRAINT "demo_videos_file_size_bytes_check" CHECK (((file_size_bytes > 0) AND (file_size_bytes <= 104857600))),
  CONSTRAINT "demo_videos_file_type_check" CHECK ((file_type = ANY (ARRAY['video/mp4'::text, 'video/quicktime'::text, 'video/webm'::text]))),
  CONSTRAINT "demo_videos_height_check" CHECK (((height IS NULL) OR (height > 0))),
  CONSTRAINT "demo_videos_pkey" PRIMARY KEY (id),
  CONSTRAINT "demo_videos_ratio_check" CHECK ((ratio = ANY (ARRAY['9:16'::text, '1:1'::text, '4:5'::text, '16:9'::text, 'other'::text]))),
  CONSTRAINT "demo_videos_status_check"
    CHECK ((status = ANY (ARRAY['uploading'::text, 'processing'::text, 'ready'::text, 'draft'::text, 'rendering'::text, 'rendered'::text, 'failed'::text]))),
  CONSTRAINT "demo_videos_width_check" CHECK (((width IS NULL) OR (width > 0)))
);

ALTER TABLE "public"."demo_videos"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX demo_videos_latest_render_idx ON public.demo_videos USING btree (latest_render_id)
  WHERE (latest_render_id IS NOT NULL);

CREATE UNIQUE INDEX demo_videos_user_project_source_key_idx ON public.demo_videos USING btree (user_id, project_id, source_s3_key)
  WHERE (deleted_at IS NULL);

CREATE INDEX demo_videos_user_project_status_idx ON public.demo_videos USING btree (user_id, project_id, status, updated_at DESC)
  WHERE (deleted_at IS NULL);

CREATE INDEX demo_videos_user_project_updated_idx ON public.demo_videos USING btree (user_id, project_id, updated_at DESC)
  WHERE (deleted_at IS NULL);

CREATE TRIGGER sync_deleted_demo_media_trigger
  AFTER UPDATE OF deleted_at ON public.demo_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_deleted_demo_media();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."demo_videos" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."demo_videos" FROM "anon";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."demo_videos" TO "anon";

REVOKE ALL ON TABLE "public"."demo_videos" FROM "authenticated";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."demo_videos" TO "authenticated";


-- source: public/tables/editable_videos.sql
CREATE TABLE "public"."editable_videos" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"            text                     NOT NULL,
  "project_id"         text                     NOT NULL,
  "source_video_id"    text                     NOT NULL,
  "source"             text                     NOT NULL,
  "title"              text                     NOT NULL,
  "ratio"              text                     NOT NULL DEFAULT '9:16'::text,
  "source_video_url"   text,
  "thumbnail_url"      text,
  "duration_seconds"   numeric,
  "draft_json"         jsonb,
  "rendered_video_url" text,
  "latest_render_id"   uuid,
  "status"             text                     NOT NULL DEFAULT 'ready'::text,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at"         timestamp with time zone,
  CONSTRAINT "editable_videos_draft_json_check" CHECK (((draft_json IS NULL) OR (jsonb_typeof(draft_json) = 'object'::text))),
  CONSTRAINT "editable_videos_duration_seconds_check" CHECK (((duration_seconds IS NULL) OR (duration_seconds >= (0)::numeric))),
  CONSTRAINT "editable_videos_pkey" PRIMARY KEY (id),
  CONSTRAINT "editable_videos_ratio_check" CHECK ((ratio = ANY (ARRAY['9:16'::text, '1:1'::text, '4:5'::text, '16:9'::text]))),
  CONSTRAINT "editable_videos_source_check" CHECK ((source = ANY (ARRAY['hook'::text, 'demo'::text, 'draft'::text, 'final'::text]))),
  CONSTRAINT "editable_videos_status_check" CHECK ((status = ANY (ARRAY['ready'::text, 'draft'::text, 'rendering'::text, 'rendered'::text, 'failed'::text]))),
  CONSTRAINT "editable_videos_user_id_project_id_source_video_id_key" UNIQUE (user_id, project_id, source_video_id)
);

ALTER TABLE "public"."editable_videos"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX editable_videos_latest_render_idx ON public.editable_videos USING btree (latest_render_id)
  WHERE (latest_render_id IS NOT NULL);

CREATE INDEX editable_videos_user_active_updated_idx ON public.editable_videos USING btree (user_id, updated_at DESC)
  WHERE (deleted_at IS NULL);

CREATE INDEX editable_videos_user_project_updated_idx ON public.editable_videos USING btree (user_id, project_id, updated_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."editable_videos" TO "postgres";

REVOKE ALL ON TABLE "public"."editable_videos" FROM "anon";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."editable_videos" TO "anon";

REVOKE ALL ON TABLE "public"."editable_videos" FROM "authenticated";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."editable_videos" TO "authenticated";

REVOKE ALL ON TABLE "public"."editable_videos" FROM "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."editable_videos" TO "service_role";


-- source: public/tables/free_trial_entitlements.sql
CREATE TABLE "public"."free_trial_entitlements" (
  "user_id"                  text                     NOT NULL,
  "started_at"               timestamp with time zone NOT NULL,
  "expires_at"               timestamp with time zone NOT NULL,
  "content_days_limit"       integer                  NOT NULL DEFAULT 3,
  "daily_content_pieces"     integer                  NOT NULL DEFAULT 10,
  "instagram_schedule_limit" integer                  NOT NULL DEFAULT 5,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "free_trial_entitlements_check" CHECK ((expires_at > started_at)),
  CONSTRAINT "free_trial_entitlements_content_days_limit_check" CHECK ((content_days_limit > 0)),
  CONSTRAINT "free_trial_entitlements_daily_content_pieces_check" CHECK ((daily_content_pieces > 0)),
  CONSTRAINT "free_trial_entitlements_instagram_schedule_limit_check" CHECK ((instagram_schedule_limit >= 0)),
  CONSTRAINT "free_trial_entitlements_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "public"."free_trial_entitlements"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."free_trial_entitlements" TO "postgres", "service_role";


-- source: public/tables/hook_audio_assets.sql
CREATE TABLE "public"."hook_audio_assets" (
  "id"                       text                     NOT NULL,
  "source_package"           text                     NOT NULL,
  "source_file_name"         text                     NOT NULL,
  "storage_provider"         text                     NOT NULL DEFAULT 'gcp'::text,
  "storage_key"              text                     NOT NULL,
  "audio_url"                text                     NOT NULL,
  "duration_seconds"         numeric(10,3)            NOT NULL,
  "codec"                    text                     NOT NULL DEFAULT 'mp3'::text,
  "sample_rate_hz"           integer,
  "channels"                 integer,
  "bit_rate_bps"             integer,
  "moods"                    text[]                   NOT NULL DEFAULT '{}'::text[],
  "hook_types"               text[]                   NOT NULL DEFAULT '{}'::text[],
  "energy"                   text,
  "impact_at_seconds"        numeric(10,3),
  "loopable"                 boolean                  NOT NULL DEFAULT false,
  "measured_integrated_lufs" numeric(6,2),
  "measured_true_peak_db"    numeric(6,2),
  "sha256"                   text                     NOT NULL,
  "file_size_bytes"          bigint                   NOT NULL,
  "review_status"            text                     NOT NULL DEFAULT 'pending'::text,
  "reviewed_at"              timestamp with time zone,
  "review_notes"             text,
  "status"                   text                     NOT NULL DEFAULT 'inactive'::text,
  "schema_version"           text                     NOT NULL DEFAULT 'hook-audio-library-v1'::text,
  "tagging_version"          text                     NOT NULL DEFAULT 'hook-audio-tagging-v1'::text,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "hook_audio_assets_active_review_check" CHECK (((status <> 'active'::text) OR ((review_status = 'approved'::text) AND (reviewed_at IS
    NOT NULL) AND ((cardinality(moods) >= 1) AND (cardinality(moods) <= 2)) AND ((cardinality(hook_types) >= 2) AND (cardinality(hook_types) <= 4)) AND (energy IS NOT NULL)))),
  CONSTRAINT "hook_audio_assets_audio_url_check" CHECK ((audio_url ~ '^https://'::text)),
  CONSTRAINT "hook_audio_assets_bit_rate_bps_check" CHECK (((bit_rate_bps IS NULL) OR (bit_rate_bps > 0))),
  CONSTRAINT "hook_audio_assets_channels_check" CHECK (((channels IS NULL) OR ((channels >= 1) AND (channels <= 8)))),
  CONSTRAINT "hook_audio_assets_check" CHECK (((impact_at_seconds IS NULL) OR ((impact_at_seconds >= (0)::numeric) AND (impact_at_seconds < duration_seconds)))),
  CONSTRAINT "hook_audio_assets_codec_check" CHECK ((codec = 'mp3'::text)),
  CONSTRAINT "hook_audio_assets_duration_seconds_check" CHECK (((duration_seconds > (0)::numeric) AND (duration_seconds <= (600)::numeric))),
  CONSTRAINT "hook_audio_assets_energy_check" CHECK (((energy IS NULL) OR (energy = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))),
  CONSTRAINT "hook_audio_assets_file_size_bytes_check" CHECK ((file_size_bytes > 0)),
  CONSTRAINT "hook_audio_assets_hook_types_check"
    CHECK
    (((hook_types <@ ARRAY['curiosity'::text, 'problem'::text, 'warning'::text, 'transformation'::text, 'benefit'::text, 'story'::text, 'authority'::text]) AND
    (cardinality(hook_types) <= 4))),
  CONSTRAINT "hook_audio_assets_id_check" CHECK ((id ~ '^hook_audio_[0-9]{3}$'::text)),
  CONSTRAINT "hook_audio_assets_loopable_check" CHECK ((NOT loopable)),
  CONSTRAINT "hook_audio_assets_moods_check"
    CHECK (((moods <@ ARRAY['curious'::text, 'uplifting'::text, 'serious'::text, 'calm'::text, 'urgent'::text, 'playful'::text]) AND (cardinality(moods) <= 2))),
  CONSTRAINT "hook_audio_assets_pkey" PRIMARY KEY (id),
  CONSTRAINT "hook_audio_assets_review_status_check" CHECK ((review_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
  CONSTRAINT "hook_audio_assets_review_timestamp_check"
    CHECK ((((review_status = 'pending'::text) AND (reviewed_at IS NULL)) OR ((review_status = ANY (ARRAY['approved'::text, 'rejected'::text])) AND (reviewed_at IS NOT NULL)))),
  CONSTRAINT "hook_audio_assets_sample_rate_hz_check" CHECK (((sample_rate_hz IS NULL) OR (sample_rate_hz > 0))),
  CONSTRAINT "hook_audio_assets_schema_version_check" CHECK ((char_length(btrim(schema_version)) > 0)),
  CONSTRAINT "hook_audio_assets_sha256_check" CHECK ((sha256 ~ '^[a-f0-9]{64}$'::text)),
  CONSTRAINT "hook_audio_assets_sha256_key" UNIQUE (sha256),
  CONSTRAINT "hook_audio_assets_source_file_name_check"
    CHECK ((((char_length(btrim(source_file_name)) >= 5) AND (char_length(btrim(source_file_name)) <= 255)) AND (lower(source_file_name) ~~ '%.mp3'::text))),
  CONSTRAINT "hook_audio_assets_source_package_check" CHECK (((char_length(btrim(source_package)) >= 1) AND (char_length(btrim(source_package)) <= 120))),
  CONSTRAINT "hook_audio_assets_status_check" CHECK ((status = ANY (ARRAY['inactive'::text, 'active'::text]))),
  CONSTRAINT "hook_audio_assets_storage_key_check" CHECK ((char_length(btrim(storage_key)) > 0)),
  CONSTRAINT "hook_audio_assets_storage_key_key" UNIQUE (storage_key),
  CONSTRAINT "hook_audio_assets_storage_provider_check" CHECK ((storage_provider = 'gcp'::text)),
  CONSTRAINT "hook_audio_assets_tag_completeness_check"
    CHECK
    ((((cardinality(moods) = 0) AND (cardinality(hook_types) = 0) AND (energy IS NULL)) OR (((cardinality(moods) >= 1) AND (cardinality(moods) <= 2)) AND ((cardinality(hook_types)
    >= 2) AND (cardinality(hook_types) <= 4)) AND (energy IS NOT NULL)))),
  CONSTRAINT "hook_audio_assets_tagging_version_check" CHECK ((char_length(btrim(tagging_version)) > 0))
);

ALTER TABLE "public"."hook_audio_assets"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX hook_audio_assets_active_matching_idx ON public.hook_audio_assets USING btree (energy, duration_seconds, id)
  WHERE ((status = 'active'::text) AND (review_status = 'approved'::text));

CREATE INDEX hook_audio_assets_review_queue_idx ON public.hook_audio_assets USING btree (review_status, status, id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hook_audio_assets" TO "postgres", "service_role";


-- source: public/tables/hook_formats.sql
CREATE TABLE "public"."hook_formats" (
  "id"           text                     NOT NULL,
  "display_name" text                     NOT NULL,
  "description"  text                     NOT NULL,
  "audio_mode"   text                     NOT NULL DEFAULT 'dynamic'::text,
  "status"       text                     NOT NULL DEFAULT 'active'::text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "hook_formats_audio_mode_check" CHECK ((audio_mode = ANY (ARRAY['dynamic'::text, 'preferred'::text]))),
  CONSTRAINT "hook_formats_description_check" CHECK (((char_length(btrim(description)) >= 1) AND (char_length(btrim(description)) <= 500))),
  CONSTRAINT "hook_formats_display_name_check" CHECK (((char_length(btrim(display_name)) >= 1) AND (char_length(btrim(display_name)) <= 140))),
  CONSTRAINT "hook_formats_id_check" CHECK ((((char_length(id) >= 1) AND (char_length(id) <= 100)) AND (id ~ '^[a-z0-9]+(_[a-z0-9]+)*$'::text))),
  CONSTRAINT "hook_formats_pkey" PRIMARY KEY (id),
  CONSTRAINT "hook_formats_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);

ALTER TABLE "public"."hook_formats"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hook_formats" TO "postgres";

REVOKE ALL ON TABLE "public"."hook_formats" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."hook_formats" TO "service_role";


-- source: public/tables/hook_text_formats.sql
CREATE TABLE "public"."hook_text_formats" (
  "id"                 text                     NOT NULL,
  "family"             text                     NOT NULL,
  "name"               text                     NOT NULL,
  "canonical_template" text                     NOT NULL,
  "required_variables" text[]                   NOT NULL DEFAULT '{}'::text[],
  "optional_variables" text[]                   NOT NULL DEFAULT '{}'::text[],
  "psychology"         text[]                   NOT NULL DEFAULT '{}'::text[],
  "initial_confidence" text                     NOT NULL,
  "global_status"      text                     NOT NULL DEFAULT 'global_v1'::text,
  "allowed_tones"      text[]                   NOT NULL DEFAULT '{}'::text[],
  "generation_rules"   jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "library_version"    text                     NOT NULL DEFAULT 'global-hook-text-formats-v1'::text,
  "enabled"            boolean                  NOT NULL DEFAULT true,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "hook_text_formats_canonical_template_check"
    CHECK (((char_length(TRIM(BOTH FROM canonical_template)) >= 1) AND (char_length(TRIM(BOTH FROM canonical_template)) <= 500))),
  CONSTRAINT "hook_text_formats_family_check" CHECK ((family ~ '^[a-z0-9_]+$'::text)),
  CONSTRAINT "hook_text_formats_family_key" UNIQUE (family),
  CONSTRAINT "hook_text_formats_generation_rules_check" CHECK ((jsonb_typeof(generation_rules) = 'object'::text)),
  CONSTRAINT "hook_text_formats_global_status_check" CHECK ((global_status = ANY (ARRAY['global_v1'::text, 'global_candidate'::text, 'retired'::text]))),
  CONSTRAINT "hook_text_formats_id_check" CHECK ((id ~ '^GF_[0-9]{3}$'::text)),
  CONSTRAINT "hook_text_formats_initial_confidence_check" CHECK ((initial_confidence = ANY (ARRAY['tier_a'::text, 'tier_b'::text, 'tier_c'::text]))),
  CONSTRAINT "hook_text_formats_name_check" CHECK (((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(TRIM(BOTH FROM name)) <= 120))),
  CONSTRAINT "hook_text_formats_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."hook_text_formats"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hook_text_formats" TO "postgres", "service_role";

COMMENT ON TABLE "public"."hook_text_formats" IS 'Reusable Hook writing structures. Independent of visual hook_formats and audio mappings.';


-- source: public/tables/library_items.sql
CREATE TABLE "public"."library_items" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       text                     NOT NULL,
  "project_id"    text                     NOT NULL,
  "source_type"   text                     NOT NULL,
  "source_id"     text                     NOT NULL,
  "media_type"    text                     NOT NULL DEFAULT 'carousel'::text,
  "title"         text                     NOT NULL,
  "cover_url"     text,
  "thumbnail_url" text,
  "status"        text                     NOT NULL DEFAULT 'ready'::text,
  "metadata"      jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "deleted_at"    timestamp with time zone,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "library_items_media_type_check" CHECK ((media_type = 'carousel'::text)),
  CONSTRAINT "library_items_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text)),
  CONSTRAINT "library_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "library_items_source_type_check" CHECK ((source_type = 'generated_carousel'::text)),
  CONSTRAINT "library_items_status_check" CHECK ((status = ANY (ARRAY['ready'::text, 'archived'::text])))
);

ALTER TABLE "public"."library_items"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX library_items_user_project_updated_idx ON public.library_items USING btree (user_id, project_id, updated_at DESC)
  WHERE (deleted_at IS NULL);

CREATE UNIQUE INDEX library_items_user_source_uidx ON public.library_items USING btree (user_id, source_type, source_id)
  WHERE (deleted_at IS NULL);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."library_items" TO "postgres", "service_role";


-- source: public/tables/media_assets.sql
CREATE TABLE "public"."media_assets" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          text                     NOT NULL,
  "project_id"       text,
  "collection"       text                     NOT NULL,
  "source_type"      text                     NOT NULL,
  "source_record_id" text,
  "parent_asset_id"  uuid,
  "title"            text                     NOT NULL,
  "storage_key"      text                     NOT NULL,
  "url"              text                     NOT NULL,
  "thumbnail_url"    text,
  "mime_type"        text                     NOT NULL,
  "file_name"        text,
  "file_size_bytes"  bigint,
  "duration_seconds" numeric,
  "width"            integer,
  "height"           integer,
  "ratio"            text                     NOT NULL DEFAULT 'other'::text,
  "status"           text                     NOT NULL DEFAULT 'uploading'::text,
  "metadata"         jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "deleted_at"       timestamp with time zone,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "media_assets_collection_check" CHECK ((collection = ANY (ARRAY['influencer'::text, 'video'::text, 'image'::text]))),
  CONSTRAINT "media_assets_duration_seconds_check" CHECK (((duration_seconds IS NULL) OR (duration_seconds >= (0)::numeric))),
  CONSTRAINT "media_assets_file_size_bytes_check" CHECK (((file_size_bytes IS NULL) OR (file_size_bytes > 0))),
  CONSTRAINT "media_assets_height_check" CHECK (((height IS NULL) OR (height > 0))),
  CONSTRAINT "media_assets_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text)),
  CONSTRAINT "media_assets_mime_type_check" CHECK ((char_length(TRIM(BOTH FROM mime_type)) > 0)),
  CONSTRAINT "media_assets_pkey" PRIMARY KEY (id),
  CONSTRAINT "media_assets_parent_asset_id_fkey" FOREIGN KEY (parent_asset_id) REFERENCES public.media_assets(id) ON DELETE SET NULL,
  CONSTRAINT "media_assets_ratio_check" CHECK ((ratio = ANY (ARRAY['9:16'::text, '1:1'::text, '4:5'::text, '16:9'::text, 'other'::text]))),
  CONSTRAINT "media_assets_source_type_check"
    CHECK
    ((source_type = ANY (ARRAY['upload'::text, 'influencer_upload'::text, 'demo_upload'::text, 'catalog_influencer'::text, 'generated_image'::text, 'generated_video'::text,
    'edit_export'::text, 'combined_render'::text, 'wall_text_render'::text]))),
  CONSTRAINT "media_assets_status_check" CHECK ((status = ANY (ARRAY['uploading'::text, 'processing'::text, 'ready'::text, 'failed'::text]))),
  CONSTRAINT "media_assets_storage_key_check" CHECK ((char_length(TRIM(BOTH FROM storage_key)) > 0)),
  CONSTRAINT "media_assets_thumbnail_url_check" CHECK (((thumbnail_url IS NULL) OR (thumbnail_url ~ '^https?://'::text))),
  CONSTRAINT "media_assets_title_check" CHECK (((char_length(TRIM(BOTH FROM title)) > 0) AND (char_length(title) <= 140))),
  CONSTRAINT "media_assets_url_check" CHECK ((url ~ '^https?://'::text)),
  CONSTRAINT "media_assets_width_check" CHECK (((width IS NULL) OR (width > 0)))
);

ALTER TABLE "public"."media_assets"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX media_assets_parent_idx ON public.media_assets USING btree (parent_asset_id)
  WHERE ((parent_asset_id IS NOT NULL) AND (deleted_at IS NULL));

CREATE INDEX media_assets_user_collection_updated_idx ON public.media_assets USING btree (user_id, collection, updated_at DESC)
  WHERE (deleted_at IS NULL);

CREATE UNIQUE INDEX media_assets_user_source_record_idx ON public.media_assets USING btree (user_id, source_type, source_record_id)
  WHERE ((source_record_id IS NOT NULL) AND (deleted_at IS NULL));

CREATE UNIQUE INDEX media_assets_user_storage_key_idx ON public.media_assets USING btree (user_id, storage_key)
  WHERE (deleted_at IS NULL);

CREATE TRIGGER require_active_demo_for_media_insert_trigger
  BEFORE INSERT ON public.media_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.require_active_demo_for_media();

CREATE TRIGGER require_active_demo_for_media_update_trigger
  BEFORE UPDATE OF user_id, project_id, source_type, source_record_id, deleted_at ON public.media_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.require_active_demo_for_media();

CREATE TRIGGER sync_deleted_demo_source_trigger
  AFTER UPDATE OF deleted_at ON public.media_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_deleted_demo_source();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."media_assets" TO "postgres", "service_role";


-- source: public/tables/oauth_states.sql
CREATE TABLE "public"."oauth_states" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       text                     NOT NULL,
  "platform"      text                     NOT NULL,
  "state_hash"    text                     NOT NULL,
  "code_verifier" text,
  "redirect_to"   text                     NOT NULL DEFAULT '/connected-accounts'::text,
  "expires_at"    timestamp with time zone NOT NULL,
  "consumed_at"   timestamp with time zone,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "oauth_states_pkey" PRIMARY KEY (id),
  CONSTRAINT "oauth_states_platform_check" CHECK ((platform = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'youtube'::text]))),
  CONSTRAINT "oauth_states_state_hash_key" UNIQUE (state_hash)
);

ALTER TABLE "public"."oauth_states"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX oauth_states_expiry_idx ON public.oauth_states USING btree (expires_at)
  WHERE (consumed_at IS NULL);

CREATE INDEX oauth_states_platform_hash_idx ON public.oauth_states USING btree (platform, state_hash);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."oauth_states" TO "postgres", "service_role";


-- source: public/tables/product_feedback_attachment_uploads.sql
CREATE TABLE "public"."product_feedback_attachment_uploads" (
  "id"              uuid                     NOT NULL,
  "user_id"         text                     NOT NULL,
  "storage_key"     text                     NOT NULL,
  "file_name"       text                     NOT NULL,
  "mime_type"       text                     NOT NULL,
  "file_size_bytes" bigint                   NOT NULL,
  "status"          text                     NOT NULL DEFAULT 'pending'::text,
  "feedback_id"     uuid,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "attached_at"     timestamp with time zone,
  CONSTRAINT "product_feedback_attachment_uploads_feedback_id_key" UNIQUE (feedback_id),
  CONSTRAINT "product_feedback_attachment_uploads_file_name_check" CHECK (((char_length(file_name) >= 1) AND (char_length(file_name) <= 255))),
  CONSTRAINT "product_feedback_attachment_uploads_file_size_bytes_check" CHECK (((file_size_bytes >= 1) AND (file_size_bytes <= 10485760))),
  CONSTRAINT "product_feedback_attachment_uploads_mime_type_check" CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text]))),
  CONSTRAINT "product_feedback_attachment_uploads_pkey" PRIMARY KEY (id),
  CONSTRAINT "product_feedback_attachment_uploads_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'attached'::text]))),
  CONSTRAINT "product_feedback_attachment_uploads_storage_key_check" CHECK (((char_length(storage_key) >= 1) AND (char_length(storage_key) <= 1000))),
  CONSTRAINT "product_feedback_attachment_uploads_storage_key_key" UNIQUE (storage_key),
  CONSTRAINT "product_feedback_attachment_uploads_user_id_check" CHECK (((char_length(user_id) >= 1) AND (char_length(user_id) <= 128)))
);

ALTER TABLE "public"."product_feedback_attachment_uploads"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX product_feedback_attachment_uploads_user_created_idx ON public.product_feedback_attachment_uploads USING btree (user_id, created_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."product_feedback_attachment_uploads" TO "postgres";

COMMENT ON TABLE "public"."product_feedback_attachment_uploads" IS 'Service-only, short-lived image-upload records for authenticated product feedback.';

REVOKE ALL ON TABLE "public"."product_feedback_attachment_uploads" FROM "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."product_feedback_attachment_uploads" TO "service_role";


-- source: public/tables/product_feedback.sql
CREATE TABLE "public"."product_feedback" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                text                     NOT NULL,
  "user_email"             text,
  "user_display_name"      text,
  "feedback_type"          text                     NOT NULL,
  "title"                  text                     NOT NULL,
  "description"            text                     NOT NULL,
  "source_path"            text,
  "user_agent"             text,
  "status"                 text                     NOT NULL DEFAULT 'new'::text,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "attachment_upload_id"   uuid,
  "attachment_storage_key" text,
  "attachment_file_name"   text,
  "attachment_mime_type"   text,
  "attachment_size_bytes"  bigint,
  "attachment_width"       integer,
  "attachment_height"      integer,
  CONSTRAINT "product_feedback_attachment_metadata_check"
    CHECK
    ((((attachment_upload_id IS NULL) AND (attachment_storage_key IS NULL) AND (attachment_file_name IS NULL) AND (attachment_mime_type IS NULL) AND (attachment_size_bytes IS NULL)
    AND (attachment_width IS NULL) AND (attachment_height IS NULL)) OR ((attachment_upload_id IS NOT NULL) AND (attachment_storage_key IS NOT NULL) AND (attachment_file_name IS
    NOT NULL) AND (attachment_mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])) AND
    ((attachment_size_bytes >= 1) AND (attachment_size_bytes <= 10485760)) AND ((attachment_width >= 1) AND (attachment_width <= 10000)) AND
    ((attachment_height >= 1) AND (attachment_height <= 10000))))),
  CONSTRAINT "product_feedback_attachment_upload_id_key" UNIQUE (attachment_upload_id),
  CONSTRAINT "product_feedback_description_check" CHECK (((char_length(description) >= 10) AND (char_length(description) <= 4000))),
  CONSTRAINT "product_feedback_feedback_type_check" CHECK ((feedback_type = ANY (ARRAY['support_ticket'::text, 'feature_request'::text]))),
  CONSTRAINT "product_feedback_pkey" PRIMARY KEY (id),
  CONSTRAINT "product_feedback_source_path_check" CHECK (((source_path IS NULL) OR (char_length(source_path) <= 500))),
  CONSTRAINT "product_feedback_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'reviewing'::text, 'planned'::text, 'resolved'::text, 'declined'::text]))),
  CONSTRAINT "product_feedback_title_check" CHECK (((char_length(title) >= 3) AND (char_length(title) <= 120))),
  CONSTRAINT "product_feedback_user_agent_check" CHECK (((user_agent IS NULL) OR (char_length(user_agent) <= 1000))),
  CONSTRAINT "product_feedback_user_display_name_check" CHECK (((user_display_name IS NULL) OR (char_length(user_display_name) <= 160))),
  CONSTRAINT "product_feedback_user_email_check" CHECK (((user_email IS NULL) OR (char_length(user_email) <= 320))),
  CONSTRAINT "product_feedback_user_id_check" CHECK (((char_length(user_id) >= 1) AND (char_length(user_id) <= 128)))
);

ALTER TABLE "public"."product_feedback"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX product_feedback_status_created_idx ON public.product_feedback USING btree (status, created_at DESC);

CREATE INDEX product_feedback_user_created_idx ON public.product_feedback USING btree (user_id, created_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."product_feedback" TO "postgres";

COMMENT ON TABLE "public"."product_feedback" IS 'Authenticated support tickets and feature requests submitted from Settings. The table is service-role only so customer identity and feedback are never exposed through the browser Data API.';

REVOKE ALL ON TABLE "public"."product_feedback" FROM "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."product_feedback" TO "service_role";


-- source: public/tables/social_connections.sql
CREATE TABLE "public"."social_connections" (
  "id"                        uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                   text                     NOT NULL,
  "platform"                  text                     NOT NULL,
  "platform_account_id"       text                     NOT NULL,
  "platform_account_name"     text,
  "platform_account_username" text,
  "scopes"                    text[]                   NOT NULL DEFAULT '{}'::text[],
  "access_token_ciphertext"   text                     NOT NULL,
  "refresh_token_ciphertext"  text,
  "token_type"                text,
  "expires_at"                timestamp with time zone,
  "metadata"                  jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "connected_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                timestamp with time zone NOT NULL DEFAULT now(),
  "revoked_at"                timestamp with time zone,
  "provider"                  text                     NOT NULL,
  "status"                    text                     NOT NULL DEFAULT 'connected'::text,
  "last_error_code"           text,
  "refresh_expires_at"        timestamp with time zone,
  "token_refreshed_at"        timestamp with time zone,
  "token_refresh_claim_token" uuid,
  "token_refresh_claimed_at"  timestamp with time zone,
  CONSTRAINT "social_connections_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text)),
  CONSTRAINT "social_connections_pkey" PRIMARY KEY (id),
  CONSTRAINT "social_connections_platform_check" CHECK ((platform = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'youtube'::text]))),
  CONSTRAINT "social_connections_provider_check" CHECK ((provider = ANY (ARRAY['meta'::text, 'tiktok'::text, 'google'::text]))),
  CONSTRAINT "social_connections_provider_platform_check"
    CHECK
    ((((provider = 'meta'::text) AND (platform = 'instagram'::text)) OR ((provider = 'tiktok'::text) AND (platform = 'tiktok'::text)) OR ((provider = 'google'::text) AND (platform
    = 'youtube'::text)))),
  CONSTRAINT "social_connections_refresh_claim_check" CHECK ((((token_refresh_claim_token IS NULL) AND (token_refresh_claimed_at IS NULL)) OR ((token_refresh_claim_token IS
    NOT NULL) AND (token_refresh_claimed_at IS NOT NULL)))),
  CONSTRAINT "social_connections_status_check" CHECK ((status = ANY (ARRAY['connected'::text, 'expired'::text, 'revoked'::text, 'permission_missing'::text, 'error'::text])))
);

ALTER TABLE "public"."social_connections"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX social_connections_refresh_claim_idx ON public.social_connections USING btree (token_refresh_claimed_at)
  WHERE (token_refresh_claim_token IS NOT NULL);

CREATE INDEX social_connections_user_platform_idx ON public.social_connections USING btree (user_id, platform, updated_at DESC);

CREATE UNIQUE INDEX social_connections_user_provider_account_idx ON public.social_connections USING btree (user_id, PROVIDER, platform_account_id);

CREATE INDEX social_connections_user_status_idx ON public.social_connections USING btree (user_id, status, updated_at DESC);

CREATE TRIGGER enforce_instagram_connection_limit
  BEFORE INSERT OR UPDATE OF user_id, platform, revoked_at ON public.social_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_instagram_connection_limit();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."social_connections" TO "postgres", "service_role";


-- source: public/tables/subscription_entitlements.sql
CREATE TABLE "public"."subscription_entitlements" (
  "plan_key"             text                     NOT NULL,
  "display_name"         text                     NOT NULL,
  "daily_carousel_limit" integer                  NOT NULL,
  "is_active"            boolean                  NOT NULL DEFAULT true,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "daily_trending_limit" integer,
  CONSTRAINT "subscription_entitlements_daily_carousel_limit_check" CHECK ((daily_carousel_limit > 0)),
  CONSTRAINT "subscription_entitlements_daily_trending_limit_check" CHECK (((daily_trending_limit IS NULL) OR (daily_trending_limit > 0))),
  CONSTRAINT "subscription_entitlements_pkey" PRIMARY KEY (plan_key)
);

ALTER TABLE "public"."subscription_entitlements"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subscription_entitlements" TO "postgres", "service_role";


-- source: public/tables/trending_content_mix_preferences.sql
CREATE TABLE "public"."trending_content_mix_preferences" (
  "user_id"            text                     NOT NULL,
  "carousel_percent"   integer                  NOT NULL DEFAULT 25,
  "wall_text_percent"  integer                  NOT NULL DEFAULT 50,
  "hook_video_percent" integer                  NOT NULL DEFAULT 25,
  "preference_version" integer                  NOT NULL DEFAULT 1,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "trending_content_mix_preferences_percentages_check"
    CHECK
    ((((carousel_percent >= 0) AND (carousel_percent <= 100)) AND ((wall_text_percent >= 0) AND (wall_text_percent <= 100)) AND ((hook_video_percent >= 0) AND (hook_video_percent
    <= 100)) AND (((carousel_percent + wall_text_percent) + hook_video_percent) = 100))),
  CONSTRAINT "trending_content_mix_preferences_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "trending_content_mix_preferences_preference_version_check" CHECK ((preference_version > 0))
);

ALTER TABLE "public"."trending_content_mix_preferences"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."trending_content_mix_preferences" TO "postgres", "service_role";


-- source: public/tables/trending_creative_decisions.sql
CREATE TABLE "public"."trending_creative_decisions" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       text                     NOT NULL,
  "assignment_id" uuid                     NOT NULL,
  "creative_id"   uuid                     NOT NULL,
  "format"        text                     NOT NULL,
  "decision"      text                     NOT NULL,
  "decided_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "trending_creative_decisions_assignment_key" UNIQUE (format, assignment_id),
  CONSTRAINT "trending_creative_decisions_creative_key" UNIQUE (user_id, format, creative_id),
  CONSTRAINT "trending_creative_decisions_decision_check" CHECK ((decision = ANY (ARRAY['accepted'::text, 'rejected'::text]))),
  CONSTRAINT "trending_creative_decisions_format_check" CHECK ((format = ANY (ARRAY['carousel'::text, 'hook_video'::text, 'wall_text'::text]))),
  CONSTRAINT "trending_creative_decisions_pkey" PRIMARY KEY (id),
  CONSTRAINT "trending_creative_decisions_user_id_check" CHECK ((char_length(TRIM(BOTH FROM user_id)) > 0))
);

ALTER TABLE "public"."trending_creative_decisions"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX trending_creative_decisions_user_decided_idx ON public.trending_creative_decisions USING btree (user_id, decided_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."trending_creative_decisions" TO "postgres", "service_role";


-- source: public/tables/video_render_jobs.sql
CREATE TABLE "public"."video_render_jobs" (
  "render_id"        uuid                     NOT NULL,
  "trigger_run_id"   text,
  "user_id"          text                     NOT NULL,
  "project_id"       text                     NOT NULL,
  "source_video_id"  text                     NOT NULL,
  "source_video_url" text                     NOT NULL,
  "ratio"            text                     NOT NULL DEFAULT '9:16'::text,
  "draft_json"       jsonb                    NOT NULL,
  "status"           text                     NOT NULL DEFAULT 'queued'::text,
  "output_s3_key"    text,
  "output_url"       text,
  "error_message"    text,
  "started_at"       timestamp with time zone,
  "completed_at"     timestamp with time zone,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "video_render_jobs_draft_json_check" CHECK ((jsonb_typeof(draft_json) = 'object'::text)),
  CONSTRAINT "video_render_jobs_pkey" PRIMARY KEY (render_id),
  CONSTRAINT "video_render_jobs_ratio_check" CHECK ((ratio = ANY (ARRAY['9:16'::text, '1:1'::text, '4:5'::text, '16:9'::text]))),
  CONSTRAINT "video_render_jobs_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'rendering'::text, 'completed'::text, 'failed'::text]))),
  CONSTRAINT "video_render_jobs_trigger_run_id_key" UNIQUE (trigger_run_id)
);

ALTER TABLE "public"."video_render_jobs"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX video_render_jobs_source_video_idx ON public.video_render_jobs USING btree (user_id, project_id, source_video_id, created_at DESC);

CREATE INDEX video_render_jobs_user_project_created_idx ON public.video_render_jobs USING btree (user_id, project_id, created_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."video_render_jobs" TO "postgres";

REVOKE ALL ON TABLE "public"."video_render_jobs" FROM "anon";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."video_render_jobs" TO "anon";

REVOKE ALL ON TABLE "public"."video_render_jobs" FROM "authenticated";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."video_render_jobs" TO "authenticated";

REVOKE ALL ON TABLE "public"."video_render_jobs" FROM "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."video_render_jobs" TO "service_role";


-- source: public/tables/viral_references.sql
CREATE TABLE "public"."viral_references" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "section"               text                     NOT NULL,
  "platform"              text                     NOT NULL DEFAULT 'instagram'::text,
  "source_url"            text                     NOT NULL,
  "embed_html"            text                     NOT NULL,
  "embed_status"          text                     NOT NULL DEFAULT 'active'::text,
  "publish_status"        text                     NOT NULL DEFAULT 'pending_review'::text,
  "editor_rank"           integer,
  "last_verified_at"      timestamp with time zone,
  "next_check_at"         timestamp with time zone,
  "verification_failures" integer                  NOT NULL DEFAULT 0,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "view_count"            bigint,
  CONSTRAINT "viral_references_editor_rank_check" CHECK (((editor_rank IS NULL) OR (editor_rank > 0))),
  CONSTRAINT "viral_references_embed_html_check" CHECK ((char_length(TRIM(BOTH FROM embed_html)) > 0)),
  CONSTRAINT "viral_references_embed_status_check" CHECK ((embed_status = ANY (ARRAY['active'::text, 'suspected_unavailable'::text, 'unavailable'::text]))),
  CONSTRAINT "viral_references_pkey" PRIMARY KEY (id),
  CONSTRAINT "viral_references_platform_check" CHECK ((platform = 'instagram'::text)),
  CONSTRAINT "viral_references_publish_status_check" CHECK ((publish_status = ANY (ARRAY['pending_review'::text, 'published'::text, 'hidden'::text]))),
  CONSTRAINT "viral_references_section_check" CHECK ((section = ANY (ARRAY['hook_video'::text, 'wall_of_text'::text, 'slideshow'::text]))),
  CONSTRAINT "viral_references_source_url_check"
    CHECK (((source_url = TRIM(BOTH FROM source_url)) AND (source_url ~ '^https://(www\.)?instagram\.com/(p|reel|tv)/[A-Za-z0-9_-]+/?$'::text))),
  CONSTRAINT "viral_references_source_url_key" UNIQUE (source_url),
  CONSTRAINT "viral_references_verification_failures_check" CHECK ((verification_failures >= 0)),
  CONSTRAINT "viral_references_view_count_nonnegative" CHECK (((view_count IS NULL) OR (view_count >= 0)))
);

ALTER TABLE "public"."viral_references"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX viral_references_hook_review_idx ON public.viral_references USING btree (created_at)
  WHERE ((section = 'hook_video'::text) AND (publish_status = 'pending_review'::text));

CREATE INDEX viral_references_published_feed_idx ON public.viral_references USING btree (section, editor_rank, created_at DESC)
  WHERE ((publish_status = 'published'::text) AND (embed_status = 'active'::text));

CREATE INDEX viral_references_verification_due_idx ON public.viral_references USING btree (next_check_at)
  WHERE ((next_check_at IS NOT NULL) AND (embed_status <> 'unavailable'::text));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."viral_references" TO "postgres";

COMMENT ON COLUMN "public"."viral_references"."view_count" IS 'Latest known Instagram view count. Null means the count is unknown.';

COMMENT ON TABLE "public"."viral_references" IS 'Server-managed Instagram references. Original media remains hosted by Instagram.';

REVOKE ALL ON TABLE "public"."viral_references" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."viral_references" TO "service_role";


-- source: public/tables/wall_audio_assets.sql
CREATE TABLE "public"."wall_audio_assets" (
  "id"                       text                     NOT NULL,
  "source_audio_id"          text                     NOT NULL,
  "storage_provider"         text                     NOT NULL DEFAULT 'gcp'::text,
  "storage_key"              text                     NOT NULL,
  "audio_url"                text                     NOT NULL,
  "duration_seconds"         numeric(10,3)            NOT NULL,
  "source_start_seconds"     numeric(10,3)            NOT NULL DEFAULT 0,
  "source_end_seconds"       numeric(10,3)            NOT NULL,
  "cue_start_seconds"        numeric(10,3)            NOT NULL DEFAULT 0,
  "moods"                    text[]                   NOT NULL DEFAULT '{}'::text[],
  "message_types"            text[]                   NOT NULL DEFAULT '{}'::text[],
  "energy"                   text,
  "loopable"                 boolean,
  "measured_integrated_lufs" numeric(6,2)             NOT NULL,
  "measured_true_peak_db"    numeric(6,2)             NOT NULL,
  "sha256"                   text                     NOT NULL,
  "file_size_bytes"          bigint                   NOT NULL,
  "review_status"            text                     NOT NULL DEFAULT 'pending'::text,
  "reviewed_at"              timestamp with time zone,
  "review_notes"             text,
  "status"                   text                     NOT NULL DEFAULT 'pending_review'::text,
  "schema_version"           text                     NOT NULL DEFAULT 'wall-audio-library-v2'::text,
  "preparation_version"      text                     NOT NULL DEFAULT 'wall-audio-preparation-v2'::text,
  "tagging_version"          text                     NOT NULL DEFAULT 'wall-audio-tagging-v1'::text,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "selection_scope"          text                     NOT NULL DEFAULT 'matcher_pool'::text,
  CONSTRAINT "wall_audio_assets_active_review_check" CHECK (((status <> 'active'::text) OR ((review_status = 'approved'::text) AND (reviewed_at IS
    NOT NULL) AND
    (((selection_scope = 'matcher_pool'::text) AND ((cardinality(moods) >= 1) AND (cardinality(moods) <= 3)) AND ((cardinality(message_types) >= 1) AND (cardinality(message_types)
    <= 4)) AND (energy IS NOT NULL) AND (loopable IS NOT NULL)) OR ((selection_scope = 'instagram_reel_locked'::text) AND (loopable = false)))))),
  CONSTRAINT "wall_audio_assets_audio_url_check" CHECK ((audio_url ~ '^https://'::text)),
  CONSTRAINT "wall_audio_assets_check1" CHECK (((cue_start_seconds >= (0)::numeric) AND (cue_start_seconds < duration_seconds))),
  CONSTRAINT "wall_audio_assets_check" CHECK ((source_end_seconds > source_start_seconds)),
  CONSTRAINT "wall_audio_assets_duration_seconds_check" CHECK (((duration_seconds > (0)::numeric) AND (duration_seconds <= (600)::numeric))),
  CONSTRAINT "wall_audio_assets_energy_check" CHECK (((energy IS NULL) OR (energy = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))),
  CONSTRAINT "wall_audio_assets_file_size_bytes_check" CHECK ((file_size_bytes > 0)),
  CONSTRAINT "wall_audio_assets_id_check" CHECK ((id ~ '^audio_[0-9]{3}(_segment_[0-9]{2})?$'::text)),
  CONSTRAINT "wall_audio_assets_message_types_check"
    CHECK
    (((message_types <@ ARRAY['curiosity'::text, 'problem'::text, 'warning'::text, 'transformation'::text, 'benefit'::text, 'story'::text, 'authority'::text]) AND
    (cardinality(message_types) <= 4))),
  CONSTRAINT "wall_audio_assets_moods_check"
    CHECK (((moods <@ ARRAY['curious'::text, 'uplifting'::text, 'serious'::text, 'calm'::text, 'urgent'::text, 'playful'::text]) AND (cardinality(moods) <= 3))),
  CONSTRAINT "wall_audio_assets_pkey" PRIMARY KEY (id),
  CONSTRAINT "wall_audio_assets_preparation_version_check" CHECK ((char_length(btrim(preparation_version)) > 0)),
  CONSTRAINT "wall_audio_assets_review_status_check" CHECK ((review_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
  CONSTRAINT "wall_audio_assets_schema_version_check" CHECK ((char_length(btrim(schema_version)) > 0)),
  CONSTRAINT "wall_audio_assets_selection_scope_chk" CHECK ((selection_scope = ANY (ARRAY['matcher_pool'::text, 'instagram_reel_locked'::text]))),
  CONSTRAINT "wall_audio_assets_sha256_check" CHECK ((sha256 ~ '^[a-f0-9]{64}$'::text)),
  CONSTRAINT "wall_audio_assets_sha256_key" UNIQUE (sha256),
  CONSTRAINT "wall_audio_assets_source_audio_id_check" CHECK ((source_audio_id ~ '^audio_[0-9]{3}$'::text)),
  CONSTRAINT "wall_audio_assets_source_start_seconds_check" CHECK ((source_start_seconds >= (0)::numeric)),
  CONSTRAINT "wall_audio_assets_status_check" CHECK ((status = ANY (ARRAY['pending_review'::text, 'active'::text, 'inactive'::text]))),
  CONSTRAINT "wall_audio_assets_storage_key_check" CHECK ((char_length(btrim(storage_key)) > 0)),
  CONSTRAINT "wall_audio_assets_storage_key_key" UNIQUE (storage_key),
  CONSTRAINT "wall_audio_assets_storage_provider_check" CHECK ((storage_provider = 'gcp'::text)),
  CONSTRAINT "wall_audio_assets_tagging_version_check" CHECK ((char_length(btrim(tagging_version)) > 0))
);

ALTER TABLE "public"."wall_audio_assets"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX wall_audio_assets_active_duration_idx ON public.wall_audio_assets USING btree (energy, duration_seconds, id)
  WHERE ((status = 'active'::text) AND (review_status = 'approved'::text));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wall_audio_assets" TO "postgres", "service_role";


-- source: public/tables/avatar_assets.sql
CREATE TABLE "public"."avatar_assets" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"                text                     NOT NULL,
  "description"         text,
  "avatar_type"         text                     NOT NULL DEFAULT 'global'::text,
  "source_s3_key"       text                     NOT NULL,
  "source_video_url"    text                     NOT NULL,
  "thumbnail_url"       text,
  "duration_seconds"    numeric,
  "width"               integer,
  "height"              integer,
  "ratio"               text                     NOT NULL DEFAULT '9:16'::text,
  "status"              text                     NOT NULL DEFAULT 'ready'::text,
  "sort_order"          integer                  NOT NULL DEFAULT 0,
  "metadata"            jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "deleted_at"          timestamp with time zone,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "source_file_sha256"  text,
  "source_batch"        text,
  "influencer_key"      text,
  "visual_group"        text,
  "has_audio"           boolean                  NOT NULL DEFAULT false,
  "hook_format_id"      text,
  "hook_text_placement" jsonb,
  CONSTRAINT "avatar_assets_avatar_type_check" CHECK ((avatar_type = 'global'::text)),
  CONSTRAINT "avatar_assets_duration_seconds_check" CHECK (((duration_seconds IS NULL) OR (duration_seconds > (0)::numeric))),
  CONSTRAINT "avatar_assets_height_check" CHECK (((height IS NULL) OR (height > 0))),
  CONSTRAINT "avatar_assets_hook_format_id_check"
    CHECK (((hook_format_id IS NULL) OR (((char_length(hook_format_id) >= 1) AND (char_length(hook_format_id) <= 100)) AND (hook_format_id ~ '^[a-z0-9]+(_[a-z0-9]+)*$'::text)))),
  CONSTRAINT "avatar_assets_hook_text_placement_chk"
    CHECK
    (((hook_text_placement IS NULL) OR ((jsonb_typeof(hook_text_placement) = 'object'::text) AND ((hook_text_placement ->> 'preset'::text) = ANY (ARRAY['above_head'::text,
    'below_face'::text])) AND (jsonb_typeof((hook_text_placement -> 'x'::text)) = 'number'::text) AND
    ((((hook_text_placement ->> 'x'::text))::numeric >= (0)::numeric) AND (((hook_text_placement ->> 'x'::text))::numeric <= (1)::numeric)) AND
    (jsonb_typeof((hook_text_placement -> 'y'::text)) = 'number'::text) AND
    ((((hook_text_placement ->> 'y'::text))::numeric >= (0)::numeric) AND (((hook_text_placement ->> 'y'::text))::numeric <= (1)::numeric)) AND
    ((char_length(TRIM(BOTH FROM COALESCE((hook_text_placement ->> 'reviewVersion'::text), ''::text))) >= 1) AND (char_length(TRIM(BOTH FROM COALESCE((hook_text_placement ->>
    'reviewVersion'::text),
    ''::text))) <= 100)) AND
    ((char_length(TRIM(BOTH FROM COALESCE((hook_text_placement ->> 'reviewedAt'::text), ''::text))) >= 10) AND (char_length(TRIM(BOTH FROM COALESCE((hook_text_placement ->>
    'reviewedAt'::text), ''::text))) <= 40))))),
  CONSTRAINT "avatar_assets_influencer_key_chk"
    CHECK (((influencer_key IS NULL) OR (((char_length(influencer_key) >= 1) AND (char_length(influencer_key) <= 100)) AND (influencer_key ~ '^[a-z0-9]+(_[a-z0-9]+)*$'::text)))),
  CONSTRAINT "avatar_assets_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text)),
  CONSTRAINT "avatar_assets_name_check" CHECK (((char_length(TRIM(BOTH FROM name)) > 0) AND (char_length(name) <= 140))),
  CONSTRAINT "avatar_assets_pkey" PRIMARY KEY (id),
  CONSTRAINT "avatar_assets_ratio_check" CHECK ((ratio = ANY (ARRAY['9:16'::text, '1:1'::text, '4:5'::text, '16:9'::text, 'other'::text]))),
  CONSTRAINT "avatar_assets_ready_catalog_metadata_chk" CHECK (((status <> 'ready'::text) OR (deleted_at IS NOT NULL) OR ((source_file_sha256 IS NOT NULL) AND (source_batch IS
    NOT NULL) AND (influencer_key IS NOT NULL) AND (visual_group IS NOT NULL)))),
  CONSTRAINT "avatar_assets_ready_hook_text_placement_chk" CHECK (((status <> 'ready'::text) OR (deleted_at IS
    NOT NULL) OR (source_batch !~~ 'hook-silent-%'::text) OR (hook_text_placement IS NOT NULL))),
  CONSTRAINT "avatar_assets_source_batch_chk"
    CHECK (((source_batch IS NULL) OR (((char_length(source_batch) >= 1) AND (char_length(source_batch) <= 100)) AND (source_batch ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)))),
  CONSTRAINT "avatar_assets_source_file_sha256_chk" CHECK (((source_file_sha256 IS NULL) OR (source_file_sha256 ~ '^[a-f0-9]{64}$'::text))),
  CONSTRAINT "avatar_assets_source_s3_key_check" CHECK ((char_length(TRIM(BOTH FROM source_s3_key)) > 0)),
  CONSTRAINT "avatar_assets_source_video_url_check" CHECK ((source_video_url ~ '^https?://'::text)),
  CONSTRAINT "avatar_assets_status_check" CHECK ((status = ANY (ARRAY['ready'::text, 'disabled'::text, 'processing'::text, 'failed'::text]))),
  CONSTRAINT "avatar_assets_thumbnail_url_check" CHECK (((thumbnail_url IS NULL) OR (thumbnail_url ~ '^https?://'::text))),
  CONSTRAINT "avatar_assets_visual_group_chk"
    CHECK (((visual_group IS NULL) OR (((char_length(visual_group) >= 1) AND (char_length(visual_group) <= 100)) AND (visual_group ~ '^[a-z0-9]+(_[a-z0-9]+)*$'::text)))),
  CONSTRAINT "avatar_assets_width_check" CHECK (((width IS NULL) OR (width > 0))),
  CONSTRAINT "avatar_assets_hook_format_id_fkey" FOREIGN KEY (hook_format_id) REFERENCES public.hook_formats(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."avatar_assets"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX avatar_assets_hook_format_id_idx ON public.avatar_assets USING btree (hook_format_id, sort_order, created_at DESC)
  WHERE ((status = 'ready'::text) AND (deleted_at IS NULL) AND (hook_format_id IS NOT NULL));

CREATE INDEX avatar_assets_ready_selection_idx ON public.avatar_assets USING btree (has_audio, visual_group, influencer_key, sort_order, created_at DESC)
  WHERE ((status = 'ready'::text) AND (deleted_at IS NULL));

CREATE INDEX avatar_assets_source_batch_idx ON public.avatar_assets USING btree (source_batch, created_at DESC)
  WHERE ((deleted_at IS NULL) AND (source_batch IS NOT NULL));

CREATE UNIQUE INDEX avatar_assets_source_file_sha256_idx ON public.avatar_assets USING btree (source_file_sha256)
  WHERE ((deleted_at IS NULL) AND (source_file_sha256 IS NOT NULL));

CREATE UNIQUE INDEX avatar_assets_source_s3_key_idx ON public.avatar_assets USING btree (source_s3_key)
  WHERE (deleted_at IS NULL);

CREATE INDEX avatar_assets_status_sort_idx ON public.avatar_assets USING btree (status, sort_order, created_at DESC)
  WHERE (deleted_at IS NULL);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."avatar_assets" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."avatar_assets"."has_audio" IS 'True only when the original Hook source contains an audio stream intended to be preserved.';

COMMENT ON COLUMN "public"."avatar_assets"."hook_format_id" IS 'Stable visual Hook format used to choose Dynamic, Preferred, or Locked Hook audio behavior. Existing visual_group remains unchanged.';

COMMENT ON COLUMN "public"."avatar_assets"."hook_text_placement" IS 'First-frame-reviewed normalized center anchor for Hook overlay text. Catalog placement is the default; a saved user edit may override it.';

COMMENT ON COLUMN "public"."avatar_assets"."influencer_key" IS 'Normalized Hook influencer identity used for grouping and diverse selection.';

COMMENT ON COLUMN "public"."avatar_assets"."source_batch" IS 'Stable identifier for the reviewed Hook catalog import batch.';

COMMENT ON COLUMN "public"."avatar_assets"."source_file_sha256" IS 'SHA-256 of the original Hook source file. Used for idempotent imports and exact duplicate prevention.';

COMMENT ON COLUMN "public"."avatar_assets"."visual_group" IS 'One primary visual similarity group used to avoid repetitive Hook selections.';

REVOKE ALL ON TABLE "public"."avatar_assets" FROM "anon";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."avatar_assets" TO "anon";

REVOKE ALL ON TABLE "public"."avatar_assets" FROM "authenticated";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."avatar_assets" TO "authenticated";


-- source: public/tables/background_job_events.sql
CREATE TABLE "public"."background_job_events" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "job_id"     uuid                     NOT NULL,
  "event_type" text                     NOT NULL,
  "metadata"   jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "background_job_events_event_type_check" CHECK (((char_length(TRIM(BOTH FROM event_type)) >= 1) AND (char_length(TRIM(BOTH FROM event_type)) <= 120))),
  CONSTRAINT "background_job_events_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text)),
  CONSTRAINT "background_job_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "background_job_events_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.background_jobs(id) ON DELETE CASCADE
);

ALTER TABLE "public"."background_job_events"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX background_job_events_job_created_idx ON public.background_job_events USING btree (job_id, created_at, id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."background_job_events" TO "postgres", "service_role";


-- source: public/tables/billing_credit_reservations.sql
CREATE TABLE "public"."billing_credit_reservations" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"             text                     NOT NULL,
  "idempotency_key"     text                     NOT NULL,
  "job_type"            text                     NOT NULL,
  "amount"              integer                  NOT NULL,
  "status"              text                     NOT NULL DEFAULT 'reserved'::text,
  "background_job_id"   uuid,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "settled_at"          timestamp with time zone,
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "credit_period_start" timestamp with time zone NOT NULL,
  CONSTRAINT "billing_credit_reservations_amount_check" CHECK ((amount > 0)),
  CONSTRAINT "billing_credit_reservations_background_job_id_fkey" FOREIGN KEY (background_job_id) REFERENCES public.background_jobs(id) ON DELETE SET NULL,
  CONSTRAINT "billing_credit_reservations_pkey" PRIMARY KEY (id),
  CONSTRAINT "billing_credit_reservations_status_check" CHECK ((status = ANY (ARRAY['reserved'::text, 'committed'::text, 'released'::text]))),
  CONSTRAINT "billing_credit_reservations_user_id_idempotency_key_key" UNIQUE (user_id, idempotency_key)
);

ALTER TABLE "public"."billing_credit_reservations"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX billing_credit_reservations_job_idx ON public.billing_credit_reservations USING btree (background_job_id)
  WHERE (background_job_id IS NOT NULL);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."billing_credit_reservations" TO "postgres", "service_role";


-- source: public/tables/billing_usage_outbox.sql
CREATE TABLE "public"."billing_usage_outbox" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "event_id"          text                     NOT NULL,
  "user_id"           text                     NOT NULL,
  "dodo_customer_id"  text                     NOT NULL,
  "background_job_id" uuid                     NOT NULL,
  "generation_kind"   text                     NOT NULL,
  "credit_cost"       integer                  NOT NULL,
  "status"            text                     NOT NULL DEFAULT 'pending'::text,
  "attempt_count"     integer                  NOT NULL DEFAULT 0,
  "last_error"        text,
  "occurred_at"       timestamp with time zone NOT NULL,
  "delivered_at"      timestamp with time zone,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "last_attempt_at"   timestamp with time zone,
  "next_attempt_at"   timestamp with time zone DEFAULT now(),
  CONSTRAINT "billing_usage_outbox_attempt_count_check" CHECK ((attempt_count >= 0)),
  CONSTRAINT "billing_usage_outbox_background_job_id_fkey" FOREIGN KEY (background_job_id) REFERENCES public.background_jobs(id) ON DELETE CASCADE,
  CONSTRAINT "billing_usage_outbox_credit_cost_check" CHECK ((credit_cost > 0)),
  CONSTRAINT "billing_usage_outbox_event_id_key" UNIQUE (event_id),
  CONSTRAINT "billing_usage_outbox_generation_kind_check" CHECK ((generation_kind = ANY (ARRAY['image'::text, 'video'::text]))),
  CONSTRAINT "billing_usage_outbox_pkey" PRIMARY KEY (id),
  CONSTRAINT "billing_usage_outbox_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'delivered'::text, 'failed'::text])))
);

ALTER TABLE "public"."billing_usage_outbox"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX billing_usage_outbox_retry_idx ON public.billing_usage_outbox USING btree (next_attempt_at, created_at)
  WHERE ((status = ANY (ARRAY['pending'::text, 'failed'::text])) AND (attempt_count < 10));

CREATE INDEX billing_usage_outbox_status_created_idx ON public.billing_usage_outbox USING btree (status, created_at);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."billing_usage_outbox" TO "postgres", "service_role";


-- source: public/tables/creative_asset_group_items.sql
CREATE TABLE "public"."creative_asset_group_items" (
  "user_id"        text                     NOT NULL,
  "group_id"       uuid                     NOT NULL,
  "media_asset_id" uuid                     NOT NULL,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "creative_asset_group_items_pkey" PRIMARY KEY (group_id, media_asset_id),
  CONSTRAINT "creative_asset_group_items_user_id_check" CHECK (((char_length(btrim(user_id)) > 0) AND (char_length(btrim(user_id)) <= 200))),
  CONSTRAINT "creative_asset_group_items_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.creative_asset_groups(id) ON DELETE CASCADE,
  CONSTRAINT "creative_asset_group_items_media_asset_id_fkey" FOREIGN KEY (media_asset_id) REFERENCES public.media_assets(id) ON DELETE CASCADE
);

ALTER TABLE "public"."creative_asset_group_items"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX creative_asset_group_items_owner_asset_idx ON public.creative_asset_group_items USING btree (user_id, media_asset_id);

CREATE TRIGGER validate_creative_asset_group_item_row
  BEFORE INSERT OR UPDATE ON public.creative_asset_group_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_creative_asset_group_item();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."creative_asset_group_items" TO "postgres", "service_role";


-- source: public/tables/daily_carousel_feeds.sql
CREATE TABLE "public"."daily_carousel_feeds" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     text                     NOT NULL,
  "local_date"  date                     NOT NULL,
  "timezone"    text                     NOT NULL,
  "plan_key"    text                     NOT NULL,
  "daily_limit" integer                  NOT NULL,
  "status"      text                     NOT NULL DEFAULT 'ready'::text,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "daily_carousel_feeds_daily_limit_check" CHECK ((daily_limit > 0)),
  CONSTRAINT "daily_carousel_feeds_pkey" PRIMARY KEY (id),
  CONSTRAINT "daily_carousel_feeds_status_check" CHECK ((status = ANY (ARRAY['preparing'::text, 'ready'::text, 'failed'::text]))),
  CONSTRAINT "daily_carousel_feeds_user_id_local_date_key" UNIQUE (user_id, local_date),
  CONSTRAINT "daily_carousel_feeds_plan_key_fkey" FOREIGN KEY (plan_key) REFERENCES public.subscription_entitlements(plan_key)
);

ALTER TABLE "public"."daily_carousel_feeds"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX daily_carousel_feeds_user_date_idx ON public.daily_carousel_feeds USING btree (user_id, local_date DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_carousel_feeds" TO "postgres", "service_role";


-- source: public/tables/generation_provider_operations.sql
CREATE TABLE "public"."generation_provider_operations" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "job_id"                uuid                     NOT NULL,
  "operation_key"         text                     NOT NULL,
  "provider"              text                     NOT NULL,
  "status"                text                     NOT NULL DEFAULT 'reserved'::text,
  "request_fingerprint"   text                     NOT NULL,
  "provider_operation_id" text,
  "output_reference"      text,
  "output_url"            text,
  "retry_allowed"         boolean                  NOT NULL DEFAULT false,
  "last_error_code"       text,
  "last_error_message"    text,
  "metadata"              jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "submitted_at"          timestamp with time zone,
  "provider_completed_at" timestamp with time zone,
  "output_persisted_at"   timestamp with time zone,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "generation_provider_operations_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.background_jobs(id) ON DELETE CASCADE,
  CONSTRAINT "generation_provider_operations_job_id_operation_key_key" UNIQUE (job_id, operation_key),
  CONSTRAINT "generation_provider_operations_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text)),
  CONSTRAINT "generation_provider_operations_operation_key_check"
    CHECK (((char_length(TRIM(BOTH FROM operation_key)) >= 1) AND (char_length(TRIM(BOTH FROM operation_key)) <= 120))),
  CONSTRAINT "generation_provider_operations_output_url_check" CHECK (((output_url IS NULL) OR (output_url ~ '^https?://'::text))),
  CONSTRAINT "generation_provider_operations_pkey" PRIMARY KEY (id),
  CONSTRAINT "generation_provider_operations_provider_check" CHECK ((provider = ANY (ARRAY['gemini'::text, 'openai'::text, 'runway'::text, 'veo'::text]))),
  CONSTRAINT "generation_provider_operations_request_fingerprint_check" CHECK ((request_fingerprint ~ '^[a-f0-9]{64}$'::text)),
  CONSTRAINT "generation_provider_operations_status_check"
    CHECK ((status = ANY (ARRAY['reserved'::text, 'submitted'::text, 'provider_succeeded'::text, 'output_persisted'::text, 'failed'::text, 'submission_uncertain'::text])))
);

ALTER TABLE "public"."generation_provider_operations"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX generation_provider_operations_job_updated_idx ON public.generation_provider_operations USING btree (job_id, updated_at DESC);

CREATE UNIQUE INDEX generation_provider_operations_provider_id_uidx ON public.generation_provider_operations USING btree (PROVIDER, provider_operation_id)
  WHERE (provider_operation_id IS NOT NULL);

CREATE INDEX generation_provider_operations_uncertain_idx ON public.generation_provider_operations USING btree (updated_at, job_id)
  WHERE (status = ANY (ARRAY['reserved'::text, 'submission_uncertain'::text]));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."generation_provider_operations" TO "postgres", "service_role";


-- source: public/tables/hook_format_audio_preferences.sql
CREATE TABLE "public"."hook_format_audio_preferences" (
  "hook_format_id" text                     NOT NULL,
  "audio_asset_id" text                     NOT NULL,
  "priority"       smallint                 NOT NULL,
  "status"         text                     NOT NULL DEFAULT 'inactive'::text,
  "notes"          text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "hook_format_audio_preferences_audio_asset_id_fkey" FOREIGN KEY (audio_asset_id) REFERENCES public.hook_audio_assets(id) ON DELETE RESTRICT,
  CONSTRAINT "hook_format_audio_preferences_notes_check" CHECK (((notes IS NULL) OR (char_length(notes) <= 1000))),
  CONSTRAINT "hook_format_audio_preferences_pkey" PRIMARY KEY (hook_format_id, audio_asset_id),
  CONSTRAINT "hook_format_audio_preferences_priority_check" CHECK (((priority >= 1) AND (priority <= 100))),
  CONSTRAINT "hook_format_audio_preferences_priority_unique" UNIQUE (hook_format_id, priority),
  CONSTRAINT "hook_format_audio_preferences_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))),
  CONSTRAINT "hook_format_audio_preferences_hook_format_id_fkey" FOREIGN KEY (hook_format_id) REFERENCES public.hook_formats(id) ON DELETE CASCADE
);

ALTER TABLE "public"."hook_format_audio_preferences"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX hook_format_audio_preferences_active_idx ON public.hook_format_audio_preferences USING btree (hook_format_id, priority, audio_asset_id)
  WHERE (status = 'active'::text);

CREATE INDEX hook_format_audio_preferences_asset_idx ON public.hook_format_audio_preferences USING btree (audio_asset_id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hook_format_audio_preferences" TO "postgres";

REVOKE ALL ON TABLE "public"."hook_format_audio_preferences" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."hook_format_audio_preferences" TO "service_role";


-- source: public/tables/hook_text_format_evidence.sql
CREATE TABLE "public"."hook_text_format_evidence" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "hook_text_format_id" text                     NOT NULL,
  "observed_hook_text"  text                     NOT NULL,
  "source_reference"    text                     NOT NULL,
  "source_platform"     text,
  "evidence_version"    text                     NOT NULL DEFAULT 'global-v1-corpus'::text,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "hook_text_format_evidence_hook_text_format_id_observed_hook_key" UNIQUE (hook_text_format_id, observed_hook_text, source_reference),
  CONSTRAINT "hook_text_format_evidence_observed_hook_text_check"
    CHECK (((char_length(TRIM(BOTH FROM observed_hook_text)) >= 1) AND (char_length(TRIM(BOTH FROM observed_hook_text)) <= 1000))),
  CONSTRAINT "hook_text_format_evidence_pkey" PRIMARY KEY (id),
  CONSTRAINT "hook_text_format_evidence_source_platform_check" CHECK (((source_platform IS NULL) OR (source_platform = ANY (ARRAY['instagram'::text, 'tiktok'::text])))),
  CONSTRAINT "hook_text_format_evidence_source_reference_check"
    CHECK (((char_length(TRIM(BOTH FROM source_reference)) >= 1) AND (char_length(TRIM(BOTH FROM source_reference)) <= 500))),
  CONSTRAINT "hook_text_format_evidence_hook_text_format_id_fkey" FOREIGN KEY (hook_text_format_id) REFERENCES public.hook_text_formats(id) ON DELETE CASCADE
);

ALTER TABLE "public"."hook_text_format_evidence"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX hook_text_format_evidence_format_idx ON public.hook_text_format_evidence USING btree (hook_text_format_id, created_at);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hook_text_format_evidence" TO "postgres", "service_role";

COMMENT ON TABLE "public"."hook_text_format_evidence" IS 'Original observed Hook wording retained as evidence after format extraction.';


-- source: public/tables/hook_text_format_variants.sql
CREATE TABLE "public"."hook_text_format_variants" (
  "id"                  text                     NOT NULL,
  "hook_text_format_id" text                     NOT NULL,
  "template"            text                     NOT NULL,
  "instruction"         text                     NOT NULL,
  "enabled"             boolean                  NOT NULL DEFAULT true,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "hook_text_format_variants_hook_text_format_id_id_key" UNIQUE (hook_text_format_id, id),
  CONSTRAINT "hook_text_format_variants_id_check" CHECK ((id ~ '^GF_[0-9]{3}_[A-Z]$'::text)),
  CONSTRAINT "hook_text_format_variants_instruction_check" CHECK (((char_length(TRIM(BOTH FROM instruction)) >= 1) AND (char_length(TRIM(BOTH FROM instruction)) <= 1000))),
  CONSTRAINT "hook_text_format_variants_pkey" PRIMARY KEY (id),
  CONSTRAINT "hook_text_format_variants_template_check" CHECK (((char_length(TRIM(BOTH FROM template)) >= 1) AND (char_length(TRIM(BOTH FROM template)) <= 500))),
  CONSTRAINT "hook_text_format_variants_hook_text_format_id_fkey" FOREIGN KEY (hook_text_format_id) REFERENCES public.hook_text_formats(id) ON DELETE CASCADE
);

ALTER TABLE "public"."hook_text_format_variants"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX hook_text_format_variants_format_idx ON public.hook_text_format_variants USING btree (hook_text_format_id, enabled);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hook_text_format_variants" TO "postgres", "service_role";


-- source: public/tables/instagram_analytics_account_snapshots.sql
CREATE TABLE "public"."instagram_analytics_account_snapshots" (
  "user_id"              text                     NOT NULL,
  "social_connection_id" uuid                     NOT NULL,
  "range_days"           smallint                 NOT NULL,
  "snapshot_json"        jsonb                    NOT NULL,
  "synced_at"            timestamp with time zone NOT NULL,
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "instagram_analytics_account_snapshots_pkey" PRIMARY KEY (user_id, social_connection_id, range_days),
  CONSTRAINT "instagram_analytics_account_snapshots_range_days_check" CHECK ((range_days = ANY (ARRAY[7, 30, 90]))),
  CONSTRAINT "instagram_analytics_account_snapshots_snapshot_json_check" CHECK ((jsonb_typeof(snapshot_json) = 'object'::text)),
  CONSTRAINT "instagram_analytics_account_snapshots_social_connection_id_fkey" FOREIGN KEY (social_connection_id) REFERENCES public.social_connections(id) ON DELETE CASCADE
);

ALTER TABLE "public"."instagram_analytics_account_snapshots"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX instagram_analytics_account_snapshots_owner_range_idx ON public.instagram_analytics_account_snapshots USING btree (user_id, range_days, synced_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."instagram_analytics_account_snapshots" TO "postgres", "service_role";


-- source: public/tables/instagram_analytics_connection_snapshots.sql
CREATE TABLE "public"."instagram_analytics_connection_snapshots" (
  "user_id"              text                     NOT NULL,
  "social_connection_id" uuid                     NOT NULL,
  "range_days"           smallint                 NOT NULL,
  "account_name"         text,
  "account_username"     text,
  "status"               text                     NOT NULL,
  "message"              text,
  "feed_synced_at"       timestamp with time zone,
  "last_synced_at"       timestamp with time zone,
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "instagram_analytics_connection_snapshots_pkey" PRIMARY KEY (user_id, social_connection_id, range_days),
  CONSTRAINT "instagram_analytics_connection_snapshots_range_days_check" CHECK ((range_days = ANY (ARRAY[7, 30, 90]))),
  CONSTRAINT "instagram_analytics_connection_snapshots_status_check" CHECK ((status = ANY (ARRAY['error'::text, 'permission_missing'::text, 'ready'::text, 'unavailable'::text]))),
  CONSTRAINT "instagram_analytics_connection_snapsh_social_connection_id_fkey" FOREIGN KEY (social_connection_id) REFERENCES public.social_connections(id) ON DELETE CASCADE
);

ALTER TABLE "public"."instagram_analytics_connection_snapshots"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX instagram_analytics_connection_snapshots_owner_idx ON public.instagram_analytics_connection_snapshots USING btree (user_id, range_days, updated_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."instagram_analytics_connection_snapshots" TO "postgres", "service_role";


-- source: public/tables/instagram_analytics_content.sql
CREATE TABLE "public"."instagram_analytics_content" (
  "user_id"              text                     NOT NULL,
  "social_connection_id" uuid                     NOT NULL,
  "platform_media_id"    text                     NOT NULL,
  "account_name"         text,
  "account_username"     text,
  "caption"              text,
  "content_type"         text                     NOT NULL,
  "media_type"           text,
  "permalink"            text,
  "published_at"         timestamp with time zone NOT NULL,
  "thumbnail_url"        text,
  "comments"             bigint,
  "interactions"         bigint,
  "likes"                bigint,
  "reach"                bigint,
  "saves"                bigint,
  "shares"               bigint,
  "views"                bigint,
  "metrics_synced_at"    timestamp with time zone,
  "last_sync_error"      text,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "instagram_analytics_content_comments_check" CHECK (((comments IS NULL) OR (comments >= 0))),
  CONSTRAINT "instagram_analytics_content_content_type_check" CHECK ((content_type = ANY (ARRAY['carousel'::text, 'post'::text, 'reel'::text]))),
  CONSTRAINT "instagram_analytics_content_interactions_check" CHECK (((interactions IS NULL) OR (interactions >= 0))),
  CONSTRAINT "instagram_analytics_content_likes_check" CHECK (((likes IS NULL) OR (likes >= 0))),
  CONSTRAINT "instagram_analytics_content_pkey" PRIMARY KEY (user_id, social_connection_id, platform_media_id),
  CONSTRAINT "instagram_analytics_content_reach_check" CHECK (((reach IS NULL) OR (reach >= 0))),
  CONSTRAINT "instagram_analytics_content_saves_check" CHECK (((saves IS NULL) OR (saves >= 0))),
  CONSTRAINT "instagram_analytics_content_shares_check" CHECK (((shares IS NULL) OR (shares >= 0))),
  CONSTRAINT "instagram_analytics_content_views_check" CHECK (((views IS NULL) OR (views >= 0))),
  CONSTRAINT "instagram_analytics_content_social_connection_id_fkey" FOREIGN KEY (social_connection_id) REFERENCES public.social_connections(id) ON DELETE CASCADE
);

ALTER TABLE "public"."instagram_analytics_content"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX instagram_analytics_content_connection_published_idx ON public.instagram_analytics_content USING btree (social_connection_id, published_at DESC);

CREATE INDEX instagram_analytics_content_owner_published_idx ON public.instagram_analytics_content USING btree (user_id, published_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."instagram_analytics_content" TO "postgres", "service_role";


-- source: public/tables/overlay_media_assets.sql
CREATE TABLE "public"."overlay_media_assets" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "asset_type"              text                     NOT NULL,
  "format_family"           text                     NOT NULL DEFAULT 'wall_text_overlay'::text,
  "aspect_ratio"            text                     NOT NULL DEFAULT '9:16'::text,
  "source_type"             text                     NOT NULL DEFAULT 'owned'::text,
  "source_file_name"        text,
  "content_type"            text,
  "file_size_bytes"         bigint,
  "s3_key"                  text                     NOT NULL,
  "preview_url"             text,
  "thumbnail_s3_key"        text,
  "thumbnail_url"           text,
  "duration_seconds"        numeric,
  "width"                   integer,
  "height"                  integer,
  "analysis_status"         text                     NOT NULL DEFAULT 'pending'::text,
  "status"                  text                     NOT NULL DEFAULT 'inactive'::text,
  "analysis_model"          text,
  "analysis_error"          text,
  "analyzed_at"             timestamp with time zone,
  "metadata_schema_version" text                     NOT NULL DEFAULT 'overlay_asset_metadata_v1'::text,
  "primary_profiles"        jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "generic_profiles"        jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "use_case_tags"           jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "recommended_position"    text,
  "text_capacity"           text,
  "readability_score"       numeric,
  "motion_level"            text,
  "vision_metadata"         jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "usage_count"             integer                  NOT NULL DEFAULT 0,
  "last_used_at"            timestamp with time zone,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "source_file_sha256"      text,
  "source_batch"            text,
  "visual_group"            text,
  "source_media_asset_id"   uuid,
  "owner_user_id"           text,
  "placement_analysis"      jsonb,
  "wall_text_source_kind"   text,
  CONSTRAINT "overlay_media_assets_active_requires_analysis_chk" CHECK (((status <> 'active'::text) OR (analysis_status = 'succeeded'::text))),
  CONSTRAINT "overlay_media_assets_active_wall_min_duration_chk"
    CHECK (((status <> 'active'::text) OR (asset_type <> 'video'::text) OR (format_family <> 'wall_text_overlay'::text) OR ((duration_seconds IS
    NOT NULL) AND (duration_seconds >= (6)::numeric)))),
  CONSTRAINT "overlay_media_assets_active_wall_video_metadata_chk"
    CHECK (((status <> 'active'::text) OR (asset_type <> 'video'::text) OR (format_family <> 'wall_text_overlay'::text) OR ((source_file_sha256 IS NOT NULL) AND (source_batch IS
    NOT NULL) AND (visual_group IS NOT NULL)))),
  CONSTRAINT "overlay_media_assets_analysis_model_check" CHECK (((analysis_model IS NULL) OR (char_length(TRIM(BOTH FROM analysis_model)) > 0))),
  CONSTRAINT "overlay_media_assets_analysis_status_check"
    CHECK ((analysis_status = ANY (ARRAY['pending'::text, 'analyzing'::text, 'succeeded'::text, 'failed'::text, 'skipped_missing_ffmpeg'::text]))),
  CONSTRAINT "overlay_media_assets_aspect_ratio_check" CHECK ((aspect_ratio = ANY (ARRAY['9:16'::text, '1:1'::text, '4:5'::text, '16:9'::text, 'other'::text]))),
  CONSTRAINT "overlay_media_assets_asset_type_check" CHECK ((asset_type = ANY (ARRAY['image'::text, 'video'::text]))),
  CONSTRAINT "overlay_media_assets_content_type_check"
    CHECK
    (((content_type IS NULL) OR (content_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text, 'video/mp4'::text, 'video/quicktime'::text,
    'video/webm'::text])))),
  CONSTRAINT "overlay_media_assets_duration_seconds_check" CHECK (((duration_seconds IS NULL) OR (duration_seconds > (0)::numeric))),
  CONSTRAINT "overlay_media_assets_file_size_bytes_check" CHECK (((file_size_bytes IS NULL) OR (file_size_bytes > 0))),
  CONSTRAINT "overlay_media_assets_format_family_check" CHECK ((format_family = 'wall_text_overlay'::text)),
  CONSTRAINT "overlay_media_assets_generic_profiles_check" CHECK ((jsonb_typeof(generic_profiles) = 'array'::text)),
  CONSTRAINT "overlay_media_assets_height_check" CHECK (((height IS NULL) OR (height > 0))),
  CONSTRAINT "overlay_media_assets_metadata_schema_version_check" CHECK ((metadata_schema_version = 'overlay_asset_metadata_v1'::text)),
  CONSTRAINT "overlay_media_assets_motion_level_check" CHECK (((motion_level IS NULL) OR (motion_level = ANY (ARRAY['none'::text, 'low'::text, 'medium'::text, 'high'::text])))),
  CONSTRAINT "overlay_media_assets_pkey" PRIMARY KEY (id),
  CONSTRAINT "overlay_media_assets_placement_analysis_chk"
    CHECK
    (((placement_analysis IS NULL) OR COALESCE(((jsonb_typeof(placement_analysis) = 'object'::text) AND ((((placement_analysis ->> 'version'::text) =
    'wall-text-placement-v1'::text) AND
    ((placement_analysis ->> 'selectedZone'::text) = ANY (ARRAY['top-left'::text, 'upper-center'::text, 'middle-left'::text, 'lower-left'::text]))) OR
    (((placement_analysis ->> 'version'::text) = 'wall-text-placement-v2'::text) AND ((placement_analysis ->> 'selectedZone'::text) = ANY (ARRAY['upper-middle'::text,
    'middle'::text,
    'lower-middle'::text])))) AND (jsonb_typeof((placement_analysis -> 'faceBoxes'::text)) = 'array'::text) AND
    (jsonb_typeof((placement_analysis -> 'importantRegions'::text)) = 'array'::text) AND (jsonb_typeof((placement_analysis -> 'faceOverlap'::text)) = 'number'::text) AND
    (jsonb_typeof((placement_analysis -> 'contrastScore'::text)) = 'number'::text)), false))),
  CONSTRAINT "overlay_media_assets_preview_url_check" CHECK (((preview_url IS NULL) OR (preview_url ~ '^https?://'::text))),
  CONSTRAINT "overlay_media_assets_primary_profiles_check" CHECK ((jsonb_typeof(primary_profiles) = 'array'::text)),
  CONSTRAINT "overlay_media_assets_readability_score_check" CHECK (((readability_score IS NULL) OR ((readability_score >= (0)::numeric) AND (readability_score <= (1)::numeric)))),
  CONSTRAINT "overlay_media_assets_s3_key_check" CHECK ((char_length(TRIM(BOTH FROM s3_key)) > 0)),
  CONSTRAINT "overlay_media_assets_source_batch_chk" CHECK (((source_batch IS NULL) OR (char_length(TRIM(BOTH FROM source_batch)) > 0))),
  CONSTRAINT "overlay_media_assets_source_file_name_check" CHECK (((source_file_name IS NULL) OR (char_length(TRIM(BOTH FROM source_file_name)) > 0))),
  CONSTRAINT "overlay_media_assets_source_file_sha256_chk" CHECK (((source_file_sha256 IS NULL) OR (source_file_sha256 ~ '^[0-9a-f]{64}$'::text))),
  CONSTRAINT "overlay_media_assets_source_media_asset_id_fkey" FOREIGN KEY (source_media_asset_id) REFERENCES public.media_assets(id) ON DELETE SET NULL,
  CONSTRAINT "overlay_media_assets_source_type_check" CHECK ((source_type = 'owned'::text)),
  CONSTRAINT "overlay_media_assets_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'archived'::text]))),
  CONSTRAINT "overlay_media_assets_text_capacity_check" CHECK (((text_capacity IS NULL) OR (text_capacity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))),
  CONSTRAINT "overlay_media_assets_thumbnail_s3_key_check" CHECK (((thumbnail_s3_key IS NULL) OR (char_length(TRIM(BOTH FROM thumbnail_s3_key)) > 0))),
  CONSTRAINT "overlay_media_assets_thumbnail_url_check" CHECK (((thumbnail_url IS NULL) OR (thumbnail_url ~ '^https?://'::text))),
  CONSTRAINT "overlay_media_assets_usage_count_check" CHECK ((usage_count >= 0)),
  CONSTRAINT "overlay_media_assets_use_case_tags_check" CHECK ((jsonb_typeof(use_case_tags) = 'array'::text)),
  CONSTRAINT "overlay_media_assets_video_duration_chk" CHECK (((asset_type <> 'video'::text) OR (duration_seconds IS NULL) OR (duration_seconds > (0)::numeric))),
  CONSTRAINT "overlay_media_assets_vision_metadata_check" CHECK ((jsonb_typeof(vision_metadata) = 'object'::text)),
  CONSTRAINT "overlay_media_assets_visual_group_chk" CHECK (((visual_group IS NULL) OR (char_length(TRIM(BOTH FROM visual_group)) > 0))),
  CONSTRAINT "overlay_media_assets_wall_text_source_kind_chk"
    CHECK (((wall_text_source_kind IS NULL) OR (wall_text_source_kind = ANY (ARRAY['ugcpilot'::text, 'creative_asset'::text, 'instagram_reel'::text])))),
  CONSTRAINT "overlay_media_assets_width_check" CHECK (((width IS NULL) OR (width > 0)))
);

ALTER TABLE "public"."overlay_media_assets"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX overlay_media_assets_analysis_status_idx ON public.overlay_media_assets USING btree (analysis_status, status, created_at DESC);

CREATE INDEX overlay_media_assets_generic_profiles_gin_idx ON public.overlay_media_assets USING gin (generic_profiles);

CREATE UNIQUE INDEX overlay_media_assets_owner_source_media_uidx ON public.overlay_media_assets USING btree (owner_user_id, source_media_asset_id);

CREATE INDEX overlay_media_assets_primary_profiles_gin_idx ON public.overlay_media_assets USING gin (primary_profiles);

CREATE UNIQUE INDEX overlay_media_assets_s3_key_idx ON public.overlay_media_assets USING btree (s3_key)
  WHERE (status <> 'archived'::text);

CREATE INDEX overlay_media_assets_selectable_idx ON public.overlay_media_assets USING btree (format_family, asset_type, aspect_ratio, status, usage_count, created_at DESC)
  WHERE (status = 'active'::text);

CREATE INDEX overlay_media_assets_source_media_idx ON public.overlay_media_assets USING btree (source_media_asset_id)
  WHERE (source_media_asset_id IS NOT NULL);

CREATE INDEX overlay_media_assets_use_case_tags_gin_idx ON public.overlay_media_assets USING gin (use_case_tags);

CREATE INDEX overlay_media_assets_wall_video_selection_idx ON public.overlay_media_assets USING btree (visual_group, usage_count, last_used_at, created_at DESC)
  WHERE
    ((asset_type = 'video'::text) AND (format_family = 'wall_text_overlay'::text) AND (aspect_ratio = '9:16'::text) AND (status = 'active'::text) AND (analysis_status =
    'succeeded'::text));

CREATE UNIQUE INDEX overlay_media_assets_wall_video_sha256_idx ON public.overlay_media_assets USING btree (source_file_sha256)
  WHERE ((asset_type = 'video'::text) AND (format_family = 'wall_text_overlay'::text) AND (source_file_sha256 IS NOT NULL));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."overlay_media_assets" TO "postgres", "service_role";


-- source: public/tables/scheduled_posts.sql
CREATE TABLE "public"."scheduled_posts" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"         text                     NOT NULL,
  "project_id"      text,
  "source_kind"     text                     NOT NULL,
  "media_asset_id"  uuid,
  "library_item_id" uuid,
  "title"           text                     NOT NULL DEFAULT 'Scheduled post'::text,
  "caption"         text                     NOT NULL DEFAULT ''::text,
  "timezone"        text                     NOT NULL DEFAULT 'UTC'::text,
  "scheduled_for"   timestamp with time zone,
  "status"          text                     NOT NULL DEFAULT 'draft'::text,
  "idempotency_key" text,
  "last_error_code" text,
  "metadata"        jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "cancelled_at"    timestamp with time zone,
  "published_at"    timestamp with time zone,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "scheduled_posts_caption_check" CHECK ((char_length(caption) <= 5000)),
  CONSTRAINT "scheduled_posts_check" CHECK ((((source_kind = 'media_asset'::text) AND (media_asset_id IS
    NOT NULL) AND (library_item_id IS NULL)) OR ((source_kind = 'library_item'::text) AND (library_item_id IS NOT NULL) AND (media_asset_id IS NULL)))),
  CONSTRAINT "scheduled_posts_library_item_id_fkey" FOREIGN KEY (library_item_id) REFERENCES public.library_items(id) ON DELETE RESTRICT,
  CONSTRAINT "scheduled_posts_media_asset_id_fkey" FOREIGN KEY (media_asset_id) REFERENCES public.media_assets(id) ON DELETE RESTRICT,
  CONSTRAINT "scheduled_posts_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text)),
  CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY (id),
  CONSTRAINT "scheduled_posts_source_kind_check" CHECK ((source_kind = ANY (ARRAY['media_asset'::text, 'library_item'::text]))),
  CONSTRAINT "scheduled_posts_status_check"
    CHECK
    ((status = ANY (ARRAY['draft'::text, 'scheduling'::text, 'scheduled'::text, 'publishing'::text, 'published'::text, 'partially_failed'::text, 'failed'::text,
    'cancelled'::text]))),
  CONSTRAINT "scheduled_posts_timezone_check" CHECK (((char_length(TRIM(BOTH FROM timezone)) > 0) AND (char_length(timezone) <= 100))),
  CONSTRAINT "scheduled_posts_title_check" CHECK (((char_length(TRIM(BOTH FROM title)) > 0) AND (char_length(title) <= 160)))
);

ALTER TABLE "public"."scheduled_posts"
  ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX scheduled_posts_active_hook_video_draft_idx ON public.scheduled_posts USING btree (((metadata ->> 'hookVideoDraftId'::text)))
  WHERE ((metadata ? 'hookVideoDraftId'::text) AND (status <> 'cancelled'::text));

CREATE UNIQUE INDEX scheduled_posts_user_idempotency_idx ON public.scheduled_posts USING btree (user_id, idempotency_key)
  WHERE (idempotency_key IS NOT NULL);

CREATE INDEX scheduled_posts_user_schedule_sort_idx ON public.scheduled_posts USING btree (user_id, scheduled_for, updated_at DESC);

CREATE INDEX scheduled_posts_user_status_time_idx ON public.scheduled_posts USING btree (user_id, status, scheduled_for DESC);

CREATE INDEX scheduled_posts_user_updated_idx ON public.scheduled_posts USING btree (user_id, updated_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."scheduled_posts" TO "postgres", "service_role";


-- source: public/tables/social_oauth_sessions.sql
CREATE TABLE "public"."social_oauth_sessions" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                text                     NOT NULL,
  "provider"               text                     NOT NULL,
  "platform"               text                     NOT NULL,
  "state_hash"             text                     NOT NULL,
  "code_verifier"          text,
  "library_item_id"        uuid,
  "carousel_id"            text,
  "return_to"              text                     NOT NULL DEFAULT 'accounts'::text,
  "expires_at"             timestamp with time zone NOT NULL,
  "consumed_at"            timestamp with time zone,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "intent"                 text                     NOT NULL DEFAULT 'add'::text,
  "expected_connection_id" uuid,
  CONSTRAINT "social_oauth_sessions_check"
    CHECK
    ((((provider = 'meta'::text) AND (platform = 'instagram'::text)) OR ((provider = 'tiktok'::text) AND (platform = 'tiktok'::text)) OR ((provider = 'google'::text) AND (platform
    = 'youtube'::text)))),
  CONSTRAINT "social_oauth_sessions_expected_connection_fkey" FOREIGN KEY (expected_connection_id) REFERENCES public.social_connections(id) ON DELETE CASCADE,
  CONSTRAINT "social_oauth_sessions_intent_check" CHECK ((intent = ANY (ARRAY['add'::text, 'reconnect'::text]))),
  CONSTRAINT "social_oauth_sessions_library_item_id_fkey" FOREIGN KEY (library_item_id) REFERENCES public.library_items(id) ON DELETE SET NULL,
  CONSTRAINT "social_oauth_sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "social_oauth_sessions_platform_check" CHECK ((platform = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'youtube'::text]))),
  CONSTRAINT "social_oauth_sessions_provider_check" CHECK ((provider = ANY (ARRAY['meta'::text, 'tiktok'::text, 'google'::text]))),
  CONSTRAINT "social_oauth_sessions_reconnect_target_check"
    CHECK ((((intent = 'add'::text) AND (expected_connection_id IS NULL)) OR ((intent = 'reconnect'::text) AND (expected_connection_id IS NOT NULL)))),
  CONSTRAINT "social_oauth_sessions_return_to_check" CHECK ((return_to = ANY (ARRAY['accounts'::text, 'library'::text, 'trending'::text]))),
  CONSTRAINT "social_oauth_sessions_state_hash_key" UNIQUE (state_hash)
);

ALTER TABLE "public"."social_oauth_sessions"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX social_oauth_sessions_expiry_idx ON public.social_oauth_sessions USING btree (expires_at)
  WHERE (consumed_at IS NULL);

CREATE INDEX social_oauth_sessions_provider_state_idx ON public.social_oauth_sessions USING btree (PROVIDER, platform, state_hash);

CREATE INDEX social_oauth_sessions_reconnect_target_idx ON public.social_oauth_sessions USING btree (expected_connection_id)
  WHERE (expected_connection_id IS NOT NULL);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."social_oauth_sessions" TO "postgres", "service_role";


-- source: public/tables/social_publish_account_lanes.sql
CREATE TABLE "public"."social_publish_account_lanes" (
  "platform"             text                     NOT NULL,
  "social_connection_id" uuid                     NOT NULL,
  "active_job_id"        uuid,
  "active_claim_token"   uuid,
  "claimed_at"           timestamp with time zone,
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "social_publish_account_lanes_active_job_id_fkey" FOREIGN KEY (active_job_id) REFERENCES public.background_jobs(id) ON DELETE RESTRICT,
  CONSTRAINT "social_publish_account_lanes_check" CHECK ((((active_job_id IS NULL) AND (active_claim_token IS NULL) AND (claimed_at IS NULL)) OR ((active_job_id IS
    NOT NULL) AND (active_claim_token IS NOT NULL) AND (claimed_at IS NOT NULL)))),
  CONSTRAINT "social_publish_account_lanes_pkey" PRIMARY KEY (platform, social_connection_id),
  CONSTRAINT "social_publish_account_lanes_platform_check" CHECK ((platform = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'youtube'::text]))),
  CONSTRAINT "social_publish_account_lanes_social_connection_id_fkey" FOREIGN KEY (social_connection_id) REFERENCES public.social_connections(id) ON DELETE CASCADE
);

ALTER TABLE "public"."social_publish_account_lanes"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."social_publish_account_lanes" TO "postgres", "service_role";


-- source: public/tables/trending_creative_edits.sql
CREATE TABLE "public"."trending_creative_edits" (
  "id"                                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                            text                     NOT NULL,
  "assignment_id"                      uuid                     NOT NULL,
  "creative_id"                        uuid                     NOT NULL,
  "format"                             text                     NOT NULL,
  "revision"                           integer                  NOT NULL DEFAULT 1,
  "content_json"                       jsonb                    NOT NULL,
  "position_json"                      jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "source_selection_kind"              text,
  "source_group_id"                    uuid,
  "source_media_asset_id"              uuid,
  "resolved_media_asset_id"            uuid,
  "render_status"                      text                     NOT NULL DEFAULT 'draft'::text,
  "render_job_id"                      uuid,
  "render_output_json"                 jsonb,
  "render_error"                       text,
  "created_at"                         timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                         timestamp with time zone NOT NULL DEFAULT now(),
  "wall_text_edit_classification"      text,
  "wall_text_format_learning_eligible" boolean,
  "wall_text_content_hash"             text,
  CONSTRAINT "trending_creative_edits_assignment_key" UNIQUE (format, assignment_id),
  CONSTRAINT "trending_creative_edits_carousel_source_check" CHECK (((format <> 'carousel'::text) OR (source_selection_kind IS NULL))),
  CONSTRAINT "trending_creative_edits_content_format_check" CHECK (((content_json ->> 'format'::text) = format)),
  CONSTRAINT "trending_creative_edits_content_json_check" CHECK ((jsonb_typeof(content_json) = 'object'::text)),
  CONSTRAINT "trending_creative_edits_format_check" CHECK ((format = ANY (ARRAY['carousel'::text, 'hook_video'::text, 'wall_text'::text]))),
  CONSTRAINT "trending_creative_edits_owner_creative_key" UNIQUE (user_id, format, creative_id),
  CONSTRAINT "trending_creative_edits_pkey" PRIMARY KEY (id),
  CONSTRAINT "trending_creative_edits_position_json_check" CHECK ((jsonb_typeof(position_json) = 'object'::text)),
  CONSTRAINT "trending_creative_edits_queued_job_check" CHECK (((render_status <> ALL (ARRAY['queued'::text, 'rendering'::text])) OR (render_job_id IS NOT NULL))),
  CONSTRAINT "trending_creative_edits_ready_output_check" CHECK (((render_status <> 'ready'::text) OR (render_output_json IS NOT NULL))),
  CONSTRAINT "trending_creative_edits_render_job_id_fkey" FOREIGN KEY (render_job_id) REFERENCES public.background_jobs(id) ON DELETE SET NULL,
  CONSTRAINT "trending_creative_edits_render_output_json_check" CHECK (((render_output_json IS NULL) OR (jsonb_typeof(render_output_json) = 'object'::text))),
  CONSTRAINT "trending_creative_edits_render_status_check" CHECK ((render_status = ANY (ARRAY['draft'::text, 'queued'::text, 'rendering'::text, 'ready'::text, 'failed'::text]))),
  CONSTRAINT "trending_creative_edits_resolved_media_asset_id_fkey" FOREIGN KEY (resolved_media_asset_id) REFERENCES public.media_assets(id) ON DELETE RESTRICT,
  CONSTRAINT "trending_creative_edits_revision_check" CHECK ((revision > 0)),
  CONSTRAINT "trending_creative_edits_source_group_id_fkey" FOREIGN KEY (source_group_id) REFERENCES public.creative_asset_groups(id) ON DELETE RESTRICT,
  CONSTRAINT "trending_creative_edits_source_media_asset_id_fkey" FOREIGN KEY (source_media_asset_id) REFERENCES public.media_assets(id) ON DELETE RESTRICT,
  CONSTRAINT "trending_creative_edits_source_selection_kind_check" CHECK (((source_selection_kind IS NULL) OR (source_selection_kind = ANY (ARRAY['asset'::text, 'group'::text])))),
  CONSTRAINT "trending_creative_edits_source_shape_check"
    CHECK
    ((((source_selection_kind IS NULL) AND (source_group_id IS NULL) AND (source_media_asset_id IS NULL) AND (resolved_media_asset_id IS NULL)) OR ((source_selection_kind =
    'asset'::text) AND (source_group_id IS NULL) AND (source_media_asset_id IS
    NOT NULL) AND (resolved_media_asset_id = source_media_asset_id)) OR ((source_selection_kind = 'group'::text) AND (source_group_id IS
    NOT NULL) AND (source_media_asset_id IS NULL) AND (resolved_media_asset_id IS NOT NULL)))),
  CONSTRAINT "trending_creative_edits_user_id_check" CHECK (((char_length(btrim(user_id)) > 0) AND (char_length(btrim(user_id)) <= 200)))
);

ALTER TABLE "public"."trending_creative_edits"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."trending_creative_edits"
  ADD CONSTRAINT "trending_creative_edits_wall_attribution_chk"
    CHECK
    ((((format <> 'wall_text'::text) AND (wall_text_edit_classification IS NULL) AND (wall_text_format_learning_eligible IS NULL) AND (wall_text_content_hash IS NULL)) OR ((format
    = 'wall_text'::text) AND (wall_text_edit_classification = ANY (ARRAY['none'::text, 'minor'::text, 'major'::text])) AND (wall_text_format_learning_eligible IS
    NOT NULL) AND (wall_text_content_hash ~ '^[a-f0-9]{64}$'::text)))) NOT VALID;

CREATE INDEX trending_creative_edits_owner_updated_idx ON public.trending_creative_edits USING btree (user_id, updated_at DESC);

CREATE INDEX trending_creative_edits_render_job_idx ON public.trending_creative_edits USING btree (render_job_id)
  WHERE (render_job_id IS NOT NULL);

CREATE TRIGGER validate_trending_creative_edit_row
  BEFORE INSERT OR UPDATE ON public.trending_creative_edits
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_trending_creative_edit();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."trending_creative_edits" TO "postgres", "service_role";


-- source: public/tables/trending_feed_reconciliation_outbox.sql
CREATE TABLE "public"."trending_feed_reconciliation_outbox" (
  "source_job_id"   uuid                     NOT NULL,
  "user_id"         text                     NOT NULL,
  "status"          text                     NOT NULL DEFAULT 'pending'::text,
  "attempt_count"   integer                  NOT NULL DEFAULT 0,
  "next_attempt_at" timestamp with time zone NOT NULL DEFAULT now(),
  "locked_at"       timestamp with time zone,
  "last_attempt_at" timestamp with time zone,
  "last_error"      text,
  "completed_at"    timestamp with time zone,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "trending_feed_reconciliation_outbox_attempt_count_check" CHECK ((attempt_count >= 0)),
  CONSTRAINT "trending_feed_reconciliation_outbox_pkey" PRIMARY KEY (source_job_id),
  CONSTRAINT "trending_feed_reconciliation_outbox_source_job_id_fkey" FOREIGN KEY (source_job_id) REFERENCES public.background_jobs(id) ON DELETE CASCADE,
  CONSTRAINT "trending_feed_reconciliation_outbox_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text]))),
  CONSTRAINT "trending_feed_reconciliation_outbox_user_id_check" CHECK (((char_length(TRIM(BOTH FROM user_id)) >= 1) AND (char_length(TRIM(BOTH FROM user_id)) <= 128)))
);

ALTER TABLE "public"."trending_feed_reconciliation_outbox"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX trending_feed_reconciliation_outbox_due_idx ON public.trending_feed_reconciliation_outbox USING btree (next_attempt_at, created_at)
  WHERE (status = 'pending'::text);

CREATE INDEX trending_feed_reconciliation_outbox_stale_idx ON public.trending_feed_reconciliation_outbox USING btree (locked_at)
  WHERE (status = 'processing'::text);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."trending_feed_reconciliation_outbox" TO "postgres", "service_role";


-- source: public/tables/trending_video_source_selections.sql
CREATE TABLE "public"."trending_video_source_selections" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"        text                     NOT NULL,
  "format"         text                     NOT NULL,
  "selection_kind" text                     NOT NULL,
  "group_id"       uuid,
  "media_asset_id" uuid,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "trending_video_source_selections_format_check" CHECK ((format = ANY (ARRAY['hook_video'::text, 'wall_text'::text]))),
  CONSTRAINT "trending_video_source_selections_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.creative_asset_groups(id) ON DELETE CASCADE,
  CONSTRAINT "trending_video_source_selections_media_asset_id_fkey" FOREIGN KEY (media_asset_id) REFERENCES public.media_assets(id) ON DELETE CASCADE,
  CONSTRAINT "trending_video_source_selections_pkey" PRIMARY KEY (id),
  CONSTRAINT "trending_video_source_selections_selection_kind_check" CHECK ((selection_kind = ANY (ARRAY['group'::text, 'asset'::text]))),
  CONSTRAINT "trending_video_source_selections_target_check" CHECK ((((selection_kind = 'group'::text) AND (group_id IS
    NOT NULL) AND (media_asset_id IS NULL)) OR ((selection_kind = 'asset'::text) AND (group_id IS NULL) AND (media_asset_id IS NOT NULL)))),
  CONSTRAINT "trending_video_source_selections_user_format_key" UNIQUE (user_id, format),
  CONSTRAINT "trending_video_source_selections_user_id_check" CHECK ((char_length(TRIM(BOTH FROM user_id)) > 0))
);

ALTER TABLE "public"."trending_video_source_selections"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX trending_video_source_selections_asset_idx ON public.trending_video_source_selections USING btree (media_asset_id)
  WHERE (media_asset_id IS NOT NULL);

CREATE INDEX trending_video_source_selections_group_idx ON public.trending_video_source_selections USING btree (group_id)
  WHERE (group_id IS NOT NULL);

CREATE TRIGGER validate_trending_video_source_selection_row
  BEFORE INSERT OR UPDATE ON public.trending_video_source_selections
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_trending_video_source_selection();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."trending_video_source_selections" TO "postgres", "service_role";


-- source: public/tables/user_subscription_plans.sql
CREATE TABLE "public"."user_subscription_plans" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    text                     NOT NULL,
  "plan_key"   text                     NOT NULL,
  "is_active"  boolean                  NOT NULL DEFAULT true,
  "source"     text                     NOT NULL DEFAULT 'manual'::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_subscription_plans_pkey" PRIMARY KEY (id),
  CONSTRAINT "user_subscription_plans_plan_key_fkey" FOREIGN KEY (plan_key) REFERENCES public.subscription_entitlements(plan_key),
  CONSTRAINT "user_subscription_plans_source_check" CHECK ((source = ANY (ARRAY['manual'::text, 'billing'::text, 'system'::text])))
);

ALTER TABLE "public"."user_subscription_plans"
  ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX user_subscription_plans_active_uidx ON public.user_subscription_plans USING btree (user_id)
  WHERE is_active;

CREATE INDEX user_subscription_plans_user_updated_idx ON public.user_subscription_plans USING btree (user_id, updated_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_subscription_plans" TO "postgres", "service_role";


-- source: public/tables/video_render_execution_slots.sql
CREATE TABLE "public"."video_render_execution_slots" (
  "slot_number"         smallint                 NOT NULL,
  "background_job_id"   uuid,
  "claim_token"         uuid,
  "claimed_at"          timestamp with time zone,
  "worker_execution_id" text,
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "video_render_execution_slots_background_job_id_fkey" FOREIGN KEY (background_job_id) REFERENCES public.background_jobs(id) ON DELETE RESTRICT,
  CONSTRAINT "video_render_execution_slots_background_job_id_key" UNIQUE (background_job_id),
  CONSTRAINT "video_render_execution_slots_check"
    CHECK ((((background_job_id IS NULL) AND (claim_token IS NULL) AND (claimed_at IS NULL) AND (worker_execution_id IS NULL)) OR ((background_job_id IS
    NOT NULL) AND (claim_token IS NOT NULL) AND (claimed_at IS NOT NULL)))),
  CONSTRAINT "video_render_execution_slots_pkey" PRIMARY KEY (slot_number),
  CONSTRAINT "video_render_execution_slots_slot_number_check" CHECK (((slot_number >= 1) AND (slot_number <= 10)))
);

ALTER TABLE "public"."video_render_execution_slots"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."video_render_execution_slots" TO "postgres", "service_role";


-- source: public/tables/viral_hook_config.sql
CREATE TABLE "public"."viral_hook_config" (
  "reference_id" uuid                     NOT NULL,
  "hook_end_ms"  integer                  NOT NULL,
  "reviewed_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "reviewed_by"  text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "viral_hook_config_hook_end_ms_check" CHECK ((hook_end_ms > 0)),
  CONSTRAINT "viral_hook_config_pkey" PRIMARY KEY (reference_id),
  CONSTRAINT "viral_hook_config_reviewed_by_check" CHECK (((char_length(TRIM(BOTH FROM reviewed_by)) >= 1) AND (char_length(TRIM(BOTH FROM reviewed_by)) <= 128))),
  CONSTRAINT "viral_hook_config_reference_id_fkey" FOREIGN KEY (reference_id) REFERENCES public.viral_references(id) ON DELETE CASCADE
);

ALTER TABLE "public"."viral_hook_config"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."viral_hook_config"
  ADD COLUMN "hook_start_ms" integer GENERATED ALWAYS AS (0) STORED;

CREATE TRIGGER validate_viral_hook_reference_section
  BEFORE INSERT OR UPDATE OF reference_id ON public.viral_hook_config
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_viral_hook_reference_section();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."viral_hook_config" TO "postgres";

COMMENT ON COLUMN "public"."viral_hook_config"."hook_end_ms" IS 'Admin-reviewed hook ending boundary in milliseconds.';

COMMENT ON COLUMN "public"."viral_hook_config"."hook_start_ms" IS 'All Viral hooks begin at zero milliseconds.';

COMMENT ON TABLE "public"."viral_hook_config" IS 'Private hook timing intelligence. Never include this table in customer feed responses.';

REVOKE ALL ON TABLE "public"."viral_hook_config" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."viral_hook_config" TO "service_role";


-- source: public/tables/website_analyses.sql
CREATE TABLE "public"."website_analyses" (
  "id"                             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                        text                     NOT NULL,
  "project_id"                     text                     NOT NULL,
  "website_url"                    text,
  "normalized_domain"              text,
  "business_name"                  text,
  "category"                       text,
  "product_summary"                text,
  "target_audience"                text[]                   NOT NULL DEFAULT '{}'::text[],
  "main_problem"                   text,
  "main_promise"                   text,
  "value_props"                    text[]                   NOT NULL DEFAULT '{}'::text[],
  "pain_points"                    text[]                   NOT NULL DEFAULT '{}'::text[],
  "differentiators"                text[]                   NOT NULL DEFAULT '{}'::text[],
  "brand_tone"                     text,
  "carousel_angles"                text[]                   NOT NULL DEFAULT '{}'::text[],
  "pexels_image_queries"           text[]                   NOT NULL DEFAULT '{}'::text[],
  "visual_keywords"                text[]                   NOT NULL DEFAULT '{}'::text[],
  "recommended_carousel_structure" text[]                   NOT NULL DEFAULT '{}'::text[],
  "cta_ideas"                      text[]                   NOT NULL DEFAULT '{}'::text[],
  "claims_to_avoid"                text[]                   NOT NULL DEFAULT '{}'::text[],
  "missing_info"                   text[]                   NOT NULL DEFAULT '{}'::text[],
  "confidence"                     text                     NOT NULL,
  "confidence_reason"              text,
  "analysis_json"                  jsonb                    NOT NULL,
  "created_at"                     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                     timestamp with time zone NOT NULL DEFAULT now(),
  "source_type"                    text                     NOT NULL DEFAULT 'website'::text,
  "source_context"                 text,
  "source_job_id"                  uuid,
  CONSTRAINT "website_analyses_analysis_json_check" CHECK ((jsonb_typeof(analysis_json) = 'object'::text)),
  CONSTRAINT "website_analyses_confidence_check" CHECK ((confidence = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
  CONSTRAINT "website_analyses_pkey" PRIMARY KEY (id),
  CONSTRAINT "website_analyses_source_job_id_fkey" FOREIGN KEY (source_job_id) REFERENCES public.background_jobs(id) ON DELETE SET NULL,
  CONSTRAINT "website_analyses_source_type_check" CHECK ((source_type = ANY (ARRAY['website'::text, 'mobile_app_ai_prompt'::text, 'manual'::text])))
);

ALTER TABLE "public"."website_analyses"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX website_analyses_domain_idx ON public.website_analyses USING btree (normalized_domain);

CREATE INDEX website_analyses_project_created_idx ON public.website_analyses USING btree (project_id, created_at DESC);

CREATE UNIQUE INDEX website_analyses_source_job_unique_idx ON public.website_analyses USING btree (source_job_id)
  WHERE (source_job_id IS NOT NULL);

CREATE INDEX website_analyses_user_source_job_idx ON public.website_analyses USING btree (user_id, source_job_id)
  WHERE (source_job_id IS NOT NULL);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."website_analyses" TO "anon", "authenticated", "postgres", "service_role";


-- source: public/tables/business_profiles.sql
CREATE TABLE "public"."business_profiles" (
  "id"                                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                           text                     NOT NULL,
  "project_id"                        text                     NOT NULL DEFAULT 'default-project'::text,
  "intake_type"                       text                     NOT NULL,
  "analysis_id"                       uuid,
  "context_json"                      jsonb                    NOT NULL,
  "source_url"                        text,
  "source_context"                    text,
  "content_hash"                      text                     NOT NULL,
  "profile_version"                   integer                  NOT NULL DEFAULT 1,
  "preparation_status"                text                     NOT NULL DEFAULT 'preparing'::text,
  "preparation_error"                 text,
  "latest_generation_batch_id"        uuid,
  "created_at"                        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                        timestamp with time zone NOT NULL DEFAULT now(),
  "trending_timezone"                 text,
  "onboarding_status"                 text                     NOT NULL DEFAULT 'incomplete'::text,
  "onboarding_version"                integer                  NOT NULL DEFAULT 0,
  "onboarding_completed_at"           timestamp with time zone,
  "primary_goal"                      text,
  "logo_storage_key"                  text,
  "logo_url"                          text,
  "logo_mime_type"                    text,
  "logo_file_size_bytes"              bigint,
  "logo_width"                        integer,
  "logo_height"                       integer,
  "primary_goals"                     text[]                   NOT NULL DEFAULT '{}'::text[],
  "onboarding_step"                   smallint                 NOT NULL DEFAULT 1,
  "trending_walkthrough_completed_at" timestamp with time zone,
  CONSTRAINT "business_profiles_completed_goals_check" CHECK (((onboarding_status <> 'completed'::text) OR (onboarding_version < 3) OR (cardinality(primary_goals) >= 1))),
  CONSTRAINT "business_profiles_context_json_check" CHECK ((jsonb_typeof(context_json) = 'object'::text)),
  CONSTRAINT "business_profiles_intake_type_check" CHECK ((intake_type = ANY (ARRAY['website'::text, 'mobile_app_ai_prompt'::text, 'manual'::text]))),
  CONSTRAINT "business_profiles_logo_metadata_check"
    CHECK
    ((((logo_storage_key IS NULL) AND (logo_url IS NULL) AND (logo_mime_type IS NULL) AND (logo_file_size_bytes IS NULL) AND (logo_width IS NULL) AND (logo_height IS NULL)) OR
    ((logo_storage_key IS NOT NULL) AND (logo_url IS NOT NULL) AND (logo_mime_type IS
    NOT NULL) AND ((logo_file_size_bytes >= 1) AND (logo_file_size_bytes <= 2097152)) AND ((logo_width >= 64) AND (logo_width <= 4096)) AND
    ((logo_height >= 64) AND (logo_height <= 4096))))),
  CONSTRAINT "business_profiles_logo_mime_type_check"
    CHECK (((logo_mime_type IS NULL) OR (logo_mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])))),
  CONSTRAINT "business_profiles_onboarding_state_check"
    CHECK
    ((((onboarding_status = 'incomplete'::text) AND (onboarding_version = 0) AND (onboarding_completed_at IS NULL)) OR ((onboarding_status = 'completed'::text) AND
    (onboarding_version > 0) AND (onboarding_completed_at IS NOT NULL)))),
  CONSTRAINT "business_profiles_onboarding_status_check" CHECK ((onboarding_status = ANY (ARRAY['incomplete'::text, 'completed'::text]))),
  CONSTRAINT "business_profiles_onboarding_step_check"
    CHECK ((((onboarding_step >= 1) AND (onboarding_step <= 3)) AND ((onboarding_status <> 'completed'::text) OR (onboarding_version < 3) OR (onboarding_step = 3)))),
  CONSTRAINT "business_profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "business_profiles_preparation_status_check" CHECK ((preparation_status = ANY (ARRAY['preparing'::text, 'failed'::text]))),
  CONSTRAINT "business_profiles_primary_goal_check"
    CHECK
    (((primary_goal IS NULL) OR (primary_goal = ANY (ARRAY['increase_revenue'::text, 'generate_leads'::text, 'increase_signups'::text, 'increase_installs'::text,
    'grow_views'::text, 'brand_awareness'::text, 'grow_following'::text, 'increase_engagement'::text, 'website_traffic'::text, 'product_launch'::text])))),
  CONSTRAINT "business_profiles_primary_goals_values_check"
    CHECK
    (((cardinality(primary_goals) <= 10) AND (primary_goals <@ ARRAY['increase_revenue'::text, 'generate_leads'::text, 'increase_signups'::text, 'increase_installs'::text,
    'grow_views'::text, 'brand_awareness'::text, 'grow_following'::text, 'increase_engagement'::text, 'website_traffic'::text, 'product_launch'::text]))),
  CONSTRAINT "business_profiles_profile_version_check" CHECK ((profile_version > 0)),
  CONSTRAINT "business_profiles_user_id_key" UNIQUE (user_id),
  CONSTRAINT "business_profiles_analysis_id_fkey" FOREIGN KEY (analysis_id) REFERENCES public.website_analyses(id) ON DELETE SET NULL
);

ALTER TABLE "public"."business_profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX business_profiles_completed_onboarding_idx ON public.business_profiles USING btree (onboarding_version, id)
  WHERE (onboarding_status = 'completed'::text);

CREATE UNIQUE INDEX business_profiles_id_owner_project_uidx ON public.business_profiles USING btree (id, user_id, project_id);

CREATE INDEX business_profiles_user_updated_idx ON public.business_profiles USING btree (user_id, updated_at DESC);

CREATE TRIGGER grant_free_trial_on_onboarding_completion
  AFTER INSERT OR UPDATE OF onboarding_status, onboarding_version, onboarding_completed_at ON public.business_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_free_trial_on_onboarding_completion();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."business_profiles" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."business_profiles"."onboarding_step" IS 'Last verified onboarding screen; stale completed versions restart at source selection.';

COMMENT ON COLUMN "public"."business_profiles"."primary_goals" IS 'Ordered onboarding goals selected by the user. Empty until onboarding completion.';

COMMENT ON COLUMN "public"."business_profiles"."trending_walkthrough_completed_at" IS 'The first time an owner completes the visual Trending walkthrough.';


-- source: public/tables/hook_video_audio_locks.sql
CREATE TABLE "public"."hook_video_audio_locks" (
  "hook_video_id"  uuid                     NOT NULL,
  "audio_asset_id" text                     NOT NULL,
  "notes"          text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "hook_video_audio_locks_audio_asset_id_fkey" FOREIGN KEY (audio_asset_id) REFERENCES public.hook_audio_assets(id) ON DELETE RESTRICT,
  CONSTRAINT "hook_video_audio_locks_hook_video_id_fkey" FOREIGN KEY (hook_video_id) REFERENCES public.avatar_assets(id) ON DELETE CASCADE,
  CONSTRAINT "hook_video_audio_locks_notes_check" CHECK (((notes IS NULL) OR ((char_length(btrim(notes)) >= 1) AND (char_length(btrim(notes)) <= 1000)))),
  CONSTRAINT "hook_video_audio_locks_pkey" PRIMARY KEY (hook_video_id)
);

ALTER TABLE "public"."hook_video_audio_locks"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX hook_video_audio_locks_audio_asset_idx ON public.hook_video_audio_locks USING btree (audio_asset_id);

CREATE TRIGGER validate_hook_video_audio_lock_before_write
  BEFORE INSERT OR UPDATE ON public.hook_video_audio_locks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_hook_video_audio_lock();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hook_video_audio_locks" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."hook_video_audio_locks"."hook_video_id" IS 'Primary key intentionally limits each Hook video to one Locked audio.';

COMMENT ON TABLE "public"."hook_video_audio_locks" IS 'Server-only mapping from one catalog Hook video to its manually approved Locked audio. The same audio may be reused by many videos.';


-- source: public/tables/overlay_creatives.sql
CREATE TABLE "public"."overlay_creatives" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "overlay_media_asset_id" uuid                     NOT NULL,
  "creative_type"          text                     NOT NULL,
  "format_family"          text                     NOT NULL DEFAULT 'wall_text_overlay'::text,
  "format"                 text                     NOT NULL,
  "profile"                text,
  "overlay_text"           jsonb                    NOT NULL,
  "render_box"             jsonb                    NOT NULL,
  "render_style"           jsonb                    NOT NULL,
  "source_context"         jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "status"                 text                     NOT NULL DEFAULT 'preview_ready'::text,
  "error_message"          text,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"             timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "overlay_creatives_creative_type_check" CHECK ((creative_type = ANY (ARRAY['text_overlay_image'::text, 'text_overlay_video'::text]))),
  CONSTRAINT "overlay_creatives_format_check" CHECK ((format = ANY (ARRAY['pick_two_list'::text, 'choose_one'::text, 'hot_take'::text, 'pov_statement'::text]))),
  CONSTRAINT "overlay_creatives_format_family_check" CHECK ((format_family = 'wall_text_overlay'::text)),
  CONSTRAINT "overlay_creatives_overlay_text_check" CHECK ((jsonb_typeof(overlay_text) = 'object'::text)),
  CONSTRAINT "overlay_creatives_pkey" PRIMARY KEY (id),
  CONSTRAINT "overlay_creatives_profile_check" CHECK (((profile IS NULL) OR (char_length(TRIM(BOTH FROM profile)) > 0))),
  CONSTRAINT "overlay_creatives_render_box_check" CHECK ((jsonb_typeof(render_box) = 'object'::text)),
  CONSTRAINT "overlay_creatives_render_style_check" CHECK ((jsonb_typeof(render_style) = 'object'::text)),
  CONSTRAINT "overlay_creatives_source_context_check" CHECK ((jsonb_typeof(source_context) = 'object'::text)),
  CONSTRAINT "overlay_creatives_status_check" CHECK ((status = ANY (ARRAY['preview_ready'::text, 'failed'::text, 'archived'::text]))),
  CONSTRAINT "overlay_creatives_overlay_media_asset_id_fkey" FOREIGN KEY (overlay_media_asset_id) REFERENCES public.overlay_media_assets(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."overlay_creatives"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX overlay_creatives_asset_idx ON public.overlay_creatives USING btree (overlay_media_asset_id, created_at DESC);

CREATE INDEX overlay_creatives_profile_format_idx ON public.overlay_creatives USING btree (profile, format, status, created_at DESC)
  WHERE (status = 'preview_ready'::text);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."overlay_creatives" TO "postgres", "service_role";


-- source: public/tables/scheduled_post_targets.sql
CREATE TABLE "public"."scheduled_post_targets" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "scheduled_post_id"       uuid                     NOT NULL,
  "user_id"                 text                     NOT NULL,
  "social_connection_id"    uuid                     NOT NULL,
  "platform"                text                     NOT NULL,
  "scheduled_for"           timestamp with time zone NOT NULL,
  "status"                  text                     NOT NULL DEFAULT 'draft'::text,
  "scheduler_schedule_name" text,
  "scheduler_schedule_arn"  text,
  "attempt_count"           integer                  NOT NULL DEFAULT 0,
  "platform_post_id"        text,
  "platform_post_url"       text,
  "last_error_code"         text,
  "last_error_message"      text,
  "settings"                jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "metadata"                jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "cancelled_at"            timestamp with time zone,
  "published_at"            timestamp with time zone,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "publish_job_id"          uuid,
  "next_retry_at"           timestamp with time zone,
  "scheduler_deleted_at"    timestamp with time zone,
  "last_reconciled_at"      timestamp with time zone,
  CONSTRAINT "scheduled_post_targets_attempt_count_check" CHECK ((attempt_count >= 0)),
  CONSTRAINT "scheduled_post_targets_last_error_message_check" CHECK (((last_error_message IS NULL) OR (char_length(last_error_message) <= 500))),
  CONSTRAINT "scheduled_post_targets_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text)),
  CONSTRAINT "scheduled_post_targets_pkey" PRIMARY KEY (id),
  CONSTRAINT "scheduled_post_targets_platform_check" CHECK ((platform = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'youtube'::text]))),
  CONSTRAINT "scheduled_post_targets_platform_post_url_check" CHECK (((platform_post_url IS NULL) OR (platform_post_url ~ '^https?://'::text))),
  CONSTRAINT "scheduled_post_targets_publish_job_id_fkey" FOREIGN KEY (publish_job_id) REFERENCES public.background_jobs(id) ON DELETE SET NULL,
  CONSTRAINT "scheduled_post_targets_settings_check" CHECK ((jsonb_typeof(settings) = 'object'::text)),
  CONSTRAINT "scheduled_post_targets_status_check"
    CHECK
    ((status = ANY (ARRAY['draft'::text, 'scheduling'::text, 'scheduled'::text, 'publishing'::text, 'published'::text, 'failed'::text, 'action_required'::text, 'cancelled'::text,
    'skipped'::text]))),
  CONSTRAINT "scheduled_post_targets_scheduled_post_id_fkey" FOREIGN KEY (scheduled_post_id) REFERENCES public.scheduled_posts(id) ON DELETE CASCADE,
  CONSTRAINT "scheduled_post_targets_social_connection_id_fkey" FOREIGN KEY (social_connection_id) REFERENCES public.social_connections(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."scheduled_post_targets"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX scheduled_post_targets_due_idx ON public.scheduled_post_targets USING btree (status, scheduled_for)
  WHERE (status = ANY (ARRAY['scheduled'::text, 'publishing'::text]));

CREATE UNIQUE INDEX scheduled_post_targets_post_connection_idx ON public.scheduled_post_targets USING btree (scheduled_post_id, social_connection_id);

CREATE INDEX scheduled_post_targets_publish_job_idx ON public.scheduled_post_targets USING btree (publish_job_id)
  WHERE (publish_job_id IS NOT NULL);

CREATE INDEX scheduled_post_targets_recovery_due_idx ON public.scheduled_post_targets USING btree (scheduled_for, publish_job_id)
  WHERE ((publish_job_id IS NOT NULL) AND (status = ANY (ARRAY['scheduling'::text, 'scheduled'::text, 'publishing'::text])));

CREATE INDEX scheduled_post_targets_scheduler_cleanup_idx ON public.scheduled_post_targets USING btree (updated_at)
  WHERE ((status = 'cancelled'::text) AND (scheduler_schedule_name IS NOT NULL) AND (scheduler_deleted_at IS NULL));

CREATE UNIQUE INDEX scheduled_post_targets_scheduler_name_idx ON public.scheduled_post_targets USING btree (scheduler_schedule_name)
  WHERE (scheduler_schedule_name IS NOT NULL);

CREATE INDEX scheduled_post_targets_user_status_time_idx ON public.scheduled_post_targets USING btree (user_id, status, scheduled_for DESC);

CREATE TRIGGER enforce_free_trial_instagram_schedule_limit
  AFTER INSERT ON public.scheduled_post_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_free_trial_instagram_schedule_limit();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."scheduled_post_targets" TO "postgres", "service_role";


-- source: public/tables/user_avatar_preferences.sql
CREATE TABLE "public"."user_avatar_preferences" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"         text                     NOT NULL,
  "avatar_asset_id" uuid                     NOT NULL,
  "trim_start"      numeric,
  "trim_end"        numeric,
  "is_trimmed"      boolean                  NOT NULL DEFAULT false,
  "last_used_at"    timestamp with time zone,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_avatar_preferences_avatar_asset_id_fkey" FOREIGN KEY (avatar_asset_id) REFERENCES public.avatar_assets(id) ON DELETE CASCADE,
  CONSTRAINT "user_avatar_preferences_pkey" PRIMARY KEY (id),
  CONSTRAINT "user_avatar_preferences_trim_check" CHECK ((((is_trimmed = false) AND (trim_start IS NULL) AND (trim_end IS NULL)) OR ((is_trimmed = true) AND (trim_start IS
    NOT NULL) AND (trim_end IS NOT NULL) AND (trim_start >= (0)::numeric) AND (trim_end > trim_start) AND ((trim_end - trim_start) >= 0.5))))
);

ALTER TABLE "public"."user_avatar_preferences"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX user_avatar_preferences_avatar_idx ON public.user_avatar_preferences USING btree (avatar_asset_id);

CREATE UNIQUE INDEX user_avatar_preferences_user_avatar_idx ON public.user_avatar_preferences USING btree (user_id, avatar_asset_id);

CREATE INDEX user_avatar_preferences_user_updated_idx ON public.user_avatar_preferences USING btree (user_id, updated_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_avatar_preferences" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."user_avatar_preferences" FROM "anon";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."user_avatar_preferences" TO "anon";

REVOKE ALL ON TABLE "public"."user_avatar_preferences" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."user_avatar_preferences" TO "authenticated";


-- source: public/tables/wall_text_instagram_reel_templates.sql
CREATE TABLE "public"."wall_text_instagram_reel_templates" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "template_key"            text                     NOT NULL,
  "overlay_media_asset_id"  uuid                     NOT NULL,
  "locked_audio_asset_id"   text                     NOT NULL,
  "reference_text"          text                     NOT NULL,
  "reference_text_hash"     text                     NOT NULL,
  "writer_format_id"        text                     NOT NULL,
  "instagram_reference_url" text                     NOT NULL,
  "canonical_reference_url" text                     NOT NULL,
  "safe_text_box"           jsonb                    NOT NULL,
  "audio_fit_mode"          text                     NOT NULL,
  "template_version"        integer                  NOT NULL DEFAULT 1,
  "import_batch"            text                     NOT NULL,
  "status"                  text                     NOT NULL DEFAULT 'pending'::text,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "wall_text_instagram_reel_template_canonical_reference_url_check" CHECK ((canonical_reference_url ~ '^https://'::text)),
  CONSTRAINT "wall_text_instagram_reel_template_instagram_reference_url_check" CHECK ((instagram_reference_url ~ '^https://'::text)),
  CONSTRAINT "wall_text_instagram_reel_templates_audio_fit_mode_check" CHECK ((audio_fit_mode = ANY (ARRAY['exact'::text, 'trim'::text]))),
  CONSTRAINT "wall_text_instagram_reel_templates_canonical_reference_url_key" UNIQUE (canonical_reference_url),
  CONSTRAINT "wall_text_instagram_reel_templates_import_batch_check" CHECK ((char_length(btrim(import_batch)) > 0)),
  CONSTRAINT "wall_text_instagram_reel_templates_locked_audio_asset_id_fkey" FOREIGN KEY (locked_audio_asset_id) REFERENCES public.wall_audio_assets(id) ON DELETE RESTRICT,
  CONSTRAINT "wall_text_instagram_reel_templates_locked_audio_asset_id_key" UNIQUE (locked_audio_asset_id),
  CONSTRAINT "wall_text_instagram_reel_templates_overlay_media_asset_id_fkey" FOREIGN KEY (overlay_media_asset_id) REFERENCES public.overlay_media_assets(id) ON DELETE RESTRICT,
  CONSTRAINT "wall_text_instagram_reel_templates_overlay_media_asset_id_key" UNIQUE (overlay_media_asset_id),
  CONSTRAINT "wall_text_instagram_reel_templates_pkey" PRIMARY KEY (id),
  CONSTRAINT "wall_text_instagram_reel_templates_reference_text_check" CHECK (((char_length(btrim(reference_text)) >= 8) AND (char_length(btrim(reference_text)) <= 600))),
  CONSTRAINT "wall_text_instagram_reel_templates_reference_text_hash_check" CHECK ((reference_text_hash ~ '^[a-f0-9]{64}$'::text)),
  CONSTRAINT "wall_text_instagram_reel_templates_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'inactive'::text, 'rejected'::text]))),
  CONSTRAINT "wall_text_instagram_reel_templates_template_key_check" CHECK ((template_key ~ '^instagram_reel_[0-9]{3,}$'::text)),
  CONSTRAINT "wall_text_instagram_reel_templates_template_key_key" UNIQUE (template_key),
  CONSTRAINT "wall_text_instagram_reel_templates_template_version_check" CHECK ((template_version > 0)),
  CONSTRAINT "wall_text_instagram_reel_templates_writer_format_id_check"
    CHECK
    ((writer_format_id = ANY (ARRAY['hidden_alternative'::text, 'manual_automatic'::text, 'secret_advantage'::text, 'outcome_mystery'::text, 'authority_reaction'::text,
    'personal_obsession'::text,
    'numbered_curiosity'::text,
    'rule_checklist'::text,
    'hidden_cause'::text,
    'contrarian_opinion'::text,
    'niche_pov'::text,
    'community_question'::text,
    'transformation_timeframe'::text,
    'method_framework'::text,
    'emotional_reframe'::text,
    'personal_manifesto'::text,
    'relatable_situation'::text,
    'desire_identity_stack'::text,
    'old_way_regret'::text,
    'retrospective_lesson'::text,
    'self_audit'::text,
    'warning_alert'::text,
    'personal_stance'::text,
    'future_snapshot'::text,
    'metaphor_reframe'::text, 'swap_upgrade_stack'::text, 'niche_milestones'::text, 'insider_truths'::text, 'aspirational_archetype'::text, 'internal_conflict'::text]))),
  CONSTRAINT "wall_text_instagram_templates_safe_box_chk"
    CHECK
    (COALESCE(((jsonb_typeof(safe_text_box) = 'object'::text) AND ((((safe_text_box ->> 'x'::text))::numeric >= (0)::numeric) AND (((safe_text_box ->> 'x'::text))::numeric <=
    (1)::numeric)) AND ((((safe_text_box ->> 'y'::text))::numeric >= (0)::numeric) AND (((safe_text_box ->> 'y'::text))::numeric <= (1)::numeric)) AND
    (((safe_text_box ->> 'width'::text))::numeric > (0)::numeric) AND (((safe_text_box ->> 'height'::text))::numeric > (0)::numeric) AND
    ((((safe_text_box ->> 'x'::text))::numeric + ((safe_text_box ->> 'width'::text))::numeric) <= (1)::numeric) AND
    ((((safe_text_box ->> 'y'::text))::numeric + ((safe_text_box ->> 'height'::text))::numeric) <= (1)::numeric)), false))
);

ALTER TABLE "public"."wall_text_instagram_reel_templates"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER validate_wall_text_instagram_reel_template_row
  BEFORE INSERT OR UPDATE ON public.wall_text_instagram_reel_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_wall_text_instagram_reel_template();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wall_text_instagram_reel_templates" TO "postgres", "service_role";


-- source: public/tables/carousel_content_plans.sql
CREATE TABLE "public"."carousel_content_plans" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                  text                     NOT NULL,
  "project_id"               text                     NOT NULL,
  "business_profile_id"      uuid                     NOT NULL,
  "business_profile_version" integer                  NOT NULL,
  "period_start_date"        date                     NOT NULL,
  "period_end_date"          date                     NOT NULL,
  "timezone"                 text                     NOT NULL,
  "plan_version"             integer                  NOT NULL DEFAULT 1,
  "schema_version"           integer                  NOT NULL DEFAULT 1,
  "business_description"     text                     NOT NULL,
  "target_item_count"        integer                  NOT NULL DEFAULT 150,
  "planner_model"            text                     NOT NULL DEFAULT 'gpt-4o-mini'::text,
  "planner_prompt_version"   text                     NOT NULL,
  "status"                   text                     NOT NULL DEFAULT 'generating'::text,
  "activated_at"             timestamp with time zone,
  "exhausted_at"             timestamp with time zone,
  "failed_at"                timestamp with time zone,
  "failure_reason"           text,
  "superseded_at"            timestamp with time zone,
  "superseded_by_plan_id"    uuid,
  "created_at"               timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "generation_job_id"        uuid,
  "generation_started_at"    timestamp with time zone,
  "generation_completed_at"  timestamp with time zone,
  "planning_context"         jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT "carousel_content_plans_business_description_check"
    CHECK (((char_length(TRIM(BOTH FROM business_description)) >= 1) AND (char_length(TRIM(BOTH FROM business_description)) <= 4000))),
  CONSTRAINT "carousel_content_plans_business_profile_id_business_profile_key" UNIQUE (business_profile_id, business_profile_version, period_start_date, plan_version),
  CONSTRAINT "carousel_content_plans_business_profile_version_check" CHECK ((business_profile_version > 0)),
  CONSTRAINT "carousel_content_plans_check1" CHECK (((superseded_by_plan_id IS NULL) OR (superseded_by_plan_id <> id))),
  CONSTRAINT "carousel_content_plans_check2"
    CHECK
    ((((status = 'generating'::text) AND (activated_at IS NULL) AND (exhausted_at IS NULL) AND (failed_at IS NULL) AND (failure_reason IS NULL) AND (superseded_at IS NULL) AND
    (superseded_by_plan_id IS NULL)) OR ((status = 'active'::text) AND (activated_at IS
    NOT NULL) AND (exhausted_at IS NULL) AND (failed_at IS NULL) AND (failure_reason IS NULL) AND (superseded_at IS NULL) AND (superseded_by_plan_id IS NULL)) OR
    ((status = 'exhausted'::text) AND (activated_at IS NOT NULL) AND (exhausted_at IS
    NOT NULL) AND (failed_at IS NULL) AND (failure_reason IS NULL) AND (superseded_at IS NULL) AND (superseded_by_plan_id IS NULL)) OR
    ((status = 'failed'::text) AND (activated_at IS NULL) AND (exhausted_at IS NULL) AND (failed_at IS
    NOT NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE(failure_reason, ''::text)), ''::text) IS
    NOT NULL) AND (superseded_at IS NULL) AND (superseded_by_plan_id IS NULL)) OR
    ((status = 'superseded'::text) AND (exhausted_at IS NULL) AND (failed_at IS NULL) AND (failure_reason IS NULL) AND (superseded_at IS NOT NULL) AND (superseded_by_plan_id IS
    NOT NULL)))),
  CONSTRAINT "carousel_content_plans_check" CHECK ((period_end_date = (period_start_date + 29))),
  CONSTRAINT "carousel_content_plans_generation_job_id_fkey" FOREIGN KEY (generation_job_id) REFERENCES public.background_jobs(id) ON DELETE SET NULL,
  CONSTRAINT "carousel_content_plans_id_user_id_key" UNIQUE (id, user_id),
  CONSTRAINT "carousel_content_plans_pkey" PRIMARY KEY (id),
  CONSTRAINT "carousel_content_plans_plan_version_check" CHECK ((plan_version > 0)),
  CONSTRAINT "carousel_content_plans_planner_model_check" CHECK (((char_length(TRIM(BOTH FROM planner_model)) >= 1) AND (char_length(TRIM(BOTH FROM planner_model)) <= 120))),
  CONSTRAINT "carousel_content_plans_planner_prompt_version_check"
    CHECK (((char_length(TRIM(BOTH FROM planner_prompt_version)) >= 1) AND (char_length(TRIM(BOTH FROM planner_prompt_version)) <= 160))),
  CONSTRAINT "carousel_content_plans_planning_context_check" CHECK ((jsonb_typeof(planning_context) = 'object'::text)),
  CONSTRAINT "carousel_content_plans_project_id_check" CHECK (((char_length(TRIM(BOTH FROM project_id)) >= 1) AND (char_length(TRIM(BOTH FROM project_id)) <= 240))),
  CONSTRAINT "carousel_content_plans_schema_version_check" CHECK ((schema_version = 1)),
  CONSTRAINT "carousel_content_plans_status_check" CHECK ((status = ANY (ARRAY['generating'::text, 'active'::text, 'exhausted'::text, 'failed'::text, 'superseded'::text]))),
  CONSTRAINT "carousel_content_plans_superseded_by_plan_id_fkey" FOREIGN KEY (superseded_by_plan_id) REFERENCES public.carousel_content_plans(id) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "carousel_content_plans_target_item_count_check" CHECK (((target_item_count >= 150) AND (target_item_count <= 10000))),
  CONSTRAINT "carousel_content_plans_timezone_check" CHECK (((char_length(TRIM(BOTH FROM timezone)) >= 1) AND (char_length(TRIM(BOTH FROM timezone)) <= 100))),
  CONSTRAINT "carousel_content_plans_user_id_check" CHECK (((char_length(TRIM(BOTH FROM user_id)) >= 1) AND (char_length(TRIM(BOTH FROM user_id)) <= 240))),
  CONSTRAINT "carousel_content_plans_business_profile_id_user_id_project_fkey" FOREIGN KEY (business_profile_id, user_id, project_id)
    REFERENCES public.business_profiles(id, user_id, project_id) ON DELETE CASCADE
);

ALTER TABLE "public"."carousel_content_plans"
  ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX carousel_content_plans_active_period_uidx ON public.carousel_content_plans USING btree (business_profile_id, business_profile_version, period_start_date)
  WHERE (status = 'active'::text);

CREATE UNIQUE INDEX carousel_content_plans_generation_job_uidx ON public.carousel_content_plans USING btree (generation_job_id)
  WHERE (generation_job_id IS NOT NULL);

CREATE INDEX carousel_content_plans_owner_period_idx ON public.carousel_content_plans USING btree (user_id, project_id, period_start_date DESC, created_at DESC);

CREATE INDEX carousel_content_plans_profile_status_idx ON public.carousel_content_plans USING btree (business_profile_id, business_profile_version, status, period_start_date DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."carousel_content_plans" TO "postgres";

COMMENT ON COLUMN "public"."carousel_content_plans"."business_description" IS 'Exact minimal business context snapshot intended for the Carousel plan writer; richer profile analysis is not part of the creative payload.';

COMMENT ON COLUMN "public"."carousel_content_plans"."planning_context" IS 'Private approved-business snapshot used only to create creative briefs. It is not user-visible Carousel copy.';

COMMENT ON TABLE "public"."carousel_content_plans" IS 'Owner- and business-profile-version-scoped 30-day Carousel creative pool. A plan starts with at least 150 items and may be extended without a per-day consumption cap.';

REVOKE ALL ON TABLE "public"."carousel_content_plans" FROM "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."carousel_content_plans" TO "service_role";


-- source: public/tables/carousel_experiment_batches.sql
CREATE TABLE "public"."carousel_experiment_batches" (
  "id"                                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "business_profile_id"                uuid                     NOT NULL,
  "business_profile_version"           integer                  NOT NULL,
  "generation_batch_id"                uuid                     NOT NULL,
  "batch_sequence"                     integer                  NOT NULL,
  "cycle_number"                       integer,
  "cycle_batch_position"               smallint,
  "requested_carousel_count"           smallint                 NOT NULL DEFAULT 5,
  "status"                             text                     NOT NULL DEFAULT 'reserved'::text,
  "planner_job_id"                     uuid,
  "created_at"                         timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"                         timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "structure_id"                       text                     NOT NULL DEFAULT 'structure_1'::text,
  "structure_version"                  integer                  NOT NULL DEFAULT 1,
  "structure_selection_mode"           text                     NOT NULL DEFAULT 'legacy_default'::text,
  "structure_mode_snapshot"            text                     NOT NULL DEFAULT 'structure_1_only'::text,
  "structure_batch_sequence"           integer                  NOT NULL,
  "structure_rotation_sequence"        integer,
  "requested_structure_id"             text                     NOT NULL,
  "requested_structure_version"        integer                  NOT NULL,
  "requested_structure_batch_sequence" integer                  NOT NULL,
  "structure_resolution_mode"          text                     NOT NULL DEFAULT 'requested'::text,
  "structure_planning_attempt_count"   integer                  NOT NULL DEFAULT 0,
  "structure_fallback_reason"          text,
  "structure_resolved_at"              timestamp with time zone,
  CONSTRAINT "carousel_experiment_batches_batch_sequence_check" CHECK ((batch_sequence >= 0)),
  CONSTRAINT "carousel_experiment_batches_business_profile_id_batch_seque_key" UNIQUE (business_profile_id, batch_sequence),
  CONSTRAINT "carousel_experiment_batches_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  CONSTRAINT "carousel_experiment_batches_cycle_batch_position_check" CHECK (((cycle_batch_position >= 0) AND (cycle_batch_position <= 2))),
  CONSTRAINT "carousel_experiment_batches_cycle_number_check" CHECK ((cycle_number >= 1)),
  CONSTRAINT "carousel_experiment_batches_generation_batch_id_batch_seque_key" UNIQUE (generation_batch_id, batch_sequence),
  CONSTRAINT "carousel_experiment_batches_pkey" PRIMARY KEY (id),
  CONSTRAINT "carousel_experiment_batches_planner_job_id_fkey" FOREIGN KEY (planner_job_id) REFERENCES public.background_jobs(id) ON DELETE SET NULL,
  CONSTRAINT "carousel_experiment_batches_planning_attempt_count_check" CHECK (((structure_planning_attempt_count >= 0) AND (structure_planning_attempt_count <= 2))),
  CONSTRAINT "carousel_experiment_batches_requested_carousel_count_check" CHECK ((requested_carousel_count = 5)),
  CONSTRAINT "carousel_experiment_batches_requested_structure_id_check" CHECK ((requested_structure_id = ANY (ARRAY['structure_1'::text, 'structure_2'::text]))),
  CONSTRAINT "carousel_experiment_batches_requested_structure_sequence_check" CHECK ((requested_structure_batch_sequence >= 0)),
  CONSTRAINT "carousel_experiment_batches_requested_structure_version_check" CHECK ((requested_structure_version >= 1)),
  CONSTRAINT "carousel_experiment_batches_status_check"
    CHECK ((status = ANY (ARRAY['reserved'::text, 'queued'::text, 'processing'::text, 'completed'::text, 'partial'::text, 'failed'::text]))),
  CONSTRAINT "carousel_experiment_batches_structure_batch_sequence_check" CHECK ((structure_batch_sequence >= 0)),
  CONSTRAINT "carousel_experiment_batches_structure_id_check" CHECK ((structure_id = ANY (ARRAY['structure_1'::text, 'structure_2'::text]))),
  CONSTRAINT "carousel_experiment_batches_structure_mode_snapshot_check"
    CHECK ((structure_mode_snapshot = ANY (ARRAY['rotate'::text, 'structure_1_only'::text, 'structure_2_only'::text]))),
  CONSTRAINT "carousel_experiment_batches_structure_resolution_check"
    CHECK
    ((((structure_resolution_mode = 'requested'::text) AND (requested_structure_id = structure_id) AND (requested_structure_version = structure_version) AND
    (requested_structure_batch_sequence = structure_batch_sequence) AND (structure_fallback_reason IS NULL) AND (structure_resolved_at IS NULL)) OR
    ((structure_resolution_mode = 'planning_fallback'::text) AND (requested_structure_id = 'structure_1'::text) AND (structure_id = 'structure_2'::text) AND
    (structure_planning_attempt_count = 2) AND (NULLIF(TRIM(BOTH FROM COALESCE(structure_fallback_reason, ''::text)), ''::text) IS NOT NULL) AND (structure_resolved_at IS
    NOT NULL)))),
  CONSTRAINT "carousel_experiment_batches_structure_resolution_mode_check" CHECK ((structure_resolution_mode = ANY (ARRAY['requested'::text, 'planning_fallback'::text]))),
  CONSTRAINT "carousel_experiment_batches_structure_rotation_sequence_check" CHECK ((((structure_selection_mode = 'rotation'::text) AND (structure_rotation_sequence IS
    NOT NULL) AND (structure_rotation_sequence >= 0)) OR ((structure_selection_mode <> 'rotation'::text) AND (structure_rotation_sequence IS NULL)))),
  CONSTRAINT "carousel_experiment_batches_structure_selection_mode_check"
    CHECK ((structure_selection_mode = ANY (ARRAY['legacy_default'::text, 'rotation'::text, 'global_override'::text]))),
  CONSTRAINT "carousel_experiment_batches_structure_version_check" CHECK ((structure_version >= 1))
);

ALTER TABLE "public"."carousel_experiment_batches"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX carousel_experiment_batches_generation_batch_idx ON public.carousel_experiment_batches USING btree (generation_batch_id, batch_sequence);

CREATE UNIQUE INDEX carousel_experiment_batches_id_structure_uidx ON public.carousel_experiment_batches USING btree (id, structure_id);

CREATE INDEX carousel_experiment_batches_profile_created_idx ON public.carousel_experiment_batches USING btree (business_profile_id, business_profile_version, created_at DESC);

CREATE UNIQUE INDEX carousel_experiment_batches_profile_rotation_sequence_uidx ON public.carousel_experiment_batches USING btree (business_profile_id, structure_rotation_sequence)
  WHERE (structure_rotation_sequence IS NOT NULL);

CREATE UNIQUE INDEX carousel_experiment_batches_profile_structure_sequence_uidx ON public.carousel_experiment_batches
  USING btree (business_profile_id, structure_id, structure_batch_sequence);

CREATE TRIGGER carousel_experiment_batches_initialize_requested_structure
  BEFORE INSERT ON public.carousel_experiment_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_carousel_requested_structure();

CREATE TRIGGER carousel_experiment_batches_structure_immutable
  BEFORE UPDATE ON public.carousel_experiment_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_carousel_batch_structure_assignment_change();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."carousel_experiment_batches" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."carousel_experiment_batches"."batch_sequence" IS 'Monotonic per-business batch number. It advances when a batch is reserved, so deletes and generation failures never rewind rotation.';

COMMENT ON COLUMN "public"."carousel_experiment_batches"."cycle_batch_position" IS 'Legacy Structure 1 three-group rotation position. It is nullable for non-Structure-1 batches.';

COMMENT ON COLUMN "public"."carousel_experiment_batches"."cycle_number" IS 'Legacy Structure 1 three-group rotation metadata. It is nullable so a later Structure 2 reservation does not need to imitate Structure 1 grouping.';

COMMENT ON COLUMN "public"."carousel_experiment_batches"."requested_structure_id" IS 'Immutable structure selected by the global mode before planning. The resolved structure_id remains the analytics and generation namespace.';

COMMENT ON COLUMN "public"."carousel_experiment_batches"."structure_batch_sequence" IS 'Monotonic per-business, per-structure sequence used by that structure own independent format rotation.';

COMMENT ON COLUMN "public"."carousel_experiment_batches"."structure_fallback_reason" IS 'Bounded final Structure 1 planning failure recorded when the complete batch resolves to Structure 2.';

COMMENT ON COLUMN "public"."carousel_experiment_batches"."structure_id" IS 'Persisted structure identity for the complete five-Carousel batch. One batch may never mix Structure 1 and Structure 2.';

COMMENT ON COLUMN "public"."carousel_experiment_batches"."structure_planning_attempt_count" IS 'Number of complete Structure 1 planning attempts made. Each attempt includes its one isolated validation repair.';

COMMENT ON COLUMN "public"."carousel_experiment_batches"."structure_resolution_mode" IS 'requested for the normal path, or planning_fallback after the service-only atomic Structure 1 to Structure 2 takeover.';

COMMENT ON COLUMN "public"."carousel_experiment_batches"."structure_rotation_sequence" IS 'Monotonic per-business sequence used only by batches selected through global rotate mode. Global overrides do not consume it.';

COMMENT ON TABLE "public"."carousel_experiment_batches" IS 'Durable five-carousel controlled-format batches. A row is persisted before its single batch planner request is queued.';


-- source: public/tables/category_image_assets.sql
CREATE TABLE "public"."category_image_assets" (
  "id"                        uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "category_slug"             text                     NOT NULL,
  "image_query"               text,
  "visual_keywords"           jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "source_provider"           text                     NOT NULL DEFAULT 'pexels'::text,
  "pexels_photo_id"           text,
  "pexels_photo_url"          text,
  "pexels_photographer"       text,
  "pexels_photographer_url"   text,
  "base_s3_key"               text                     NOT NULL,
  "thumb_s3_key"              text,
  "base_url"                  text                     NOT NULL,
  "thumb_url"                 text,
  "width"                     integer,
  "height"                    integer,
  "avg_color"                 text,
  "orientation"               text                     NOT NULL DEFAULT 'portrait'::text,
  "quality_score"             numeric,
  "usage_count"               integer                  NOT NULL DEFAULT 0,
  "status"                    text                     NOT NULL DEFAULT 'ready'::text,
  "created_at"                timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                timestamp with time zone NOT NULL DEFAULT now(),
  "has_human"                 boolean,
  "visual_setting"            text,
  "visual_style"              text,
  "source_query"              text,
  "content_tags"              jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "visual_bucket"             text,
  "bucket_type"               text,
  "primary_vertical"          text,
  "usable_verticals"          jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "best_for_slide_types"      jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "mood_tags"                 jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "image_subject_class"       text,
  "face_count"                integer,
  "person_count"              integer,
  "max_face_area_ratio"       real,
  "subject_analysis"          jsonb,
  "subject_analyzed_at"       timestamp with time zone,
  "subject_analyzer_version"  text,
  "subject_review_status"     text                     NOT NULL DEFAULT 'unreviewed'::text,
  "broad_visual_bucket"       text,
  "bucket_taxonomy_version"   text,
  "object_tags"               jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "runtime_exclusion_reason"  text,
  "near_duplicate_group"      text,
  "asset_scope"               text                     NOT NULL DEFAULT 'category'::text,
  "usable_profiles"           jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "asset_variant"             text                     NOT NULL DEFAULT 'canonical'::text,
  "canonical_asset_id"        uuid,
  "source_original_s3_key"    text,
  "source_original_url"       text,
  "source_folder"             text,
  "source_filename"           text,
  "source_file_sha256"        text,
  "source_perceptual_hash"    text,
  "source_metadata"           jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "license_information"       text,
  "library_asset_id"          text,
  "asset_role"                text,
  "is_active"                 boolean                  NOT NULL DEFAULT false,
  "owner_business_profile_id" uuid,
  CONSTRAINT "category_image_assets_asset_scope_chk" CHECK ((asset_scope = ANY (ARRAY['category'::text, 'shared'::text]))),
  CONSTRAINT "category_image_assets_asset_variant_chk"
    CHECK ((asset_variant = ANY (ARRAY['canonical'::text, 'derived_crop'::text, 'cropped_only'::text, 'flat'::text, 'preview'::text, 'duplicate'::text]))),
  CONSTRAINT "category_image_assets_best_for_slide_types_array_chk" CHECK ((jsonb_typeof(best_for_slide_types) = 'array'::text)),
  CONSTRAINT "category_image_assets_broad_visual_bucket_format_chk" CHECK (((broad_visual_bucket IS NULL) OR (broad_visual_bucket ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))),
  CONSTRAINT "category_image_assets_bucket_type_chk" CHECK (((bucket_type IS NULL) OR (bucket_type = ANY (ARRAY['universal'::text, 'vertical'::text])))),
  CONSTRAINT "category_image_assets_content_tags_array_chk" CHECK ((jsonb_typeof(content_tags) = 'array'::text)),
  CONSTRAINT "category_image_assets_face_count_chk" CHECK (((face_count IS NULL) OR (face_count >= 0))),
  CONSTRAINT "category_image_assets_height_check" CHECK (((height IS NULL) OR (height > 0))),
  CONSTRAINT "category_image_assets_max_face_area_ratio_chk"
    CHECK (((max_face_area_ratio IS NULL) OR ((max_face_area_ratio >= (0)::double precision) AND (max_face_area_ratio <= (1)::double precision)))),
  CONSTRAINT "category_image_assets_mood_tags_array_chk" CHECK ((jsonb_typeof(mood_tags) = 'array'::text)),
  CONSTRAINT "category_image_assets_near_duplicate_group_format_chk" CHECK (((near_duplicate_group IS NULL) OR (near_duplicate_group ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))),
  CONSTRAINT "category_image_assets_object_tags_array_chk" CHECK ((jsonb_typeof(object_tags) = 'array'::text)),
  CONSTRAINT "category_image_assets_orientation_check" CHECK ((orientation = ANY (ARRAY['portrait'::text, 'square'::text, 'landscape'::text]))),
  CONSTRAINT "category_image_assets_owner_business_profile_id_fkey" FOREIGN KEY (owner_business_profile_id) REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  CONSTRAINT "category_image_assets_person_count_chk" CHECK (((person_count IS NULL) OR (person_count >= 0))),
  CONSTRAINT "category_image_assets_pkey" PRIMARY KEY (id),
  CONSTRAINT "category_image_assets_canonical_asset_id_fkey" FOREIGN KEY (canonical_asset_id) REFERENCES public.category_image_assets(id) ON DELETE SET NULL,
  CONSTRAINT "category_image_assets_primary_vertical_chk"
    CHECK (((primary_vertical IS NULL) OR (primary_vertical = ANY (ARRAY['fitness-health'::text, 'productivity'::text, 'saas-work'::text, 'wellness'::text])))),
  CONSTRAINT "category_image_assets_quality_score_check" CHECK (((quality_score IS NULL) OR ((quality_score >= (0)::numeric) AND (quality_score <= (1)::numeric)))),
  CONSTRAINT "category_image_assets_runtime_exclusion_reason_format_chk"
    CHECK (((runtime_exclusion_reason IS NULL) OR (runtime_exclusion_reason ~ '^[a-z0-9]+(_[a-z0-9]+)*$'::text))),
  CONSTRAINT "category_image_assets_source_file_sha256_chk" CHECK (((source_file_sha256 IS NULL) OR (source_file_sha256 ~ '^[a-f0-9]{64}$'::text))),
  CONSTRAINT "category_image_assets_source_metadata_object_chk" CHECK ((jsonb_typeof(source_metadata) = 'object'::text)),
  CONSTRAINT "category_image_assets_source_original_url_chk" CHECK (((source_original_url IS NULL) OR (source_original_url ~ '^https?://'::text))),
  CONSTRAINT "category_image_assets_source_perceptual_hash_chk"
    CHECK (((source_perceptual_hash IS NULL) OR (source_perceptual_hash ~ '^[a-f0-9]{16,128}$'::text) OR (source_perceptual_hash ~ '^[01]{16,256}$'::text))),
  CONSTRAINT "category_image_assets_source_provider_chk" CHECK ((source_provider = ANY (ARRAY['pexels'::text, 'local'::text]))),
  CONSTRAINT "category_image_assets_status_check" CHECK ((status = ANY (ARRAY['ready'::text, 'processing'::text, 'failed'::text, 'archived'::text]))),
  CONSTRAINT "category_image_assets_subject_class_chk"
    CHECK (((image_subject_class IS NULL) OR (image_subject_class = ANY (ARRAY['clear-face'::text, 'faceless-human'::text, 'object-only'::text])))),
  CONSTRAINT "category_image_assets_subject_review_status_chk" CHECK ((subject_review_status = ANY (ARRAY['unreviewed'::text, 'approved'::text, 'rejected'::text]))),
  CONSTRAINT "category_image_assets_usable_profiles_array_chk" CHECK ((jsonb_typeof(usable_profiles) = 'array'::text)),
  CONSTRAINT "category_image_assets_usable_verticals_array_chk" CHECK ((jsonb_typeof(usable_verticals) = 'array'::text)),
  CONSTRAINT "category_image_assets_usage_count_check" CHECK ((usage_count >= 0)),
  CONSTRAINT "category_image_assets_visual_bucket_format_chk" CHECK (((visual_bucket IS NULL) OR (visual_bucket ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))),
  CONSTRAINT "category_image_assets_visual_keywords_check" CHECK ((jsonb_typeof(visual_keywords) = 'array'::text)),
  CONSTRAINT "category_image_assets_width_check" CHECK (((width IS NULL) OR (width > 0)))
);

ALTER TABLE "public"."category_image_assets"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."category_image_assets"
  ADD CONSTRAINT "category_image_assets_active_review_chk" CHECK (((NOT is_active) OR ((library_asset_id IS NOT NULL) AND (asset_role IS NOT NULL) AND (source_file_sha256 IS
    NOT NULL) AND (status = 'ready'::text) AND (subject_review_status = 'approved'::text) AND (runtime_exclusion_reason IS NULL)))) NOT VALID;

ALTER TABLE "public"."category_image_assets"
  ADD CONSTRAINT "category_image_assets_asset_role_chk"
    CHECK (((asset_role IS NULL) OR (asset_role = ANY (ARRAY['hook'::text, 'human'::text, 'static'::text, 'product_asset'::text])))) NOT VALID;

ALTER TABLE "public"."category_image_assets"
  ADD CONSTRAINT "category_image_assets_library_asset_id_chk" CHECK (((library_asset_id IS NULL) OR (library_asset_id ~ '^[a-z0-9][a-z0-9_]{2,95}$'::text))) NOT VALID;

ALTER TABLE "public"."category_image_assets"
  ADD CONSTRAINT "category_image_assets_product_owner_chk" CHECK (((asset_role IS NULL) OR ((asset_role = 'product_asset'::text) AND (owner_business_profile_id IS
    NOT NULL)) OR ((asset_role <> 'product_asset'::text) AND (owner_business_profile_id IS NULL)))) NOT VALID;

CREATE INDEX category_image_assets_asset_scope_idx ON public.category_image_assets USING btree (asset_scope, category_slug, status);

CREATE UNIQUE INDEX category_image_assets_base_key_uidx ON public.category_image_assets USING btree (base_s3_key);

CREATE INDEX category_image_assets_best_for_slide_types_gin_idx ON public.category_image_assets USING gin (best_for_slide_types);

CREATE INDEX category_image_assets_canonical_asset_idx ON public.category_image_assets USING btree (canonical_asset_id)
  WHERE (canonical_asset_id IS NOT NULL);

CREATE UNIQUE INDEX category_image_assets_library_asset_id_uidx ON public.category_image_assets USING btree (library_asset_id)
  WHERE (library_asset_id IS NOT NULL);

CREATE INDEX category_image_assets_object_tags_gin_idx ON public.category_image_assets USING gin (object_tags);

CREATE UNIQUE INDEX category_image_assets_product_owner_hash_uidx ON public.category_image_assets USING btree (owner_business_profile_id, category_slug, source_file_sha256)
  WHERE ((asset_role = 'product_asset'::text) AND is_active AND (source_file_sha256 IS NOT NULL));

CREATE INDEX category_image_assets_product_owner_idx ON public.category_image_assets USING btree (owner_business_profile_id, category_slug, is_active, id)
  WHERE (asset_role = 'product_asset'::text);

CREATE UNIQUE INDEX category_image_assets_provider_photo_uidx ON public.category_image_assets USING btree (source_provider, pexels_photo_id)
  WHERE (pexels_photo_id IS NOT NULL);

CREATE INDEX category_image_assets_ready_broad_bucket_idx ON public.category_image_assets USING btree (category_slug, status, broad_visual_bucket, usage_count, created_at);

CREATE INDEX category_image_assets_ready_bucket_idx ON public.category_image_assets USING btree (category_slug, status, visual_bucket, usage_count, created_at);

CREATE INDEX category_image_assets_ready_category_idx ON public.category_image_assets USING btree (category_slug, status, usage_count, created_at);

CREATE INDEX category_image_assets_ready_near_duplicate_idx ON public.category_image_assets USING btree (category_slug, status, near_duplicate_group, usage_count, created_at);

CREATE INDEX category_image_assets_ready_setting_idx ON public.category_image_assets USING btree (category_slug, status, visual_setting, usage_count, created_at);

CREATE INDEX category_image_assets_ready_style_idx ON public.category_image_assets USING btree (category_slug, status, visual_style, usage_count, created_at);

CREATE INDEX category_image_assets_ready_subject_idx ON public.category_image_assets
  USING btree (category_slug, status, image_subject_class, visual_bucket, usage_count, created_at);

CREATE INDEX category_image_assets_role_pool_idx ON public.category_image_assets USING btree (category_slug, asset_role, is_active, status, subject_review_status, id)
  WHERE (library_asset_id IS NOT NULL);

CREATE UNIQUE INDEX category_image_assets_role_source_hash_uidx ON public.category_image_assets USING btree (source_file_sha256)
  WHERE ((library_asset_id IS NOT NULL) AND (source_file_sha256 IS NOT NULL) AND (owner_business_profile_id IS NULL));

CREATE INDEX category_image_assets_source_file_sha256_idx ON public.category_image_assets USING btree (source_file_sha256)
  WHERE (source_file_sha256 IS NOT NULL);

CREATE INDEX category_image_assets_source_perceptual_hash_idx ON public.category_image_assets USING btree (source_perceptual_hash)
  WHERE (source_perceptual_hash IS NOT NULL);

CREATE INDEX category_image_assets_subject_review_idx ON public.category_image_assets USING btree (category_slug, image_subject_class, subject_review_status, status);

CREATE INDEX category_image_assets_usable_profiles_gin_idx ON public.category_image_assets USING gin (usable_profiles);

CREATE INDEX category_image_assets_usable_verticals_gin_idx ON public.category_image_assets USING gin (usable_verticals);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."category_image_assets" TO "postgres";

COMMENT ON INDEX "public"."category_image_assets_product_owner_hash_uidx" IS 'Prevents duplicate active product screenshots inside one business category without coupling separate customer libraries.';

REVOKE ALL ON TABLE "public"."category_image_assets" FROM "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."category_image_assets" TO "service_role";


-- source: public/tables/daily_carousel_refill_batches.sql
CREATE TABLE "public"."daily_carousel_refill_batches" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "feed_id"                  uuid                     NOT NULL,
  "user_id"                  text                     NOT NULL,
  "business_profile_id"      uuid                     NOT NULL,
  "business_profile_version" integer                  NOT NULL,
  "local_date"               date                     NOT NULL,
  "generation_batch_id"      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "requested_count"          integer                  NOT NULL DEFAULT 0,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "daily_carousel_refill_batches_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE RESTRICT,
  CONSTRAINT "daily_carousel_refill_batches_business_profile_version_check" CHECK ((business_profile_version > 0)),
  CONSTRAINT "daily_carousel_refill_batches_feed_id_business_profile_id_b_key" UNIQUE (feed_id, business_profile_id, business_profile_version),
  CONSTRAINT "daily_carousel_refill_batches_feed_id_fkey" FOREIGN KEY (feed_id) REFERENCES public.daily_carousel_feeds(id) ON DELETE RESTRICT,
  CONSTRAINT "daily_carousel_refill_batches_generation_batch_id_key" UNIQUE (generation_batch_id),
  CONSTRAINT "daily_carousel_refill_batches_pkey" PRIMARY KEY (id),
  CONSTRAINT "daily_carousel_refill_batches_requested_count_check" CHECK (((requested_count >= 0) AND (requested_count <= 50)))
);

ALTER TABLE "public"."daily_carousel_refill_batches"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX daily_carousel_refill_batches_profile_date_idx ON public.daily_carousel_refill_batches
  USING btree (user_id, business_profile_id, business_profile_version, local_date DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_carousel_refill_batches" TO "postgres";

REVOKE ALL ON TABLE "public"."daily_carousel_refill_batches" FROM "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."daily_carousel_refill_batches" TO "service_role";


-- source: public/tables/daily_trending_feeds.sql
CREATE TABLE "public"."daily_trending_feeds" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                  text                     NOT NULL,
  "business_profile_id"      uuid                     NOT NULL,
  "business_profile_version" integer                  NOT NULL,
  "local_date"               date                     NOT NULL,
  "timezone"                 text                     NOT NULL,
  "plan_key"                 text                     NOT NULL,
  "plan_display_name"        text                     NOT NULL,
  "daily_limit"              integer                  NOT NULL,
  "carousel_percent"         integer                  NOT NULL,
  "wall_text_percent"        integer                  NOT NULL,
  "hook_video_percent"       integer                  NOT NULL,
  "preference_version"       integer                  NOT NULL,
  "status"                   text                     NOT NULL DEFAULT 'preparing'::text,
  "last_error"               text,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "wall_text_retry_key"      uuid,
  CONSTRAINT "daily_trending_feeds_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  CONSTRAINT "daily_trending_feeds_business_profile_version_check" CHECK ((business_profile_version > 0)),
  CONSTRAINT "daily_trending_feeds_daily_limit_check" CHECK ((daily_limit > 0)),
  CONSTRAINT "daily_trending_feeds_mix_check"
    CHECK
    ((((carousel_percent >= 0) AND (carousel_percent <= 100)) AND ((wall_text_percent >= 0) AND (wall_text_percent <= 100)) AND ((hook_video_percent >= 0) AND (hook_video_percent
    <= 100)) AND (((carousel_percent + wall_text_percent) + hook_video_percent) = 100))),
  CONSTRAINT "daily_trending_feeds_pkey" PRIMARY KEY (id),
  CONSTRAINT "daily_trending_feeds_preference_version_check" CHECK ((preference_version > 0)),
  CONSTRAINT "daily_trending_feeds_status_check" CHECK ((status = ANY (ARRAY['preparing'::text, 'ready'::text, 'completed'::text, 'failed'::text]))),
  CONSTRAINT "daily_trending_feeds_timezone_check" CHECK (((char_length(TRIM(BOTH FROM timezone)) >= 1) AND (char_length(TRIM(BOTH FROM timezone)) <= 100))),
  CONSTRAINT "daily_trending_feeds_user_id_local_date_key" UNIQUE (user_id, local_date),
  CONSTRAINT "daily_trending_feeds_plan_key_fkey" FOREIGN KEY (plan_key) REFERENCES public.subscription_entitlements(plan_key)
);

ALTER TABLE "public"."daily_trending_feeds"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX daily_trending_feeds_profile_idx ON public.daily_trending_feeds USING btree (business_profile_id, business_profile_version, local_date DESC);

CREATE INDEX daily_trending_feeds_user_date_idx ON public.daily_trending_feeds USING btree (user_id, local_date DESC);

CREATE TRIGGER enforce_free_trial_daily_trending_feed
  BEFORE INSERT ON public.daily_trending_feeds
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_free_trial_daily_trending_feed();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_trending_feeds" TO "postgres", "service_role";


-- source: public/tables/free_trial_instagram_schedule_usage.sql
CREATE TABLE "public"."free_trial_instagram_schedule_usage" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                  text                     NOT NULL,
  "scheduled_post_target_id" uuid                     NOT NULL,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "free_trial_instagram_schedule_usag_scheduled_post_target_id_key" UNIQUE (scheduled_post_target_id),
  CONSTRAINT "free_trial_instagram_schedule_usage_pkey" PRIMARY KEY (id),
  CONSTRAINT "free_trial_instagram_schedule_usage_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.free_trial_entitlements(user_id) ON DELETE RESTRICT,
  CONSTRAINT "free_trial_instagram_schedule_usa_scheduled_post_target_id_fkey" FOREIGN KEY (scheduled_post_target_id) REFERENCES public.scheduled_post_targets(id)
    ON DELETE RESTRICT
);

ALTER TABLE "public"."free_trial_instagram_schedule_usage"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX free_trial_instagram_schedule_usage_user_idx ON public.free_trial_instagram_schedule_usage USING btree (user_id, created_at);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."free_trial_instagram_schedule_usage" TO "postgres", "service_role";


-- source: public/tables/hook_video_suggestions.sql
CREATE TABLE "public"."hook_video_suggestions" (
  "id"                               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                          text                     NOT NULL,
  "business_profile_id"              uuid                     NOT NULL,
  "generation_id"                    uuid                     NOT NULL,
  "influencer_id"                    text                     NOT NULL,
  "influencer_video_id"              text                     NOT NULL,
  "influencer_source"                text                     NOT NULL,
  "demo_asset_id"                    uuid,
  "text"                             text                     NOT NULL,
  "created_at"                       timestamp with time zone NOT NULL DEFAULT now(),
  "suggestion_context"               text                     NOT NULL DEFAULT 'composition'::text,
  "business_profile_version"         integer,
  "candidate_index"                  integer,
  "duration_seconds"                 numeric,
  "source_duration_seconds"          numeric,
  "trim_start"                       numeric,
  "trim_end"                         numeric,
  "influencer_name"                  text,
  "influencer_video_title"           text,
  "thumbnail_url"                    text,
  "generation_job_id"                uuid,
  "prompt_version"                   text,
  "selection_version"                text,
  "generator_model"                  text,
  "influencer_key"                   text,
  "reaction_type"                    text,
  "visual_group"                     text,
  "readability_review"               jsonb,
  "visual_fit"                       jsonb,
  "opening_lines"                    jsonb,
  "pattern_id"                       text,
  "pattern_library_version"          text,
  "validator_version"                text,
  "input_context_hash"               text,
  "validation_metadata"              jsonb,
  "quality_score"                    integer,
  "campaign_purpose"                 text,
  "industry_pack_id"                 text,
  "audio_intent"                     jsonb,
  "hook_text_format_id"              text,
  "hook_text_variant_id"             text,
  "hook_text_format_library_version" text,
  CONSTRAINT "hook_video_suggestions_audio_intent_check"
    CHECK
    (((audio_intent IS NULL) OR COALESCE(((jsonb_typeof(audio_intent) = 'object'::text) AND ((audio_intent - ARRAY['mood'::text, 'hookType'::text, 'energy'::text]) = '{}'::jsonb)
    AND ((audio_intent ->> 'mood'::text) = ANY (ARRAY['curious'::text, 'uplifting'::text, 'serious'::text, 'calm'::text, 'urgent'::text, 'playful'::text])) AND
    ((audio_intent ->> 'hookType'::text) = ANY (ARRAY['curiosity'::text, 'problem'::text, 'warning'::text, 'transformation'::text, 'benefit'::text, 'story'::text,
    'authority'::text])) AND ((audio_intent ->> 'energy'::text) = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))), false))),
  CONSTRAINT "hook_video_suggestions_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  CONSTRAINT "hook_video_suggestions_context_fields_check" CHECK ((((suggestion_context = 'composition'::text) AND (demo_asset_id IS
    NOT NULL)) OR ((suggestion_context = 'trending'::text) AND (demo_asset_id IS NULL) AND (business_profile_version IS
    NOT NULL) AND (business_profile_version > 0) AND (candidate_index IS NOT NULL) AND (candidate_index >= 0) AND (duration_seconds IS
    NOT NULL) AND (duration_seconds > (0)::numeric) AND (source_duration_seconds IS NOT NULL) AND (source_duration_seconds > (0)::numeric) AND (trim_start IS
    NOT NULL) AND (trim_start >= (0)::numeric) AND ((trim_end IS NULL) OR (trim_end > trim_start)) AND (influencer_name IS
    NOT NULL) AND ((char_length(TRIM(BOTH FROM influencer_name)) >= 1) AND (char_length(TRIM(BOTH FROM influencer_name)) <= 140)) AND (influencer_video_title IS
    NOT NULL) AND ((char_length(TRIM(BOTH FROM influencer_video_title)) >= 1) AND (char_length(TRIM(BOTH FROM influencer_video_title)) <= 180))))),
  CONSTRAINT "hook_video_suggestions_generation_job_id_fkey" FOREIGN KEY (generation_job_id) REFERENCES public.background_jobs(id) ON DELETE SET NULL,
  CONSTRAINT "hook_video_suggestions_hook_text_format_id_fkey" FOREIGN KEY (hook_text_format_id) REFERENCES public.hook_text_formats(id),
  CONSTRAINT "hook_video_suggestions_hook_text_variant_id_fkey" FOREIGN KEY (hook_text_variant_id) REFERENCES public.hook_text_format_variants(id),
  CONSTRAINT "hook_video_suggestions_influencer_source_check" CHECK ((influencer_source = ANY (ARRAY['catalog'::text, 'user'::text]))),
  CONSTRAINT "hook_video_suggestions_pkey" PRIMARY KEY (id),
  CONSTRAINT "hook_video_suggestions_suggestion_context_check" CHECK ((suggestion_context = ANY (ARRAY['composition'::text, 'trending'::text]))),
  CONSTRAINT "hook_video_suggestions_text_check" CHECK (((char_length(TRIM(BOTH FROM text)) >= 1) AND (char_length(TRIM(BOTH FROM text)) <= 220))),
  CONSTRAINT "hook_video_suggestions_v6_audio_intent_required" CHECK (((prompt_version IS DISTINCT FROM 'trending-hook-copy-v6'::text) OR (audio_intent IS NOT NULL))),
  CONSTRAINT "hook_video_suggestions_demo_asset_id_fkey" FOREIGN KEY (demo_asset_id) REFERENCES public.media_assets(id) ON DELETE CASCADE
);

ALTER TABLE "public"."hook_video_suggestions"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."hook_video_suggestions"
  ADD CONSTRAINT "hook_video_suggestions_campaign_purpose_check"
    CHECK
    (((campaign_purpose IS NULL) OR (campaign_purpose = ANY (ARRAY['product_discovery'::text, 'education'::text, 'conversion'::text, 'retargeting'::text, 'app_install'::text]))))
    NOT VALID;

ALTER TABLE "public"."hook_video_suggestions"
  ADD CONSTRAINT "hook_video_suggestions_generation_metadata_v5_check"
    CHECK
    ((((prompt_version IS NULL) AND (selection_version IS NULL) AND (generator_model IS NULL) AND (generation_job_id IS NULL) AND (readability_review IS NULL) AND (visual_fit IS
    NULL)) OR ((suggestion_context = ANY (ARRAY['trending'::text, 'composition'::text])) AND (prompt_version IS NOT NULL) AND (selection_version IS
    NOT NULL) AND (generator_model IS NOT NULL) AND (generation_job_id IS
    NOT NULL) AND (jsonb_typeof(readability_review) = 'object'::text) AND ((readability_review ->> 'readable'::text) = 'true'::text) AND
    ((readability_review ->> 'reactionMatch'::text) = 'true'::text) AND ((readability_review ->> 'scrollStopping'::text) = 'true'::text) AND
    (jsonb_typeof(visual_fit) = 'object'::text) AND ((visual_fit ->> 'fits'::text) = 'true'::text)))) NOT VALID;

ALTER TABLE "public"."hook_video_suggestions"
  ADD CONSTRAINT "hook_video_suggestions_industry_pack_check"
    CHECK
    (((industry_pack_id IS NULL) OR (industry_pack_id = ANY (ARRAY['mobile_app'::text, 'ecommerce'::text, 'saas'::text, 'agency_services'::text, 'health_wellness'::text,
    'finance'::text, 'education'::text, 'food_hospitality'::text, 'general'::text])))) NOT VALID;

ALTER TABLE "public"."hook_video_suggestions"
  ADD CONSTRAINT "hook_video_suggestions_text_variant_format_check" CHECK ((((hook_text_format_id IS NULL) AND (hook_text_variant_id IS NULL)) OR ((hook_text_format_id IS
    NOT NULL) AND (hook_text_variant_id IS NOT NULL)))) NOT VALID;

ALTER TABLE "public"."hook_video_suggestions"
  ADD CONSTRAINT "hook_video_suggestions_text_variant_parent_fkey" FOREIGN KEY (hook_text_format_id, hook_text_variant_id)
    REFERENCES public.hook_text_format_variants(hook_text_format_id, id) NOT VALID;

ALTER TABLE "public"."hook_video_suggestions"
  ADD CONSTRAINT "hook_video_suggestions_v5_metadata_check"
    CHECK
    ((((opening_lines IS NULL) AND (pattern_id IS NULL) AND (hook_text_format_id IS NULL) AND (pattern_library_version IS NULL) AND (hook_text_format_library_version IS NULL) AND
    (validator_version IS NULL) AND (input_context_hash IS NULL) AND (validation_metadata IS NULL) AND (quality_score IS NULL) AND (campaign_purpose IS NULL) AND
    (industry_pack_id IS NULL)) OR
    ((suggestion_context = ANY (ARRAY['trending'::text, 'composition'::text])) AND (jsonb_typeof(opening_lines) = 'array'::text) AND ((jsonb_array_length(opening_lines) >= 1) AND
    (jsonb_array_length(opening_lines) <= 3)) AND (input_context_hash ~ '^[a-f0-9]{64}$'::text) AND (jsonb_typeof(validation_metadata) = 'object'::text) AND
    ((validation_metadata ->> 'passed'::text) = 'true'::text) AND ((quality_score >= 80) AND (quality_score <= 100)) AND
    (validator_version = ANY (ARRAY['trending-hook-validator-v3'::text, 'trending-hook-validator-v4-fixed-type'::text])) AND
    (((pattern_id = ANY (ARRAY['mystery_discovery'::text, 'direct_capability'::text, 'problem_observation'::text, 'skeptical_challenge'::text, 'problem_reversal'::text,
    'workflow_exposed'::text,
    'outcome_without_friction'::text,
    'professional_transformation'::text])) AND
    (pattern_library_version = ANY (ARRAY['trending-hook-patterns-v1'::text, 'trending-hook-patterns-v2'::text, 'trending-hook-patterns-v3'::text])) AND
    (hook_text_format_id IS NULL) AND (hook_text_variant_id IS NULL) AND (hook_text_format_library_version IS NULL)) OR
    ((pattern_id IS NULL) AND (pattern_library_version IS NULL) AND (hook_text_format_id ~ '^GF_[0-9]{3}$'::text) AND (hook_text_variant_id ~ '^GF_[0-9]{3}_[A-Z]$'::text) AND
    (hook_text_format_library_version = 'global-hook-text-formats-v1'::text) AND (industry_pack_id IS NULL))) AND ((suggestion_context = 'trending'::text) OR ((demo_asset_id IS
    NOT NULL) AND (campaign_purpose IS NOT NULL)))))) NOT VALID;

ALTER TABLE "public"."hook_video_suggestions"
  ADD CONSTRAINT "hook_video_suggestions_v7_audio_intent_required" CHECK (((prompt_version IS DISTINCT FROM 'trending-hook-copy-v7'::text) OR ((audio_intent IS
    NOT NULL) AND (hook_text_format_id IS NOT NULL) AND (hook_text_variant_id IS NOT NULL)))) NOT VALID;

CREATE INDEX hook_video_suggestions_demo_idx ON public.hook_video_suggestions USING btree (demo_asset_id);

CREATE INDEX hook_video_suggestions_generation_idx ON public.hook_video_suggestions USING btree (generation_id);

CREATE INDEX hook_video_suggestions_generation_job_idx ON public.hook_video_suggestions USING btree (generation_job_id)
  WHERE (generation_job_id IS NOT NULL);

CREATE INDEX hook_video_suggestions_learning_idx ON public.hook_video_suggestions USING btree (business_profile_id, campaign_purpose, industry_pack_id, pattern_id)
  WHERE (pattern_id IS NOT NULL);

CREATE INDEX hook_video_suggestions_pattern_performance_idx ON public.hook_video_suggestions USING btree (pattern_id, quality_score DESC)
  WHERE (pattern_id IS NOT NULL);

CREATE INDEX hook_video_suggestions_profile_idx ON public.hook_video_suggestions USING btree (business_profile_id);

CREATE INDEX hook_video_suggestions_selection_idx ON public.hook_video_suggestions USING btree (user_id, influencer_video_id, demo_asset_id);

CREATE INDEX hook_video_suggestions_text_format_idx ON public.hook_video_suggestions USING btree (user_id, business_profile_id, hook_text_format_id, created_at DESC)
  WHERE (hook_text_format_id IS NOT NULL);

CREATE UNIQUE INDEX hook_video_suggestions_trending_candidate_unique_idx ON public.hook_video_suggestions
  USING btree (business_profile_id, business_profile_version, candidate_index)
  WHERE ((suggestion_context = 'trending'::text) AND (candidate_index IS NOT NULL));

CREATE UNIQUE INDEX hook_video_suggestions_trending_generation_candidate_uidx ON public.hook_video_suggestions
  USING btree (business_profile_id, business_profile_version, suggestion_context, generation_id, candidate_index)
  WHERE (suggestion_context = 'trending'::text);

CREATE INDEX hook_video_suggestions_trending_profile_idx ON public.hook_video_suggestions USING btree (user_id, business_profile_id, business_profile_version, candidate_index)
  WHERE (suggestion_context = 'trending'::text);

CREATE INDEX hook_video_suggestions_user_created_idx ON public.hook_video_suggestions USING btree (user_id, created_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hook_video_suggestions" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."hook_video_suggestions"."audio_intent" IS 'Hidden controlled Hook sound requirements. This stores meaning only and never an audio filename or asset choice.';

COMMENT ON COLUMN "public"."hook_video_suggestions"."hook_text_format_id" IS 'Global Hook writing format for V7+ generations; separate from visual hook_format_id.';

COMMENT ON COLUMN "public"."hook_video_suggestions"."pattern_id" IS 'Legacy writing pattern retained for historical generations. V7+ uses hook_text_format_id.';


-- source: public/tables/social_publish_attempts.sql
CREATE TABLE "public"."social_publish_attempts" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "scheduled_post_target_id" uuid                     NOT NULL,
  "user_id"                  text                     NOT NULL,
  "attempt_number"           integer                  NOT NULL DEFAULT 1,
  "stage"                    text                     NOT NULL,
  "status"                   text                     NOT NULL,
  "error_code"               text,
  "error_message"            text,
  "provider_request_id"      text,
  "metadata"                 jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "social_publish_attempts_attempt_number_check" CHECK ((attempt_number > 0)),
  CONSTRAINT "social_publish_attempts_error_message_check" CHECK (((error_message IS NULL) OR (char_length(error_message) <= 500))),
  CONSTRAINT "social_publish_attempts_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text)),
  CONSTRAINT "social_publish_attempts_pkey" PRIMARY KEY (id),
  CONSTRAINT "social_publish_attempts_scheduled_post_target_id_fkey" FOREIGN KEY (scheduled_post_target_id) REFERENCES public.scheduled_post_targets(id) ON DELETE CASCADE,
  CONSTRAINT "social_publish_attempts_stage_check" CHECK (((char_length(TRIM(BOTH FROM stage)) > 0) AND (char_length(stage) <= 80))),
  CONSTRAINT "social_publish_attempts_status_check" CHECK ((status = ANY (ARRAY['started'::text, 'succeeded'::text, 'failed'::text, 'skipped'::text])))
);

ALTER TABLE "public"."social_publish_attempts"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX social_publish_attempts_target_created_idx ON public.social_publish_attempts USING btree (scheduled_post_target_id, created_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."social_publish_attempts" TO "postgres", "service_role";


-- source: public/tables/social_publish_operations.sql
CREATE TABLE "public"."social_publish_operations" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "scheduled_post_target_id" uuid                     NOT NULL,
  "user_id"                  text                     NOT NULL,
  "platform"                 text                     NOT NULL,
  "idempotency_key"          text                     NOT NULL,
  "status"                   text                     NOT NULL DEFAULT 'pending'::text,
  "provider_operation_kind"  text,
  "provider_operation_id"    text,
  "platform_post_id"         text,
  "platform_post_url"        text,
  "active_job_id"            uuid,
  "active_claim_token"       uuid,
  "claimed_at"               timestamp with time zone,
  "last_error_code"          text,
  "last_error_message"       text,
  "metadata"                 jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "published_at"             timestamp with time zone,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "social_publish_operations_active_job_id_fkey" FOREIGN KEY (active_job_id) REFERENCES public.background_jobs(id) ON DELETE RESTRICT,
  CONSTRAINT "social_publish_operations_check1" CHECK ((((active_job_id IS NULL) AND (active_claim_token IS NULL)) OR ((active_job_id IS NOT NULL) AND (active_claim_token IS
    NOT NULL)))),
  CONSTRAINT "social_publish_operations_check2" CHECK (((status <> 'initialized'::text) OR (provider_operation_id IS NOT NULL))),
  CONSTRAINT "social_publish_operations_check3" CHECK (((status <> 'published'::text) OR (platform_post_id IS NOT NULL))),
  CONSTRAINT "social_publish_operations_check" CHECK ((((provider_operation_kind IS NULL) AND (provider_operation_id IS NULL)) OR ((provider_operation_kind IS
    NOT NULL) AND (provider_operation_id IS NOT NULL)))),
  CONSTRAINT "social_publish_operations_idempotency_key_check" CHECK (((char_length(TRIM(BOTH FROM idempotency_key)) > 0) AND (char_length(idempotency_key) <= 200))),
  CONSTRAINT "social_publish_operations_idempotency_key_key" UNIQUE (idempotency_key),
  CONSTRAINT "social_publish_operations_last_error_message_check" CHECK (((last_error_message IS NULL) OR (char_length(last_error_message) <= 500))),
  CONSTRAINT "social_publish_operations_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text)),
  CONSTRAINT "social_publish_operations_pkey" PRIMARY KEY (id),
  CONSTRAINT "social_publish_operations_platform_check" CHECK ((platform = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'youtube'::text]))),
  CONSTRAINT "social_publish_operations_platform_post_url_check" CHECK (((platform_post_url IS NULL) OR (platform_post_url ~ '^https?://'::text))),
  CONSTRAINT "social_publish_operations_provider_operation_id_check" CHECK (((provider_operation_id IS NULL) OR (char_length(provider_operation_id) <= 4096))),
  CONSTRAINT "social_publish_operations_provider_operation_kind_check"
    CHECK (((provider_operation_kind IS NULL) OR (provider_operation_kind = ANY (ARRAY['instagram_container'::text, 'tiktok_publish'::text, 'youtube_resumable_upload'::text])))),
  CONSTRAINT "social_publish_operations_scheduled_post_target_id_fkey" FOREIGN KEY (scheduled_post_target_id) REFERENCES public.scheduled_post_targets(id) ON DELETE CASCADE,
  CONSTRAINT "social_publish_operations_scheduled_post_target_id_key" UNIQUE (scheduled_post_target_id),
  CONSTRAINT "social_publish_operations_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'initialized'::text, 'published'::text])))
);

ALTER TABLE "public"."social_publish_operations"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX social_publish_operations_active_job_idx ON public.social_publish_operations USING btree (active_job_id)
  WHERE (active_job_id IS NOT NULL);

CREATE INDEX social_publish_operations_user_updated_idx ON public.social_publish_operations USING btree (user_id, updated_at DESC);

CREATE TRIGGER release_social_publish_account_lane_on_operation_change
  AFTER UPDATE OF active_job_id, active_claim_token ON public.social_publish_operations
  FOR EACH ROW
  EXECUTE FUNCTION public.release_social_publish_account_lane_on_operation_change();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."social_publish_operations" TO "postgres", "service_role";


-- source: public/tables/trending_hook_generation_runs.sql
CREATE TABLE "public"."trending_hook_generation_runs" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                  text                     NOT NULL,
  "business_profile_id"      uuid                     NOT NULL,
  "business_profile_version" integer                  NOT NULL,
  "prompt_version"           text                     NOT NULL,
  "selection_version"        text                     NOT NULL,
  "source_selection_key"     text                     NOT NULL DEFAULT ''::text,
  "target_valid_count"       integer                  NOT NULL,
  "completed_valid_count"    integer                  NOT NULL DEFAULT 0,
  "status"                   text                     NOT NULL DEFAULT 'queued'::text,
  "last_error"               text,
  "completed_at"             timestamp with time zone,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "trending_hook_generation_runs_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  CONSTRAINT "trending_hook_generation_runs_business_profile_version_check" CHECK ((business_profile_version > 0)),
  CONSTRAINT "trending_hook_generation_runs_check" CHECK (((completed_valid_count >= 0) AND (completed_valid_count <= target_valid_count))),
  CONSTRAINT "trending_hook_generation_runs_pkey" PRIMARY KEY (id),
  CONSTRAINT "trending_hook_generation_runs_prompt_version_check"
    CHECK (((char_length(TRIM(BOTH FROM prompt_version)) >= 1) AND (char_length(TRIM(BOTH FROM prompt_version)) <= 120))),
  CONSTRAINT "trending_hook_generation_runs_selection_version_check"
    CHECK (((char_length(TRIM(BOTH FROM selection_version)) >= 1) AND (char_length(TRIM(BOTH FROM selection_version)) <= 120))),
  CONSTRAINT "trending_hook_generation_runs_status_check"
    CHECK
    ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'continuation_pending'::text, 'completed'::text, 'source_exhausted'::text, 'superseded'::text, 'failed'::text]))),
  CONSTRAINT "trending_hook_generation_runs_target_valid_count_check" CHECK (((target_valid_count >= 1) AND (target_valid_count <= 100))),
  CONSTRAINT "trending_hook_generation_runs_user_id_check" CHECK (((char_length(TRIM(BOTH FROM user_id)) >= 1) AND (char_length(TRIM(BOTH FROM user_id)) <= 128)))
);

ALTER TABLE "public"."trending_hook_generation_runs"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX trending_hook_generation_runs_lookup_idx ON public.trending_hook_generation_runs USING btree (user_id, business_profile_id, business_profile_version, updated_at DESC);

CREATE UNIQUE INDEX trending_hook_generation_runs_one_active_scope_idx ON public.trending_hook_generation_runs USING btree (user_id, business_profile_id, business_profile_version)
  WHERE (status = ANY (ARRAY['queued'::text, 'processing'::text, 'continuation_pending'::text]));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."trending_hook_generation_runs" TO "postgres", "service_role";


-- source: public/tables/user_hook_text_format_performance.sql
CREATE TABLE "public"."user_hook_text_format_performance" (
  "user_id"                text                     NOT NULL,
  "business_profile_id"    uuid                     NOT NULL,
  "hook_text_format_id"    text                     NOT NULL,
  "campaign_purpose"       text,
  "times_used"             integer                  NOT NULL DEFAULT 0,
  "recent_results"         jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "median_views"           numeric,
  "average_views"          numeric,
  "consistency_score"      numeric                  NOT NULL DEFAULT 0.5,
  "performance_score"      numeric                  NOT NULL DEFAULT 1,
  "confidence_score"       numeric                  NOT NULL DEFAULT 0,
  "selection_weight"       numeric                  NOT NULL DEFAULT 1,
  "temporary_boost"        numeric                  NOT NULL DEFAULT 0,
  "published_result_count" integer                  NOT NULL DEFAULT 0,
  "last_used_at"           timestamp with time zone,
  "refreshed_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_hook_text_format_performance_average_views_check" CHECK (((average_views IS NULL) OR (average_views >= (0)::numeric))),
  CONSTRAINT "user_hook_text_format_performance_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  CONSTRAINT "user_hook_text_format_performance_confidence_score_check" CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))),
  CONSTRAINT "user_hook_text_format_performance_consistency_score_check" CHECK (((consistency_score >= (0)::numeric) AND (consistency_score <= (1)::numeric))),
  CONSTRAINT "user_hook_text_format_performance_hook_text_format_id_fkey" FOREIGN KEY (hook_text_format_id) REFERENCES public.hook_text_formats(id) ON DELETE CASCADE,
  CONSTRAINT "user_hook_text_format_performance_median_views_check" CHECK (((median_views IS NULL) OR (median_views >= (0)::numeric))),
  CONSTRAINT "user_hook_text_format_performance_performance_score_check" CHECK ((performance_score >= (0)::numeric)),
  CONSTRAINT "user_hook_text_format_performance_pkey" PRIMARY KEY (user_id, business_profile_id, hook_text_format_id),
  CONSTRAINT "user_hook_text_format_performance_published_result_count_check" CHECK ((published_result_count >= 0)),
  CONSTRAINT "user_hook_text_format_performance_recent_results_check" CHECK ((jsonb_typeof(recent_results) = 'array'::text)),
  CONSTRAINT "user_hook_text_format_performance_selection_weight_check" CHECK (((selection_weight >= 0.8) AND (selection_weight <= 1.3))),
  CONSTRAINT "user_hook_text_format_performance_temporary_boost_check" CHECK (((temporary_boost >= (0)::numeric) AND (temporary_boost <= 0.12))),
  CONSTRAINT "user_hook_text_format_performance_times_used_check" CHECK ((times_used >= 0))
);

ALTER TABLE "public"."user_hook_text_format_performance"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX user_hook_text_format_performance_profile_idx ON public.user_hook_text_format_performance USING btree (user_id, business_profile_id, selection_weight DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_hook_text_format_performance" TO "postgres", "service_role";

COMMENT ON TABLE "public"."user_hook_text_format_performance" IS 'Per-user Global Hook text-format learning. V1 learns from attributed Instagram views only.';


-- source: public/tables/wall_text_content_plans.sql
CREATE TABLE "public"."wall_text_content_plans" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                  text                     NOT NULL,
  "project_id"               text                     NOT NULL,
  "business_profile_id"      uuid                     NOT NULL,
  "business_profile_version" integer                  NOT NULL,
  "period_start_date"        date                     NOT NULL,
  "period_end_date"          date                     NOT NULL,
  "timezone"                 text                     NOT NULL,
  "plan_version"             integer                  NOT NULL,
  "business_description"     text                     NOT NULL,
  "planning_context"         jsonb                    NOT NULL,
  "target_item_count"        integer                  NOT NULL DEFAULT 200,
  "planner_model"            text                     NOT NULL,
  "planner_prompt_version"   text                     NOT NULL,
  "status"                   text                     NOT NULL DEFAULT 'generating'::text,
  "generation_job_id"        uuid,
  "generation_started_at"    timestamp with time zone,
  "generation_completed_at"  timestamp with time zone,
  "activated_at"             timestamp with time zone,
  "failed_at"                timestamp with time zone,
  "failure_reason"           text,
  "superseded_at"            timestamp with time zone,
  "superseded_by_plan_id"    uuid,
  "created_at"               timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "wall_text_content_plans_business_description_check" CHECK (((char_length(btrim(business_description)) >= 12) AND (char_length(btrim(business_description)) <= 4000))),
  CONSTRAINT "wall_text_content_plans_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  CONSTRAINT "wall_text_content_plans_business_profile_version_check" CHECK ((business_profile_version > 0)),
  CONSTRAINT "wall_text_content_plans_check" CHECK ((period_end_date = (period_start_date + 29))),
  CONSTRAINT "wall_text_content_plans_generation_job_id_fkey" FOREIGN KEY (generation_job_id) REFERENCES public.background_jobs(id) ON DELETE SET NULL,
  CONSTRAINT "wall_text_content_plans_id_user_id_key" UNIQUE (id, user_id),
  CONSTRAINT "wall_text_content_plans_pkey" PRIMARY KEY (id),
  CONSTRAINT "wall_text_content_plans_plan_version_check" CHECK ((plan_version > 0)),
  CONSTRAINT "wall_text_content_plans_planner_model_check" CHECK (((char_length(btrim(planner_model)) >= 1) AND (char_length(btrim(planner_model)) <= 120))),
  CONSTRAINT "wall_text_content_plans_planner_prompt_version_check"
    CHECK (((char_length(btrim(planner_prompt_version)) >= 1) AND (char_length(btrim(planner_prompt_version)) <= 160))),
  CONSTRAINT "wall_text_content_plans_planning_context_check" CHECK ((jsonb_typeof(planning_context) = 'object'::text)),
  CONSTRAINT "wall_text_content_plans_project_id_check" CHECK (((char_length(btrim(project_id)) >= 1) AND (char_length(btrim(project_id)) <= 240))),
  CONSTRAINT "wall_text_content_plans_status_check" CHECK ((status = ANY (ARRAY['generating'::text, 'active'::text, 'failed'::text, 'superseded'::text]))),
  CONSTRAINT "wall_text_content_plans_superseded_by_plan_id_fkey" FOREIGN KEY (superseded_by_plan_id) REFERENCES public.wall_text_content_plans(id) ON DELETE SET NULL,
  CONSTRAINT "wall_text_content_plans_target_item_count_check" CHECK ((target_item_count = 200)),
  CONSTRAINT "wall_text_content_plans_timezone_check" CHECK (((char_length(btrim(timezone)) >= 1) AND (char_length(btrim(timezone)) <= 120))),
  CONSTRAINT "wall_text_content_plans_user_id_business_profile_id_busines_key" UNIQUE (user_id, business_profile_id, business_profile_version, period_start_date, plan_version),
  CONSTRAINT "wall_text_content_plans_user_id_check" CHECK (((char_length(btrim(user_id)) >= 1) AND (char_length(btrim(user_id)) <= 240)))
);

ALTER TABLE "public"."wall_text_content_plans"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX wall_text_content_plans_current_idx ON public.wall_text_content_plans
  USING btree (user_id, business_profile_id, business_profile_version, status, period_start_date DESC);

CREATE UNIQUE INDEX wall_text_content_plans_generation_job_uidx ON public.wall_text_content_plans USING btree (generation_job_id)
  WHERE (generation_job_id IS NOT NULL);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wall_text_content_plans" TO "postgres", "service_role";


-- source: public/tables/wall_text_creatives.sql
CREATE TABLE "public"."wall_text_creatives" (
  "id"                         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                    text                     NOT NULL,
  "business_profile_id"        uuid                     NOT NULL,
  "business_profile_version"   integer                  NOT NULL,
  "overlay_media_asset_id"     uuid                     NOT NULL,
  "generation_id"              uuid                     NOT NULL,
  "candidate_index"            integer                  NOT NULL,
  "duration_seconds"           numeric                  NOT NULL,
  "text_content"               jsonb                    NOT NULL,
  "layout"                     jsonb                    NOT NULL,
  "generator_version"          text                     NOT NULL DEFAULT 'business-profile-wall-text-v9'::text,
  "generator_model"            text,
  "status"                     text                     NOT NULL DEFAULT 'preview_ready'::text,
  "error_message"              text,
  "created_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "source_kind"                text                     NOT NULL DEFAULT 'ugcpilot'::text,
  "instagram_reel_template_id" uuid,
  CONSTRAINT "wall_text_creatives_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  CONSTRAINT "wall_text_creatives_business_profile_version_check" CHECK ((business_profile_version > 0)),
  CONSTRAINT "wall_text_creatives_candidate_index_check" CHECK (((candidate_index >= 0) AND (candidate_index < 1000000))),
  CONSTRAINT "wall_text_creatives_duration_seconds_check" CHECK ((duration_seconds > (0)::numeric)),
  CONSTRAINT "wall_text_creatives_generator_model_check" CHECK (((generator_model IS NULL) OR (char_length(TRIM(BOTH FROM generator_model)) > 0))),
  CONSTRAINT "wall_text_creatives_generator_version_check" CHECK ((char_length(TRIM(BOTH FROM generator_version)) > 0)),
  CONSTRAINT "wall_text_creatives_instagram_template_chk" CHECK (((source_kind = 'instagram_reel'::text) = (instagram_reel_template_id IS NOT NULL))),
  CONSTRAINT "wall_text_creatives_layout_chk"
    CHECK
    (COALESCE(((jsonb_typeof(layout) = 'object'::text) AND ((layout ->> 'version'::text) = ANY (ARRAY['wall-text-layout-v1'::text, 'wall-text-layout-v2'::text,
    'wall-text-layout-v3'::text, 'wall-text-layout-v4'::text]))), false)),
  CONSTRAINT "wall_text_creatives_overlay_media_asset_id_fkey" FOREIGN KEY (overlay_media_asset_id) REFERENCES public.overlay_media_assets(id) ON DELETE RESTRICT,
  CONSTRAINT "wall_text_creatives_pkey" PRIMARY KEY (id),
  CONSTRAINT "wall_text_creatives_profile_asset_key" UNIQUE (user_id, business_profile_id, business_profile_version, overlay_media_asset_id),
  CONSTRAINT "wall_text_creatives_profile_candidate_key" UNIQUE (user_id, business_profile_id, business_profile_version, candidate_index),
  CONSTRAINT "wall_text_creatives_source_kind_chk" CHECK ((source_kind = ANY (ARRAY['ugcpilot'::text, 'creative_asset'::text, 'instagram_reel'::text]))),
  CONSTRAINT "wall_text_creatives_status_check" CHECK ((status = ANY (ARRAY['preview_ready'::text, 'failed'::text, 'archived'::text]))),
  CONSTRAINT "wall_text_creatives_text_content_chk"
    CHECK
    (COALESCE(((jsonb_typeof(text_content) = 'object'::text) AND ((text_content ->> 'kind'::text) = 'wall_text'::text) AND (((text_content ->> 'layoutVersion'::text) = ANY
    (ARRAY['wall-text-overlay-v1'::text, 'wall-text-overlay-v2'::text, 'wall-text-overlay-v3'::text, 'wall-text-overlay-v4'::text])) OR
    (((text_content ->> 'layoutVersion'::text) = 'wall-text-overlay-v5'::text) AND ((text_content ->> 'formatId'::text) = ANY (ARRAY['identity_mirror'::text,
    'recognizable_moment'::text,
    'hidden_truth'::text,
    'contrarian_reframe'::text,
    'personal_confession'::text,
    'aspiration_redefinition'::text,
    'pain_beneath_the_pain'::text,
    'niche_insight'::text,
    'list_rules'::text,
    'community_prompt'::text,
    'analogy_reframe'::text,
    'progression_sequence'::text])) AND (jsonb_typeof((text_content -> 'fullText'::text)) = 'string'::text) AND
    ((char_length(TRIM(BOTH FROM (text_content ->> 'fullText'::text))) >= 1) AND (char_length(TRIM(BOTH FROM (text_content ->> 'fullText'::text))) <= 600)) AND
    (jsonb_typeof((text_content -> 'sourceContent'::text)) = 'object'::text) AND
    (((text_content -> 'sourceContent'::text) ->> 'kind'::text) = ANY (ARRAY['prose'::text, 'list'::text])) AND
    (jsonb_typeof((text_content -> 'finalLayout'::text)) = 'object'::text) AND (((text_content -> 'finalLayout'::text) ->> 'version'::text) = 'wall-text-final-layout-v1'::text) AND
    (((text_content -> 'finalLayout'::text) ->> 'fontFamily'::text) = 'Inter'::text) AND
    ((((text_content -> 'finalLayout'::text) ->> 'fontWeight'::text))::integer = ANY (ARRAY[400, 600, 700])) AND
    ((((text_content -> 'finalLayout'::text) ->> 'fontSizePx'::text))::integer = ANY (ARRAY[36, 38, 40, 42, 44, 46, 48, 50, 52])) AND
    (jsonb_typeof(((text_content -> 'finalLayout'::text) -> 'textBox'::text)) = 'object'::text) AND
    (jsonb_typeof(((text_content -> 'finalLayout'::text) -> 'blocks'::text)) = 'array'::text) AND
    ((jsonb_array_length(((text_content -> 'finalLayout'::text) -> 'blocks'::text)) >= 1) AND (jsonb_array_length(((text_content -> 'finalLayout'::text) -> 'blocks'::text)) <= 6)))
    OR
    (((text_content ->> 'layoutVersion'::text) = 'wall-text-overlay-v6'::text) AND ((text_content ->> 'formatId'::text) = ANY (ARRAY['freeform'::text, 'hidden_alternative'::text,
    'manual_automatic'::text,
    'secret_advantage'::text,
    'outcome_mystery'::text,
    'authority_reaction'::text,
    'personal_obsession'::text,
    'numbered_curiosity'::text,
    'rule_checklist'::text,
    'hidden_cause'::text,
    'contrarian_opinion'::text,
    'niche_pov'::text,
    'community_question'::text,
    'transformation_timeframe'::text,
    'method_framework'::text,
    'emotional_reframe'::text,
    'personal_manifesto'::text,
    'relatable_situation'::text,
    'desire_identity_stack'::text,
    'old_way_regret'::text,
    'retrospective_lesson'::text,
    'self_audit'::text,
    'warning_alert'::text,
    'personal_stance'::text,
    'future_snapshot'::text,
    'metaphor_reframe'::text,
    'swap_upgrade_stack'::text,
    'niche_milestones'::text,
    'insider_truths'::text,
    'aspirational_archetype'::text,
    'internal_conflict'::text])) AND (jsonb_typeof((text_content -> 'fullText'::text)) = 'string'::text) AND
    ((char_length(TRIM(BOTH FROM (text_content ->> 'fullText'::text))) >= 8) AND (char_length(TRIM(BOTH FROM (text_content ->> 'fullText'::text))) <= 600)) AND
    (((text_content -> 'sourceContent'::text) ->> 'kind'::text) = 'text'::text) AND (jsonb_typeof(((text_content -> 'sourceContent'::text) -> 'text'::text)) = 'string'::text) AND
    (((text_content -> 'finalLayout'::text) ->> 'version'::text) = 'wall-text-final-layout-v2'::text) AND
    (((text_content -> 'finalLayout'::text) ->> 'fontFamily'::text) = 'Inter'::text) AND
    ((((text_content -> 'finalLayout'::text) ->> 'fontWeight'::text))::integer = ANY (ARRAY[400, 600, 700])) AND
    ((((text_content -> 'finalLayout'::text) ->> 'fontSizePx'::text))::integer = ANY (ARRAY[36, 38, 40, 42, 44, 46, 48, 50, 52])) AND
    (jsonb_array_length(((text_content -> 'finalLayout'::text) -> 'blocks'::text)) = 1) AND ((text_content #>> '{finalLayout,blocks,0,role}'::text[]) = 'text'::text) AND
    (((generator_version = 'business-profile-wall-text-v9'::text) AND ((jsonb_array_length((text_content #> '{finalLayout,blocks,0,lines}'::text[])) >= 5) AND
    (jsonb_array_length((text_content #> '{finalLayout,blocks,0,lines}'::text[])) <= 8))) OR
    ((generator_version <> 'business-profile-wall-text-v9'::text) AND ((jsonb_array_length((text_content #> '{finalLayout,blocks,0,lines}'::text[])) >= 4) AND
    (jsonb_array_length((text_content #> '{finalLayout,blocks,0,lines}'::text[])) <= 7))))))), false)),
  CONSTRAINT "wall_text_creatives_user_id_check" CHECK ((char_length(TRIM(BOTH FROM user_id)) > 0)),
  CONSTRAINT "wall_text_creatives_instagram_reel_template_id_fkey" FOREIGN KEY (instagram_reel_template_id) REFERENCES public.wall_text_instagram_reel_templates(id)
    ON DELETE RESTRICT
);

ALTER TABLE "public"."wall_text_creatives"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX wall_text_creatives_business_profile_idx ON public.wall_text_creatives USING btree (business_profile_id);

CREATE INDEX wall_text_creatives_overlay_asset_idx ON public.wall_text_creatives USING btree (overlay_media_asset_id);

CREATE INDEX wall_text_creatives_profile_idx ON public.wall_text_creatives USING btree (user_id, business_profile_id, business_profile_version, status, candidate_index);

CREATE INDEX wall_text_creatives_recent_assets_idx ON public.wall_text_creatives USING btree (user_id, created_at DESC, overlay_media_asset_id);

CREATE TRIGGER validate_wall_text_creative_trigger
  BEFORE INSERT OR UPDATE OF user_id, business_profile_id, business_profile_version, overlay_media_asset_id ON public.wall_text_creatives
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_wall_text_creative();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wall_text_creatives" TO "postgres", "service_role";


-- source: public/tables/wall_text_generation_batches.sql
CREATE TABLE "public"."wall_text_generation_batches" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                  text                     NOT NULL,
  "business_profile_id"      uuid                     NOT NULL,
  "business_profile_version" integer                  NOT NULL,
  "request_key"              text                     NOT NULL,
  "request_hash"             text                     NOT NULL,
  "requested_count"          integer                  NOT NULL,
  "chunk_size"               integer                  NOT NULL DEFAULT 10,
  "chunk_count"              integer                  NOT NULL,
  "candidate_index_start"    integer                  NOT NULL,
  "generator_version"        text                     NOT NULL,
  "prompt_version"           text                     NOT NULL,
  "format_library_version"   text                     NOT NULL,
  "selector_version"         text                     NOT NULL,
  "status"                   text                     NOT NULL DEFAULT 'pending'::text,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at"             timestamp with time zone,
  CONSTRAINT "wall_text_generation_batches_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  CONSTRAINT "wall_text_generation_batches_business_profile_version_check" CHECK ((business_profile_version > 0)),
  CONSTRAINT "wall_text_generation_batches_candidate_index_start_check" CHECK ((candidate_index_start >= 0)),
  CONSTRAINT "wall_text_generation_batches_chunk_count_check" CHECK ((chunk_count > 0)),
  CONSTRAINT "wall_text_generation_batches_chunk_size_check" CHECK ((chunk_size = 10)),
  CONSTRAINT "wall_text_generation_batches_pkey" PRIMARY KEY (id),
  CONSTRAINT "wall_text_generation_batches_request_hash_check" CHECK ((request_hash ~ '^[a-f0-9]{64}$'::text)),
  CONSTRAINT "wall_text_generation_batches_request_key_check" CHECK ((char_length(btrim(request_key)) > 0)),
  CONSTRAINT "wall_text_generation_batches_request_key" UNIQUE (user_id, request_key),
  CONSTRAINT "wall_text_generation_batches_requested_count_check" CHECK (((requested_count >= 1) AND (requested_count <= 50))),
  CONSTRAINT "wall_text_generation_batches_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))),
  CONSTRAINT "wall_text_generation_batches_user_id_check" CHECK ((char_length(btrim(user_id)) > 0))
);

ALTER TABLE "public"."wall_text_generation_batches"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX wall_text_generation_batches_profile_idx ON public.wall_text_generation_batches USING btree (user_id, business_profile_id, created_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wall_text_generation_batches" TO "postgres", "service_role";


-- source: public/tables/carousel_content_plan_briefs.sql
CREATE TABLE "public"."carousel_content_plan_briefs" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "plan_id"                 uuid                     NOT NULL,
  "user_id"                 text                     NOT NULL,
  "brief_index"             smallint                 NOT NULL,
  "creative_seed"           text                     NOT NULL,
  "audience_context"        text                     NOT NULL,
  "human_moment"            text                     NOT NULL,
  "emotional_tension"       text                     NOT NULL,
  "supported_angle"         text                     NOT NULL,
  "preferred_format_family" text                     NOT NULL,
  "brief_fingerprint"       text                     NOT NULL,
  "created_at"              timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "carousel_content_plan_briefs_audience_context_check"
    CHECK (((char_length(TRIM(BOTH FROM audience_context)) >= 2) AND (char_length(TRIM(BOTH FROM audience_context)) <= 240))),
  CONSTRAINT "carousel_content_plan_briefs_brief_fingerprint_check" CHECK ((brief_fingerprint ~ '^[0-9a-f]{64}$'::text)),
  CONSTRAINT "carousel_content_plan_briefs_brief_index_check" CHECK (((brief_index >= 1) AND (brief_index <= 30))),
  CONSTRAINT "carousel_content_plan_briefs_creative_seed_check"
    CHECK (((char_length(TRIM(BOTH FROM creative_seed)) >= 12) AND (char_length(TRIM(BOTH FROM creative_seed)) <= 400))),
  CONSTRAINT "carousel_content_plan_briefs_emotional_tension_check"
    CHECK (((char_length(TRIM(BOTH FROM emotional_tension)) >= 2) AND (char_length(TRIM(BOTH FROM emotional_tension)) <= 160))),
  CONSTRAINT "carousel_content_plan_briefs_human_moment_check" CHECK (((char_length(TRIM(BOTH FROM human_moment)) >= 12) AND (char_length(TRIM(BOTH FROM human_moment)) <= 400))),
  CONSTRAINT "carousel_content_plan_briefs_id_plan_id_user_id_key" UNIQUE (id, plan_id, user_id),
  CONSTRAINT "carousel_content_plan_briefs_pkey" PRIMARY KEY (id),
  CONSTRAINT "carousel_content_plan_briefs_plan_id_brief_fingerprint_key" UNIQUE (plan_id, brief_fingerprint),
  CONSTRAINT "carousel_content_plan_briefs_plan_id_brief_index_key" UNIQUE (plan_id, brief_index),
  CONSTRAINT "carousel_content_plan_briefs_preferred_format_family_check"
    CHECK
    ((preferred_format_family = ANY (ARRAY['common_problem'::text, 'contrast'::text, 'emotional_observation'::text, 'practical_reframe'::text, 'relatable_situation'::text,
    'small_story'::text]))),
  CONSTRAINT "carousel_content_plan_briefs_supported_angle_check"
    CHECK (((char_length(TRIM(BOTH FROM supported_angle)) >= 12) AND (char_length(TRIM(BOTH FROM supported_angle)) <= 400))),
  CONSTRAINT "carousel_content_plan_briefs_user_id_check" CHECK (((char_length(TRIM(BOTH FROM user_id)) >= 1) AND (char_length(TRIM(BOTH FROM user_id)) <= 240))),
  CONSTRAINT "carousel_content_plan_briefs_plan_id_user_id_fkey" FOREIGN KEY (plan_id, user_id) REFERENCES public.carousel_content_plans(id, user_id) ON DELETE CASCADE
);

ALTER TABLE "public"."carousel_content_plan_briefs"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX carousel_content_plan_briefs_plan_idx ON public.carousel_content_plan_briefs USING btree (plan_id, brief_index);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."carousel_content_plan_briefs" TO "postgres";

COMMENT ON TABLE "public"."carousel_content_plan_briefs" IS 'Private, source-grounded six-field creative context. Each brief creates five durable Carousel ideas and is never exposed as slide content.';

REVOKE ALL ON TABLE "public"."carousel_content_plan_briefs" FROM "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."carousel_content_plan_briefs" TO "service_role";


-- source: public/tables/carousel_content_plan_reservations.sql
CREATE TABLE "public"."carousel_content_plan_reservations" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "plan_id"         uuid                     NOT NULL,
  "user_id"         text                     NOT NULL,
  "reservation_key" text                     NOT NULL,
  "requested_count" integer                  NOT NULL,
  "consumed_count"  integer                  NOT NULL DEFAULT 0,
  "status"          text                     NOT NULL DEFAULT 'active'::text,
  "expires_at"      timestamp with time zone NOT NULL,
  "completed_at"    timestamp with time zone,
  "released_at"     timestamp with time zone,
  "release_reason"  text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "carousel_content_plan_reservations_check1" CHECK ((expires_at > created_at)),
  CONSTRAINT "carousel_content_plan_reservations_check2"
    CHECK
    ((((status = 'active'::text) AND (completed_at IS NULL) AND (released_at IS NULL) AND (release_reason IS NULL)) OR ((status = 'completed'::text) AND (consumed_count =
    requested_count) AND (completed_at IS
    NOT NULL) AND (released_at IS NULL) AND (release_reason IS NULL)) OR
    ((status = ANY (ARRAY['released'::text, 'released_partial'::text, 'expired'::text, 'expired_partial'::text])) AND (completed_at IS NULL) AND (released_at IS
    NOT NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE(release_reason, ''::text)), ''::text) IS NOT NULL)))),
  CONSTRAINT "carousel_content_plan_reservations_check3"
    CHECK
    ((((status = ANY (ARRAY['released'::text, 'expired'::text])) AND (consumed_count = 0)) OR ((status = ANY (ARRAY['released_partial'::text, 'expired_partial'::text])) AND
    (consumed_count > 0)) OR (status = ANY (ARRAY['active'::text, 'completed'::text])))),
  CONSTRAINT "carousel_content_plan_reservations_check" CHECK (((consumed_count >= 0) AND (consumed_count <= requested_count))),
  CONSTRAINT "carousel_content_plan_reservations_pkey" PRIMARY KEY (id),
  CONSTRAINT "carousel_content_plan_reservations_requested_count_check" CHECK (((requested_count >= 1) AND (requested_count <= 150))),
  CONSTRAINT "carousel_content_plan_reservations_reservation_key_check"
    CHECK (((char_length(TRIM(BOTH FROM reservation_key)) >= 1) AND (char_length(TRIM(BOTH FROM reservation_key)) <= 240))),
  CONSTRAINT "carousel_content_plan_reservations_status_check"
    CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'released'::text, 'released_partial'::text, 'expired'::text, 'expired_partial'::text]))),
  CONSTRAINT "carousel_content_plan_reservations_user_id_check" CHECK (((char_length(TRIM(BOTH FROM user_id)) >= 1) AND (char_length(TRIM(BOTH FROM user_id)) <= 240))),
  CONSTRAINT "carousel_content_plan_reservations_user_id_reservation_key_key" UNIQUE (user_id, reservation_key),
  CONSTRAINT "carousel_content_plan_reservations_plan_id_user_id_fkey" FOREIGN KEY (plan_id, user_id) REFERENCES public.carousel_content_plans(id, user_id) ON DELETE CASCADE
);

ALTER TABLE "public"."carousel_content_plan_reservations"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX carousel_content_plan_reservations_expiry_idx ON public.carousel_content_plan_reservations USING btree (expires_at, plan_id)
  WHERE (status = 'active'::text);

CREATE INDEX carousel_content_plan_reservations_plan_status_idx ON public.carousel_content_plan_reservations USING btree (plan_id, status, expires_at);

CREATE UNIQUE INDEX carousel_content_plan_reservations_provenance_uidx ON public.carousel_content_plan_reservations USING btree (id, plan_id, user_id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."carousel_content_plan_reservations" TO "postgres";

COMMENT ON TABLE "public"."carousel_content_plan_reservations" IS 'Idempotent reservation ledger for arbitrary Carousel content-plan requests. One reservation may be partitioned into writer jobs of at most five items.';

REVOKE ALL ON TABLE "public"."carousel_content_plan_reservations" FROM "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."carousel_content_plan_reservations" TO "service_role";


-- source: public/tables/carousel_experiment_assignments.sql
CREATE TABLE "public"."carousel_experiment_assignments" (
  "id"                           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "experiment_batch_id"          uuid                     NOT NULL,
  "slot_index"                   smallint                 NOT NULL,
  "assigned_format_id"           text                     NOT NULL,
  "actual_format_id"             text,
  "format_version"               integer                  NOT NULL,
  "hook_family_id"               text,
  "carousel_generation_id"       uuid,
  "replacement_for_format_id"    text,
  "status"                       text                     NOT NULL DEFAULT 'reserved'::text,
  "created_at"                   timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"                   timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "rotation_candidate_format_id" text                     NOT NULL,
  "format_selection_mode"        text                     NOT NULL DEFAULT 'controlled_rotation'::text,
  "format_selection_multiplier"  numeric                  NOT NULL DEFAULT 1,
  "hook_selection_mode"          text                     DEFAULT 'controlled_rotation'::text,
  "hook_selection_multiplier"    numeric                  DEFAULT 1,
  "structure_id"                 text                     NOT NULL DEFAULT 'structure_1'::text,
  "structure_version"            integer                  NOT NULL DEFAULT 1,
  CONSTRAINT "carousel_experiment_assignmen_experiment_batch_id_slot_inde_key" UNIQUE (experiment_batch_id, slot_index),
  CONSTRAINT "carousel_experiment_assignments_carousel_generation_id_key" UNIQUE (carousel_generation_id),
  CONSTRAINT "carousel_experiment_assignments_check1" CHECK (((replacement_for_format_id IS NULL) OR (actual_format_id IS DISTINCT FROM replacement_for_format_id))),
  CONSTRAINT "carousel_experiment_assignments_check" CHECK ((((status = 'not_applicable'::text) AND (actual_format_id IS NULL)) OR (status <> 'not_applicable'::text))),
  CONSTRAINT "carousel_experiment_assignments_format_multiplier_check" CHECK (((format_selection_multiplier >= 0.5) AND (format_selection_multiplier <= (2)::numeric))),
  CONSTRAINT "carousel_experiment_assignments_format_selection_mode_check"
    CHECK ((format_selection_mode = ANY (ARRAY['controlled_rotation'::text, 'performance_exploration'::text, 'performance_weighted'::text]))),
  CONSTRAINT "carousel_experiment_assignments_format_version_check" CHECK ((format_version >= 1)),
  CONSTRAINT "carousel_experiment_assignments_hook_multiplier_check" CHECK (((hook_selection_multiplier >= 0.5) AND (hook_selection_multiplier <= (2)::numeric))),
  CONSTRAINT "carousel_experiment_assignments_hook_selection_mode_check"
    CHECK ((hook_selection_mode = ANY (ARRAY['controlled_rotation'::text, 'performance_exploration'::text, 'performance_weighted'::text]))),
  CONSTRAINT "carousel_experiment_assignments_pkey" PRIMARY KEY (id),
  CONSTRAINT "carousel_experiment_assignments_slot_index_check" CHECK (((slot_index >= 0) AND (slot_index <= 4))),
  CONSTRAINT "carousel_experiment_assignments_status_check"
    CHECK ((status = ANY (ARRAY['reserved'::text, 'queued'::text, 'processing'::text, 'completed'::text, 'not_applicable'::text, 'failed'::text]))),
  CONSTRAINT "carousel_experiment_assignments_structure_grammar_check" CHECK ((((structure_id = 'structure_1'::text) AND (hook_family_id IS NOT NULL) AND (hook_selection_mode IS
    NOT NULL) AND (hook_selection_multiplier IS
    NOT NULL)) OR
    ((structure_id = 'structure_2'::text) AND (assigned_format_id = ANY (ARRAY['wrong_belief'::text, 'perfect_plan_breaks'::text, 'stopped_behavior'::text, 'terrible_at'::text,
    'result_without_sacrifice'::text,
    'identity_transformation'::text,
    'new_rule'::text,
    'wrong_villain'::text])) AND
    (rotation_candidate_format_id = ANY (ARRAY['wrong_belief'::text, 'perfect_plan_breaks'::text, 'stopped_behavior'::text, 'terrible_at'::text, 'result_without_sacrifice'::text,
    'identity_transformation'::text,
    'new_rule'::text,
    'wrong_villain'::text])) AND
    ((actual_format_id IS NULL) OR (actual_format_id = ANY (ARRAY['wrong_belief'::text, 'perfect_plan_breaks'::text, 'stopped_behavior'::text, 'terrible_at'::text,
    'result_without_sacrifice'::text,
    'identity_transformation'::text,
    'new_rule'::text,
    'wrong_villain'::text]))) AND
    ((replacement_for_format_id IS NULL) OR (replacement_for_format_id = ANY (ARRAY['wrong_belief'::text, 'perfect_plan_breaks'::text, 'stopped_behavior'::text,
    'terrible_at'::text,
    'result_without_sacrifice'::text,
    'identity_transformation'::text,
    'new_rule'::text, 'wrong_villain'::text]))) AND (hook_family_id IS NULL) AND (hook_selection_mode IS NULL) AND (hook_selection_multiplier IS NULL)))),
  CONSTRAINT "carousel_experiment_assignments_structure_id_check" CHECK ((structure_id = ANY (ARRAY['structure_1'::text, 'structure_2'::text]))),
  CONSTRAINT "carousel_experiment_assignments_structure_version_check" CHECK ((structure_version >= 1)),
  CONSTRAINT "carousel_experiment_assignments_experiment_batch_id_fkey" FOREIGN KEY (experiment_batch_id) REFERENCES public.carousel_experiment_batches(id) ON DELETE CASCADE,
  CONSTRAINT "carousel_experiment_assignments_batch_structure_fk" FOREIGN KEY (experiment_batch_id, structure_id) REFERENCES public.carousel_experiment_batches(id, structure_id)
    ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE "public"."carousel_experiment_assignments"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX carousel_experiment_assignments_batch_status_idx ON public.carousel_experiment_assignments USING btree (experiment_batch_id, status, slot_index);

CREATE UNIQUE INDEX carousel_experiment_assignments_id_structure_uidx ON public.carousel_experiment_assignments USING btree (id, structure_id);

CREATE INDEX carousel_experiment_assignments_structure_format_idx ON public.carousel_experiment_assignments USING btree (structure_id, actual_format_id, created_at DESC);

CREATE TRIGGER carousel_experiment_assignments_structure_immutable
  BEFORE UPDATE ON public.carousel_experiment_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_carousel_structure_identity_change();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."carousel_experiment_assignments" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."carousel_experiment_assignments"."actual_format_id" IS 'The format actually generated and stored; may repeat another applicable format when the assigned format is not applicable.';

COMMENT ON COLUMN "public"."carousel_experiment_assignments"."assigned_format_id" IS 'The controlled-rotation format originally attempted for this slot.';

COMMENT ON COLUMN "public"."carousel_experiment_assignments"."format_selection_multiplier" IS 'Retry-stable, capped performance multiplier available when the assignment was reserved; selection_mode records whether it influenced selection.';

COMMENT ON COLUMN "public"."carousel_experiment_assignments"."hook_family_id" IS 'Structure 1 hook family. It is null for Structure 2 because Structure 2 owns a separate eight-format story grammar and never borrows Structure 1 hook families.';

COMMENT ON COLUMN "public"."carousel_experiment_assignments"."hook_selection_multiplier" IS 'Retry-stable, capped within-format hook-family multiplier used when the assignment was reserved.';

COMMENT ON COLUMN "public"."carousel_experiment_assignments"."rotation_candidate_format_id" IS 'The format the controlled rotation would have used in this slot before bounded performance weighting.';

COMMENT ON COLUMN "public"."carousel_experiment_assignments"."structure_id" IS 'Structure namespace for assigned, rotation-candidate, and actual format IDs. Format identity is the pair (structure_id, format_id).';


-- source: public/tables/carousel_image_rotation_pools.sql
CREATE TABLE "public"."carousel_image_rotation_pools" (
  "business_profile_id" uuid                     NOT NULL,
  "category_slug"       text                     NOT NULL,
  "asset_role"          text                     NOT NULL,
  "cycle_number"        integer                  NOT NULL DEFAULT 1,
  "last_asset_id"       uuid,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "carousel_image_rotation_pools_asset_role_check" CHECK ((asset_role = ANY (ARRAY['hook'::text, 'human'::text, 'static'::text, 'product_asset'::text]))),
  CONSTRAINT "carousel_image_rotation_pools_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  CONSTRAINT "carousel_image_rotation_pools_cycle_number_check" CHECK ((cycle_number > 0)),
  CONSTRAINT "carousel_image_rotation_pools_pkey" PRIMARY KEY (business_profile_id, category_slug, asset_role),
  CONSTRAINT "carousel_image_rotation_pools_last_asset_id_fkey" FOREIGN KEY (last_asset_id) REFERENCES public.category_image_assets(id) ON DELETE SET NULL
);

ALTER TABLE "public"."carousel_image_rotation_pools"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."carousel_image_rotation_pools" TO "postgres", "service_role";


-- source: public/tables/hook_video_drafts.sql
CREATE TABLE "public"."hook_video_drafts" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                 text                     NOT NULL,
  "influencer_id"           text                     NOT NULL,
  "influencer_video_id"     text                     NOT NULL,
  "influencer_source"       text                     NOT NULL,
  "influencer_name"         text                     NOT NULL,
  "influencer_video_title"  text                     NOT NULL,
  "demo_asset_id"           uuid                     NOT NULL,
  "demo_title"              text                     NOT NULL,
  "selected_hook_id"        uuid                     NOT NULL,
  "hook_text"               text                     NOT NULL,
  "trim_start"              numeric                  NOT NULL DEFAULT 0,
  "trim_end"                numeric,
  "preview_thumbnail_url"   text,
  "status"                  text                     NOT NULL DEFAULT 'draft'::text,
  "scheduled_post_id"       uuid,
  "library_saved_at"        timestamp with time zone,
  "metadata"                jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "render_id"               uuid,
  "render_job_id"           uuid,
  "render_status"           text                     NOT NULL DEFAULT 'not_requested'::text,
  "render_fingerprint"      text,
  "rendered_media_asset_id" uuid,
  "rendered_video_url"      text,
  "render_error"            text,
  "render_requested_at"     timestamp with time zone,
  "rendered_at"             timestamp with time zone,
  CONSTRAINT "hook_video_drafts_demo_title_check" CHECK (((char_length(TRIM(BOTH FROM demo_title)) >= 1) AND (char_length(TRIM(BOTH FROM demo_title)) <= 180))),
  CONSTRAINT "hook_video_drafts_hook_text_check" CHECK (((char_length(TRIM(BOTH FROM hook_text)) >= 1) AND (char_length(TRIM(BOTH FROM hook_text)) <= 220))),
  CONSTRAINT "hook_video_drafts_influencer_name_check" CHECK (((char_length(TRIM(BOTH FROM influencer_name)) >= 1) AND (char_length(TRIM(BOTH FROM influencer_name)) <= 140))),
  CONSTRAINT "hook_video_drafts_influencer_source_check" CHECK ((influencer_source = ANY (ARRAY['catalog'::text, 'user'::text]))),
  CONSTRAINT "hook_video_drafts_influencer_video_title_check"
    CHECK (((char_length(TRIM(BOTH FROM influencer_video_title)) >= 1) AND (char_length(TRIM(BOTH FROM influencer_video_title)) <= 180))),
  CONSTRAINT "hook_video_drafts_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text)),
  CONSTRAINT "hook_video_drafts_pkey" PRIMARY KEY (id),
  CONSTRAINT "hook_video_drafts_render_job_id_fkey" FOREIGN KEY (render_job_id) REFERENCES public.background_jobs(id) ON DELETE SET NULL,
  CONSTRAINT "hook_video_drafts_render_status_check" CHECK ((render_status = ANY (ARRAY['not_requested'::text, 'queued'::text, 'rendering'::text, 'ready'::text, 'failed'::text]))),
  CONSTRAINT "hook_video_drafts_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'saved'::text, 'scheduled'::text]))),
  CONSTRAINT "hook_video_drafts_trim_check" CHECK (((trim_end IS NULL) OR (trim_end > trim_start))),
  CONSTRAINT "hook_video_drafts_trim_start_check" CHECK ((trim_start >= (0)::numeric)),
  CONSTRAINT "hook_video_drafts_selected_hook_id_fkey" FOREIGN KEY (selected_hook_id) REFERENCES public.hook_video_suggestions(id) ON DELETE RESTRICT,
  CONSTRAINT "hook_video_drafts_demo_asset_id_fkey" FOREIGN KEY (demo_asset_id) REFERENCES public.media_assets(id) ON DELETE RESTRICT,
  CONSTRAINT "hook_video_drafts_rendered_media_asset_id_fkey" FOREIGN KEY (rendered_media_asset_id) REFERENCES public.media_assets(id) ON DELETE SET NULL,
  CONSTRAINT "hook_video_drafts_scheduled_post_fk" FOREIGN KEY (scheduled_post_id) REFERENCES public.scheduled_posts(id) ON DELETE SET NULL
);

ALTER TABLE "public"."hook_video_drafts"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX hook_video_drafts_demo_idx ON public.hook_video_drafts USING btree (demo_asset_id);

CREATE UNIQUE INDEX hook_video_drafts_render_id_uidx ON public.hook_video_drafts USING btree (render_id)
  WHERE (render_id IS NOT NULL);

CREATE INDEX hook_video_drafts_render_job_idx ON public.hook_video_drafts USING btree (render_job_id)
  WHERE (render_job_id IS NOT NULL);

CREATE INDEX hook_video_drafts_rendered_media_idx ON public.hook_video_drafts USING btree (rendered_media_asset_id)
  WHERE (rendered_media_asset_id IS NOT NULL);

CREATE INDEX hook_video_drafts_schedule_idx ON public.hook_video_drafts USING btree (scheduled_post_id)
  WHERE (scheduled_post_id IS NOT NULL);

CREATE INDEX hook_video_drafts_selected_hook_idx ON public.hook_video_drafts USING btree (selected_hook_id);

CREATE UNIQUE INDEX hook_video_drafts_unique_schedule_idx ON public.hook_video_drafts USING btree (scheduled_post_id)
  WHERE (scheduled_post_id IS NOT NULL);

CREATE INDEX hook_video_drafts_user_library_idx ON public.hook_video_drafts USING btree (user_id, library_saved_at DESC)
  WHERE (library_saved_at IS NOT NULL);

CREATE INDEX hook_video_drafts_user_updated_idx ON public.hook_video_drafts USING btree (user_id, updated_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hook_video_drafts" TO "postgres", "service_role";


-- source: public/tables/trending_hook_generation_run_chunks.sql
CREATE TABLE "public"."trending_hook_generation_run_chunks" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "run_id"            uuid                     NOT NULL,
  "chunk_number"      integer                  NOT NULL,
  "background_job_id" uuid,
  "candidate_count"   integer                  NOT NULL,
  "accepted_count"    integer                  NOT NULL DEFAULT 0,
  "rejected_count"    integer                  NOT NULL DEFAULT 0,
  "status"            text                     NOT NULL DEFAULT 'reserved'::text,
  "last_error"        text,
  "completed_at"      timestamp with time zone,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "trending_hook_generation_run_chunks_accepted_count_check" CHECK ((accepted_count >= 0)),
  CONSTRAINT "trending_hook_generation_run_chunks_background_job_id_fkey" FOREIGN KEY (background_job_id) REFERENCES public.background_jobs(id) ON DELETE SET NULL,
  CONSTRAINT "trending_hook_generation_run_chunks_background_job_id_key" UNIQUE (background_job_id),
  CONSTRAINT "trending_hook_generation_run_chunks_candidate_count_check" CHECK (((candidate_count >= 1) AND (candidate_count <= 12))),
  CONSTRAINT "trending_hook_generation_run_chunks_chunk_number_check" CHECK ((chunk_number >= 1)),
  CONSTRAINT "trending_hook_generation_run_chunks_pkey" PRIMARY KEY (id),
  CONSTRAINT "trending_hook_generation_run_chunks_rejected_count_check" CHECK ((rejected_count >= 0)),
  CONSTRAINT "trending_hook_generation_run_chunks_run_id_chunk_number_key" UNIQUE (run_id, chunk_number),
  CONSTRAINT "trending_hook_generation_run_chunks_status_check" CHECK ((status = ANY (ARRAY['reserved'::text, 'completed'::text, 'failed'::text]))),
  CONSTRAINT "trending_hook_generation_run_chunks_run_id_fkey" FOREIGN KEY (run_id) REFERENCES public.trending_hook_generation_runs(id) ON DELETE CASCADE
);

ALTER TABLE "public"."trending_hook_generation_run_chunks"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX trending_hook_generation_run_chunks_active_idx ON public.trending_hook_generation_run_chunks USING btree (run_id, created_at DESC)
  WHERE (status = 'reserved'::text);

CREATE TRIGGER complete_trending_hook_generation_chunk_dispatch
  AFTER UPDATE OF background_job_id, status ON public.trending_hook_generation_run_chunks
  FOR EACH ROW
  WHEN (((new.background_job_id IS NOT NULL) OR (new.status <> 'reserved'::text)))
  EXECUTE FUNCTION public.complete_trending_hook_generation_chunk_dispatch_trigger_v1();

CREATE TRIGGER enqueue_trending_hook_generation_chunk_dispatch
  AFTER INSERT ON public.trending_hook_generation_run_chunks
  FOR EACH ROW
  WHEN ((new.status = 'reserved'::text))
  EXECUTE FUNCTION public.enqueue_trending_hook_generation_chunk_dispatch_v1();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."trending_hook_generation_run_chunks" TO "postgres", "service_role";


-- source: public/tables/user_hook_video_assignments.sql
CREATE TABLE "public"."user_hook_video_assignments" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                  text                     NOT NULL,
  "business_profile_id"      uuid                     NOT NULL,
  "business_profile_version" integer                  NOT NULL,
  "hook_suggestion_id"       uuid                     NOT NULL,
  "position"                 integer                  NOT NULL,
  "state"                    text                     NOT NULL DEFAULT 'active'::text,
  "last_opened_at"           timestamp with time zone,
  "completed_at"             timestamp with time zone,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_hook_video_assignments_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  CONSTRAINT "user_hook_video_assignments_business_profile_version_check" CHECK ((business_profile_version > 0)),
  CONSTRAINT "user_hook_video_assignments_hook_suggestion_id_fkey" FOREIGN KEY (hook_suggestion_id) REFERENCES public.hook_video_suggestions(id) ON DELETE CASCADE,
  CONSTRAINT "user_hook_video_assignments_pkey" PRIMARY KEY (id),
  CONSTRAINT "user_hook_video_assignments_position_check" CHECK (("position" >= 0)),
  CONSTRAINT "user_hook_video_assignments_state_check" CHECK ((state = ANY (ARRAY['active'::text, 'completed_skipped'::text, 'selected'::text, 'superseded'::text]))),
  CONSTRAINT "user_hook_video_assignments_user_id_hook_suggestion_id_key" UNIQUE (user_id, hook_suggestion_id)
);

ALTER TABLE "public"."user_hook_video_assignments"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX user_hook_video_assignments_active_profile_idx ON public.user_hook_video_assignments USING btree (user_id, business_profile_id, business_profile_version, "position")
  WHERE (state = 'active'::text);

CREATE INDEX user_hook_video_assignments_business_profile_idx ON public.user_hook_video_assignments USING btree (business_profile_id);

CREATE INDEX user_hook_video_assignments_hook_suggestion_idx ON public.user_hook_video_assignments USING btree (hook_suggestion_id);

CREATE TRIGGER preserve_current_daily_hook_assignment_on_supersede
  BEFORE UPDATE OF state ON public.user_hook_video_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_current_daily_hook_assignment_on_supersede();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_hook_video_assignments" TO "postgres", "service_role";


-- source: public/tables/user_wall_text_assignments.sql
CREATE TABLE "public"."user_wall_text_assignments" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                  text                     NOT NULL,
  "business_profile_id"      uuid                     NOT NULL,
  "business_profile_version" integer                  NOT NULL,
  "wall_text_creative_id"    uuid                     NOT NULL,
  "position"                 integer                  NOT NULL,
  "state"                    text                     NOT NULL DEFAULT 'active'::text,
  "last_opened_at"           timestamp with time zone,
  "completed_at"             timestamp with time zone,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "render_edit_id"           uuid,
  "render_edit_revision"     integer,
  "render_id"                uuid,
  "render_job_id"            uuid,
  "render_status"            text                     NOT NULL DEFAULT 'not_requested'::text,
  "rendered_media_asset_id"  uuid,
  "render_error"             text,
  "render_requested_at"      timestamp with time zone,
  "rendered_at"              timestamp with time zone,
  CONSTRAINT "user_wall_text_assignments_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  CONSTRAINT "user_wall_text_assignments_business_profile_version_check" CHECK ((business_profile_version > 0)),
  CONSTRAINT "user_wall_text_assignments_creative_key" UNIQUE (user_id, wall_text_creative_id),
  CONSTRAINT "user_wall_text_assignments_pkey" PRIMARY KEY (id),
  CONSTRAINT "user_wall_text_assignments_position_check" CHECK ((("position" >= 0) AND ("position" < 1000000))),
  CONSTRAINT "user_wall_text_assignments_render_edit_check" CHECK ((((render_edit_id IS NULL) AND (render_edit_revision IS NULL)) OR ((render_edit_id IS
    NOT NULL) AND (render_edit_revision IS NOT NULL) AND (render_edit_revision > 0)))),
  CONSTRAINT "user_wall_text_assignments_render_edit_id_fkey" FOREIGN KEY (render_edit_id) REFERENCES public.trending_creative_edits(id) ON DELETE RESTRICT,
  CONSTRAINT "user_wall_text_assignments_render_job_id_fkey" FOREIGN KEY (render_job_id) REFERENCES public.background_jobs(id) ON DELETE SET NULL,
  CONSTRAINT "user_wall_text_assignments_render_status_check"
    CHECK ((render_status = ANY (ARRAY['not_requested'::text, 'queued'::text, 'rendering'::text, 'ready'::text, 'failed'::text]))),
  CONSTRAINT "user_wall_text_assignments_rendered_media_asset_id_fkey" FOREIGN KEY (rendered_media_asset_id) REFERENCES public.media_assets(id) ON DELETE SET NULL,
  CONSTRAINT "user_wall_text_assignments_state_check" CHECK ((state = ANY (ARRAY['active'::text, 'completed_skipped'::text, 'selected'::text]))),
  CONSTRAINT "user_wall_text_assignments_user_id_check" CHECK ((char_length(TRIM(BOTH FROM user_id)) > 0)),
  CONSTRAINT "user_wall_text_assignments_wall_text_creative_id_fkey" FOREIGN KEY (wall_text_creative_id) REFERENCES public.wall_text_creatives(id) ON DELETE CASCADE
);

ALTER TABLE "public"."user_wall_text_assignments"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX user_wall_text_assignments_active_idx ON public.user_wall_text_assignments USING btree (user_id, business_profile_id, business_profile_version, state, "position")
  WHERE (state = 'active'::text);

CREATE INDEX user_wall_text_assignments_business_profile_idx ON public.user_wall_text_assignments USING btree (business_profile_id);

CREATE INDEX user_wall_text_assignments_creative_idx ON public.user_wall_text_assignments USING btree (wall_text_creative_id);

CREATE INDEX user_wall_text_assignments_render_edit_idx ON public.user_wall_text_assignments USING btree (render_edit_id)
  WHERE (render_edit_id IS NOT NULL);

CREATE UNIQUE INDEX user_wall_text_assignments_render_id_uidx ON public.user_wall_text_assignments USING btree (render_id)
  WHERE (render_id IS NOT NULL);

CREATE INDEX user_wall_text_assignments_render_job_idx ON public.user_wall_text_assignments USING btree (render_job_id)
  WHERE (render_job_id IS NOT NULL);

CREATE INDEX user_wall_text_assignments_rendered_media_idx ON public.user_wall_text_assignments USING btree (rendered_media_asset_id)
  WHERE (rendered_media_asset_id IS NOT NULL);

CREATE INDEX user_wall_text_assignments_selected_idx ON public.user_wall_text_assignments USING btree (user_id, state, updated_at DESC)
  WHERE (state = 'selected'::text);

CREATE TRIGGER track_wall_text_asset_assignment_trigger
  AFTER INSERT ON public.user_wall_text_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.track_wall_text_asset_assignment();

CREATE TRIGGER validate_wall_text_assignment_trigger
  BEFORE INSERT OR UPDATE OF user_id, business_profile_id, business_profile_version, wall_text_creative_id ON public.user_wall_text_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_wall_text_assignment();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_wall_text_assignments" TO "postgres", "service_role";


-- source: public/tables/wall_text_audio_selections.sql
CREATE TABLE "public"."wall_text_audio_selections" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                 text                     NOT NULL,
  "wall_text_creative_id"   uuid                     NOT NULL,
  "creative_edit_id"        uuid,
  "creative_edit_revision"  integer,
  "content_fingerprint"     text                     NOT NULL,
  "video_duration_seconds"  numeric(10,3)            NOT NULL,
  "audio_asset_id"          text                     NOT NULL,
  "audio_intent"            jsonb                    NOT NULL,
  "fit_mode"                text                     NOT NULL,
  "cue_start_seconds"       numeric(10,3)            NOT NULL,
  "output_duration_seconds" numeric(10,3)            NOT NULL,
  "fade_out_seconds"        numeric(5,3)             NOT NULL DEFAULT 0.2,
  "match_score"             numeric(5,4)             NOT NULL,
  "matching_version"        text                     NOT NULL,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "wall_text_audio_selections_audio_asset_id_fkey" FOREIGN KEY (audio_asset_id) REFERENCES public.wall_audio_assets(id) ON DELETE RESTRICT,
  CONSTRAINT "wall_text_audio_selections_content_fingerprint_check" CHECK ((content_fingerprint ~ '^[a-f0-9]{64}$'::text)),
  CONSTRAINT "wall_text_audio_selections_creative_edit_id_fkey" FOREIGN KEY (creative_edit_id) REFERENCES public.trending_creative_edits(id) ON DELETE CASCADE,
  CONSTRAINT "wall_text_audio_selections_creative_edit_revision_check" CHECK (((creative_edit_revision IS NULL) OR (creative_edit_revision > 0))),
  CONSTRAINT "wall_text_audio_selections_cue_start_seconds_check" CHECK ((cue_start_seconds >= (0)::numeric)),
  CONSTRAINT "wall_text_audio_selections_duration_snapshot_check" CHECK ((abs((output_duration_seconds - video_duration_seconds)) <= 0.001)),
  CONSTRAINT "wall_text_audio_selections_edit_scope_check" CHECK ((((creative_edit_id IS NULL) AND (creative_edit_revision IS NULL)) OR ((creative_edit_id IS
    NOT NULL) AND (creative_edit_revision IS NOT NULL)))),
  CONSTRAINT "wall_text_audio_selections_fade_out_seconds_check" CHECK (((fade_out_seconds >= (0)::numeric) AND (fade_out_seconds <= (1)::numeric))),
  CONSTRAINT "wall_text_audio_selections_fit_mode_check" CHECK ((fit_mode = ANY (ARRAY['exact'::text, 'trim'::text, 'loop'::text]))),
  CONSTRAINT "wall_text_audio_selections_intent_check"
    CHECK
    (COALESCE(((jsonb_typeof(audio_intent) = 'object'::text) AND (jsonb_typeof((audio_intent -> 'moods'::text)) = 'array'::text) AND ((jsonb_array_length((audio_intent ->
    'moods'::text)) >= 1) AND (jsonb_array_length((audio_intent -> 'moods'::text)) <= 3)) AND (jsonb_typeof((audio_intent -> 'messageTypes'::text)) = 'array'::text) AND
    ((jsonb_array_length((audio_intent -> 'messageTypes'::text)) >= 1) AND (jsonb_array_length((audio_intent -> 'messageTypes'::text)) <= 3)) AND
    ((audio_intent ->> 'energy'::text) = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))), false)),
  CONSTRAINT "wall_text_audio_selections_match_score_check" CHECK (((match_score >= (0)::numeric) AND (match_score <= (1)::numeric))),
  CONSTRAINT "wall_text_audio_selections_matching_version_check" CHECK ((char_length(btrim(matching_version)) > 0)),
  CONSTRAINT "wall_text_audio_selections_output_duration_seconds_check" CHECK (((output_duration_seconds > (0)::numeric) AND (output_duration_seconds <= (60)::numeric))),
  CONSTRAINT "wall_text_audio_selections_pkey" PRIMARY KEY (id),
  CONSTRAINT "wall_text_audio_selections_user_id_check" CHECK (((char_length(btrim(user_id)) > 0) AND (char_length(btrim(user_id)) <= 200))),
  CONSTRAINT "wall_text_audio_selections_video_duration_seconds_check" CHECK (((video_duration_seconds > (0)::numeric) AND (video_duration_seconds <= (60)::numeric))),
  CONSTRAINT "wall_text_audio_selections_wall_text_creative_id_fkey" FOREIGN KEY (wall_text_creative_id) REFERENCES public.wall_text_creatives(id) ON DELETE CASCADE
);

ALTER TABLE "public"."wall_text_audio_selections"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX wall_text_audio_selections_asset_idx ON public.wall_text_audio_selections USING btree (audio_asset_id);

CREATE UNIQUE INDEX wall_text_audio_selections_base_uidx ON public.wall_text_audio_selections USING btree (user_id, wall_text_creative_id)
  WHERE (creative_edit_id IS NULL);

CREATE INDEX wall_text_audio_selections_creative_idx ON public.wall_text_audio_selections USING btree (wall_text_creative_id);

CREATE INDEX wall_text_audio_selections_edit_idx ON public.wall_text_audio_selections USING btree (creative_edit_id)
  WHERE (creative_edit_id IS NOT NULL);

CREATE UNIQUE INDEX wall_text_audio_selections_edit_uidx ON public.wall_text_audio_selections USING btree (user_id, creative_edit_id, creative_edit_revision)
  WHERE (creative_edit_id IS NOT NULL);

CREATE INDEX wall_text_audio_selections_recent_user_idx ON public.wall_text_audio_selections USING btree (user_id, updated_at DESC, audio_asset_id);

CREATE TRIGGER validate_wall_text_audio_selection_row
  BEFORE INSERT OR UPDATE ON public.wall_text_audio_selections
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_wall_text_audio_selection();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wall_text_audio_selections" TO "postgres", "service_role";


-- source: public/tables/wall_text_content_history.sql
CREATE TABLE "public"."wall_text_content_history" (
  "id"                           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                      text                     NOT NULL,
  "business_profile_id"          uuid                     NOT NULL,
  "wall_text_creative_id"        uuid                     NOT NULL,
  "creative_edit_id"             uuid,
  "creative_edit_revision"       integer,
  "normalized_text"              text                     NOT NULL,
  "content_hash"                 text                     NOT NULL,
  "normalization_version"        text                     NOT NULL,
  "similarity_signature"         jsonb                    NOT NULL,
  "similarity_version"           text                     NOT NULL,
  "format_id"                    text,
  "format_version"               integer,
  "format_attribution"           text                     NOT NULL,
  "performance_eligible"         boolean                  NOT NULL,
  "performance_exclusion_reason" text,
  "created_at"                   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "wall_text_content_history_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  CONSTRAINT "wall_text_content_history_content_hash_check" CHECK ((content_hash ~ '^[a-f0-9]{64}$'::text)),
  CONSTRAINT "wall_text_content_history_creative_edit_id_fkey" FOREIGN KEY (creative_edit_id) REFERENCES public.trending_creative_edits(id) ON DELETE CASCADE,
  CONSTRAINT "wall_text_content_history_edit_scope_chk" CHECK ((((creative_edit_id IS NULL) AND (creative_edit_revision IS NULL)) OR ((creative_edit_id IS
    NOT NULL) AND (creative_edit_revision > 0)))),
  CONSTRAINT "wall_text_content_history_exact_duplicate_key" UNIQUE (user_id, business_profile_id, content_hash),
  CONSTRAINT "wall_text_content_history_format_attribution_check"
    CHECK ((format_attribution = ANY (ARRAY['original'::text, 'minor_edit'::text, 'major_edit'::text, 'manual_custom'::text, 'legacy_unknown'::text]))),
  CONSTRAINT "wall_text_content_history_normalized_text_check" CHECK ((char_length(normalized_text) > 0)),
  CONSTRAINT "wall_text_content_history_performance_chk"
    CHECK (((performance_eligible AND (format_attribution = ANY (ARRAY['original'::text, 'minor_edit'::text]))) OR (NOT performance_eligible))),
  CONSTRAINT "wall_text_content_history_pkey" PRIMARY KEY (id),
  CONSTRAINT "wall_text_content_history_user_id_check" CHECK ((char_length(btrim(user_id)) > 0)),
  CONSTRAINT "wall_text_content_history_wall_text_creative_id_fkey" FOREIGN KEY (wall_text_creative_id) REFERENCES public.wall_text_creatives(id) ON DELETE CASCADE
);

ALTER TABLE "public"."wall_text_content_history"
  ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX wall_text_content_history_base_uidx ON public.wall_text_content_history USING btree (wall_text_creative_id)
  WHERE (creative_edit_id IS NULL);

CREATE UNIQUE INDEX wall_text_content_history_edit_uidx ON public.wall_text_content_history USING btree (creative_edit_id, creative_edit_revision)
  WHERE (creative_edit_id IS NOT NULL);

CREATE INDEX wall_text_content_history_profile_recent_idx ON public.wall_text_content_history USING btree (user_id, business_profile_id, created_at DESC);

CREATE TRIGGER wall_text_content_history_freeform_learning_guard
  BEFORE INSERT OR UPDATE OF format_id, performance_eligible ON public.wall_text_content_history
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_freeform_wall_text_format_learning();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wall_text_content_history" TO "postgres", "service_role";


-- source: public/tables/wall_text_content_plan_briefs.sql
CREATE TABLE "public"."wall_text_content_plan_briefs" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "plan_id"                 uuid                     NOT NULL,
  "user_id"                 text                     NOT NULL,
  "brief_index"             smallint                 NOT NULL,
  "creative_seed"           text                     NOT NULL,
  "audience_context"        text                     NOT NULL,
  "human_moment"            text                     NOT NULL,
  "emotional_tension"       text                     NOT NULL,
  "supported_angle"         text                     NOT NULL,
  "preferred_format_family" text                     NOT NULL,
  "brief_fingerprint"       text                     NOT NULL,
  "created_at"              timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "wall_text_content_plan_briefs_audience_context_check" CHECK (((char_length(btrim(audience_context)) >= 2) AND (char_length(btrim(audience_context)) <= 240))),
  CONSTRAINT "wall_text_content_plan_briefs_brief_fingerprint_check" CHECK ((brief_fingerprint ~ '^[a-f0-9]{64}$'::text)),
  CONSTRAINT "wall_text_content_plan_briefs_brief_index_check" CHECK (((brief_index >= 1) AND (brief_index <= 40))),
  CONSTRAINT "wall_text_content_plan_briefs_creative_seed_check" CHECK (((char_length(btrim(creative_seed)) >= 12) AND (char_length(btrim(creative_seed)) <= 400))),
  CONSTRAINT "wall_text_content_plan_briefs_emotional_tension_check" CHECK (((char_length(btrim(emotional_tension)) >= 2) AND (char_length(btrim(emotional_tension)) <= 160))),
  CONSTRAINT "wall_text_content_plan_briefs_human_moment_check" CHECK (((char_length(btrim(human_moment)) >= 12) AND (char_length(btrim(human_moment)) <= 400))),
  CONSTRAINT "wall_text_content_plan_briefs_id_plan_id_user_id_key" UNIQUE (id, plan_id, user_id),
  CONSTRAINT "wall_text_content_plan_briefs_pkey" PRIMARY KEY (id),
  CONSTRAINT "wall_text_content_plan_briefs_plan_id_brief_fingerprint_key" UNIQUE (plan_id, brief_fingerprint),
  CONSTRAINT "wall_text_content_plan_briefs_plan_id_brief_index_key" UNIQUE (plan_id, brief_index),
  CONSTRAINT "wall_text_content_plan_briefs_preferred_format_family_check"
    CHECK
    ((preferred_format_family = ANY (ARRAY['common_problem'::text, 'contrast'::text, 'emotional_observation'::text, 'freeform'::text, 'practical_reframe'::text,
    'relatable_situation'::text, 'small_story'::text]))),
  CONSTRAINT "wall_text_content_plan_briefs_supported_angle_check" CHECK (((char_length(btrim(supported_angle)) >= 12) AND (char_length(btrim(supported_angle)) <= 400))),
  CONSTRAINT "wall_text_content_plan_briefs_user_id_check" CHECK (((char_length(btrim(user_id)) >= 1) AND (char_length(btrim(user_id)) <= 240))),
  CONSTRAINT "wall_text_content_plan_briefs_plan_id_user_id_fkey" FOREIGN KEY (plan_id, user_id) REFERENCES public.wall_text_content_plans(id, user_id) ON DELETE CASCADE
);

ALTER TABLE "public"."wall_text_content_plan_briefs"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX wall_text_content_plan_briefs_plan_idx ON public.wall_text_content_plan_briefs USING btree (plan_id, brief_index);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wall_text_content_plan_briefs" TO "postgres", "service_role";

COMMENT ON TABLE "public"."wall_text_content_plan_briefs" IS 'Private six-field Wall-of-Text creative context. One brief guides five different child ideas and never becomes rendered overlay text.';


-- source: public/tables/wall_text_generation_chunks.sql
CREATE TABLE "public"."wall_text_generation_chunks" (
  "id"                          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "batch_id"                    uuid                     NOT NULL,
  "chunk_index"                 integer                  NOT NULL,
  "first_batch_candidate_index" integer                  NOT NULL,
  "candidate_count"             integer                  NOT NULL,
  "idempotency_key"             text                     NOT NULL,
  "request_hash"                text                     NOT NULL,
  "status"                      text                     NOT NULL DEFAULT 'pending'::text,
  "attempt_count"               integer                  NOT NULL DEFAULT 0,
  "content_retry_count"         integer                  NOT NULL DEFAULT 0,
  "claim_token"                 uuid,
  "locked_at"                   timestamp with time zone,
  "completed_at"                timestamp with time zone,
  "last_error_code"             text,
  "last_error_message"          text,
  "created_at"                  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "wall_text_generation_chunks_attempt_count_check" CHECK ((attempt_count >= 0)),
  CONSTRAINT "wall_text_generation_chunks_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES public.wall_text_generation_batches(id) ON DELETE CASCADE,
  CONSTRAINT "wall_text_generation_chunks_batch_index_key" UNIQUE (batch_id, chunk_index),
  CONSTRAINT "wall_text_generation_chunks_candidate_count_check" CHECK (((candidate_count >= 1) AND (candidate_count <= 10))),
  CONSTRAINT "wall_text_generation_chunks_chunk_index_check" CHECK ((chunk_index >= 0)),
  CONSTRAINT "wall_text_generation_chunks_content_retry_count_check" CHECK (((content_retry_count >= 0) AND (content_retry_count <= 1))),
  CONSTRAINT "wall_text_generation_chunks_first_batch_candidate_index_check" CHECK ((first_batch_candidate_index >= 0)),
  CONSTRAINT "wall_text_generation_chunks_idempotency_key_key" UNIQUE (idempotency_key),
  CONSTRAINT "wall_text_generation_chunks_pkey" PRIMARY KEY (id),
  CONSTRAINT "wall_text_generation_chunks_request_hash_check" CHECK ((request_hash ~ '^[a-f0-9]{64}$'::text)),
  CONSTRAINT "wall_text_generation_chunks_status_check"
    CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'retry_pending'::text, 'completed'::text, 'failed'::text])))
);

ALTER TABLE "public"."wall_text_generation_chunks"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX wall_text_generation_chunks_status_idx ON public.wall_text_generation_chunks USING btree (status, created_at);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wall_text_generation_chunks" TO "postgres", "service_role";


-- source: public/tables/carousel_content_plan_items.sql
CREATE TABLE "public"."carousel_content_plan_items" (
  "id"                                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "plan_id"                            uuid                     NOT NULL,
  "user_id"                            text                     NOT NULL,
  "sequence_index"                     integer                  NOT NULL,
  "day_number"                         smallint                 NOT NULL,
  "day_slot_index"                     integer                  NOT NULL,
  "creative_seed"                      text                     NOT NULL,
  "emotion"                            text                     NOT NULL,
  "seed_fingerprint"                   text                     NOT NULL,
  "status"                             text                     NOT NULL DEFAULT 'planned'::text,
  "reservation_token"                  uuid,
  "reservation_key"                    text,
  "reserved_by_job_id"                 uuid,
  "reserved_at"                        timestamp with time zone,
  "reservation_expires_at"             timestamp with time zone,
  "consumed_by_carousel_generation_id" uuid,
  "consumed_at"                        timestamp with time zone,
  "retired_at"                         timestamp with time zone,
  "retirement_reason"                  text,
  "created_at"                         timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"                         timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "creative_brief_id"                  uuid,
  CONSTRAINT "carousel_content_plan_items_check1"
    CHECK
    ((((status = ANY (ARRAY['planned'::text, 'available'::text])) AND (reservation_token IS NULL) AND (reservation_key IS NULL) AND (reserved_by_job_id IS NULL) AND (reserved_at IS
    NULL) AND (reservation_expires_at IS NULL) AND (consumed_by_carousel_generation_id IS NULL) AND (consumed_at IS NULL) AND (retired_at IS NULL) AND (retirement_reason IS NULL))
    OR ((status = 'reserved'::text) AND (reservation_token IS NOT NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE(reservation_key, ''::text)), ''::text) IS NOT NULL) AND (reserved_at IS
    NOT NULL) AND (reservation_expires_at IS
    NOT NULL) AND (consumed_by_carousel_generation_id IS NULL) AND (consumed_at IS NULL) AND (retired_at IS NULL) AND (retirement_reason IS NULL)) OR
    ((status = 'consumed'::text) AND (reservation_token IS NOT NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE(reservation_key, ''::text)), ''::text) IS NOT NULL) AND (reserved_at IS
    NOT NULL) AND (reservation_expires_at IS NOT NULL) AND (consumed_by_carousel_generation_id IS NOT NULL) AND (consumed_at IS
    NOT NULL) AND (retired_at IS NULL) AND (retirement_reason IS NULL)) OR
    ((status = 'retired'::text) AND (reservation_token IS NULL) AND (reservation_key IS NULL) AND (reserved_by_job_id IS NULL) AND (reserved_at IS NULL) AND (reservation_expires_at
    IS NULL) AND (consumed_by_carousel_generation_id IS NULL) AND (consumed_at IS NULL) AND (retired_at IS
    NOT NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE(retirement_reason, ''::text)), ''::text) IS NOT NULL)))),
  CONSTRAINT "carousel_content_plan_items_check" CHECK (((reservation_expires_at IS NULL) OR (reserved_at IS NULL) OR (reservation_expires_at > reserved_at))),
  CONSTRAINT "carousel_content_plan_items_creative_brief_fkey" FOREIGN KEY (creative_brief_id, plan_id, user_id)
    REFERENCES public.carousel_content_plan_briefs(id, plan_id, user_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "carousel_content_plan_items_creative_seed_check" CHECK (((char_length(TRIM(BOTH FROM creative_seed)) >= 1) AND (char_length(TRIM(BOTH FROM creative_seed)) <= 2000))),
  CONSTRAINT "carousel_content_plan_items_day_number_check" CHECK (((day_number >= 1) AND (day_number <= 30))),
  CONSTRAINT "carousel_content_plan_items_day_slot_index_check" CHECK ((day_slot_index > 0)),
  CONSTRAINT "carousel_content_plan_items_emotion_check" CHECK (((char_length(TRIM(BOTH FROM emotion)) >= 1) AND (char_length(TRIM(BOTH FROM emotion)) <= 240))),
  CONSTRAINT "carousel_content_plan_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "carousel_content_plan_items_plan_id_day_number_day_slot_ind_key" UNIQUE (plan_id, day_number, day_slot_index),
  CONSTRAINT "carousel_content_plan_items_plan_id_seed_fingerprint_key" UNIQUE (plan_id, seed_fingerprint),
  CONSTRAINT "carousel_content_plan_items_plan_id_sequence_index_key" UNIQUE (plan_id, sequence_index),
  CONSTRAINT "carousel_content_plan_items_reservation_key_check"
    CHECK (((reservation_key IS NULL) OR ((char_length(TRIM(BOTH FROM reservation_key)) >= 1) AND (char_length(TRIM(BOTH FROM reservation_key)) <= 240)))),
  CONSTRAINT "carousel_content_plan_items_reserved_by_job_id_fkey" FOREIGN KEY (reserved_by_job_id) REFERENCES public.background_jobs(id) ON DELETE SET NULL,
  CONSTRAINT "carousel_content_plan_items_seed_fingerprint_check" CHECK ((seed_fingerprint ~ '^[0-9a-f]{64}$'::text)),
  CONSTRAINT "carousel_content_plan_items_sequence_index_check" CHECK ((sequence_index > 0)),
  CONSTRAINT "carousel_content_plan_items_status_check" CHECK ((status = ANY (ARRAY['planned'::text, 'available'::text, 'reserved'::text, 'consumed'::text, 'retired'::text]))),
  CONSTRAINT "carousel_content_plan_items_user_id_check" CHECK (((char_length(TRIM(BOTH FROM user_id)) >= 1) AND (char_length(TRIM(BOTH FROM user_id)) <= 240))),
  CONSTRAINT "carousel_content_plan_items_reservation_fk" FOREIGN KEY (reservation_token) REFERENCES public.carousel_content_plan_reservations(id) ON DELETE RESTRICT DEFERRABLE
    INITIALLY DEFERRED,
  CONSTRAINT "carousel_content_plan_items_plan_id_user_id_fkey" FOREIGN KEY (plan_id, user_id) REFERENCES public.carousel_content_plans(id, user_id) ON DELETE CASCADE
);

ALTER TABLE "public"."carousel_content_plan_items"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX carousel_content_plan_items_available_idx ON public.carousel_content_plan_items USING btree (plan_id, sequence_index)
  WHERE (status = 'available'::text);

CREATE UNIQUE INDEX carousel_content_plan_items_consumed_generation_uidx ON public.carousel_content_plan_items USING btree (consumed_by_carousel_generation_id)
  WHERE (consumed_by_carousel_generation_id IS NOT NULL);

CREATE INDEX carousel_content_plan_items_creative_brief_idx ON public.carousel_content_plan_items USING btree (creative_brief_id)
  WHERE (creative_brief_id IS NOT NULL);

CREATE UNIQUE INDEX carousel_content_plan_items_provenance_uidx ON public.carousel_content_plan_items USING btree (id, plan_id, user_id);

CREATE INDEX carousel_content_plan_items_reservation_expiry_idx ON public.carousel_content_plan_items USING btree (reservation_expires_at, plan_id)
  WHERE (status = 'reserved'::text);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."carousel_content_plan_items" TO "postgres";

COMMENT ON COLUMN "public"."carousel_content_plan_items"."creative_brief_id" IS 'Private parent brief that may inform final writing; legacy items remain null and keep their original seed-plus-emotion behavior.';

COMMENT ON COLUMN "public"."carousel_content_plan_items"."creative_seed" IS 'Broad, open-ended creative starting thought. It must not prewrite a slide story.';

COMMENT ON COLUMN "public"."carousel_content_plan_items"."day_number" IS 'Organizational 1-30 grouping only. It does not impose a daily consumption limit.';

COMMENT ON COLUMN "public"."carousel_content_plan_items"."emotion" IS 'Required emotional undercurrent for the writer, not a required literal phrase or fixed plot.';

COMMENT ON COLUMN "public"."carousel_content_plan_items"."seed_fingerprint" IS 'System-only normalized SHA-256 duplicate key. It is not part of the creative prompt payload.';

REVOKE ALL ON TABLE "public"."carousel_content_plan_items" FROM "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."carousel_content_plan_items" TO "service_role";


-- source: public/tables/carousel_generations.sql
CREATE TABLE "public"."carousel_generations" (
  "id"                                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                           text                     NOT NULL,
  "project_id"                        text                     NOT NULL,
  "website_analysis_id"               uuid,
  "category_slug"                     text,
  "status"                            text                     NOT NULL DEFAULT 'processing'::text,
  "slide_count"                       integer                  NOT NULL DEFAULT 6,
  "format"                            text                     NOT NULL DEFAULT '4:5'::text,
  "goal"                              text,
  "selected_angle"                    text,
  "error_message"                     text,
  "trigger_run_id"                    text,
  "created_at"                        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                        timestamp with time zone NOT NULL DEFAULT now(),
  "generation_batch_id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "candidate_index"                   integer                  NOT NULL DEFAULT 0,
  "candidate_count"                   integer                  NOT NULL DEFAULT 1,
  "business_profile_id"               uuid,
  "business_profile_version"          integer,
  "generation_source"                 text                     NOT NULL DEFAULT 'manual'::text,
  "content_plan_raw_response"         jsonb,
  "content_plan_normalized"           jsonb,
  "content_planner_version"           text,
  "content_planner_model"             text,
  "content_plan_source"               text,
  "content_plan_fallback_reason"      text,
  "content_plan_validation"           jsonb,
  "renderer_version"                  text,
  "origin_daily_feed_id"              uuid,
  "available_on_local_date"           date,
  "content_format_id"                 text,
  "hook_family_id"                    text,
  "content_grammar_version"           text,
  "content_selector_version"          text,
  "content_history_snapshot"          jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "content_audience_id"               text,
  "content_problem_id"                text,
  "content_goal_id"                   text,
  "content_topic_id"                  text,
  "content_topic"                     text,
  "content_angle"                     text,
  "carousel_experiment_batch_id"      uuid,
  "carousel_experiment_assignment_id" uuid,
  "content_assigned_format_id"        text,
  "content_format_version"            integer,
  "structure_id"                      text                     NOT NULL DEFAULT 'structure_1'::text,
  "structure_version"                 integer                  NOT NULL DEFAULT 1,
  "content_plan_id"                   uuid,
  "content_plan_item_id"              uuid,
  "content_plan_reservation_id"       uuid,
  CONSTRAINT "carousel_generations_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  CONSTRAINT "carousel_generations_candidate_count_check" CHECK (((candidate_count >= 1) AND (candidate_count <= 50))),
  CONSTRAINT "carousel_generations_candidate_index_check" CHECK ((candidate_index >= 0)),
  CONSTRAINT "carousel_generations_carousel_experiment_batch_id_fkey" FOREIGN KEY (carousel_experiment_batch_id) REFERENCES public.carousel_experiment_batches(id) ON DELETE
    SET NULL,
  CONSTRAINT "carousel_generations_content_format_id_check" CHECK (((content_format_id IS NULL) OR (content_format_id ~ '^[a-z0-9]+(_[a-z0-9]+)*$'::text))),
  CONSTRAINT "carousel_generations_content_history_snapshot_check"
    CHECK (((jsonb_typeof(content_history_snapshot) = 'array'::text) AND (jsonb_array_length(content_history_snapshot) <= 10))),
  CONSTRAINT "carousel_generations_content_labels_check"
    CHECK
    ((((content_topic IS NULL) OR ((char_length(TRIM(BOTH FROM content_topic)) >= 1) AND (char_length(TRIM(BOTH FROM content_topic)) <= 240))) AND ((content_angle IS NULL) OR
    ((char_length(TRIM(BOTH FROM content_angle)) >= 1) AND (char_length(TRIM(BOTH FROM content_angle)) <= 360))))),
  CONSTRAINT "carousel_generations_content_option_ids_check"
    CHECK
    ((((content_audience_id IS NULL) OR ((char_length(content_audience_id) >= 1) AND (char_length(content_audience_id) <= 100))) AND ((content_problem_id IS NULL) OR
    ((char_length(content_problem_id) >= 1) AND (char_length(content_problem_id) <= 100))) AND
    ((content_goal_id IS NULL) OR ((char_length(content_goal_id) >= 1) AND (char_length(content_goal_id) <= 100))) AND
    ((content_topic_id IS NULL) OR ((char_length(content_topic_id) >= 1) AND (char_length(content_topic_id) <= 100))))),
  CONSTRAINT "carousel_generations_content_plan_id_fkey" FOREIGN KEY (content_plan_id) REFERENCES public.carousel_content_plans(id),
  CONSTRAINT "carousel_generations_content_plan_owner_fk" FOREIGN KEY (content_plan_id, user_id) REFERENCES public.carousel_content_plans(id, user_id),
  CONSTRAINT "carousel_generations_content_plan_provenance_check"
    CHECK ((((content_plan_id IS NULL) AND (content_plan_item_id IS NULL) AND (content_plan_reservation_id IS NULL)) OR ((content_plan_id IS NOT NULL) AND (content_plan_item_id IS
    NOT NULL) AND (content_plan_reservation_id IS NOT NULL) AND (generation_source = 'auto_generated'::text)))),
  CONSTRAINT "carousel_generations_content_plan_reservation_id_fkey" FOREIGN KEY (content_plan_reservation_id) REFERENCES public.carousel_content_plan_reservations(id),
  CONSTRAINT "carousel_generations_content_selection_pair_check"
    CHECK
    ((((structure_id = 'structure_1'::text) AND (((content_format_id IS NULL) AND (hook_family_id IS NULL) AND (content_grammar_version IS NULL) AND (content_selector_version IS
    NULL)) OR ((content_format_id IS NOT NULL) AND (hook_family_id IS NOT NULL) AND (content_grammar_version IS NOT NULL) AND (content_selector_version IS
    NOT NULL)))) OR ((structure_id = 'structure_2'::text) AND (content_format_id IS NOT NULL) AND (hook_family_id IS NULL) AND (content_grammar_version IS
    NOT NULL) AND (content_selector_version IS NOT NULL)))),
  CONSTRAINT "carousel_generations_daily_origin_check" CHECK ((((origin_daily_feed_id IS NULL) AND (available_on_local_date IS NULL)) OR ((origin_daily_feed_id IS
    NOT NULL) AND (available_on_local_date IS NOT NULL)))),
  CONSTRAINT "carousel_generations_format_check" CHECK ((format = ANY (ARRAY['4:5'::text, '1:1'::text]))),
  CONSTRAINT "carousel_generations_generation_source_check" CHECK ((generation_source = ANY (ARRAY['auto_generated'::text, 'manual'::text]))),
  CONSTRAINT "carousel_generations_hook_family_id_check" CHECK (((hook_family_id IS NULL) OR (hook_family_id ~ '^[a-z0-9]+(_[a-z0-9]+)*$'::text))),
  CONSTRAINT "carousel_generations_pkey" PRIMARY KEY (id),
  CONSTRAINT "carousel_generations_slide_count_check" CHECK (((slide_count >= 1) AND (slide_count <= 10))),
  CONSTRAINT "carousel_generations_status_check" CHECK ((status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text]))),
  CONSTRAINT "carousel_generations_structure_grammar_check"
    CHECK
    (((structure_id = 'structure_1'::text) OR ((structure_id = 'structure_2'::text) AND (content_assigned_format_id = ANY (ARRAY['wrong_belief'::text, 'perfect_plan_breaks'::text,
    'stopped_behavior'::text,
    'terrible_at'::text,
    'result_without_sacrifice'::text,
    'identity_transformation'::text,
    'new_rule'::text,
    'wrong_villain'::text])) AND
    (content_format_id = ANY (ARRAY['wrong_belief'::text, 'perfect_plan_breaks'::text, 'stopped_behavior'::text, 'terrible_at'::text, 'result_without_sacrifice'::text,
    'identity_transformation'::text, 'new_rule'::text, 'wrong_villain'::text])) AND (hook_family_id IS NULL)))),
  CONSTRAINT "carousel_generations_structure_id_check" CHECK ((structure_id = ANY (ARRAY['structure_1'::text, 'structure_2'::text]))),
  CONSTRAINT "carousel_generations_structure_version_check" CHECK ((structure_version >= 1)),
  CONSTRAINT "carousel_generations_origin_daily_feed_id_fkey" FOREIGN KEY (origin_daily_feed_id) REFERENCES public.daily_carousel_feeds(id) ON DELETE RESTRICT,
  CONSTRAINT "carousel_generations_website_analysis_id_fkey" FOREIGN KEY (website_analysis_id) REFERENCES public.website_analyses(id) ON DELETE SET NULL,
  CONSTRAINT "carousel_generations_content_plan_reservation_provenance_fk" FOREIGN KEY (content_plan_reservation_id, content_plan_id, user_id)
    REFERENCES public.carousel_content_plan_reservations(id, plan_id, user_id),
  CONSTRAINT "carousel_generations_batch_structure_fk" FOREIGN KEY (carousel_experiment_batch_id, structure_id) REFERENCES public.carousel_experiment_batches(id, structure_id)
    ON DELETE SET NULL (carousel_experiment_batch_id) DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE "public"."carousel_generations"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX carousel_generations_analysis_idx ON public.carousel_generations USING btree (website_analysis_id);

CREATE UNIQUE INDEX carousel_generations_batch_candidate_uidx ON public.carousel_generations USING btree (generation_batch_id, candidate_index);

CREATE INDEX carousel_generations_content_plan_item_idx ON public.carousel_generations USING btree (content_plan_item_id, created_at DESC)
  WHERE (content_plan_item_id IS NOT NULL);

CREATE INDEX carousel_generations_content_plan_reservation_idx ON public.carousel_generations USING btree (content_plan_reservation_id, status, created_at DESC)
  WHERE (content_plan_reservation_id IS NOT NULL);

CREATE INDEX carousel_generations_daily_availability_idx ON public.carousel_generations
  USING btree (user_id, business_profile_id, business_profile_version, available_on_local_date, status, updated_at DESC)
  WHERE (origin_daily_feed_id IS NOT NULL);

CREATE INDEX carousel_generations_experiment_batch_candidate_idx ON public.carousel_generations USING btree (carousel_experiment_batch_id, candidate_index)
  WHERE (carousel_experiment_batch_id IS NOT NULL);

CREATE UNIQUE INDEX carousel_generations_id_structure_uidx ON public.carousel_generations USING btree (id, structure_id);

CREATE UNIQUE INDEX carousel_generations_id_structure_version_uidx ON public.carousel_generations USING btree (id, structure_id, structure_version);

CREATE UNIQUE INDEX carousel_generations_initial_profile_candidate_uidx ON public.carousel_generations USING btree (business_profile_id, business_profile_version, candidate_index)
  WHERE ((business_profile_id IS NOT NULL) AND (business_profile_version IS NOT NULL) AND (origin_daily_feed_id IS NULL));

CREATE INDEX carousel_generations_profile_content_history_idx ON public.carousel_generations USING btree (business_profile_id, created_at DESC, candidate_index DESC)
  WHERE ((business_profile_id IS NOT NULL) AND (generation_source = 'auto_generated'::text) AND (status = ANY (ARRAY['processing'::text, 'completed'::text])));

CREATE INDEX carousel_generations_profile_structure_format_idx ON public.carousel_generations USING btree (business_profile_id, structure_id, content_format_id, created_at DESC)
  WHERE ((business_profile_id IS NOT NULL) AND (content_format_id IS NOT NULL));

CREATE INDEX carousel_generations_profile_structure_history_idx ON public.carousel_generations
  USING btree (business_profile_id, structure_id, created_at DESC, candidate_index DESC)
  WHERE ((business_profile_id IS NOT NULL) AND (generation_source = 'auto_generated'::text) AND (status = ANY (ARRAY['processing'::text, 'completed'::text])));

CREATE INDEX carousel_generations_profile_updated_idx ON public.carousel_generations USING btree (business_profile_id, updated_at DESC)
  WHERE (business_profile_id IS NOT NULL);

CREATE INDEX carousel_generations_project_created_idx ON public.carousel_generations USING btree (project_id, created_at DESC);

CREATE TRIGGER carousel_generations_structure_immutable
  BEFORE UPDATE ON public.carousel_generations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_carousel_structure_identity_change();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."carousel_generations" TO "postgres";

COMMENT ON COLUMN "public"."carousel_generations"."content_format_id" IS 'Backend-reserved five-slide content structure. This is separate from format, which stores the canvas ratio.';

COMMENT ON COLUMN "public"."carousel_generations"."content_grammar_version" IS 'Version of the format and hook-family configuration used for this generation.';

COMMENT ON COLUMN "public"."carousel_generations"."content_history_snapshot" IS 'Compact retry-stable history input used for repetition avoidance; never a copy of prior full slides.';

COMMENT ON COLUMN "public"."carousel_generations"."content_plan_item_id" IS 'Creative seed/emotion provenance. Failed attempts may share an item; the plan item consumed_by_carousel_generation_id remains the unique successful consumer.';

COMMENT ON COLUMN "public"."carousel_generations"."content_plan_normalized" IS 'Validated normalized carousel plan sent to image matching and rendering.';

COMMENT ON COLUMN "public"."carousel_generations"."content_plan_raw_response" IS 'Raw initial and optional repair responses returned by the carousel planner model.';

COMMENT ON COLUMN "public"."carousel_generations"."content_plan_validation" IS 'Planner validation issues and repair outcome for the normalized plan.';

COMMENT ON COLUMN "public"."carousel_generations"."content_selector_version" IS 'Version of the deterministic backend selector that reserved the content structure.';

COMMENT ON COLUMN "public"."carousel_generations"."hook_family_id" IS 'Backend-reserved hook strategy compatible with content_format_id.';

COMMENT ON COLUMN "public"."carousel_generations"."structure_id" IS 'Authoritative structure namespace for the generation, its compact history snapshot, format ID, planner, validator, and renderer.';

COMMENT ON CONSTRAINT "carousel_generations_content_selection_pair_check" ON "public"."carousel_generations" IS 'Structure 1 requires its hook family whenever content grammar is selected. Structure 2 owns a separate format grammar and must not store a Structure 1 hook family.';

REVOKE ALL ON TABLE "public"."carousel_generations" FROM "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."carousel_generations" TO "service_role";


-- source: public/tables/hook_audio_selections.sql
CREATE TABLE "public"."hook_audio_selections" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                  text                     NOT NULL,
  "hook_video_suggestion_id" uuid                     NOT NULL,
  "hook_video_draft_id"      uuid,
  "hook_video_id"            text                     NOT NULL,
  "hook_video_source"        text                     NOT NULL,
  "hook_format_id"           text                     NOT NULL,
  "audio_asset_id"           text                     NOT NULL,
  "content_fingerprint"      text                     NOT NULL,
  "audio_intent"             jsonb                    NOT NULL,
  "selection_source"         text                     NOT NULL,
  "match_score"              numeric(5,4),
  "matching_version"         text                     NOT NULL,
  "metadata"                 jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "hook_audio_selections_audio_asset_id_fkey" FOREIGN KEY (audio_asset_id) REFERENCES public.hook_audio_assets(id) ON DELETE RESTRICT,
  CONSTRAINT "hook_audio_selections_content_fingerprint_check" CHECK ((content_fingerprint ~ '^[a-f0-9]{64}$'::text)),
  CONSTRAINT "hook_audio_selections_hook_video_id_check" CHECK (((char_length(btrim(hook_video_id)) >= 1) AND (char_length(btrim(hook_video_id)) <= 200))),
  CONSTRAINT "hook_audio_selections_hook_video_source_check" CHECK ((hook_video_source = ANY (ARRAY['catalog'::text, 'user'::text]))),
  CONSTRAINT "hook_audio_selections_intent_check"
    CHECK
    (COALESCE(((jsonb_typeof(audio_intent) = 'object'::text) AND ((audio_intent ->> 'mood'::text) = ANY (ARRAY['curious'::text, 'uplifting'::text, 'serious'::text, 'calm'::text,
    'urgent'::text,
    'playful'::text])) AND
    ((audio_intent ->> 'hookType'::text) = ANY (ARRAY['curiosity'::text, 'problem'::text, 'warning'::text, 'transformation'::text, 'benefit'::text, 'story'::text,
    'authority'::text])) AND ((audio_intent ->> 'energy'::text) = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))), false)),
  CONSTRAINT "hook_audio_selections_match_score_check"
    CHECK
    ((((selection_source = 'video_locked'::text) AND (match_score IS NULL)) OR ((selection_source = ANY (ARRAY['format_preferred'::text, 'dynamic'::text])) AND (match_score IS
    NOT NULL) AND (match_score >= (0)::numeric) AND (match_score <= (1)::numeric)))),
  CONSTRAINT "hook_audio_selections_matching_version_check" CHECK (((char_length(btrim(matching_version)) >= 1) AND (char_length(btrim(matching_version)) <= 100))),
  CONSTRAINT "hook_audio_selections_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text)),
  CONSTRAINT "hook_audio_selections_pkey" PRIMARY KEY (id),
  CONSTRAINT "hook_audio_selections_selection_source_check" CHECK ((selection_source = ANY (ARRAY['video_locked'::text, 'format_preferred'::text, 'dynamic'::text]))),
  CONSTRAINT "hook_audio_selections_user_id_check" CHECK (((char_length(btrim(user_id)) >= 1) AND (char_length(btrim(user_id)) <= 200))),
  CONSTRAINT "hook_audio_selections_hook_format_id_fkey" FOREIGN KEY (hook_format_id) REFERENCES public.hook_formats(id) ON DELETE RESTRICT,
  CONSTRAINT "hook_audio_selections_hook_video_draft_id_fkey" FOREIGN KEY (hook_video_draft_id) REFERENCES public.hook_video_drafts(id) ON DELETE SET NULL,
  CONSTRAINT "hook_audio_selections_hook_video_suggestion_id_fkey" FOREIGN KEY (hook_video_suggestion_id) REFERENCES public.hook_video_suggestions(id) ON DELETE CASCADE
);

ALTER TABLE "public"."hook_audio_selections"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX hook_audio_selections_asset_idx ON public.hook_audio_selections USING btree (audio_asset_id);

CREATE INDEX hook_audio_selections_draft_idx ON public.hook_audio_selections USING btree (hook_video_draft_id)
  WHERE (hook_video_draft_id IS NOT NULL);

CREATE INDEX hook_audio_selections_format_idx ON public.hook_audio_selections USING btree (hook_format_id);

CREATE INDEX hook_audio_selections_recent_user_idx ON public.hook_audio_selections USING btree (user_id, updated_at DESC, audio_asset_id);

CREATE INDEX hook_audio_selections_suggestion_idx ON public.hook_audio_selections USING btree (hook_video_suggestion_id);

CREATE UNIQUE INDEX hook_audio_selections_suggestion_uidx ON public.hook_audio_selections USING btree (user_id, hook_video_suggestion_id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hook_audio_selections" TO "postgres";

REVOKE ALL ON TABLE "public"."hook_audio_selections" FROM "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."hook_audio_selections" TO "service_role";


-- source: public/tables/hook_performance_observations.sql
CREATE TABLE "public"."hook_performance_observations" (
  "id"                         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                    text                     NOT NULL,
  "hook_video_suggestion_id"   uuid                     NOT NULL,
  "hook_video_draft_id"        uuid                     NOT NULL,
  "scheduled_post_target_id"   uuid                     NOT NULL,
  "social_connection_id"       uuid                     NOT NULL,
  "platform"                   text                     NOT NULL,
  "platform_post_id"           text                     NOT NULL,
  "source"                     text                     NOT NULL DEFAULT 'platform_api'::text,
  "view_count"                 bigint,
  "reach_count"                bigint,
  "interaction_count"          bigint,
  "like_count"                 bigint,
  "comment_count"              bigint,
  "share_count"                bigint,
  "save_count"                 bigint,
  "watch_time_seconds"         numeric,
  "average_watch_time_seconds" numeric,
  "completion_rate"            numeric,
  "click_count"                bigint,
  "conversion_count"           bigint,
  "attributed_sales_amount"    numeric,
  "attributed_sales_currency"  text,
  "observed_at"                timestamp with time zone NOT NULL,
  "created_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "hook_performance_observations_attributed_sales_amount_check" CHECK (((attributed_sales_amount IS NULL) OR (attributed_sales_amount >= (0)::numeric))),
  CONSTRAINT "hook_performance_observations_attributed_sales_currency_check" CHECK (((attributed_sales_currency IS NULL) OR (attributed_sales_currency ~ '^[A-Z]{3}$'::text))),
  CONSTRAINT "hook_performance_observations_average_watch_time_seconds_check" CHECK (((average_watch_time_seconds IS NULL) OR (average_watch_time_seconds >= (0)::numeric))),
  CONSTRAINT "hook_performance_observations_click_count_check" CHECK (((click_count IS NULL) OR (click_count >= 0))),
  CONSTRAINT "hook_performance_observations_comment_count_check" CHECK (((comment_count IS NULL) OR (comment_count >= 0))),
  CONSTRAINT "hook_performance_observations_completion_rate_check" CHECK (((completion_rate IS NULL) OR ((completion_rate >= (0)::numeric) AND (completion_rate <= (1)::numeric)))),
  CONSTRAINT "hook_performance_observations_conversion_count_check" CHECK (((conversion_count IS NULL) OR (conversion_count >= 0))),
  CONSTRAINT "hook_performance_observations_interaction_count_check" CHECK (((interaction_count IS NULL) OR (interaction_count >= 0))),
  CONSTRAINT "hook_performance_observations_like_count_check" CHECK (((like_count IS NULL) OR (like_count >= 0))),
  CONSTRAINT "hook_performance_observations_pkey" PRIMARY KEY (id),
  CONSTRAINT "hook_performance_observations_platform_check" CHECK ((platform = ANY (ARRAY['instagram'::text, 'tiktok'::text]))),
  CONSTRAINT "hook_performance_observations_platform_post_id_check"
    CHECK (((char_length(TRIM(BOTH FROM platform_post_id)) >= 1) AND (char_length(TRIM(BOTH FROM platform_post_id)) <= 240))),
  CONSTRAINT "hook_performance_observations_reach_count_check" CHECK (((reach_count IS NULL) OR (reach_count >= 0))),
  CONSTRAINT "hook_performance_observations_save_count_check" CHECK (((save_count IS NULL) OR (save_count >= 0))),
  CONSTRAINT "hook_performance_observations_share_count_check" CHECK (((share_count IS NULL) OR (share_count >= 0))),
  CONSTRAINT "hook_performance_observations_source_check" CHECK ((source = ANY (ARRAY['platform_api'::text, 'conversion_api'::text]))),
  CONSTRAINT "hook_performance_observations_view_count_check" CHECK (((view_count IS NULL) OR (view_count >= 0))),
  CONSTRAINT "hook_performance_observations_watch_time_seconds_check" CHECK (((watch_time_seconds IS NULL) OR (watch_time_seconds >= (0)::numeric))),
  CONSTRAINT "hook_performance_observations_hook_video_draft_id_fkey" FOREIGN KEY (hook_video_draft_id) REFERENCES public.hook_video_drafts(id) ON DELETE CASCADE,
  CONSTRAINT "hook_performance_observations_hook_video_suggestion_id_fkey" FOREIGN KEY (hook_video_suggestion_id) REFERENCES public.hook_video_suggestions(id) ON DELETE CASCADE,
  CONSTRAINT "hook_performance_observations_scheduled_post_target_id_fkey" FOREIGN KEY (scheduled_post_target_id) REFERENCES public.scheduled_post_targets(id) ON DELETE CASCADE,
  CONSTRAINT "hook_performance_observations_social_connection_id_fkey" FOREIGN KEY (social_connection_id) REFERENCES public.social_connections(id) ON DELETE CASCADE
);

ALTER TABLE "public"."hook_performance_observations"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX hook_performance_suggestion_idx ON public.hook_performance_observations USING btree (hook_video_suggestion_id, observed_at DESC);

CREATE UNIQUE INDEX hook_performance_target_idx ON public.hook_performance_observations USING btree (scheduled_post_target_id);

CREATE INDEX hook_performance_user_observed_idx ON public.hook_performance_observations USING btree (user_id, observed_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hook_performance_observations" TO "postgres", "service_role";


-- source: public/tables/trending_hook_generation_dispatch_outbox.sql
CREATE TABLE "public"."trending_hook_generation_dispatch_outbox" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "run_id"          uuid                     NOT NULL,
  "chunk_id"        uuid                     NOT NULL,
  "user_id"         text                     NOT NULL,
  "status"          text                     NOT NULL DEFAULT 'pending'::text,
  "attempt_count"   integer                  NOT NULL DEFAULT 0,
  "next_attempt_at" timestamp with time zone NOT NULL DEFAULT now(),
  "claim_token"     uuid,
  "claimed_at"      timestamp with time zone,
  "last_error"      text,
  "completed_at"    timestamp with time zone,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "trending_hook_generation_dispatch_outbox_attempt_count_check" CHECK ((attempt_count >= 0)),
  CONSTRAINT "trending_hook_generation_dispatch_outbox_chunk_id_key" UNIQUE (chunk_id),
  CONSTRAINT "trending_hook_generation_dispatch_outbox_pkey" PRIMARY KEY (id),
  CONSTRAINT "trending_hook_generation_dispatch_outbox_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text]))),
  CONSTRAINT "trending_hook_generation_dispatch_outbox_user_id_check" CHECK (((char_length(TRIM(BOTH FROM user_id)) >= 1) AND (char_length(TRIM(BOTH FROM user_id)) <= 128))),
  CONSTRAINT "trending_hook_generation_dispatch_outbox_chunk_id_fkey" FOREIGN KEY (chunk_id) REFERENCES public.trending_hook_generation_run_chunks(id) ON DELETE CASCADE,
  CONSTRAINT "trending_hook_generation_dispatch_outbox_run_id_fkey" FOREIGN KEY (run_id) REFERENCES public.trending_hook_generation_runs(id) ON DELETE CASCADE
);

ALTER TABLE "public"."trending_hook_generation_dispatch_outbox"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX trending_hook_generation_dispatch_outbox_due_idx ON public.trending_hook_generation_dispatch_outbox USING btree (status, next_attempt_at, created_at)
  WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text]));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."trending_hook_generation_dispatch_outbox" TO "postgres", "service_role";


-- source: public/tables/trending_hook_generation_run_candidates.sql
CREATE TABLE "public"."trending_hook_generation_run_candidates" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "run_id"              uuid                     NOT NULL,
  "influencer_video_id" text                     NOT NULL,
  "candidate_order"     integer                  NOT NULL,
  "candidate_payload"   jsonb                    NOT NULL,
  "state"               text                     NOT NULL DEFAULT 'pending'::text,
  "chunk_id"            uuid,
  "attempted_at"        timestamp with time zone,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "trending_hook_generation_run_can_run_id_influencer_video_id_key" UNIQUE (run_id, influencer_video_id),
  CONSTRAINT "trending_hook_generation_run_candidat_influencer_video_id_check"
    CHECK (((char_length(TRIM(BOTH FROM influencer_video_id)) >= 1) AND (char_length(TRIM(BOTH FROM influencer_video_id)) <= 240))),
  CONSTRAINT "trending_hook_generation_run_candidates_candidate_order_check" CHECK ((candidate_order >= 0)),
  CONSTRAINT "trending_hook_generation_run_candidates_candidate_payload_check" CHECK ((jsonb_typeof(candidate_payload) = 'object'::text)),
  CONSTRAINT "trending_hook_generation_run_candidates_pkey" PRIMARY KEY (id),
  CONSTRAINT "trending_hook_generation_run_candidates_state_check" CHECK ((state = ANY (ARRAY['pending'::text, 'reserved'::text, 'accepted'::text, 'rejected'::text]))),
  CONSTRAINT "trending_hook_generation_run_candidates_chunk_id_fkey" FOREIGN KEY (chunk_id) REFERENCES public.trending_hook_generation_run_chunks(id) ON DELETE SET NULL,
  CONSTRAINT "trending_hook_generation_run_candidates_run_id_fkey" FOREIGN KEY (run_id) REFERENCES public.trending_hook_generation_runs(id) ON DELETE CASCADE
);

ALTER TABLE "public"."trending_hook_generation_run_candidates"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX trending_hook_generation_run_candidates_pending_idx ON public.trending_hook_generation_run_candidates USING btree (run_id, state, candidate_order)
  WHERE (state = 'pending'::text);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."trending_hook_generation_run_candidates" TO "postgres", "service_role";


-- source: public/tables/wall_text_content_plan_items.sql
CREATE TABLE "public"."wall_text_content_plan_items" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "plan_id"           uuid                     NOT NULL,
  "user_id"           text                     NOT NULL,
  "creative_brief_id" uuid                     NOT NULL,
  "sequence_index"    integer                  NOT NULL,
  "content_idea"      text                     NOT NULL,
  "feeling"           text                     NOT NULL,
  "idea_fingerprint"  text                     NOT NULL,
  "status"            text                     NOT NULL DEFAULT 'available'::text,
  "reserved_at"       timestamp with time zone,
  "consumed_at"       timestamp with time zone,
  "retired_at"        timestamp with time zone,
  "retirement_reason" text,
  "created_at"        timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "wall_text_content_plan_items_content_idea_check" CHECK (((char_length(btrim(content_idea)) >= 12) AND (char_length(btrim(content_idea)) <= 400))),
  CONSTRAINT "wall_text_content_plan_items_creative_brief_id_plan_id_use_fkey" FOREIGN KEY (creative_brief_id, plan_id, user_id)
    REFERENCES public.wall_text_content_plan_briefs(id, plan_id, user_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "wall_text_content_plan_items_feeling_check" CHECK (((char_length(btrim(feeling)) >= 2) AND (char_length(btrim(feeling)) <= 120))),
  CONSTRAINT "wall_text_content_plan_items_id_plan_id_user_id_key" UNIQUE (id, plan_id, user_id),
  CONSTRAINT "wall_text_content_plan_items_idea_fingerprint_check" CHECK ((idea_fingerprint ~ '^[a-f0-9]{64}$'::text)),
  CONSTRAINT "wall_text_content_plan_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "wall_text_content_plan_items_plan_id_idea_fingerprint_key" UNIQUE (plan_id, idea_fingerprint),
  CONSTRAINT "wall_text_content_plan_items_plan_id_sequence_index_key" UNIQUE (plan_id, sequence_index),
  CONSTRAINT "wall_text_content_plan_items_sequence_index_check" CHECK (((sequence_index >= 1) AND (sequence_index <= 200))),
  CONSTRAINT "wall_text_content_plan_items_status_check" CHECK ((status = ANY (ARRAY['available'::text, 'reserved'::text, 'consumed'::text, 'retired'::text]))),
  CONSTRAINT "wall_text_content_plan_items_user_id_check" CHECK (((char_length(btrim(user_id)) >= 1) AND (char_length(btrim(user_id)) <= 240))),
  CONSTRAINT "wall_text_content_plan_items_plan_id_user_id_fkey" FOREIGN KEY (plan_id, user_id) REFERENCES public.wall_text_content_plans(id, user_id) ON DELETE CASCADE
);

ALTER TABLE "public"."wall_text_content_plan_items"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX wall_text_content_plan_items_available_idx ON public.wall_text_content_plan_items USING btree (plan_id, sequence_index)
  WHERE (status = 'available'::text);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wall_text_content_plan_items" TO "postgres", "service_role";

COMMENT ON TABLE "public"."wall_text_content_plan_items" IS 'Private Wall-of-Text contentIdea plus feeling inventory. The complete parent brief is loaded only by the final Wall writer.';


-- source: public/tables/carousel_performance_observations.sql
CREATE TABLE "public"."carousel_performance_observations" (
  "id"                        uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                   text                     NOT NULL,
  "business_profile_id"       uuid                     NOT NULL,
  "carousel_generation_id"    uuid                     NOT NULL,
  "scheduled_post_target_id"  uuid                     NOT NULL,
  "social_connection_id"      uuid                     NOT NULL,
  "platform"                  text                     NOT NULL,
  "platform_post_id"          text                     NOT NULL,
  "content_format_id"         text                     NOT NULL,
  "hook_family_id"            text,
  "format_version"            integer                  NOT NULL,
  "evaluation_policy_version" text                     NOT NULL DEFAULT 'carousel-performance-seven-day-v1'::text,
  "published_at"              timestamp with time zone NOT NULL,
  "evaluation_due_at"         timestamp with time zone NOT NULL,
  "snapshot_observed_at"      timestamp with time zone NOT NULL,
  "evaluated_at"              timestamp with time zone,
  "view_count"                bigint,
  "created_at"                timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"                timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "structure_id"              text                     NOT NULL DEFAULT 'structure_1'::text,
  "structure_version"         integer                  NOT NULL DEFAULT 1,
  CONSTRAINT "carousel_performance_observatio_evaluation_policy_version_check" CHECK ((evaluation_policy_version = 'carousel-performance-seven-day-v1'::text)),
  CONSTRAINT "carousel_performance_observations_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  CONSTRAINT "carousel_performance_observations_carousel_generation_id_fkey" FOREIGN KEY (carousel_generation_id) REFERENCES public.carousel_generations(id) ON DELETE CASCADE,
  CONSTRAINT "carousel_performance_observations_check1" CHECK ((snapshot_observed_at >= published_at)),
  CONSTRAINT "carousel_performance_observations_check2" CHECK (((evaluated_at IS NULL) OR ((view_count IS
    NOT NULL) AND ((snapshot_observed_at >= (evaluation_due_at - '24:00:00'::interval)) AND (snapshot_observed_at <= (evaluation_due_at + '24:00:00'::interval)))))),
  CONSTRAINT "carousel_performance_observations_check" CHECK ((evaluation_due_at = (published_at + '7 days'::interval))),
  CONSTRAINT "carousel_performance_observations_content_format_id_check" CHECK ((content_format_id ~ '^[a-z0-9]+(_[a-z0-9]+)*$'::text)),
  CONSTRAINT "carousel_performance_observations_format_version_check" CHECK ((format_version >= 1)),
  CONSTRAINT "carousel_performance_observations_hook_family_id_check" CHECK ((hook_family_id ~ '^[a-z0-9]+(_[a-z0-9]+)*$'::text)),
  CONSTRAINT "carousel_performance_observations_pkey" PRIMARY KEY (id),
  CONSTRAINT "carousel_performance_observations_platform_check" CHECK ((platform = 'instagram'::text)),
  CONSTRAINT "carousel_performance_observations_platform_post_id_check"
    CHECK (((char_length(TRIM(BOTH FROM platform_post_id)) >= 1) AND (char_length(TRIM(BOTH FROM platform_post_id)) <= 240))),
  CONSTRAINT "carousel_performance_observations_scheduled_post_target_id_key" UNIQUE (scheduled_post_target_id),
  CONSTRAINT "carousel_performance_observations_structure_grammar_check" CHECK ((((structure_id = 'structure_1'::text) AND (hook_family_id IS
    NOT NULL)) OR
    ((structure_id = 'structure_2'::text) AND (content_format_id = ANY (ARRAY['wrong_belief'::text, 'perfect_plan_breaks'::text, 'stopped_behavior'::text, 'terrible_at'::text,
    'result_without_sacrifice'::text, 'identity_transformation'::text, 'new_rule'::text, 'wrong_villain'::text])) AND (hook_family_id IS NULL)))),
  CONSTRAINT "carousel_performance_observations_structure_id_check" CHECK ((structure_id = ANY (ARRAY['structure_1'::text, 'structure_2'::text]))),
  CONSTRAINT "carousel_performance_observations_structure_version_check" CHECK ((structure_version >= 1)),
  CONSTRAINT "carousel_performance_observations_view_count_check" CHECK (((view_count IS NULL) OR (view_count >= 0))),
  CONSTRAINT "carousel_performance_observations_scheduled_post_target_id_fkey" FOREIGN KEY (scheduled_post_target_id) REFERENCES public.scheduled_post_targets(id)
    ON DELETE CASCADE,
  CONSTRAINT "carousel_performance_observations_social_connection_id_fkey" FOREIGN KEY (social_connection_id) REFERENCES public.social_connections(id) ON DELETE CASCADE,
  CONSTRAINT "carousel_performance_observations_generation_structure_fk" FOREIGN KEY (carousel_generation_id, structure_id) REFERENCES public.carousel_generations(id, structure_id)
    ON DELETE CASCADE
);

ALTER TABLE "public"."carousel_performance_observations"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX carousel_performance_connection_idx ON public.carousel_performance_observations USING btree (social_connection_id);

CREATE INDEX carousel_performance_generation_idx ON public.carousel_performance_observations USING btree (carousel_generation_id);

CREATE INDEX carousel_performance_profile_evaluated_idx ON public.carousel_performance_observations
  USING btree (user_id, business_profile_id, evaluated_at DESC, content_format_id, hook_family_id) INCLUDE (view_count, published_at)
  WHERE ((evaluated_at IS NOT NULL) AND (view_count IS NOT NULL));

CREATE INDEX carousel_performance_profile_structure_evaluated_idx ON public.carousel_performance_observations
  USING btree (user_id, business_profile_id, structure_id, evaluated_at DESC, content_format_id, hook_family_id) INCLUDE (view_count, published_at)
  WHERE ((evaluated_at IS NOT NULL) AND (view_count IS NOT NULL));

CREATE TRIGGER carousel_performance_observations_structure_immutable
  BEFORE UPDATE ON public.carousel_performance_observations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_carousel_structure_identity_change();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."carousel_performance_observations" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."carousel_performance_observations"."evaluated_at" IS 'Null until a seven-day view snapshot is frozen. Once set, later lifetime views never replace the comparable evaluation snapshot.';

COMMENT ON COLUMN "public"."carousel_performance_observations"."structure_id" IS 'Structure namespace captured from the attributed generation. Later learning must compare formats only inside this structure.';

COMMENT ON TABLE "public"."carousel_performance_observations" IS 'Owner-scoped view-count snapshots for unedited, generated Carousels. Views are the only stored learning metric, and only an observation within 24 hours of the fixed seven-day due time can become evaluated evidence.';


-- source: public/tables/carousel_slides.sql
CREATE TABLE "public"."carousel_slides" (
  "id"                         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "carousel_generation_id"     uuid                     NOT NULL,
  "slide_number"               integer                  NOT NULL,
  "slide_type"                 text,
  "headline"                   text                     NOT NULL,
  "subtext"                    text,
  "cta_text"                   text,
  "image_direction"            text,
  "layout_preset"              text,
  "text_position"              text,
  "category_image_asset_id"    uuid,
  "rendered_s3_key"            text,
  "rendered_url"               text,
  "status"                     text                     NOT NULL DEFAULT 'ready'::text,
  "created_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "structure_id"               text                     NOT NULL DEFAULT 'structure_1'::text,
  "structure_version"          integer                  NOT NULL DEFAULT 1,
  "story_format_id"            text,
  "story_role"                 text,
  "story_layout_variant"       text,
  "story_text_treatment"       text,
  "visual_role"                text,
  "product_visual_eligibility" text,
  CONSTRAINT "carousel_slides_carousel_generation_id_fkey" FOREIGN KEY (carousel_generation_id) REFERENCES public.carousel_generations(id) ON DELETE CASCADE,
  CONSTRAINT "carousel_slides_carousel_generation_id_slide_number_key" UNIQUE (carousel_generation_id, slide_number),
  CONSTRAINT "carousel_slides_pkey" PRIMARY KEY (id),
  CONSTRAINT "carousel_slides_product_visual_eligibility_check"
    CHECK (((product_visual_eligibility IS NULL) OR (product_visual_eligibility = ANY (ARRAY['allowed'::text, 'forbidden'::text, 'preferred'::text])))),
  CONSTRAINT "carousel_slides_slide_number_check" CHECK ((slide_number > 0)),
  CONSTRAINT "carousel_slides_status_check" CHECK ((status = ANY (ARRAY['ready'::text, 'processing'::text, 'failed'::text]))),
  CONSTRAINT "carousel_slides_story_format_id_check"
    CHECK
    (((story_format_id IS NULL) OR (story_format_id = ANY (ARRAY['wrong_belief'::text, 'perfect_plan_breaks'::text, 'stopped_behavior'::text, 'terrible_at'::text,
    'result_without_sacrifice'::text, 'identity_transformation'::text, 'new_rule'::text, 'wrong_villain'::text])))),
  CONSTRAINT "carousel_slides_story_layout_variant_check"
    CHECK (((story_layout_variant IS NULL) OR (story_layout_variant = ANY (ARRAY['story_overlay_only'::text, 'story_pill_overlay'::text, 'story_product_reveal'::text])))),
  CONSTRAINT "carousel_slides_story_role_check"
    CHECK
    (((story_role IS NULL) OR (story_role = ANY (ARRAY['recognition'::text, 'failure_scene'::text, 'reframe'::text, 'product_turning_point'::text,
    'proof_reflection_cta'::text])))),
  CONSTRAINT "carousel_slides_story_text_treatment_check"
    CHECK (((story_text_treatment IS NULL) OR (story_text_treatment = ANY (ARRAY['outlined_overlay'::text, 'overlay'::text, 'pill'::text])))),
  CONSTRAINT "carousel_slides_structure_2_metadata_check"
    CHECK
    ((((structure_id = 'structure_1'::text) AND (story_format_id IS NULL) AND (story_role IS NULL) AND (story_layout_variant IS NULL) AND (story_text_treatment IS NULL) AND
    (visual_role IS NULL) AND (product_visual_eligibility IS NULL)) OR ((structure_id = 'structure_2'::text) AND (NULLIF(btrim(story_format_id), ''::text) IS
    NOT NULL) AND (story_role IS NOT NULL) AND (story_layout_variant IS NOT NULL) AND (story_text_treatment IS NOT NULL) AND (visual_role IS
    NOT NULL) AND (product_visual_eligibility IS
    NOT NULL) AND
    ((visual_role <> 'product_asset'::text) OR ((slide_number = ANY (ARRAY[4, 5])) AND (product_visual_eligibility = ANY (ARRAY['allowed'::text, 'preferred'::text]))))))),
  CONSTRAINT "carousel_slides_structure_id_check" CHECK ((structure_id = ANY (ARRAY['structure_1'::text, 'structure_2'::text]))),
  CONSTRAINT "carousel_slides_structure_version_check" CHECK ((structure_version >= 1)),
  CONSTRAINT "carousel_slides_visual_role_check" CHECK (((visual_role IS NULL) OR (visual_role = ANY (ARRAY['hook'::text, 'human'::text, 'static'::text, 'product_asset'::text])))),
  CONSTRAINT "carousel_slides_category_image_asset_id_fkey" FOREIGN KEY (category_image_asset_id) REFERENCES public.category_image_assets(id),
  CONSTRAINT "carousel_slides_generation_structure_fk" FOREIGN KEY (carousel_generation_id, structure_id, structure_version)
    REFERENCES public.carousel_generations(id, structure_id, structure_version) ON DELETE CASCADE
);

ALTER TABLE "public"."carousel_slides"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX carousel_slides_asset_idx ON public.carousel_slides USING btree (category_image_asset_id);

CREATE INDEX carousel_slides_generation_slide_idx ON public.carousel_slides USING btree (carousel_generation_id, slide_number);

CREATE INDEX carousel_slides_structure_story_format_idx ON public.carousel_slides USING btree (structure_id, story_format_id, story_role, created_at DESC)
  WHERE (structure_id = 'structure_2'::text);

CREATE TRIGGER carousel_slides_story_identity_immutable
  BEFORE UPDATE ON public.carousel_slides
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_carousel_slide_story_identity_change();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."carousel_slides" TO "postgres";

COMMENT ON COLUMN "public"."carousel_slides"."story_format_id" IS 'Structure 2 format identity. It is intentionally separate from every Structure 1 format namespace.';

COMMENT ON COLUMN "public"."carousel_slides"."story_layout_variant" IS 'One of the three native-story layouts selected by the Structure 2 render-spec adapter.';

COMMENT ON COLUMN "public"."carousel_slides"."story_text_treatment" IS 'Structure 2 text treatment used to reproduce and diagnose the rendered slide.';

COMMENT ON COLUMN "public"."carousel_slides"."visual_role" IS 'Reserved role from the shared 1:2:2 image library: hook, human, static, or product_asset.';

REVOKE ALL ON TABLE "public"."carousel_slides" FROM "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."carousel_slides" TO "service_role";


-- source: public/tables/user_carousel_assignments.sql
CREATE TABLE "public"."user_carousel_assignments" (
  "id"                        uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                   text                     NOT NULL,
  "project_id"                text                     NOT NULL,
  "business_profile_id"       uuid,
  "business_profile_version"  integer,
  "carousel_id"               uuid                     NOT NULL,
  "state"                     text                     NOT NULL DEFAULT 'pending'::text,
  "concept_fingerprint"       text,
  "first_assigned_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "first_assigned_local_date" date,
  "last_assigned_local_date"  date,
  "first_shown_at"            timestamp with time zone,
  "completed_at"              timestamp with time zone,
  "completion_action"         text,
  "created_at"                timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_carousel_assignments_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  CONSTRAINT "user_carousel_assignments_carousel_id_fkey" FOREIGN KEY (carousel_id) REFERENCES public.carousel_generations(id) ON DELETE RESTRICT,
  CONSTRAINT "user_carousel_assignments_completion_action_check"
    CHECK (((completion_action IS NULL) OR (completion_action = ANY (ARRAY['accepted'::text, 'skipped'::text, 'saved'::text, 'scheduled'::text])))),
  CONSTRAINT "user_carousel_assignments_pkey" PRIMARY KEY (id),
  CONSTRAINT "user_carousel_assignments_state_check"
    CHECK
    ((state = ANY (ARRAY['pending'::text, 'in_progress'::text, 'accepted'::text, 'completed_skipped'::text, 'completed_saved'::text, 'completed_scheduled'::text,
    'failed'::text]))),
  CONSTRAINT "user_carousel_assignments_user_id_carousel_id_key" UNIQUE (user_id, carousel_id)
);

ALTER TABLE "public"."user_carousel_assignments"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX user_carousel_assignments_profile_idx ON public.user_carousel_assignments USING btree (user_id, project_id, business_profile_id, business_profile_version);

CREATE INDEX user_carousel_assignments_user_state_idx ON public.user_carousel_assignments USING btree (user_id, state, first_assigned_at, created_at);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_carousel_assignments" TO "postgres", "service_role";


-- source: public/tables/wall_text_generation_assignments.sql
CREATE TABLE "public"."wall_text_generation_assignments" (
  "id"                              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "batch_id"                        uuid                     NOT NULL,
  "chunk_id"                        uuid                     NOT NULL,
  "batch_candidate_index"           integer                  NOT NULL,
  "creative_candidate_index"        integer                  NOT NULL,
  "assigned_format_id"              text,
  "actual_format_id"                text,
  "format_version"                  integer                  NOT NULL DEFAULT 1,
  "format_library_version"          text                     NOT NULL,
  "selection_mode"                  text                     NOT NULL,
  "selection_weight_snapshot"       numeric(8,4)             NOT NULL DEFAULT 1,
  "source_kind"                     text                     NOT NULL,
  "overlay_media_asset_id"          uuid                     NOT NULL,
  "instagram_reel_template_id"      uuid,
  "instagram_reel_template_version" integer,
  "instagram_reference_text"        text,
  "instagram_reference_text_hash"   text,
  "instagram_locked_audio_asset_id" text,
  "instagram_audio_fit_mode"        text,
  "duration_seconds"                numeric(8,3)             NOT NULL,
  "layout_json"                     jsonb                    NOT NULL,
  "target_words"                    integer                  NOT NULL,
  "max_words"                       integer                  NOT NULL,
  "focus_json"                      jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "status"                          text                     NOT NULL DEFAULT 'pending'::text,
  "content_attempt_count"           integer                  NOT NULL DEFAULT 0,
  "last_failure_code"               text,
  "wall_text_creative_id"           uuid,
  "created_at"                      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                      timestamp with time zone NOT NULL DEFAULT now(),
  "wall_text_content_plan_id"       uuid,
  "wall_text_content_plan_item_id"  uuid,
  CONSTRAINT "wall_text_generation_assignme_instagram_locked_audio_asset_fkey" FOREIGN KEY (instagram_locked_audio_asset_id) REFERENCES public.wall_audio_assets(id)
    ON DELETE RESTRICT,
  CONSTRAINT "wall_text_generation_assignment_selection_weight_snapshot_check" CHECK ((selection_weight_snapshot > (0)::numeric)),
  CONSTRAINT "wall_text_generation_assignments_batch_candidate_index_check" CHECK ((batch_candidate_index >= 0)),
  CONSTRAINT "wall_text_generation_assignments_candidate_key" UNIQUE (batch_id, batch_candidate_index),
  CONSTRAINT "wall_text_generation_assignments_check" CHECK ((max_words >= target_words)),
  CONSTRAINT "wall_text_generation_assignments_content_attempt_count_check" CHECK (((content_attempt_count >= 0) AND (content_attempt_count <= 2))),
  CONSTRAINT "wall_text_generation_assignments_content_plan_fkey" FOREIGN KEY (wall_text_content_plan_id) REFERENCES public.wall_text_content_plans(id) ON DELETE RESTRICT,
  CONSTRAINT "wall_text_generation_assignments_content_plan_item_fkey" FOREIGN KEY (wall_text_content_plan_item_id) REFERENCES public.wall_text_content_plan_items(id)
    ON DELETE RESTRICT,
  CONSTRAINT "wall_text_generation_assignments_content_plan_pair_chk" CHECK (((wall_text_content_plan_id IS NULL) = (wall_text_content_plan_item_id IS NULL))),
  CONSTRAINT "wall_text_generation_assignments_creative_candidate_index_check" CHECK ((creative_candidate_index >= 0)),
  CONSTRAINT "wall_text_generation_assignments_duration_seconds_check" CHECK ((duration_seconds > (0)::numeric)),
  CONSTRAINT "wall_text_generation_assignments_format_version_check" CHECK ((format_version > 0)),
  CONSTRAINT "wall_text_generation_assignments_overlay_media_asset_id_fkey" FOREIGN KEY (overlay_media_asset_id) REFERENCES public.overlay_media_assets(id) ON DELETE RESTRICT,
  CONSTRAINT "wall_text_generation_assignments_pkey" PRIMARY KEY (id),
  CONSTRAINT "wall_text_generation_assignments_selection_mode_check"
    CHECK
    ((selection_mode = ANY (ARRAY['controlled_rotation'::text, 'performance_exploration'::text, 'performance_weighted'::text, 'instagram_template'::text, 'freeform'::text]))),
  CONSTRAINT "wall_text_generation_assignments_source_chk" CHECK ((((source_kind = 'instagram_reel'::text) AND (instagram_reel_template_id IS
    NOT NULL) AND (instagram_reel_template_version IS NOT NULL) AND (instagram_reel_template_version > 0) AND (instagram_reference_text IS
    NOT NULL) AND ((char_length(btrim(instagram_reference_text)) >= 8) AND (char_length(btrim(instagram_reference_text)) <= 600)) AND (instagram_reference_text_hash IS
    NOT NULL) AND (instagram_reference_text_hash ~ '^[a-f0-9]{64}$'::text) AND (instagram_locked_audio_asset_id IS NOT NULL) AND (instagram_audio_fit_mode IS
    NOT NULL) AND (instagram_audio_fit_mode = ANY (ARRAY['exact'::text, 'trim'::text]))) OR
    ((source_kind <> 'instagram_reel'::text) AND (instagram_reel_template_id IS NULL) AND (instagram_reel_template_version IS NULL) AND (instagram_reference_text IS NULL) AND
    (instagram_reference_text_hash IS NULL) AND (instagram_locked_audio_asset_id IS NULL) AND (instagram_audio_fit_mode IS NULL)))),
  CONSTRAINT "wall_text_generation_assignments_source_kind_check" CHECK ((source_kind = ANY (ARRAY['ugcpilot'::text, 'creative_asset'::text, 'instagram_reel'::text]))),
  CONSTRAINT "wall_text_generation_assignments_status_check"
    CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'retry_pending'::text, 'completed'::text, 'failed'::text]))),
  CONSTRAINT "wall_text_generation_assignments_target_words_check" CHECK ((target_words > 0)),
  CONSTRAINT "wall_text_generation_assignments_wall_text_creative_id_fkey" FOREIGN KEY (wall_text_creative_id) REFERENCES public.wall_text_creatives(id) ON DELETE SET NULL,
  CONSTRAINT "wall_text_generation_assignments_wall_text_creative_id_key" UNIQUE (wall_text_creative_id),
  CONSTRAINT "wall_text_generation_assignments_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES public.wall_text_generation_batches(id) ON DELETE CASCADE,
  CONSTRAINT "wall_text_generation_assignments_chunk_id_fkey" FOREIGN KEY (chunk_id) REFERENCES public.wall_text_generation_chunks(id) ON DELETE CASCADE,
  CONSTRAINT "wall_text_generation_assignment_instagram_reel_template_id_fkey" FOREIGN KEY (instagram_reel_template_id) REFERENCES public.wall_text_instagram_reel_templates(id)
    ON DELETE RESTRICT
);

ALTER TABLE "public"."wall_text_generation_assignments"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX wall_text_generation_assignments_batch_idx ON public.wall_text_generation_assignments USING btree (batch_id, batch_candidate_index);

CREATE UNIQUE INDEX wall_text_generation_assignments_plan_item_uidx ON public.wall_text_generation_assignments USING btree (wall_text_content_plan_item_id)
  WHERE (wall_text_content_plan_item_id IS NOT NULL);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wall_text_generation_assignments" TO "postgres", "service_role";

COMMENT ON COLUMN "public"."wall_text_generation_assignments"."wall_text_content_plan_item_id" IS 'Optional private planned idea used by this existing Wall generation assignment. Null preserves legacy and rollout fallback behavior.';


-- source: public/tables/carousel_image_usage.sql
CREATE TABLE "public"."carousel_image_usage" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                 text                     NOT NULL,
  "asset_id"                uuid                     NOT NULL,
  "duplicate_family_id"     text,
  "carousel_id"             uuid,
  "slide_id"                uuid,
  "feed_date"               date,
  "usage_type"              text                     NOT NULL,
  "reuse_reason"            text,
  "used_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "business_profile_id"     uuid,
  "category_slug"           text,
  "asset_role"              text,
  "cycle_number"            integer,
  "slide_number"            integer,
  "primary_category_slug"   text,
  "requested_category_slug" text,
  "selection_type"          text,
  "relevance_level"         text,
  "relevance_reason"        text,
  CONSTRAINT "carousel_image_usage_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  CONSTRAINT "carousel_image_usage_carousel_id_fkey" FOREIGN KEY (carousel_id) REFERENCES public.carousel_generations(id) ON DELETE SET NULL,
  CONSTRAINT "carousel_image_usage_pkey" PRIMARY KEY (id),
  CONSTRAINT "carousel_image_usage_relevance_level_chk"
    CHECK (((relevance_level IS NULL) OR (relevance_level = ANY (ARRAY['none'::text, 'light'::text, 'moderate'::text, 'strong'::text])))),
  CONSTRAINT "carousel_image_usage_selection_metadata_chk" CHECK (((selection_type IS NULL) OR ((primary_category_slug IS NOT NULL) AND (requested_category_slug IS
    NOT NULL) AND (relevance_level IS
    NOT NULL) AND
    (((selection_type = 'primary'::text) AND (category_slug = primary_category_slug) AND (requested_category_slug = primary_category_slug) AND (asset_role = ANY
    (ARRAY['hook'::text, 'human'::text, 'static'::text])) AND (relevance_level = 'none'::text) AND (relevance_reason IS NULL)) OR
    ((selection_type = 'related'::text) AND (category_slug <> primary_category_slug) AND (requested_category_slug = category_slug) AND (asset_role = 'static'::text) AND
    (relevance_level = ANY (ARRAY['light'::text, 'moderate'::text, 'strong'::text])) AND (relevance_reason IS
    NOT NULL)) OR
    ((selection_type = 'related_fallback'::text) AND (category_slug = primary_category_slug) AND (requested_category_slug <> primary_category_slug) AND (asset_role =
    'static'::text) AND (relevance_level = ANY (ARRAY['light'::text, 'moderate'::text, 'strong'::text])) AND (relevance_reason IS
    NOT NULL)) OR
    ((selection_type = 'product'::text) AND (category_slug = primary_category_slug) AND (requested_category_slug = primary_category_slug) AND (asset_role = 'product_asset'::text)
    AND (relevance_level = 'none'::text) AND (relevance_reason IS NULL)))))),
  CONSTRAINT "carousel_image_usage_selection_type_chk"
    CHECK (((selection_type IS NULL) OR (selection_type = ANY (ARRAY['primary'::text, 'related'::text, 'related_fallback'::text, 'product'::text])))),
  CONSTRAINT "carousel_image_usage_usage_type_check" CHECK ((usage_type = ANY (ARRAY['assigned'::text, 'shown'::text, 'saved'::text, 'published'::text]))),
  CONSTRAINT "carousel_image_usage_slide_id_fkey" FOREIGN KEY (slide_id) REFERENCES public.carousel_slides(id) ON DELETE SET NULL,
  CONSTRAINT "carousel_image_usage_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES public.category_image_assets(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."carousel_image_usage"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."carousel_image_usage"
  ADD CONSTRAINT "carousel_image_usage_role_assignment_chk" CHECK (((usage_type <> 'assigned'::text) OR ((business_profile_id IS NOT NULL) AND (category_slug IS
    NOT NULL) AND (asset_role = ANY (ARRAY['hook'::text, 'human'::text, 'static'::text, 'product_asset'::text])) AND (cycle_number > 0) AND
    ((slide_number >= 1) AND (slide_number <= 5)) AND (carousel_id IS NOT NULL)))) NOT VALID;

CREATE UNIQUE INDEX carousel_image_usage_carousel_asset_uidx ON public.carousel_image_usage USING btree (carousel_id, asset_id)
  WHERE ((usage_type = 'assigned'::text) AND (carousel_id IS NOT NULL) AND (business_profile_id IS NOT NULL));

CREATE INDEX carousel_image_usage_carousel_idx ON public.carousel_image_usage USING btree (carousel_id, slide_id)
  WHERE (carousel_id IS NOT NULL);

CREATE UNIQUE INDEX carousel_image_usage_carousel_slide_uidx ON public.carousel_image_usage USING btree (carousel_id, slide_number)
  WHERE ((usage_type = 'assigned'::text) AND (carousel_id IS NOT NULL) AND (business_profile_id IS NOT NULL));

CREATE UNIQUE INDEX carousel_image_usage_cycle_asset_uidx ON public.carousel_image_usage USING btree (business_profile_id, category_slug, asset_role, cycle_number, asset_id)
  WHERE ((usage_type = 'assigned'::text) AND (business_profile_id IS NOT NULL));

CREATE INDEX carousel_image_usage_feed_idx ON public.carousel_image_usage USING btree (user_id, feed_date, usage_type, used_at DESC)
  WHERE (feed_date IS NOT NULL);

CREATE INDEX carousel_image_usage_related_selection_idx ON public.carousel_image_usage USING btree (business_profile_id, primary_category_slug, selection_type, used_at DESC)
  WHERE ((usage_type = 'assigned'::text) AND (selection_type IS NOT NULL));

CREATE INDEX carousel_image_usage_user_asset_used_idx ON public.carousel_image_usage USING btree (user_id, asset_id, used_at DESC);

CREATE INDEX carousel_image_usage_user_family_used_idx ON public.carousel_image_usage USING btree (user_id, duplicate_family_id, used_at DESC)
  WHERE (duplicate_family_id IS NOT NULL);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."carousel_image_usage" TO "postgres", "service_role";


-- source: public/tables/daily_carousel_feed_items.sql
CREATE TABLE "public"."daily_carousel_feed_items" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "feed_id"           uuid                     NOT NULL,
  "assignment_id"     uuid                     NOT NULL,
  "position"          integer                  NOT NULL,
  "source"            text                     NOT NULL,
  "carried_from_date" date,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "daily_carousel_feed_items_feed_id_assignment_id_key" UNIQUE (feed_id, assignment_id),
  CONSTRAINT "daily_carousel_feed_items_feed_id_position_key" UNIQUE (feed_id, "position"),
  CONSTRAINT "daily_carousel_feed_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "daily_carousel_feed_items_position_check" CHECK (("position" > 0)),
  CONSTRAINT "daily_carousel_feed_items_source_check" CHECK ((source = ANY (ARRAY['new'::text, 'carried'::text]))),
  CONSTRAINT "daily_carousel_feed_items_feed_id_fkey" FOREIGN KEY (feed_id) REFERENCES public.daily_carousel_feeds(id) ON DELETE CASCADE,
  CONSTRAINT "daily_carousel_feed_items_assignment_id_fkey" FOREIGN KEY (assignment_id) REFERENCES public.user_carousel_assignments(id) ON DELETE CASCADE
);

ALTER TABLE "public"."daily_carousel_feed_items"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX daily_carousel_feed_items_assignment_idx ON public.daily_carousel_feed_items USING btree (assignment_id);

CREATE INDEX daily_carousel_feed_items_feed_position_idx ON public.daily_carousel_feed_items USING btree (feed_id, "position");

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_carousel_feed_items" TO "postgres", "service_role";


-- source: public/tables/daily_trending_feed_slots.sql
CREATE TABLE "public"."daily_trending_feed_slots" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "feed_id"                  uuid                     NOT NULL,
  "position"                 integer                  NOT NULL,
  "format"                   text                     NOT NULL,
  "state"                    text                     NOT NULL DEFAULT 'planned'::text,
  "source"                   text                     NOT NULL DEFAULT 'new'::text,
  "carousel_assignment_id"   uuid,
  "hook_video_assignment_id" uuid,
  "wall_text_assignment_id"  uuid,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "daily_trending_feed_slots_assignment_check"
    CHECK
    ((((state = ANY (ARRAY['planned'::text, 'preparing'::text, 'failed'::text])) AND (carousel_assignment_id IS NULL) AND (hook_video_assignment_id IS NULL) AND
    (wall_text_assignment_id IS NULL)) OR ((state = ANY (ARRAY['ready'::text, 'decided'::text])) AND (((format = 'carousel'::text) AND (carousel_assignment_id IS
    NOT NULL) AND (hook_video_assignment_id IS NULL) AND (wall_text_assignment_id IS NULL)) OR
    ((format = 'hook_video'::text) AND (carousel_assignment_id IS NULL) AND (hook_video_assignment_id IS
    NOT NULL) AND (wall_text_assignment_id IS NULL)) OR
    ((format = 'wall_text'::text) AND (carousel_assignment_id IS NULL) AND (hook_video_assignment_id IS NULL) AND (wall_text_assignment_id IS NOT NULL)))))),
  CONSTRAINT "daily_trending_feed_slots_feed_id_position_key" UNIQUE (feed_id, "position"),
  CONSTRAINT "daily_trending_feed_slots_format_check" CHECK ((format = ANY (ARRAY['carousel'::text, 'hook_video'::text, 'wall_text'::text]))),
  CONSTRAINT "daily_trending_feed_slots_pkey" PRIMARY KEY (id),
  CONSTRAINT "daily_trending_feed_slots_position_check" CHECK (("position" > 0)),
  CONSTRAINT "daily_trending_feed_slots_source_check" CHECK ((source = ANY (ARRAY['new'::text, 'carried'::text]))),
  CONSTRAINT "daily_trending_feed_slots_state_check" CHECK ((state = ANY (ARRAY['planned'::text, 'preparing'::text, 'ready'::text, 'decided'::text, 'failed'::text]))),
  CONSTRAINT "daily_trending_feed_slots_feed_id_fkey" FOREIGN KEY (feed_id) REFERENCES public.daily_trending_feeds(id) ON DELETE CASCADE,
  CONSTRAINT "daily_trending_feed_slots_carousel_assignment_id_fkey" FOREIGN KEY (carousel_assignment_id) REFERENCES public.user_carousel_assignments(id) ON DELETE RESTRICT,
  CONSTRAINT "daily_trending_feed_slots_hook_video_assignment_id_fkey" FOREIGN KEY (hook_video_assignment_id) REFERENCES public.user_hook_video_assignments(id) ON DELETE RESTRICT,
  CONSTRAINT "daily_trending_feed_slots_wall_text_assignment_id_fkey" FOREIGN KEY (wall_text_assignment_id) REFERENCES public.user_wall_text_assignments(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."daily_trending_feed_slots"
  ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX daily_trending_feed_slots_feed_carousel_assignment_uidx ON public.daily_trending_feed_slots USING btree (feed_id, carousel_assignment_id)
  WHERE (carousel_assignment_id IS NOT NULL);

CREATE INDEX daily_trending_feed_slots_feed_state_idx ON public.daily_trending_feed_slots USING btree (feed_id, state, "position");

CREATE UNIQUE INDEX daily_trending_feed_slots_hook_assignment_uidx ON public.daily_trending_feed_slots USING btree (hook_video_assignment_id)
  WHERE (hook_video_assignment_id IS NOT NULL);

CREATE UNIQUE INDEX daily_trending_feed_slots_wall_assignment_uidx ON public.daily_trending_feed_slots USING btree (wall_text_assignment_id)
  WHERE (wall_text_assignment_id IS NOT NULL);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."daily_trending_feed_slots" TO "postgres", "service_role";


-- source: public/tables/library_carousel_slides.sql
CREATE TABLE "public"."library_carousel_slides" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "library_item_id"        uuid                     NOT NULL,
  "carousel_generation_id" uuid                     NOT NULL,
  "carousel_slide_id"      uuid,
  "slide_number"           integer                  NOT NULL,
  "slide_type"             text,
  "headline"               text,
  "subtext"                text,
  "rendered_url"           text                     NOT NULL,
  "rendered_s3_key"        text,
  "metadata"               jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"             timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "library_carousel_slides_carousel_generation_id_fkey" FOREIGN KEY (carousel_generation_id) REFERENCES public.carousel_generations(id) ON DELETE RESTRICT,
  CONSTRAINT "library_carousel_slides_carousel_slide_id_fkey" FOREIGN KEY (carousel_slide_id) REFERENCES public.carousel_slides(id) ON DELETE SET NULL,
  CONSTRAINT "library_carousel_slides_library_item_id_slide_number_key" UNIQUE (library_item_id, slide_number),
  CONSTRAINT "library_carousel_slides_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text)),
  CONSTRAINT "library_carousel_slides_pkey" PRIMARY KEY (id),
  CONSTRAINT "library_carousel_slides_slide_number_check" CHECK ((slide_number > 0)),
  CONSTRAINT "library_carousel_slides_library_item_id_fkey" FOREIGN KEY (library_item_id) REFERENCES public.library_items(id) ON DELETE CASCADE
);

ALTER TABLE "public"."library_carousel_slides"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX library_carousel_slides_item_slide_idx ON public.library_carousel_slides USING btree (library_item_id, slide_number);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."library_carousel_slides" TO "postgres", "service_role";


-- source: public/tables/wall_text_performance_observations.sql
CREATE TABLE "public"."wall_text_performance_observations" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                  text                     NOT NULL,
  "business_profile_id"      uuid                     NOT NULL,
  "wall_text_creative_id"    uuid                     NOT NULL,
  "content_history_id"       uuid                     NOT NULL,
  "generation_assignment_id" uuid,
  "scheduled_post_target_id" uuid                     NOT NULL,
  "social_connection_id"     uuid,
  "platform"                 text                     NOT NULL,
  "platform_post_id"         text                     NOT NULL,
  "published_at"             timestamp with time zone NOT NULL,
  "observed_at"              timestamp with time zone NOT NULL,
  "view_count"               bigint                   NOT NULL,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "wall_text_performance_observation_generation_assignment_id_fkey" FOREIGN KEY (generation_assignment_id) REFERENCES public.wall_text_generation_assignments(id)
    ON DELETE SET NULL,
  CONSTRAINT "wall_text_performance_observations_business_profile_id_fkey" FOREIGN KEY (business_profile_id) REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  CONSTRAINT "wall_text_performance_observations_content_history_id_fkey" FOREIGN KEY (content_history_id) REFERENCES public.wall_text_content_history(id) ON DELETE CASCADE,
  CONSTRAINT "wall_text_performance_observations_pkey" PRIMARY KEY (id),
  CONSTRAINT "wall_text_performance_observations_scheduled_post_target_id_key" UNIQUE (scheduled_post_target_id),
  CONSTRAINT "wall_text_performance_observations_user_id_check" CHECK ((char_length(btrim(user_id)) > 0)),
  CONSTRAINT "wall_text_performance_observations_view_count_check" CHECK ((view_count >= 0)),
  CONSTRAINT "wall_text_performance_observations_wall_text_creative_id_fkey" FOREIGN KEY (wall_text_creative_id) REFERENCES public.wall_text_creatives(id) ON DELETE CASCADE,
  CONSTRAINT "wall_text_performance_platform_post_key" UNIQUE (platform, platform_post_id),
  CONSTRAINT "wall_text_performance_window_chk" CHECK (((observed_at >= (published_at + '72:00:00'::interval)) AND (observed_at <= (published_at + '96:00:00'::interval))))
);

ALTER TABLE "public"."wall_text_performance_observations"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX wall_text_performance_profile_idx ON public.wall_text_performance_observations USING btree (user_id, business_profile_id, observed_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wall_text_performance_observations" TO "postgres", "service_role";


-- source: public/tables/carousel_content_plan_items.fk.sql
-- Foreign keys in a cross-table reference cycle are split out of their
-- table's file: each file loads atomically, so keeping them inline would
-- deadlock the loader (every file would need a table another pending file
-- creates). These statements apply once all referenced tables exist.

ALTER TABLE "public"."carousel_content_plan_items"
  ADD CONSTRAINT "carousel_content_plan_items_consumed_by_carousel_generatio_fkey" FOREIGN KEY (consumed_by_carousel_generation_id) REFERENCES public.carousel_generations(id)
    ON DELETE RESTRICT;


-- source: public/tables/carousel_experiment_assignments.fk.sql
-- Foreign keys in a cross-table reference cycle are split out of their
-- table's file: each file loads atomically, so keeping them inline would
-- deadlock the loader (every file would need a table another pending file
-- creates). These statements apply once all referenced tables exist.

ALTER TABLE "public"."carousel_experiment_assignments"
  ADD CONSTRAINT "carousel_experiment_assignments_carousel_generation_id_fkey" FOREIGN KEY (carousel_generation_id) REFERENCES public.carousel_generations(id) ON DELETE SET NULL;


-- source: public/tables/carousel_generations.fk.sql
-- Foreign keys in a cross-table reference cycle are split out of their
-- table's file: each file loads atomically, so keeping them inline would
-- deadlock the loader (every file would need a table another pending file
-- creates). These statements apply once all referenced tables exist.

ALTER TABLE "public"."carousel_generations"
  ADD CONSTRAINT "carousel_generations_carousel_experiment_assignment_id_fkey" FOREIGN KEY (carousel_experiment_assignment_id) REFERENCES public.carousel_experiment_assignments(id)
    ON DELETE SET NULL;

ALTER TABLE "public"."carousel_generations"
  ADD CONSTRAINT "carousel_generations_content_plan_item_id_fkey" FOREIGN KEY (content_plan_item_id) REFERENCES public.carousel_content_plan_items(id);

ALTER TABLE "public"."carousel_generations"
  ADD CONSTRAINT "carousel_generations_content_plan_item_provenance_fk" FOREIGN KEY (content_plan_item_id, content_plan_id, user_id)
    REFERENCES public.carousel_content_plan_items(id, plan_id, user_id);


-- source: public/tables/product_feedback_attachment_uploads.fk.sql
-- Foreign keys in a cross-table reference cycle are split out of their
-- table's file: each file loads atomically, so keeping them inline would
-- deadlock the loader (every file would need a table another pending file
-- creates). These statements apply once all referenced tables exist.

ALTER TABLE "public"."product_feedback_attachment_uploads"
  ADD CONSTRAINT "product_feedback_attachment_uploads_feedback_id_fkey" FOREIGN KEY (feedback_id) REFERENCES public.product_feedback(id) ON DELETE SET NULL;


-- source: public/tables/product_feedback.fk.sql
-- Foreign keys in a cross-table reference cycle are split out of their
-- table's file: each file loads atomically, so keeping them inline would
-- deadlock the loader (every file would need a table another pending file
-- creates). These statements apply once all referenced tables exist.

ALTER TABLE "public"."product_feedback"
  ADD CONSTRAINT "product_feedback_attachment_upload_id_fkey" FOREIGN KEY (attachment_upload_id) REFERENCES public.product_feedback_attachment_uploads(id);


-- source: public/functions/activate_carousel_content_plan.sql
CREATE OR REPLACE FUNCTION public.activate_carousel_content_plan (
  p_user_id text,
  p_plan_id uuid
)
  RETURNS public.carousel_content_plans
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_brief_count integer;
  v_invalid_brief_item_count integer;
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

  if v_plan.planner_prompt_version in (
    'carousel-content-plan-creative-briefs-v2',
    'carousel-content-plan-creative-briefs-v3-explicit-definitions'
  ) then
    select count(*)::integer
    into v_brief_count
    from public.carousel_content_plan_briefs as brief
    where brief.plan_id = v_plan.id
      and brief.user_id = p_user_id;

    select count(*)::integer
    into v_invalid_brief_item_count
    from (
      select item.creative_brief_id
      from public.carousel_content_plan_items as item
      where item.plan_id = v_plan.id
        and item.user_id = p_user_id
        and item.status = 'planned'
      group by item.creative_brief_id
      having item.creative_brief_id is null or count(*) <> 5
    ) as invalid_brief_items;

    if v_brief_count <> 30
       or v_invalid_brief_item_count <> 0 then
      raise exception 'carousel_content_plan_creative_briefs_incomplete';
    end if;
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
    activated_at = v_now,
    status = 'active',
    updated_at = v_now
  where plan.id = v_plan.id
  returning plan.* into v_plan;

  return v_plan;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."activate_carousel_content_plan"(text, uuid) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."activate_carousel_content_plan"(text, uuid) IS 'Activates a current 30-day plan only after at least 150 planned items exist, all 30 organizational days exist, and every day starts with at least five items.';

REVOKE ALL ON FUNCTION "public"."activate_carousel_content_plan"(text, uuid) FROM PUBLIC;


-- source: public/functions/advance_daily_carousel_replenishment_cycle.sql
CREATE OR REPLACE FUNCTION public.advance_daily_carousel_replenishment_cycle (
  p_cycle_id        text,
  p_expected_cursor uuid,
  p_next_cursor     uuid,
  p_completed       boolean
)
  RETURNS TABLE (
    cycle_id text,
    cursor   uuid,
    status   text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."advance_daily_carousel_replenishment_cycle"(text, uuid, uuid, boolean) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."advance_daily_carousel_replenishment_cycle"(text, uuid, uuid, boolean) FROM PUBLIC;


-- source: public/functions/append_background_job_event.sql
CREATE OR REPLACE FUNCTION public.append_background_job_event (
  p_job_id     uuid,
  p_event_type text,
  p_metadata   jsonb DEFAULT '{}'::jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_event_id uuid;
begin
  if p_event_type is null
    or char_length(trim(p_event_type)) not between 1 and 120 then
    raise exception 'invalid background job event type';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'background job event metadata must be an object';
  end if;

  insert into public.background_job_events (job_id, event_type, metadata)
  values (p_job_id, trim(p_event_type), p_metadata)
  returning id into v_event_id;

  return v_event_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."append_background_job_event"(uuid, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."append_background_job_event"(uuid, text, jsonb) FROM PUBLIC;


-- source: public/functions/apply_dodo_subscription_event.sql
CREATE OR REPLACE FUNCTION public.apply_dodo_subscription_event (
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
$function$;

GRANT EXECUTE
  ON FUNCTION "public"."apply_dodo_subscription_event"(text, text, timestamp WITH time zone, text, text, text, text, text, text, text, text, timestamp WITH time zone, timestamp
    WITH time zone, boolean, timestamp WITH time zone, jsonb, jsonb)
  TO "postgres", "service_role";

REVOKE ALL
  ON FUNCTION "public"."apply_dodo_subscription_event"(text, text, timestamp WITH time zone, text, text, text, text, text, text, text, text, timestamp WITH time zone, timestamp
    WITH time zone, boolean, timestamp WITH time zone, jsonb, jsonb)
  FROM PUBLIC;


-- source: public/functions/assert_business_profile_version_current.sql
CREATE OR REPLACE FUNCTION public.assert_business_profile_version_current (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."assert_business_profile_version_current"(text, uuid, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."assert_business_profile_version_current"(text, uuid, integer) FROM PUBLIC;


-- source: public/functions/attach_carousel_content_plan_generation_job.sql
CREATE OR REPLACE FUNCTION public.attach_carousel_content_plan_generation_job (
  p_user_id text,
  p_plan_id uuid,
  p_job_id  uuid
)
  RETURNS public.carousel_content_plans
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_now timestamptz := timezone('utc', now());
  v_plan public.carousel_content_plans%rowtype;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_plan_id is null
     or p_job_id is null then
    raise exception 'carousel_content_plan_job_input_invalid';
  end if;

  select plan.*
  into v_plan
  from public.carousel_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
  for update;

  if not found or v_plan.status <> 'generating' then
    raise exception 'carousel_content_plan_not_generating';
  end if;

  perform 1
  from public.background_jobs as job
  where job.id = p_job_id
    and job.user_id = p_user_id
    and job.job_type = 'carousel_content_plan_generation'
    and job.input_json ->> 'planId' = p_plan_id::text
  for share;

  if not found then
    raise exception 'carousel_content_plan_generation_job_mismatch';
  end if;

  if v_plan.generation_job_id is not null
     and v_plan.generation_job_id <> p_job_id then
    raise exception 'carousel_content_plan_generation_job_conflict';
  end if;

  update public.carousel_content_plans as plan
  set
    generation_job_id = p_job_id,
    generation_started_at = coalesce(plan.generation_started_at, v_now),
    updated_at = v_now
  where plan.id = p_plan_id
  returning plan.* into v_plan;

  return v_plan;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."attach_carousel_content_plan_generation_job"(text, uuid, uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."attach_carousel_content_plan_generation_job"(text, uuid, uuid) FROM PUBLIC;


-- source: public/functions/attach_carousel_content_plan_items_to_job.sql
CREATE OR REPLACE FUNCTION public.attach_carousel_content_plan_items_to_job (
  p_user_id           text,
  p_reservation_token uuid,
  p_plan_item_ids     uuid[],
  p_job_id            uuid
)
  RETURNS SETOF public.carousel_content_plan_items
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."attach_carousel_content_plan_items_to_job"(text, uuid, uuid[], uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."attach_carousel_content_plan_items_to_job"(text, uuid, uuid[], uuid) FROM PUBLIC;


-- source: public/functions/attach_daily_trending_feed_assignments.sql
CREATE OR REPLACE FUNCTION public.attach_daily_trending_feed_assignments (
  p_feed_id                   uuid,
  p_carousel_assignment_ids   uuid[] DEFAULT ARRAY[]::uuid[],
  p_hook_video_assignment_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_wall_text_assignment_ids  uuid[] DEFAULT ARRAY[]::uuid[]
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  feed_record public.daily_trending_feeds;
  slot_record public.daily_trending_feed_slots;
  resolved_assignment_id uuid;
begin
  select *
  into feed_record
  from public.daily_trending_feeds
  where id = p_feed_id;

  if feed_record.id is null then
    raise exception 'daily_trending_feed_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(feed_record.user_id || ':' || feed_record.local_date::text, 0)
  );

  for slot_record in
    select *
    from public.daily_trending_feed_slots
    where feed_id = p_feed_id
      and state in ('planned', 'failed')
    order by position
    for update
  loop
    resolved_assignment_id := null;

    if slot_record.format = 'carousel' then
      select candidate.assignment_id
      into resolved_assignment_id
      from unnest(p_carousel_assignment_ids) with ordinality
        as candidate(assignment_id, ordinality)
      join public.user_carousel_assignments as assignment
        on assignment.id = candidate.assignment_id
      where assignment.user_id = feed_record.user_id
        and assignment.business_profile_id = feed_record.business_profile_id
        and assignment.business_profile_version = feed_record.business_profile_version
        and assignment.state in ('pending', 'in_progress')
        and not exists (
          select 1
          from public.daily_trending_feed_slots as used_slot
          where used_slot.feed_id = p_feed_id
            and used_slot.carousel_assignment_id = candidate.assignment_id
        )
      order by candidate.ordinality
      limit 1;

      if resolved_assignment_id is not null then
        update public.daily_trending_feed_slots
        set
          carousel_assignment_id = resolved_assignment_id,
          state = 'ready',
          updated_at = now()
        where id = slot_record.id;
      end if;
    elsif slot_record.format = 'hook_video' then
      select candidate.assignment_id
      into resolved_assignment_id
      from unnest(p_hook_video_assignment_ids) with ordinality
        as candidate(assignment_id, ordinality)
      join public.user_hook_video_assignments as assignment
        on assignment.id = candidate.assignment_id
      where assignment.user_id = feed_record.user_id
        and assignment.business_profile_id = feed_record.business_profile_id
        and assignment.business_profile_version = feed_record.business_profile_version
        and assignment.state = 'active'
        and not exists (
          select 1
          from public.daily_trending_feed_slots as used_slot
          where used_slot.hook_video_assignment_id = candidate.assignment_id
        )
      order by candidate.ordinality
      limit 1;

      if resolved_assignment_id is not null then
        update public.daily_trending_feed_slots
        set
          hook_video_assignment_id = resolved_assignment_id,
          state = 'ready',
          updated_at = now()
        where id = slot_record.id;
      end if;
    elsif slot_record.format = 'wall_text' then
      select candidate.assignment_id
      into resolved_assignment_id
      from unnest(p_wall_text_assignment_ids) with ordinality
        as candidate(assignment_id, ordinality)
      join public.user_wall_text_assignments as assignment
        on assignment.id = candidate.assignment_id
      where assignment.user_id = feed_record.user_id
        and assignment.business_profile_id = feed_record.business_profile_id
        and assignment.business_profile_version = feed_record.business_profile_version
        and assignment.state = 'active'
        and not exists (
          select 1
          from public.daily_trending_feed_slots as used_slot
          where used_slot.wall_text_assignment_id = candidate.assignment_id
        )
      order by candidate.ordinality
      limit 1;

      if resolved_assignment_id is not null then
        update public.daily_trending_feed_slots
        set
          wall_text_assignment_id = resolved_assignment_id,
          state = 'ready',
          updated_at = now()
        where id = slot_record.id;
      end if;
    end if;
  end loop;

  update public.daily_trending_feeds
  set
    status = case
      when not exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state <> 'decided'
      ) then 'completed'
      when exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state = 'ready'
      ) then 'ready'
      when exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state in ('planned', 'preparing')
      ) then 'preparing'
      else 'failed'
    end,
    last_error = case
      when exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state in ('ready', 'planned', 'preparing')
      ) then null
      else last_error
    end,
    updated_at = now()
  where id = p_feed_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."attach_daily_trending_feed_assignments"(uuid, uuid[], uuid[], uuid[]) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."attach_daily_trending_feed_assignments"(uuid, uuid[], uuid[], uuid[]) FROM PUBLIC;


-- source: public/functions/attach_trending_hook_generation_chunk_job_v1.sql
CREATE OR REPLACE FUNCTION public.attach_trending_hook_generation_chunk_job_v1 (
  p_chunk_id          uuid,
  p_background_job_id uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_chunk public.trending_hook_generation_run_chunks%rowtype;
begin
  if p_chunk_id is null or p_background_job_id is null then
    raise exception 'trending_hook_generation_chunk_attachment_invalid_input';
  end if;

  select *
  into v_chunk
  from public.trending_hook_generation_run_chunks as chunk
  where chunk.id = p_chunk_id
  for update;

  if not found or v_chunk.status <> 'reserved' then
    return false;
  end if;

  if v_chunk.background_job_id is not null
    and v_chunk.background_job_id <> p_background_job_id
    and not exists (
      select 1
      from public.background_jobs as job
      where job.id = v_chunk.background_job_id
        and job.status in ('failed', 'cancelled')
    )
  then
    return false;
  end if;

  update public.trending_hook_generation_run_chunks
  set
    background_job_id = p_background_job_id,
    updated_at = now()
  where id = v_chunk.id;

  update public.trending_hook_generation_runs
  set
    status = 'processing',
    updated_at = now()
  where id = v_chunk.run_id
    and status in ('queued', 'continuation_pending');

  return true;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."attach_trending_hook_generation_chunk_job_v1"(uuid, uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."attach_trending_hook_generation_chunk_job_v1"(uuid, uuid) FROM PUBLIC;


-- source: public/functions/attach_video_render_execution_slot.sql
CREATE OR REPLACE FUNCTION public.attach_video_render_execution_slot (
  p_job_id              uuid,
  p_claim_token         uuid,
  p_worker_execution_id text
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  with attached as (
    update public.video_render_execution_slots as slot
    set
      updated_at = now(),
      worker_execution_id = left(trim(p_worker_execution_id), 255)
    where slot.background_job_id = p_job_id
      and slot.claim_token = p_claim_token
      and slot.worker_execution_id is null
    returning 1
  )
  select exists(select 1 from attached);
$function$;

GRANT EXECUTE ON FUNCTION "public"."attach_video_render_execution_slot"(uuid, uuid, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."attach_video_render_execution_slot"(uuid, uuid, text) FROM PUBLIC;


-- source: public/functions/attach_wall_text_content_plan_generation_job.sql
CREATE OR REPLACE FUNCTION public.attach_wall_text_content_plan_generation_job (
  p_user_id text,
  p_plan_id uuid,
  p_job_id  uuid
)
  RETURNS public.wall_text_content_plans
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_plan public.wall_text_content_plans%rowtype;
begin
  select plan.* into v_plan
  from public.wall_text_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
    and plan.status = 'generating'
  for update;
  if not found then
    raise exception 'wall_text_content_plan_not_generating';
  end if;

  perform 1
  from public.background_jobs as job
  where job.id = p_job_id
    and job.user_id = p_user_id
    and job.job_type = 'wall_text_content_plan_generation'
    and job.input_json ->> 'planId' = p_plan_id::text
  for share;
  if not found then
    raise exception 'wall_text_content_plan_generation_job_mismatch';
  end if;

  if v_plan.generation_job_id is not null
     and v_plan.generation_job_id <> p_job_id then
    raise exception 'wall_text_content_plan_generation_job_conflict';
  end if;

  update public.wall_text_content_plans as plan
  set
    generation_job_id = p_job_id,
    generation_started_at = coalesce(plan.generation_started_at, timezone('utc', now())),
    updated_at = timezone('utc', now())
  where plan.id = p_plan_id
  returning plan.* into v_plan;

  return v_plan;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."attach_wall_text_content_plan_generation_job"(text, uuid, uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."attach_wall_text_content_plan_generation_job"(text, uuid, uuid) FROM PUBLIC;


-- source: public/functions/cancel_scheduled_post.sql
CREATE OR REPLACE FUNCTION public.cancel_scheduled_post (
  p_post_id uuid,
  p_user_id text
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_now timestamptz := now();
  v_post_status text;
begin
  select post.status
  into v_post_status
  from public.scheduled_posts as post
  where post.id = p_post_id
    and post.user_id = p_user_id
  for update;

  if not found then
    return 'not_found';
  end if;

  perform target.id
  from public.scheduled_post_targets as target
  where target.scheduled_post_id = p_post_id
    and target.user_id = p_user_id
  order by target.id
  for update;

  if v_post_status = 'published'
    or exists (
      select 1
      from public.scheduled_post_targets as target
      where target.scheduled_post_id = p_post_id
        and target.user_id = p_user_id
        and target.status = 'published'
    )
    or exists (
      select 1
      from public.social_publish_operations as operation
      join public.scheduled_post_targets as target
        on target.id = operation.scheduled_post_target_id
      where target.scheduled_post_id = p_post_id
        and target.user_id = p_user_id
        and (
          operation.active_claim_token is not null
          or operation.status = 'published'
        )
    ) then
    return 'too_late';
  end if;

  update public.scheduled_posts as post
  set
    cancelled_at = v_now,
    last_error_code = null,
    status = 'cancelled',
    updated_at = v_now
  where post.id = p_post_id
    and post.user_id = p_user_id;

  update public.scheduled_post_targets as target
  set
    cancelled_at = v_now,
    next_retry_at = null,
    status = 'cancelled',
    updated_at = v_now
  where target.scheduled_post_id = p_post_id
    and target.user_id = p_user_id
    and target.status in (
      'draft',
      'scheduling',
      'scheduled',
      'publishing',
      'failed',
      'action_required'
    );

  update public.background_jobs as job
  set
    claim_token = null,
    completed_at = v_now,
    next_attempt_at = null,
    status = 'cancelled',
    updated_at = v_now
  where job.status in ('queued', 'processing')
    and exists (
      select 1
      from public.scheduled_post_targets as target
      where target.scheduled_post_id = p_post_id
        and target.user_id = p_user_id
        and target.publish_job_id = job.id
    );

  return 'cancelled';
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."cancel_scheduled_post"(uuid, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."cancel_scheduled_post"(uuid, text) FROM PUBLIC;


-- source: public/functions/claim_background_job.sql
CREATE OR REPLACE FUNCTION public.claim_background_job (
  p_job_id              uuid,
  p_worker_id           text,
  p_claim_token         uuid,
  p_stale_after_seconds integer
)
  RETURNS SETOF public.background_jobs
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_now timestamptz := now();
  v_stale_after_seconds integer := greatest(
    30,
    least(coalesce(p_stale_after_seconds, 600), 43200)
  );
begin
  if p_worker_id is null or char_length(trim(p_worker_id)) = 0 then
    raise exception 'worker id is required';
  end if;

  if p_claim_token is null then
    raise exception 'claim token is required';
  end if;

  return query
  update public.background_jobs as job
  set
    claim_token = p_claim_token,
    completed_at = null,
    error_code = null,
    error_message = null,
    last_heartbeat_at = v_now,
    locked_at = v_now,
    next_attempt_at = null,
    stage = 'processing',
    started_at = coalesce(job.started_at, v_now),
    status = 'processing',
    updated_at = v_now,
    worker_execution_id = left(trim(p_worker_id) || ':' || p_claim_token::text, 255),
    worker_id = left(trim(p_worker_id), 255)
  where job.id = p_job_id
    and (
      (
        job.status in ('queued', 'stalled')
        and (job.next_attempt_at is null or job.next_attempt_at <= v_now)
      )
      or (
        job.status in (
          'processing',
          'waiting_external_service',
          'rendering',
          'uploading_output'
        )
        and coalesce(job.last_heartbeat_at, job.locked_at, job.updated_at)
          < v_now - make_interval(secs => v_stale_after_seconds)
      )
    )
  returning job.*;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."claim_background_job"(uuid, text, uuid, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."claim_background_job"(uuid, text, uuid, integer) FROM PUBLIC;


-- source: public/functions/claim_daily_carousel_replenishment_cycle.sql
CREATE OR REPLACE FUNCTION public.claim_daily_carousel_replenishment_cycle (
  p_requested_cycle_id text
)
  RETURNS TABLE (
    cycle_id text,
    cursor   uuid,
    status   text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."claim_daily_carousel_replenishment_cycle"(text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."claim_daily_carousel_replenishment_cycle"(text) FROM PUBLIC;


-- source: public/functions/claim_due_trending_feed_reconciliations.sql
CREATE OR REPLACE FUNCTION public.claim_due_trending_feed_reconciliations (
  p_limit         integer DEFAULT 25,
  p_source_job_id uuid    DEFAULT NULL::uuid
)
  RETURNS TABLE (
    source_job_id uuid,
    user_id       text,
    attempt_count integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  return query
  with eligible as (
    select outbox.source_job_id
    from public.trending_feed_reconciliation_outbox as outbox
    where (
      (
        outbox.status = 'pending'
        and outbox.next_attempt_at <= now()
      ) or (
        outbox.status = 'processing'
        and outbox.locked_at < now() - interval '10 minutes'
      )
    )
    and (p_source_job_id is null or outbox.source_job_id = p_source_job_id)
    order by outbox.next_attempt_at, outbox.created_at
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    for update skip locked
  ), claimed as (
    update public.trending_feed_reconciliation_outbox as outbox
    set
      status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      locked_at = now(),
      last_attempt_at = now(),
      updated_at = now()
    from eligible
    where outbox.source_job_id = eligible.source_job_id
    returning outbox.source_job_id, outbox.user_id, outbox.attempt_count
  )
  select claimed.source_job_id, claimed.user_id, claimed.attempt_count
  from claimed;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."claim_due_trending_feed_reconciliations"(integer, uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."claim_due_trending_feed_reconciliations"(integer, uuid) FROM PUBLIC;


-- source: public/functions/claim_due_trending_hook_generation_chunk_dispatches_v1.sql
CREATE OR REPLACE FUNCTION public.claim_due_trending_hook_generation_chunk_dispatches_v1 (
  p_limit               integer DEFAULT 25,
  p_claim_token         uuid    DEFAULT NULL::uuid,
  p_stale_after_seconds integer DEFAULT 300
)
  RETURNS TABLE (
    dispatch_id        uuid,
    run_id             uuid,
    chunk_id           uuid,
    user_id            text,
    target_valid_count integer,
    attempt_count      integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_claim_token uuid := coalesce(p_claim_token, gen_random_uuid());
  v_stale_after_seconds integer := greatest(
    60,
    least(coalesce(p_stale_after_seconds, 300), 43200)
  );
begin
  return query
  with due as (
    select dispatch.id
    from public.trending_hook_generation_dispatch_outbox as dispatch
    join public.trending_hook_generation_run_chunks as chunk
      on chunk.id = dispatch.chunk_id
    where chunk.status = 'reserved'
      and chunk.background_job_id is null
      and (
        (dispatch.status = 'pending' and dispatch.next_attempt_at <= now())
        or (
          dispatch.status = 'processing'
          and dispatch.claimed_at <= now() - make_interval(secs => v_stale_after_seconds)
        )
      )
    order by dispatch.next_attempt_at, dispatch.created_at, dispatch.id
    limit v_limit
    for update of dispatch skip locked
  ), claimed as (
    update public.trending_hook_generation_dispatch_outbox as dispatch
    set
      status = 'processing',
      attempt_count = dispatch.attempt_count + 1,
      claim_token = v_claim_token,
      claimed_at = now(),
      updated_at = now()
    from due
    where dispatch.id = due.id
    returning dispatch.*
  )
  select
    dispatch.id,
    dispatch.run_id,
    dispatch.chunk_id,
    dispatch.user_id,
    run.target_valid_count,
    dispatch.attempt_count
  from claimed as dispatch
  join public.trending_hook_generation_runs as run
    on run.id = dispatch.run_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."claim_due_trending_hook_generation_chunk_dispatches_v1"(integer, uuid, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."claim_due_trending_hook_generation_chunk_dispatches_v1"(integer, uuid, integer) FROM PUBLIC;


-- source: public/functions/claim_hook_video_library_render.sql
CREATE OR REPLACE FUNCTION public.claim_hook_video_library_render (
  p_draft_id           uuid,
  p_render_fingerprint text,
  p_user_id            text
)
  RETURNS SETOF public.hook_video_drafts
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  claimed public.hook_video_drafts;
  requested_at timestamptz := now();
begin
  if p_draft_id is null
    or char_length(trim(coalesce(p_render_fingerprint, ''))) = 0
    or char_length(trim(coalesce(p_user_id, ''))) = 0
  then
    raise exception 'hook_video_render_invalid_scope';
  end if;

  select draft.*
  into claimed
  from public.hook_video_drafts as draft
  where draft.id = p_draft_id
    and draft.user_id = p_user_id
    and draft.library_saved_at is not null
  for update;

  if not found then
    raise exception 'hook_video_render_draft_unavailable';
  end if;

  if claimed.render_status in ('queued', 'rendering', 'ready')
    and claimed.render_id is not null
    and claimed.render_fingerprint = p_render_fingerprint
  then
    return next claimed;
    return;
  end if;

  update public.hook_video_drafts
  set
    render_error = null,
    render_fingerprint = p_render_fingerprint,
    render_id = gen_random_uuid(),
    render_job_id = null,
    render_requested_at = requested_at,
    render_status = 'queued',
    rendered_at = null,
    rendered_media_asset_id = null,
    rendered_video_url = null,
    updated_at = requested_at
  where id = claimed.id
  returning * into claimed;

  return next claimed;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."claim_hook_video_library_render"(uuid, text, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."claim_hook_video_library_render"(uuid, text, text) FROM PUBLIC;


-- source: public/functions/claim_social_connection_token_refresh.sql
CREATE OR REPLACE FUNCTION public.claim_social_connection_token_refresh (
  p_connection_id       uuid,
  p_user_id             text,
  p_claim_token         uuid,
  p_stale_after_seconds integer
)
  RETURNS SETOF public.social_connections
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_now timestamptz := now();
  v_stale_after_seconds integer := greatest(
    30,
    least(coalesce(p_stale_after_seconds, 120), 900)
  );
begin
  if p_claim_token is null then
    raise exception 'refresh claim token is required';
  end if;

  return query
  update public.social_connections as connection
  set
    token_refresh_claim_token = p_claim_token,
    token_refresh_claimed_at = v_now,
    updated_at = v_now
  where connection.id = p_connection_id
    and connection.user_id = p_user_id
    and connection.revoked_at is null
    and connection.status <> 'revoked'
    and (
      connection.refresh_token_ciphertext is not null
      or connection.platform = 'instagram'
    )
    and (
      connection.token_refresh_claim_token is null
      or connection.token_refresh_claimed_at <
        v_now - make_interval(secs => v_stale_after_seconds)
      or connection.token_refresh_claim_token = p_claim_token
    )
  returning connection.*;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."claim_social_connection_token_refresh"(uuid, text, uuid, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."claim_social_connection_token_refresh"(uuid, text, uuid, integer) FROM PUBLIC;


-- source: public/functions/claim_social_publish_operation_with_account_lane.sql
CREATE OR REPLACE FUNCTION public.claim_social_publish_operation_with_account_lane (
  p_target_id           uuid,
  p_user_id             text,
  p_platform            text,
  p_job_id              uuid,
  p_claim_token         uuid,
  p_stale_after_seconds integer
)
  RETURNS SETOF public.social_publish_operations
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_connection_id uuid;
  v_lane public.social_publish_account_lanes%rowtype;
  v_operation public.social_publish_operations%rowtype;
  v_now timestamptz := now();
  v_stale_after_seconds integer := greatest(
    30,
    least(coalesce(p_stale_after_seconds, 900), 43200)
  );
begin
  if p_claim_token is null then
    raise exception 'publish claim token is required';
  end if;

  select target.social_connection_id
  into v_connection_id
  from public.scheduled_post_targets as target
  where target.id = p_target_id
    and target.user_id = p_user_id
    and target.platform = p_platform;

  if not found then
    return;
  end if;

  if not exists (
    select 1
    from public.background_jobs as requested_job
    where requested_job.id = p_job_id
      and requested_job.user_id = p_user_id
      and requested_job.job_type = 'publish_social_post'
      and requested_job.status = 'processing'
      and requested_job.claim_token = p_claim_token
      and requested_job.input_json ->> 'targetId' = p_target_id::text
  ) then
    return;
  end if;

  -- Lock a stable account key before insert/update so two first-time publishes
  -- to the same account cannot both create an active lane.
  perform pg_advisory_xact_lock(hashtextextended(p_platform || ':' || v_connection_id::text, 0));

  insert into public.social_publish_account_lanes (platform, social_connection_id)
  values (p_platform, v_connection_id)
  on conflict (platform, social_connection_id) do nothing;

  select lane.*
  into v_lane
  from public.social_publish_account_lanes as lane
  where lane.platform = p_platform
    and lane.social_connection_id = v_connection_id
  for update;

  if v_lane.active_job_id is not null
    and not (
      v_lane.active_job_id = p_job_id
      and v_lane.active_claim_token = p_claim_token
    )
    and exists (
      select 1
      from public.background_jobs as active_job
      where active_job.id = v_lane.active_job_id
        and active_job.status = 'processing'
        and active_job.claim_token = v_lane.active_claim_token
        and coalesce(
          active_job.last_heartbeat_at,
          active_job.locked_at,
          active_job.updated_at
        ) >= v_now - make_interval(secs => v_stale_after_seconds)
    ) then
    return;
  end if;

  update public.social_publish_account_lanes as lane
  set
    active_job_id = p_job_id,
    active_claim_token = p_claim_token,
    claimed_at = v_now,
    updated_at = v_now
  where lane.platform = p_platform
    and lane.social_connection_id = v_connection_id;

  select operation.*
  into v_operation
  from public.claim_social_publish_operation(
    p_target_id,
    p_user_id,
    p_platform,
    p_job_id,
    p_claim_token,
    p_stale_after_seconds
  ) as operation
  limit 1;

  if not found then
    update public.social_publish_account_lanes as lane
    set
      active_job_id = null,
      active_claim_token = null,
      claimed_at = null,
      updated_at = v_now
    where lane.platform = p_platform
      and lane.social_connection_id = v_connection_id
      and lane.active_job_id = p_job_id
      and lane.active_claim_token = p_claim_token;
    return;
  end if;

  return next v_operation;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."claim_social_publish_operation_with_account_lane"(uuid, text, text, uuid, uuid, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."claim_social_publish_operation_with_account_lane"(uuid, text, text, uuid, uuid, integer) FROM PUBLIC;


-- source: public/functions/claim_social_publish_operation.sql
CREATE OR REPLACE FUNCTION public.claim_social_publish_operation (
  p_target_id           uuid,
  p_user_id             text,
  p_platform            text,
  p_job_id              uuid,
  p_claim_token         uuid,
  p_stale_after_seconds integer
)
  RETURNS SETOF public.social_publish_operations
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_now timestamptz := now();
  v_operation_id uuid;
  v_post_id uuid;
  v_post_status text;
  v_stale_after_seconds integer := greatest(
    30,
    least(coalesce(p_stale_after_seconds, 900), 43200)
  );
  v_target_status text;
begin
  select target.scheduled_post_id
  into v_post_id
  from public.scheduled_post_targets as target
  where target.id = p_target_id
    and target.user_id = p_user_id
    and target.platform = p_platform;

  if not found then
    return;
  end if;

  select post.status
  into v_post_status
  from public.scheduled_posts as post
  where post.id = v_post_id
    and post.user_id = p_user_id
  for update;

  if not found or v_post_status in ('cancelled', 'published') then
    return;
  end if;

  select target.status
  into v_target_status
  from public.scheduled_post_targets as target
  where target.id = p_target_id
    and target.user_id = p_user_id
    and target.platform = p_platform
  for update;

  if not found
    or v_target_status not in ('scheduling', 'scheduled', 'publishing') then
    return;
  end if;

  if not exists (
    select 1
    from public.background_jobs as requested_job
    where requested_job.id = p_job_id
      and requested_job.user_id = p_user_id
      and requested_job.job_type = 'publish_social_post'
      and requested_job.status = 'processing'
      and requested_job.claim_token = p_claim_token
      and requested_job.input_json ->> 'targetId' = p_target_id::text
  ) then
    return;
  end if;

  insert into public.social_publish_operations (
    idempotency_key,
    platform,
    scheduled_post_target_id,
    user_id
  ) values (
    'social-publish:' || p_target_id::text || ':v1',
    p_platform,
    p_target_id,
    p_user_id
  )
  on conflict (scheduled_post_target_id) do nothing;

  update public.social_publish_operations as operation
  set
    active_claim_token = p_claim_token,
    active_job_id = p_job_id,
    claimed_at = v_now,
    last_error_code = null,
    last_error_message = null,
    updated_at = v_now
  where operation.scheduled_post_target_id = p_target_id
    and operation.user_id = p_user_id
    and operation.platform = p_platform
    and operation.status <> 'published'
    and (
      operation.active_claim_token is null
      or (
        operation.active_job_id = p_job_id
        and operation.active_claim_token = p_claim_token
      )
      or not exists (
        select 1
        from public.background_jobs as active_job
        where active_job.id = operation.active_job_id
          and active_job.status = 'processing'
          and active_job.claim_token = operation.active_claim_token
          and coalesce(
            active_job.last_heartbeat_at,
            active_job.locked_at,
            active_job.updated_at
          ) >= v_now - make_interval(secs => v_stale_after_seconds)
      )
    )
  returning operation.id into v_operation_id;

  if v_operation_id is null then
    return;
  end if;

  update public.scheduled_post_targets as target
  set
    attempt_count = target.attempt_count + 1,
    last_error_code = null,
    last_error_message = null,
    next_retry_at = null,
    status = 'publishing',
    updated_at = v_now
  where target.id = p_target_id
    and target.user_id = p_user_id;

  update public.scheduled_posts as post
  set
    last_error_code = null,
    status = 'publishing',
    updated_at = v_now
  where post.id = v_post_id
    and post.user_id = p_user_id;

  return query
  select operation.*
  from public.social_publish_operations as operation
  where operation.id = v_operation_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."claim_social_publish_operation"(uuid, text, text, uuid, uuid, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."claim_social_publish_operation"(uuid, text, text, uuid, uuid, integer) FROM PUBLIC;


-- source: public/functions/claim_video_render_execution_slot.sql
CREATE OR REPLACE FUNCTION public.claim_video_render_execution_slot (
  p_job_id              uuid,
  p_claim_token         uuid,
  p_stale_after_seconds integer DEFAULT 300
)
  RETURNS TABLE (
    slot_number   smallint,
    should_launch boolean,
    is_launched   boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_job public.background_jobs%rowtype;
  v_slot public.video_render_execution_slots%rowtype;
  v_now timestamptz := now();
  v_stale_after_seconds integer := greatest(
    60,
    least(coalesce(p_stale_after_seconds, 300), 3600)
  );
begin
  if p_claim_token is null then
    raise exception 'render slot claim token is required';
  end if;

  select job.*
  into v_job
  from public.background_jobs as job
  where job.id = p_job_id
    and job.queue_name = 'video-render'
    and job.job_type in (
      'render_edit_video',
      'render_schedule_combination',
      'render_trending_carousel_edit',
      'render_wall_text_video'
    )
  for update;

  if not found or v_job.status in ('cancelled', 'completed', 'failed') then
    return;
  end if;

  -- A redelivered launcher task first reuses its existing durable slot. A
  -- fresh lease means another launcher is still attaching the Cloud Run
  -- execution, so it must not start a second render.
  select slot.*
  into v_slot
  from public.video_render_execution_slots as slot
  where slot.background_job_id = p_job_id
  for update;

  if found then
    if v_slot.worker_execution_id is not null
      or v_job.status in ('processing', 'waiting_external_service', 'rendering', 'uploading_output')
      or v_slot.claimed_at >= v_now - make_interval(secs => v_stale_after_seconds) then
      return query select
        v_slot.slot_number,
        false,
        v_slot.worker_execution_id is not null
          or v_job.status in ('processing', 'waiting_external_service', 'rendering', 'uploading_output');
      return;
    end if;

    update public.video_render_execution_slots as slot
    set
      claim_token = p_claim_token,
      claimed_at = v_now,
      updated_at = v_now,
      worker_execution_id = null
    where slot.slot_number = v_slot.slot_number;

    return query select v_slot.slot_number, true, false;
    return;
  end if;

  -- Reclaim only a stale, unlaunched queued slot. A slot for a processing
  -- render stays occupied until the background job reaches a terminal state.
  update public.video_render_execution_slots as slot
  set
    background_job_id = null,
    claim_token = null,
    claimed_at = null,
    updated_at = v_now,
    worker_execution_id = null
  where slot.background_job_id is not null
    and slot.worker_execution_id is null
    and slot.claimed_at < v_now - make_interval(secs => v_stale_after_seconds)
    and exists (
      select 1
      from public.background_jobs as old_job
      where old_job.id = slot.background_job_id
        and old_job.status in ('created', 'queued', 'stalled')
    );

  select slot.*
  into v_slot
  from public.video_render_execution_slots as slot
  where slot.background_job_id is null
  order by slot.slot_number
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.video_render_execution_slots as slot
  set
    background_job_id = p_job_id,
    claim_token = p_claim_token,
    claimed_at = v_now,
    updated_at = v_now,
    worker_execution_id = null
  where slot.slot_number = v_slot.slot_number;

  return query select v_slot.slot_number, true, false;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."claim_video_render_execution_slot"(uuid, uuid, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."claim_video_render_execution_slot"(uuid, uuid, integer) FROM PUBLIC;


-- source: public/functions/claim_wall_text_generation_chunk_v1.sql
CREATE OR REPLACE FUNCTION public.claim_wall_text_generation_chunk_v1 (
  p_user_id  text,
  p_chunk_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  chunk_record public.wall_text_generation_chunks;
  next_claim_token uuid;
begin
  select chunk.* into chunk_record
  from public.wall_text_generation_chunks as chunk
  join public.wall_text_generation_batches as batch
    on batch.id = chunk.batch_id
  where chunk.id = p_chunk_id
    and batch.user_id = p_user_id
  for update of chunk;
  if not found then
    raise exception 'wall_text_generation_chunk_unavailable';
  end if;

  if chunk_record.status = 'completed' then
    return null;
  end if;
  if chunk_record.status = 'failed' then
    raise exception 'wall_text_generation_chunk_failed';
  end if;
  if chunk_record.status = 'processing'
    and chunk_record.locked_at > now() - interval '15 minutes'
  then
    return null;
  end if;

  next_claim_token := gen_random_uuid();

  update public.wall_text_generation_chunks
  set
    attempt_count = attempt_count + 1,
    claim_token = next_claim_token,
    last_error_code = null,
    last_error_message = null,
    locked_at = now(),
    status = 'processing',
    updated_at = now()
  where id = p_chunk_id;

  update public.wall_text_generation_assignments
  set status = 'processing', updated_at = now()
  where chunk_id = p_chunk_id
    and status <> 'completed';

  update public.wall_text_generation_batches
  set status = 'processing', updated_at = now()
  where id = chunk_record.batch_id
    and status <> 'completed';

  return next_claim_token;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."claim_wall_text_generation_chunk_v1"(text, uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."claim_wall_text_generation_chunk_v1"(text, uuid) FROM PUBLIC;


-- source: public/functions/claim_wall_text_render.sql
CREATE OR REPLACE FUNCTION public.claim_wall_text_render (
  p_assignment_id uuid,
  p_user_id       text,
  p_edit_id       uuid    DEFAULT NULL::uuid,
  p_edit_revision integer DEFAULT NULL::integer
)
  RETURNS SETOF public.user_wall_text_assignments
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  claimed public.user_wall_text_assignments;
  requested_at timestamptz := now();
begin
  if p_assignment_id is null
    or char_length(btrim(coalesce(p_user_id, ''))) = 0
    or ((p_edit_id is null) <> (p_edit_revision is null))
    or (p_edit_revision is not null and p_edit_revision <= 0)
  then
    raise exception 'wall_text_render_invalid_scope';
  end if;

  if p_edit_id is not null and not exists (
    select 1
    from public.trending_creative_edits as edit
    where edit.id = p_edit_id
      and edit.user_id = btrim(p_user_id)
      and edit.assignment_id = p_assignment_id
      and edit.format = 'wall_text'
      and edit.revision = p_edit_revision
  ) then
    raise exception 'wall_text_render_edit_unavailable';
  end if;

  select assignment.*
  into claimed
  from public.user_wall_text_assignments as assignment
  where assignment.id = p_assignment_id
    and assignment.user_id = btrim(p_user_id)
    and assignment.state in ('active', 'selected')
  for update;

  if not found then
    raise exception 'wall_text_render_assignment_unavailable';
  end if;

  if claimed.render_status in ('queued', 'rendering', 'ready')
    and claimed.render_id is not null
    and claimed.render_edit_id is not distinct from p_edit_id
    and claimed.render_edit_revision is not distinct from p_edit_revision
  then
    if claimed.state = 'active' then
      update public.user_wall_text_assignments
      set
        completed_at = coalesce(completed_at, requested_at),
        last_opened_at = requested_at,
        state = 'selected',
        updated_at = requested_at
      where id = claimed.id
      returning * into claimed;
    end if;

    return next claimed;
    return;
  end if;

  update public.user_wall_text_assignments
  set
    completed_at = coalesce(completed_at, requested_at),
    last_opened_at = requested_at,
    render_edit_id = p_edit_id,
    render_edit_revision = p_edit_revision,
    render_error = null,
    render_id = gen_random_uuid(),
    render_job_id = null,
    render_requested_at = requested_at,
    render_status = 'queued',
    rendered_at = null,
    rendered_media_asset_id = null,
    state = 'selected',
    updated_at = requested_at
  where id = claimed.id
  returning * into claimed;

  return next claimed;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."claim_wall_text_render"(uuid, text, uuid, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."claim_wall_text_render"(uuid, text, uuid, integer) FROM PUBLIC;


-- source: public/functions/complete_background_job.sql
CREATE OR REPLACE FUNCTION public.complete_background_job (
  p_job_id           uuid,
  p_claim_token      uuid,
  p_output           jsonb,
  p_output_reference text  DEFAULT NULL::text
)
  RETURNS SETOF public.background_jobs
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_current public.background_jobs%rowtype;
  v_output jsonb := coalesce(p_output, '{}'::jsonb);
  v_now timestamptz := now();
  v_asset_id uuid;
  v_collection text;
  v_source_type text;
  v_title text;
  v_mime_type text;
  v_storage_key text;
  v_url text;
  v_thumbnail_url text;
  v_ratio text;
  v_width integer;
  v_height integer;
  v_duration_seconds numeric;
  v_file_size_bytes bigint;
begin
  if p_claim_token is null then
    raise exception 'claim token is required';
  end if;

  if p_output is null or jsonb_typeof(p_output) <> 'object' then
    raise exception 'background job output must be an object';
  end if;

  select job.*
  into v_current
  from public.background_jobs as job
  where job.id = p_job_id
    and job.claim_token = p_claim_token
    and job.status in (
      'processing',
      'waiting_external_service',
      'rendering',
      'uploading_output'
    )
  for update;

  if not found then
    return;
  end if;

  if v_current.job_type in (
    'generate_avatar',
    'generate_hook_video',
    'generate_image'
  ) then
    if v_current.user_id is null or char_length(trim(v_current.user_id)) = 0 then
      raise exception 'generated media job requires an owner';
    end if;

    v_storage_key := nullif(trim(p_output ->> 'key'), '');
    v_url := nullif(trim(p_output ->> 'url'), '');

    if v_storage_key is null then
      raise exception 'generated media output requires a storage key';
    end if;

    if v_url is null or v_url !~ '^https?://' then
      raise exception 'generated media output requires an HTTP URL';
    end if;

    v_collection := case
      when v_current.job_type = 'generate_hook_video' then 'video'
      else 'image'
    end;
    v_source_type := case
      when v_current.job_type = 'generate_hook_video' then 'generated_video'
      else 'generated_image'
    end;
    v_title := case
      when v_current.job_type = 'generate_hook_video' then 'Generated influencer video'
      when v_current.job_type = 'generate_avatar' then 'Generated influencer image'
      else 'Generated image'
    end;
    v_mime_type := case
      when v_current.job_type = 'generate_hook_video' then 'video/mp4'
      else 'image/png'
    end;
    v_thumbnail_url := case
      when v_current.job_type = 'generate_hook_video'
        and coalesce(p_output ->> 'thumbnailUrl', '') ~ '^https?://'
        then p_output ->> 'thumbnailUrl'
      when v_current.job_type <> 'generate_hook_video' then v_url
      else null
    end;
    v_ratio := case
      when p_output ->> 'ratio' in ('9:16', '1:1', '4:5', '16:9', 'other')
        then p_output ->> 'ratio'
      when v_current.input_json ->> 'aspectRatio' in ('9:16', '1:1', '4:5', '16:9', 'other')
        then v_current.input_json ->> 'aspectRatio'
      else 'other'
    end;
    v_width := case
      when coalesce(p_output ->> 'width', '') ~ '^[1-9][0-9]*$'
        then (p_output ->> 'width')::integer
      else null
    end;
    v_height := case
      when coalesce(p_output ->> 'height', '') ~ '^[1-9][0-9]*$'
        then (p_output ->> 'height')::integer
      else null
    end;
    v_duration_seconds := case
      when coalesce(p_output ->> 'durationSeconds', '') ~ '^[0-9]+([.][0-9]+)?$'
        then (p_output ->> 'durationSeconds')::numeric
      else null
    end;
    v_file_size_bytes := case
      when coalesce(p_output ->> 'fileSizeBytes', '') ~ '^[1-9][0-9]*$'
        then (p_output ->> 'fileSizeBytes')::bigint
      else null
    end;

    select asset.id
    into v_asset_id
    from public.media_assets as asset
    where asset.user_id = v_current.user_id
      and asset.deleted_at is null
      and (
        (
          asset.source_type = v_source_type
          and asset.source_record_id = v_current.id::text
        )
        or asset.storage_key = v_storage_key
      )
    order by
      case
        when asset.source_type = v_source_type
          and asset.source_record_id = v_current.id::text then 0
        else 1
      end,
      asset.created_at
    limit 1
    for update;

    if v_asset_id is null then
      v_asset_id := gen_random_uuid();

      insert into public.media_assets (
        id,
        user_id,
        project_id,
        collection,
        source_type,
        source_record_id,
        parent_asset_id,
        title,
        storage_key,
        url,
        thumbnail_url,
        mime_type,
        file_name,
        file_size_bytes,
        duration_seconds,
        width,
        height,
        ratio,
        status,
        metadata,
        created_at,
        updated_at
      ) values (
        v_asset_id,
        v_current.user_id,
        v_current.project_id,
        v_collection,
        v_source_type,
        v_current.id::text,
        null,
        v_title,
        v_storage_key,
        v_url,
        v_thumbnail_url,
        v_mime_type,
        null,
        v_file_size_bytes,
        v_duration_seconds,
        v_width,
        v_height,
        v_ratio,
        'ready',
        jsonb_build_object(
          'backgroundJobId', v_current.id::text,
          'jobType', v_current.job_type,
          'provider', p_output ->> 'provider'
        ),
        v_now,
        v_now
      );
    else
      update public.media_assets as asset
      set
        user_id = v_current.user_id,
        project_id = v_current.project_id,
        collection = v_collection,
        source_type = v_source_type,
        source_record_id = v_current.id::text,
        title = v_title,
        storage_key = v_storage_key,
        url = v_url,
        thumbnail_url = v_thumbnail_url,
        mime_type = v_mime_type,
        file_size_bytes = v_file_size_bytes,
        duration_seconds = v_duration_seconds,
        width = v_width,
        height = v_height,
        ratio = v_ratio,
        status = 'ready',
        metadata = coalesce(asset.metadata, '{}'::jsonb) || jsonb_build_object(
          'backgroundJobId', v_current.id::text,
          'jobType', v_current.job_type,
          'provider', p_output ->> 'provider'
        ),
        updated_at = v_now
      where asset.id = v_asset_id;
    end if;

    v_output := v_output || jsonb_build_object('mediaAssetId', v_asset_id::text);
  end if;

  update public.background_jobs as job
  set
    status = 'completed',
    stage = 'completed',
    progress = 100,
    output_json = v_output,
    output_reference = coalesce(nullif(trim(p_output_reference), ''), job.output_reference),
    error_code = null,
    error_message = null,
    next_attempt_at = null,
    completed_at = v_now,
    failed_at = null,
    claim_token = null,
    locked_at = null,
    worker_id = null,
    worker_execution_id = null,
    updated_at = v_now
  where job.id = p_job_id;

  perform public.append_background_job_event(
    p_job_id,
    'job_completed',
    jsonb_strip_nulls(
      jsonb_build_object(
        'fromStatus', v_current.status,
        'mediaAssetId', v_asset_id,
        'outputReference', p_output_reference
      )
    )
  );

  return query
  select job.*
  from public.background_jobs as job
  where job.id = p_job_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."complete_background_job"(uuid, uuid, jsonb, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."complete_background_job"(uuid, uuid, jsonb, text) FROM PUBLIC;


-- source: public/functions/complete_carousel_content_plan_generation.sql
CREATE OR REPLACE FUNCTION public.complete_carousel_content_plan_generation (
  p_user_id text,
  p_plan_id uuid,
  p_job_id  uuid
)
  RETURNS public.carousel_content_plans
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_now timestamptz := timezone('utc', now());
  v_plan public.carousel_content_plans%rowtype;
begin
  select plan.*
  into v_plan
  from public.carousel_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
    and plan.generation_job_id = p_job_id
  for update;

  if not found then
    raise exception 'carousel_content_plan_generation_completion_mismatch';
  end if;

  if v_plan.status = 'active' then
    return v_plan;
  end if;

  if v_plan.status <> 'generating' then
    raise exception 'carousel_content_plan_not_generating';
  end if;

  update public.carousel_content_plans as plan
  set
    generation_completed_at = v_now,
    updated_at = v_now
  where plan.id = p_plan_id;

  select activated.*
  into v_plan
  from public.activate_carousel_content_plan(p_user_id, p_plan_id) as activated;

  return v_plan;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."complete_carousel_content_plan_generation"(text, uuid, uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."complete_carousel_content_plan_generation"(text, uuid, uuid) FROM PUBLIC;


-- source: public/functions/complete_social_connection_token_refresh.sql
CREATE OR REPLACE FUNCTION public.complete_social_connection_token_refresh (
  p_connection_id            uuid,
  p_user_id                  text,
  p_claim_token              uuid,
  p_access_token_ciphertext  text,
  p_refresh_token_ciphertext text,
  p_expires_at               timestamp with time zone,
  p_refresh_expires_at       timestamp with time zone,
  p_scopes                   text[],
  p_token_type               text,
  p_status                   text
)
  RETURNS SETOF public.social_connections
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_now timestamptz := now();
begin
  if p_status not in ('connected', 'permission_missing') then
    raise exception 'invalid refreshed connection status';
  end if;

  return query
  update public.social_connections as connection
  set
    access_token_ciphertext = p_access_token_ciphertext,
    refresh_token_ciphertext = p_refresh_token_ciphertext,
    expires_at = p_expires_at,
    refresh_expires_at = p_refresh_expires_at,
    scopes = coalesce(p_scopes, '{}'::text[]),
    token_type = p_token_type,
    status = p_status,
    last_error_code = null,
    token_refreshed_at = v_now,
    token_refresh_claim_token = null,
    token_refresh_claimed_at = null,
    updated_at = v_now
  where connection.id = p_connection_id
    and connection.user_id = p_user_id
    and connection.token_refresh_claim_token = p_claim_token
    and connection.revoked_at is null
  returning connection.*;
end;
$function$;

GRANT EXECUTE
  ON FUNCTION "public"."complete_social_connection_token_refresh"(uuid, text, uuid, text, text, timestamp WITH time zone, timestamp WITH time zone, text[], text, text)
  TO "postgres", "service_role";

REVOKE ALL
  ON FUNCTION "public"."complete_social_connection_token_refresh"(uuid, text, uuid, text, text, timestamp WITH time zone, timestamp WITH time zone, text[], text, text)
  FROM PUBLIC;


-- source: public/functions/complete_trending_feed_reconciliation.sql
CREATE OR REPLACE FUNCTION public.complete_trending_feed_reconciliation (
  p_source_job_id uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  update public.trending_feed_reconciliation_outbox as outbox
  set
    status = 'completed',
    completed_at = now(),
    locked_at = null,
    last_error = null,
    next_attempt_at = now(),
    updated_at = now()
  where outbox.source_job_id = p_source_job_id
    and outbox.status = 'processing';

  return found;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."complete_trending_feed_reconciliation"(uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."complete_trending_feed_reconciliation"(uuid) FROM PUBLIC;


-- source: public/functions/complete_trending_hook_generation_chunk_dispatch_v1.sql
CREATE OR REPLACE FUNCTION public.complete_trending_hook_generation_chunk_dispatch_v1 (
  p_dispatch_id uuid,
  p_claim_token uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_completed boolean := false;
begin
  update public.trending_hook_generation_dispatch_outbox as dispatch
  set
    status = 'completed',
    completed_at = now(),
    claim_token = null,
    claimed_at = null,
    updated_at = now()
  from public.trending_hook_generation_run_chunks as chunk
  where dispatch.id = p_dispatch_id
    and dispatch.claim_token = p_claim_token
    and chunk.id = dispatch.chunk_id
    and (
      chunk.background_job_id is not null
      or chunk.status <> 'reserved'
    )
  returning true into v_completed;

  return v_completed;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."complete_trending_hook_generation_chunk_dispatch_v1"(uuid, uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."complete_trending_hook_generation_chunk_dispatch_v1"(uuid, uuid) FROM PUBLIC;


-- source: public/functions/complete_wall_text_content_plan_generation.sql
CREATE OR REPLACE FUNCTION public.complete_wall_text_content_plan_generation (
  p_user_id text,
  p_plan_id uuid,
  p_job_id  uuid
)
  RETURNS public.wall_text_content_plans
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_brief_count integer;
  v_invalid_item_count integer;
  v_item_count integer;
  v_plan public.wall_text_content_plans%rowtype;
begin
  select plan.* into v_plan
  from public.wall_text_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
    and plan.generation_job_id = p_job_id
  for update;
  if not found then
    raise exception 'wall_text_content_plan_completion_mismatch';
  end if;
  if v_plan.status = 'active' then
    return v_plan;
  end if;
  if v_plan.status <> 'generating' then
    raise exception 'wall_text_content_plan_not_generating';
  end if;

  select count(*)::integer into v_brief_count
  from public.wall_text_content_plan_briefs as brief
  where brief.plan_id = p_plan_id and brief.user_id = p_user_id;
  select count(*)::integer into v_item_count
  from public.wall_text_content_plan_items as item
  where item.plan_id = p_plan_id and item.user_id = p_user_id;
  select count(*)::integer into v_invalid_item_count
  from (
    select item.creative_brief_id
    from public.wall_text_content_plan_items as item
    where item.plan_id = p_plan_id and item.user_id = p_user_id
    group by item.creative_brief_id
    having count(*) <> 5
  ) as invalid_items;
  if v_brief_count <> 40
     or v_item_count <> v_plan.target_item_count
     or v_invalid_item_count <> 0 then
    raise exception 'wall_text_content_plan_incomplete';
  end if;

  update public.wall_text_content_plans as prior_plan
  set
    status = 'superseded',
    superseded_at = timezone('utc', now()),
    superseded_by_plan_id = p_plan_id,
    updated_at = timezone('utc', now())
  where prior_plan.user_id = p_user_id
    and prior_plan.business_profile_id = v_plan.business_profile_id
    and prior_plan.id <> p_plan_id
    and prior_plan.status = 'active';

  update public.wall_text_content_plans as plan
  set
    status = 'active',
    activated_at = timezone('utc', now()),
    generation_completed_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where plan.id = p_plan_id
  returning plan.* into v_plan;
  return v_plan;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."complete_wall_text_content_plan_generation"(text, uuid, uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."complete_wall_text_content_plan_generation"(text, uuid, uuid) FROM PUBLIC;


-- source: public/functions/consume_carousel_content_plan_item.sql
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."consume_carousel_content_plan_item"(text, uuid, uuid, uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."consume_carousel_content_plan_item"(text, uuid, uuid, uuid) FROM PUBLIC;


-- source: public/functions/create_or_get_carousel_experiment_batch_job.sql
CREATE OR REPLACE FUNCTION public.create_or_get_carousel_experiment_batch_job (
  p_user_id             text,
  p_project_id          text,
  p_experiment_batch_id uuid,
  p_carousel_ids        uuid[],
  p_text_style          text
)
  RETURNS TABLE (
    job_id  uuid,
    created boolean
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_batch public.carousel_experiment_batches%rowtype;
  v_created boolean := false;
  v_expected_carousel_ids uuid[];
  v_job public.background_jobs%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_unique_carousel_count integer;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or nullif(trim(coalesce(p_project_id, '')), '') is null
     or p_experiment_batch_id is null
     or p_carousel_ids is null
     or coalesce(array_length(p_carousel_ids, 1), 0) <> 5
     or array_position(p_carousel_ids, null) is not null
     or p_text_style is null
     or p_text_style not in ('highlight', 'plain', 'soft-gradient') then
    raise exception 'carousel_experiment_job_input_invalid';
  end if;

  select count(distinct carousel_id)::integer
  into v_unique_carousel_count
  from unnest(p_carousel_ids) as value(carousel_id);

  if v_unique_carousel_count <> 5 then
    raise exception 'carousel_experiment_job_carousel_ids_invalid';
  end if;

  -- This is deliberately per experiment batch, not global. Different users and
  -- different batches can reserve work at the same time.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'carousel-experiment-job:' || p_experiment_batch_id::text,
      641902731
    )
  );

  select batch.*
  into v_batch
  from public.carousel_experiment_batches as batch
  join public.business_profiles as profile
    on profile.id = batch.business_profile_id
  where batch.id = p_experiment_batch_id
    and profile.user_id = p_user_id
  for update of batch;

  if not found then
    raise exception 'carousel_experiment_batch_not_found';
  end if;

  select array_agg(locked_generation.id order by locked_generation.candidate_index)
  into v_expected_carousel_ids
  from (
    select generation.id, generation.candidate_index
    from public.carousel_generations as generation
    where generation.id = any(p_carousel_ids)
      and generation.user_id = p_user_id
      and generation.project_id = p_project_id
      and generation.carousel_experiment_batch_id = p_experiment_batch_id
      and generation.business_profile_id = v_batch.business_profile_id
      and generation.business_profile_version = v_batch.business_profile_version
    for update
  ) as locked_generation;

  if coalesce(array_length(v_expected_carousel_ids, 1), 0) <> 5
     or v_expected_carousel_ids is distinct from p_carousel_ids then
    raise exception 'carousel_experiment_job_generation_ownership_mismatch';
  end if;

  if exists (
    select 1
    from public.carousel_generations as generation
    left join public.carousel_experiment_assignments as assignment
      on assignment.id = generation.carousel_experiment_assignment_id
    where generation.id = any(p_carousel_ids)
      and (
        assignment.experiment_batch_id is distinct from p_experiment_batch_id
        or assignment.carousel_generation_id is distinct from generation.id
      )
  ) then
    raise exception 'carousel_experiment_job_assignment_ownership_mismatch';
  end if;

  select job.*
  into v_job
  from public.background_jobs as job
  where job.user_id = p_user_id
    and job.job_type = 'generate_carousel'
    and job.idempotency_key =
      'carousel-experiment-batch:' || p_experiment_batch_id::text
  for update;

  if found then
    if v_job.project_id is distinct from p_project_id
       or v_job.input_json ->> 'experimentBatchId'
            is distinct from p_experiment_batch_id::text
       or v_job.input_json -> 'carouselIds' is distinct from to_jsonb(p_carousel_ids) then
      raise exception 'carousel_experiment_job_idempotency_conflict';
    end if;
  else
    insert into public.background_jobs (
      user_id,
      project_id,
      job_type,
      queue_name,
      queue_provider,
      status,
      stage,
      queued_at,
      max_attempts,
      idempotency_key,
      input_json,
      updated_at
    ) values (
      p_user_id,
      p_project_id,
      'generate_carousel',
      'carousel',
      'gcp',
      'queued',
      'queued',
      v_now,
      3,
      'carousel-experiment-batch:' || p_experiment_batch_id::text,
      jsonb_build_object(
        'carouselIds', to_jsonb(p_carousel_ids),
        'experimentBatchId', p_experiment_batch_id,
        'textStyle', p_text_style
      ),
      v_now
    )
    returning * into v_job;
    v_created := true;
  end if;

  if v_batch.planner_job_id is not null
     and v_batch.planner_job_id is distinct from v_job.id then
    raise exception 'carousel_experiment_batch_job_conflict';
  end if;

  if exists (
    select 1
    from public.carousel_generations as generation
    left join public.carousel_content_plan_items as item
      on item.id = generation.content_plan_item_id
    left join public.carousel_content_plan_reservations as reservation
      on reservation.id = generation.content_plan_reservation_id
    where generation.id = any(p_carousel_ids)
      and (
        generation.content_plan_id is null
        or generation.content_plan_item_id is null
        or generation.content_plan_reservation_id is null
        or item.user_id is distinct from p_user_id
        or item.plan_id is distinct from generation.content_plan_id
        or item.reservation_token is distinct from generation.content_plan_reservation_id
        or item.status <> 'reserved'
        or reservation.user_id is distinct from p_user_id
        or reservation.status <> 'active'
        or reservation.expires_at <= v_now
        or (
          item.reserved_by_job_id is not null
          and item.reserved_by_job_id is distinct from v_job.id
        )
      )
  ) then
    raise exception 'carousel_experiment_job_content_plan_ownership_mismatch';
  end if;

  if exists (
    select 1
    from public.carousel_generations as generation
    where generation.id = any(p_carousel_ids)
      and generation.trigger_run_id is not null
      and generation.trigger_run_id <> v_job.id::text
  ) then
    raise exception 'carousel_experiment_job_generation_job_conflict';
  end if;

  update public.carousel_content_plan_items as item
  set
    reserved_by_job_id = v_job.id,
    updated_at = v_now
  where item.id in (
    select generation.content_plan_item_id
    from public.carousel_generations as generation
    where generation.id = any(p_carousel_ids)
  )
    and item.user_id = p_user_id
    and item.status = 'reserved'
    and (item.reserved_by_job_id is null or item.reserved_by_job_id = v_job.id);

  if (
    select count(*)
    from public.carousel_content_plan_items as item
    where item.id in (
      select generation.content_plan_item_id
      from public.carousel_generations as generation
      where generation.id = any(p_carousel_ids)
    )
      and item.reserved_by_job_id = v_job.id
  ) <> 5 then
    raise exception 'carousel_experiment_job_content_plan_attachment_failed';
  end if;

  update public.carousel_generations as generation
  set trigger_run_id = v_job.id::text
  where generation.id = any(p_carousel_ids)
    and generation.trigger_run_id is null;

  update public.carousel_experiment_assignments as assignment
  set
    status = case
      when assignment.status = 'reserved' then 'queued'
      else assignment.status
    end,
    updated_at = v_now
  where assignment.carousel_generation_id = any(p_carousel_ids)
    and assignment.experiment_batch_id = p_experiment_batch_id;

  update public.carousel_experiment_batches as batch
  set
    planner_job_id = v_job.id,
    status = case
      when batch.status = 'reserved' then 'queued'
      else batch.status
    end,
    updated_at = v_now
  where batch.id = p_experiment_batch_id;

  return query select v_job.id, v_created;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."create_or_get_carousel_experiment_batch_job"(text, text, uuid, uuid[], text) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."create_or_get_carousel_experiment_batch_job"(text, text, uuid, uuid[], text) IS 'Atomically creates or reuses one durable five-Carousel writer job, attaches its exact reserved content-plan items, and binds the batch, assignments, and generations before queue delivery.';

REVOKE ALL ON FUNCTION "public"."create_or_get_carousel_experiment_batch_job"(text, text, uuid, uuid[], text) FROM PUBLIC;


-- source: public/functions/create_or_resume_and_reserve_trending_hook_generation_chunk_v1.sql
CREATE OR REPLACE FUNCTION public.create_or_resume_and_reserve_trending_hook_generation_chunk_v1 (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_prompt_version           text,
  p_selection_version        text,
  p_source_selection_key     text,
  p_target_valid_count       integer,
  p_candidate_pool           jsonb,
  p_chunk_size               integer DEFAULT 6
)
  RETURNS TABLE (
    run_id                uuid,
    run_status            text,
    chunk_id              uuid,
    chunk_number          integer,
    candidate_payloads    jsonb,
    target_valid_count    integer,
    completed_valid_count integer,
    remaining_valid_count integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_run record;
begin
  select *
  into v_run
  from public.create_or_resume_trending_hook_generation_run_v1(
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    p_prompt_version,
    p_selection_version,
    p_source_selection_key,
    p_target_valid_count,
    p_candidate_pool
  );

  return query
  select
    reserved.run_id,
    reserved.run_status,
    reserved.chunk_id,
    reserved.chunk_number,
    reserved.candidate_payloads,
    reserved.target_valid_count,
    reserved.completed_valid_count,
    reserved.remaining_valid_count
  from public.reserve_trending_hook_generation_chunk_v1(
    v_run.run_id,
    p_chunk_size
  ) as reserved;
end;
$function$;

GRANT EXECUTE
  ON FUNCTION "public"."create_or_resume_and_reserve_trending_hook_generation_chunk_v1"(text, uuid, integer, text, text, text, integer, jsonb, integer)
  TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."create_or_resume_and_reserve_trending_hook_generation_chunk_v1"(text, uuid, integer, text, text, text, integer, jsonb, integer) FROM PUBLIC;


-- source: public/functions/create_or_resume_trending_hook_generation_run_v1.sql
CREATE OR REPLACE FUNCTION public.create_or_resume_trending_hook_generation_run_v1 (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_prompt_version           text,
  p_selection_version        text,
  p_source_selection_key     text,
  p_target_valid_count       integer,
  p_candidate_pool           jsonb
)
  RETURNS TABLE (
    run_id                uuid,
    run_status            text,
    target_valid_count    integer,
    completed_valid_count integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_run public.trending_hook_generation_runs%rowtype;
  v_scope_key text;
  v_candidate_count integer;
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or coalesce(p_business_profile_version, 0) < 1
    or char_length(trim(coalesce(p_prompt_version, ''))) = 0
    or char_length(trim(coalesce(p_selection_version, ''))) = 0
    or coalesce(p_target_valid_count, 0) not between 1 and 100
    or jsonb_typeof(p_candidate_pool) <> 'array'
  then
    raise exception 'trending_hook_generation_run_invalid_input';
  end if;

  v_candidate_count := jsonb_array_length(p_candidate_pool);

  -- The run stores source metadata only. A physical worker still reserves no
  -- more than six candidates, but a larger pool prevents an early false
  -- "source exhausted" result after normal review rejections.
  if v_candidate_count < 1 or v_candidate_count > 600
    or exists (
      select 1
      from jsonb_array_elements(p_candidate_pool) as candidate(value)
      where jsonb_typeof(candidate.value) <> 'object'
        or char_length(trim(coalesce(candidate.value ->> 'influencerVideoId', ''))) = 0
    )
    or (
      select count(distinct trim(candidate.value ->> 'influencerVideoId'))
      from jsonb_array_elements(p_candidate_pool) as candidate(value)
    ) <> v_candidate_count
  then
    raise exception 'trending_hook_generation_run_invalid_candidates';
  end if;

  v_scope_key := concat_ws(
    ':',
    p_user_id,
    p_business_profile_id::text,
    p_business_profile_version::text
  );
  perform pg_advisory_xact_lock(hashtextextended(v_scope_key, 0));

  select *
  into v_run
  from public.trending_hook_generation_runs as run
  where run.user_id = p_user_id
    and run.business_profile_id = p_business_profile_id
    and run.business_profile_version = p_business_profile_version
    and run.status in ('queued', 'processing', 'continuation_pending')
  order by run.created_at desc
  limit 1
  for update;

  if found and v_run.source_selection_key <> coalesce(p_source_selection_key, '') then
    update public.trending_hook_generation_runs
    set
      status = 'superseded',
      last_error = 'The Hook-video source selection changed before this run completed.',
      updated_at = now()
    where id = v_run.id;
    v_run := null;
  end if;

  if v_run.id is null then
    insert into public.trending_hook_generation_runs (
      user_id,
      business_profile_id,
      business_profile_version,
      prompt_version,
      selection_version,
      source_selection_key,
      target_valid_count,
      status
    ) values (
      trim(p_user_id),
      p_business_profile_id,
      p_business_profile_version,
      trim(p_prompt_version),
      trim(p_selection_version),
      coalesce(p_source_selection_key, ''),
      p_target_valid_count,
      'queued'
    )
    returning * into v_run;

    insert into public.trending_hook_generation_run_candidates (
      run_id,
      influencer_video_id,
      candidate_order,
      candidate_payload
    )
    select
      v_run.id,
      trim(candidate.value ->> 'influencerVideoId'),
      candidate.ordinality - 1,
      candidate.value
    from jsonb_array_elements(p_candidate_pool)
      with ordinality as candidate(value, ordinality);
  end if;

  return query
  select
    v_run.id,
    v_run.status,
    v_run.target_valid_count,
    v_run.completed_valid_count;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."create_or_resume_trending_hook_generation_run_v1"(text, uuid, integer, text, text, text, integer, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."create_or_resume_trending_hook_generation_run_v1"(text, uuid, integer, text, text, text, integer, jsonb) FROM PUBLIC;


-- source: public/functions/ensure_carousel_content_plan.sql
CREATE OR REPLACE FUNCTION public.ensure_carousel_content_plan (
  p_user_id                  text,
  p_project_id               text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_timezone                 text,
  p_business_description     text,
  p_target_item_count        integer,
  p_planner_model            text,
  p_planner_prompt_version   text
)
  RETURNS public.carousel_content_plans
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_current_date date;
  v_next_plan_version integer;
  v_now timestamptz := timezone('utc', now());
  v_plan public.carousel_content_plans%rowtype;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or nullif(trim(coalesce(p_project_id, '')), '') is null
     or p_business_profile_id is null
     or p_business_profile_version is null
     or p_business_profile_version <= 0
     or nullif(trim(coalesce(p_timezone, '')), '') is null
     or nullif(trim(coalesce(p_business_description, '')), '') is null
     or char_length(trim(p_business_description)) > 4000
     or p_target_item_count is null
     or p_target_item_count not between 150 and 10000
     or p_planner_model <> 'gpt-4o-mini'
     or nullif(trim(coalesce(p_planner_prompt_version, '')), '') is null then
    raise exception 'carousel_content_plan_ensure_input_invalid';
  end if;

  begin
    v_current_date := timezone(trim(p_timezone), v_now)::date;
  exception
    when invalid_parameter_value then
      raise exception 'carousel_content_plan_timezone_invalid';
  end;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'carousel-content-plan:' || p_user_id || ':' || p_business_profile_id::text,
      641902731
    )
  );

  perform 1
  from public.business_profiles as profile
  where profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.project_id = p_project_id
    and profile.profile_version = p_business_profile_version
  for share;

  if not found then
    raise exception 'business_profile_version_changed';
  end if;

  select plan.*
  into v_plan
  from public.carousel_content_plans as plan
  where plan.user_id = p_user_id
    and plan.project_id = p_project_id
    and plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.status in ('generating', 'active')
    and v_current_date between plan.period_start_date and plan.period_end_date
  order by plan.plan_version desc
  limit 1
  for update;

  if found then
    return v_plan;
  end if;

  select coalesce(max(plan.plan_version), 0) + 1
  into v_next_plan_version
  from public.carousel_content_plans as plan
  where plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.period_start_date = v_current_date;

  insert into public.carousel_content_plans (
    user_id,
    project_id,
    business_profile_id,
    business_profile_version,
    period_start_date,
    period_end_date,
    timezone,
    plan_version,
    business_description,
    target_item_count,
    planner_model,
    planner_prompt_version
  ) values (
    p_user_id,
    p_project_id,
    p_business_profile_id,
    p_business_profile_version,
    v_current_date,
    v_current_date + 29,
    trim(p_timezone),
    v_next_plan_version,
    trim(p_business_description),
    p_target_item_count,
    p_planner_model,
    trim(p_planner_prompt_version)
  )
  returning * into v_plan;

  return v_plan;
end;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_carousel_content_plan (
  p_user_id                  text,
  p_project_id               text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_timezone                 text,
  p_business_description     text,
  p_planning_context         jsonb,
  p_target_item_count        integer,
  p_planner_model            text,
  p_planner_prompt_version   text
)
  RETURNS public.carousel_content_plans
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_current_date date;
  v_next_plan_version integer;
  v_now timestamptz := timezone('utc', now());
  v_plan public.carousel_content_plans%rowtype;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or nullif(trim(coalesce(p_project_id, '')), '') is null
     or p_business_profile_id is null
     or p_business_profile_version is null
     or p_business_profile_version <= 0
     or nullif(trim(coalesce(p_timezone, '')), '') is null
     or nullif(trim(coalesce(p_business_description, '')), '') is null
     or char_length(trim(p_business_description)) > 4000
     or p_planning_context is null
     or jsonb_typeof(p_planning_context) <> 'object'
     or p_target_item_count is null
     or p_target_item_count <> 150
     or p_planner_model <> 'gpt-4o-mini'
     or nullif(trim(coalesce(p_planner_prompt_version, '')), '') is null then
    raise exception 'carousel_content_plan_ensure_input_invalid';
  end if;

  begin
    v_current_date := timezone(trim(p_timezone), v_now)::date;
  exception
    when invalid_parameter_value then
      raise exception 'carousel_content_plan_timezone_invalid';
  end;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'carousel-content-plan:' || p_user_id || ':' || p_business_profile_id::text,
      641902731
    )
  );

  perform 1
  from public.business_profiles as profile
  where profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.project_id = p_project_id
    and profile.profile_version = p_business_profile_version
  for share;

  if not found then
    raise exception 'business_profile_version_changed';
  end if;

  select plan.*
  into v_plan
  from public.carousel_content_plans as plan
  where plan.user_id = p_user_id
    and plan.project_id = p_project_id
    and plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.status in ('generating', 'active')
    and v_current_date between plan.period_start_date and plan.period_end_date
  order by plan.plan_version desc
  limit 1
  for update;

  if found then
    return v_plan;
  end if;

  select coalesce(max(plan.plan_version), 0) + 1
  into v_next_plan_version
  from public.carousel_content_plans as plan
  where plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.period_start_date = v_current_date;

  insert into public.carousel_content_plans (
    user_id,
    project_id,
    business_profile_id,
    business_profile_version,
    period_start_date,
    period_end_date,
    timezone,
    plan_version,
    business_description,
    planning_context,
    target_item_count,
    planner_model,
    planner_prompt_version
  ) values (
    p_user_id,
    p_project_id,
    p_business_profile_id,
    p_business_profile_version,
    v_current_date,
    v_current_date + 29,
    trim(p_timezone),
    v_next_plan_version,
    trim(p_business_description),
    p_planning_context,
    p_target_item_count,
    p_planner_model,
    trim(p_planner_prompt_version)
  )
  returning * into v_plan;

  return v_plan;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."ensure_carousel_content_plan"(text, text, uuid, integer, text, text, integer, text, text) TO "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."ensure_carousel_content_plan"(text, text, uuid, integer, text, text, jsonb, integer, text, text) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."ensure_carousel_content_plan"(text, text, uuid, integer, text, text, integer, text, text) IS 'Returns the current profile-version plan or creates a new 30-day generating plan using only the supplied minimal business description.';

COMMENT ON FUNCTION "public"."ensure_carousel_content_plan"(text, text, uuid, integer, text, text, jsonb, integer, text, text) IS 'Returns the current profile-version plan or creates a new 150-item 30-day plan with a private, approved-business planning context.';

REVOKE ALL ON FUNCTION "public"."ensure_carousel_content_plan"(text, text, uuid, integer, text, text, integer, text, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."ensure_carousel_content_plan"(text, text, uuid, integer, text, text, jsonb, integer, text, text) FROM PUBLIC;


-- source: public/functions/ensure_daily_trending_feed_plan.sql
CREATE OR REPLACE FUNCTION public.ensure_daily_trending_feed_plan (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_local_date               date,
  p_timezone                 text,
  p_plan_key                 text,
  p_plan_display_name        text,
  p_daily_limit              integer,
  p_carousel_percent         integer,
  p_wall_text_percent        integer,
  p_hook_video_percent       integer,
  p_preference_version       integer,
  p_formats                  text[]
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  resolved_daily_limit integer;
  resolved_feed_id uuid;
  inserted_slot_count integer := 0;
begin
  if p_user_id is null or char_length(trim(p_user_id)) = 0 then
    raise exception 'invalid_daily_trending_user';
  end if;

  if p_daily_limit < 1 or coalesce(array_length(p_formats, 1), 0) <> p_daily_limit then
    raise exception 'invalid_daily_trending_plan_size';
  end if;

  if p_carousel_percent + p_wall_text_percent + p_hook_video_percent <> 100
    or p_carousel_percent not between 0 and 100
    or p_wall_text_percent not between 0 and 100
    or p_hook_video_percent not between 0 and 100
  then
    raise exception 'invalid_daily_trending_mix';
  end if;

  if exists (
    select 1
    from unnest(p_formats) as requested_format
    where requested_format not in ('carousel', 'hook_video', 'wall_text')
  ) then
    raise exception 'invalid_daily_trending_format';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id || ':' || p_local_date::text, 0)
  );

  select feed.id, feed.daily_limit
  into resolved_feed_id, resolved_daily_limit
  from public.daily_trending_feeds as feed
  where feed.user_id = p_user_id
    and feed.local_date = p_local_date;

  if resolved_feed_id is null then
    insert into public.daily_trending_feeds (
      user_id,
      business_profile_id,
      business_profile_version,
      local_date,
      timezone,
      plan_key,
      plan_display_name,
      daily_limit,
      carousel_percent,
      wall_text_percent,
      hook_video_percent,
      preference_version
    )
    values (
      p_user_id,
      p_business_profile_id,
      p_business_profile_version,
      p_local_date,
      p_timezone,
      p_plan_key,
      p_plan_display_name,
      p_daily_limit,
      p_carousel_percent,
      p_wall_text_percent,
      p_hook_video_percent,
      p_preference_version
    )
    returning id into resolved_feed_id;

    insert into public.daily_trending_feed_slots (feed_id, position, format)
    select
      resolved_feed_id,
      requested.ordinality::integer,
      requested.format
    from unnest(p_formats) with ordinality as requested(format, ordinality);
  else
    -- Preserve an immutable existing format while repairing missing slots.
    insert into public.daily_trending_feed_slots (feed_id, position, format)
    select
      resolved_feed_id,
      requested.ordinality::integer,
      requested.format
    from unnest(p_formats) with ordinality as requested(format, ordinality)
    on conflict (feed_id, position) do nothing;

    get diagnostics inserted_slot_count = row_count;

    if resolved_daily_limit < p_daily_limit then
      update public.daily_trending_feeds
      set
        timezone = p_timezone,
        plan_key = p_plan_key,
        plan_display_name = p_plan_display_name,
        daily_limit = p_daily_limit,
        carousel_percent = p_carousel_percent,
        wall_text_percent = p_wall_text_percent,
        hook_video_percent = p_hook_video_percent,
        preference_version = p_preference_version,
        status = 'preparing',
        last_error = null,
        updated_at = now()
      where id = resolved_feed_id;
    elsif inserted_slot_count > 0 then
      update public.daily_trending_feeds
      set
        status = 'preparing',
        last_error = null,
        updated_at = now()
      where id = resolved_feed_id;
    end if;
  end if;

  return resolved_feed_id;
end;
$function$;

GRANT EXECUTE
  ON FUNCTION "public"."ensure_daily_trending_feed_plan"(text, uuid, integer, date, text, text, text, integer, integer, integer, integer, integer, text[])
  TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."ensure_daily_trending_feed_plan"(text, uuid, integer, date, text, text, text, integer, integer, integer, integer, integer, text[]) FROM PUBLIC;


-- source: public/functions/ensure_wall_text_content_plan.sql
CREATE OR REPLACE FUNCTION public.ensure_wall_text_content_plan (
  p_user_id                  text,
  p_project_id               text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_timezone                 text,
  p_business_description     text,
  p_planning_context         jsonb,
  p_target_item_count        integer,
  p_planner_model            text,
  p_planner_prompt_version   text
)
  RETURNS public.wall_text_content_plans
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_current_date date;
  v_next_plan_version integer;
  v_plan public.wall_text_content_plans%rowtype;
begin
  if nullif(btrim(coalesce(p_user_id, '')), '') is null
     or nullif(btrim(coalesce(p_project_id, '')), '') is null
     or p_business_profile_id is null
     or p_business_profile_version is null
     or p_business_profile_version <= 0
     or nullif(btrim(coalesce(p_timezone, '')), '') is null
     or nullif(btrim(coalesce(p_business_description, '')), '') is null
     or char_length(btrim(p_business_description)) > 4000
     or p_planning_context is null
     or jsonb_typeof(p_planning_context) <> 'object'
     or p_target_item_count <> 200
     or nullif(btrim(coalesce(p_planner_model, '')), '') is null
     or nullif(btrim(coalesce(p_planner_prompt_version, '')), '') is null then
    raise exception 'wall_text_content_plan_ensure_input_invalid';
  end if;

  begin
    v_current_date := timezone(btrim(p_timezone), timezone('utc', now()))::date;
  exception
    when invalid_parameter_value then
      raise exception 'wall_text_content_plan_timezone_invalid';
  end;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'wall-text-content-plan:' || p_user_id || ':' || p_business_profile_id::text,
      819325101
    )
  );

  perform 1
  from public.business_profiles as profile
  where profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.project_id = p_project_id
    and profile.profile_version = p_business_profile_version
  for share;
  if not found then
    raise exception 'business_profile_version_changed';
  end if;

  select plan.* into v_plan
  from public.wall_text_content_plans as plan
  where plan.user_id = p_user_id
    and plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.status in ('generating', 'active')
    and v_current_date between plan.period_start_date and plan.period_end_date
  order by plan.plan_version desc
  limit 1
  for update;

  if found then
    return v_plan;
  end if;

  select coalesce(max(plan.plan_version), 0) + 1 into v_next_plan_version
  from public.wall_text_content_plans as plan
  where plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.period_start_date = v_current_date;

  insert into public.wall_text_content_plans (
    user_id, project_id, business_profile_id, business_profile_version,
    period_start_date, period_end_date, timezone, plan_version,
    business_description, planning_context, target_item_count,
    planner_model, planner_prompt_version
  ) values (
    p_user_id, p_project_id, p_business_profile_id, p_business_profile_version,
    v_current_date, v_current_date + 29, btrim(p_timezone), v_next_plan_version,
    btrim(p_business_description), p_planning_context, p_target_item_count,
    btrim(p_planner_model), btrim(p_planner_prompt_version)
  ) returning * into v_plan;

  return v_plan;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."ensure_wall_text_content_plan"(text, text, uuid, integer, text, text, jsonb, integer, text, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."ensure_wall_text_content_plan"(text, text, uuid, integer, text, text, jsonb, integer, text, text) FROM PUBLIC;


-- source: public/functions/fail_trending_hook_generation_chunk_v1.sql
CREATE OR REPLACE FUNCTION public.fail_trending_hook_generation_chunk_v1 (
  p_job_id        uuid,
  p_error_message text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_chunk public.trending_hook_generation_run_chunks%rowtype;
begin
  if p_job_id is null then
    return false;
  end if;

  select *
  into v_chunk
  from public.trending_hook_generation_run_chunks as chunk
  where chunk.background_job_id = p_job_id
  for update;

  if not found or v_chunk.status = 'completed' then
    return false;
  end if;

  update public.trending_hook_generation_run_candidates
  set
    state = 'pending',
    chunk_id = null,
    updated_at = now()
  where run_id = v_chunk.run_id
    and chunk_id = v_chunk.id
    and state = 'reserved';

  update public.trending_hook_generation_run_chunks
  set
    status = 'failed',
    last_error = left(coalesce(p_error_message, 'The Hook generation worker failed.'), 1_000),
    updated_at = now()
  where id = v_chunk.id;

  update public.trending_hook_generation_runs
  set
    status = 'continuation_pending',
    last_error = left(coalesce(p_error_message, 'The Hook generation worker failed.'), 1_000),
    updated_at = now()
  where id = v_chunk.run_id
    and status in ('queued', 'processing', 'continuation_pending');

  return true;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."fail_trending_hook_generation_chunk_v1"(uuid, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."fail_trending_hook_generation_chunk_v1"(uuid, text) FROM PUBLIC;


-- source: public/functions/fail_unqueued_carousel_preparation.sql
CREATE OR REPLACE FUNCTION public.fail_unqueued_carousel_preparation (
  p_generation_batch_id uuid,
  p_error_message       text
)
  RETURNS TABLE (
    failed_generation_count integer,
    failed_assignment_count integer,
    failed_batch_count      integer
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_error_message text;
begin
  if p_generation_batch_id is null then
    raise exception 'carousel_generation_batch_id_required';
  end if;

  v_error_message := left(
    coalesce(nullif(btrim(p_error_message), ''), 'Carousel preparation failed before queue dispatch.'),
    1000
  );

  update public.carousel_generations as generation
  set
    error_message = v_error_message,
    status = 'failed',
    updated_at = timezone('utc', now())
  where generation.generation_batch_id = p_generation_batch_id
    and generation.status = 'processing'
    and generation.trigger_run_id is null;

  get diagnostics failed_generation_count = row_count;

  update public.carousel_experiment_assignments as assignment
  set
    status = 'failed',
    updated_at = timezone('utc', now())
  where assignment.status in ('reserved', 'queued', 'processing')
    and exists (
      select 1
      from public.carousel_experiment_batches as batch
      where batch.id = assignment.experiment_batch_id
        and batch.generation_batch_id = p_generation_batch_id
        and batch.planner_job_id is null
        and batch.status in ('reserved', 'queued', 'processing', 'partial')
    );

  get diagnostics failed_assignment_count = row_count;

  update public.carousel_experiment_batches as batch
  set
    status = 'failed',
    updated_at = timezone('utc', now())
  where batch.generation_batch_id = p_generation_batch_id
    and batch.planner_job_id is null
    and batch.status in ('reserved', 'queued', 'processing', 'partial');

  get diagnostics failed_batch_count = row_count;

  return next;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."fail_unqueued_carousel_preparation"(uuid, text) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."fail_unqueued_carousel_preparation"(uuid, text) IS 'Fails only Carousel preparation rows that never received a durable planner job. Queued and completed work is preserved.';

REVOKE ALL ON FUNCTION "public"."fail_unqueued_carousel_preparation"(uuid, text) FROM PUBLIC;


-- source: public/functions/finalize_edit_render.sql
CREATE OR REPLACE FUNCTION public.finalize_edit_render (
  p_render_id       uuid,
  p_user_id         text,
  p_project_id      text,
  p_source_video_id text,
  p_terminal_status text,
  p_output_s3_key   text,
  p_output_url      text,
  p_error_message   text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_render_job public.video_render_jobs%rowtype;
  v_now timestamptz := now();
  v_output_s3_key text;
  v_output_url text;
begin
  if p_terminal_status is null
    or p_terminal_status not in ('completed', 'failed')
  then
    raise exception 'Edit render terminal status must be completed or failed.';
  end if;

  if nullif(trim(p_user_id), '') is null
    or nullif(trim(p_project_id), '') is null
    or nullif(trim(p_source_video_id), '') is null
  then
    raise exception 'Edit render ownership fields are required.';
  end if;

  select render_job.*
  into v_render_job
  from public.video_render_jobs as render_job
  where render_job.render_id = p_render_id
    and render_job.user_id = p_user_id
    and render_job.project_id = p_project_id
    and render_job.source_video_id = p_source_video_id
  for update;

  if not found then
    return false;
  end if;

  -- A retry of the same terminal transition repairs all dependent rows. The
  -- opposite terminal transition remains fenced and cannot overwrite it.
  if v_render_job.status not in ('queued', 'rendering', p_terminal_status) then
    return false;
  end if;

  if p_terminal_status = 'completed' then
    v_output_s3_key := coalesce(
      nullif(trim(v_render_job.output_s3_key), ''),
      nullif(trim(p_output_s3_key), '')
    );
    v_output_url := coalesce(
      nullif(trim(v_render_job.output_url), ''),
      nullif(trim(p_output_url), '')
    );

    if v_output_s3_key is null then
      raise exception 'Completed edit render requires an output storage key.';
    end if;

    if v_output_url is null or v_output_url !~ '^https?://' then
      raise exception 'Completed edit render requires an HTTP output URL.';
    end if;

    if v_render_job.status in ('queued', 'rendering')
      or v_render_job.output_s3_key is null
      or v_render_job.output_url is null
    then
      update public.video_render_jobs as render_job
      set
        completed_at = coalesce(render_job.completed_at, v_now),
        error_message = null,
        output_s3_key = v_output_s3_key,
        output_url = v_output_url,
        status = 'completed',
        updated_at = v_now
      where render_job.render_id = p_render_id;
    end if;

    update public.editable_videos as editable
    set
      rendered_video_url = v_output_url,
      status = case
        when editable.draft_json is not distinct from v_render_job.draft_json
          then 'rendered'
        else 'draft'
      end,
      updated_at = case
        when editable.draft_json is not distinct from v_render_job.draft_json
          then v_now
        else editable.updated_at
      end
    where editable.user_id = p_user_id
      and editable.project_id = p_project_id
      and editable.source_video_id = p_source_video_id
      and editable.latest_render_id = p_render_id
      and editable.deleted_at is null;

    update public.demo_videos as demo
    set
      error_message = null,
      rendered_video_url = v_output_url,
      status = case
        when demo.draft_json is not distinct from v_render_job.draft_json
          then 'rendered'
        else 'draft'
      end,
      updated_at = case
        when demo.draft_json is not distinct from v_render_job.draft_json
          then v_now
        else demo.updated_at
      end
    where demo.id::text = p_source_video_id
      and demo.user_id = p_user_id
      and demo.project_id = p_project_id
      and demo.latest_render_id = p_render_id
      and demo.deleted_at is null;
  else
    if v_render_job.status in ('queued', 'rendering') then
      update public.video_render_jobs as render_job
      set
        completed_at = coalesce(render_job.completed_at, v_now),
        error_message = left(
          coalesce(nullif(trim(p_error_message), ''), 'Edit render failed.'),
          1000
        ),
        status = 'failed',
        updated_at = v_now
      where render_job.render_id = p_render_id;
    end if;

    update public.editable_videos as editable
    set
      status = case
        when editable.draft_json is not distinct from v_render_job.draft_json
          then 'failed'
        else 'draft'
      end,
      updated_at = case
        when editable.draft_json is not distinct from v_render_job.draft_json
          then v_now
        else editable.updated_at
      end
    where editable.user_id = p_user_id
      and editable.project_id = p_project_id
      and editable.source_video_id = p_source_video_id
      and editable.latest_render_id = p_render_id
      and editable.deleted_at is null;

    update public.demo_videos as demo
    set
      error_message = left(
        coalesce(nullif(trim(p_error_message), ''), 'Edit render failed.'),
        1000
      ),
      status = case
        when demo.draft_json is not distinct from v_render_job.draft_json
          then 'failed'
        else 'draft'
      end,
      updated_at = case
        when demo.draft_json is not distinct from v_render_job.draft_json
          then v_now
        else demo.updated_at
      end
    where demo.id::text = p_source_video_id
      and demo.user_id = p_user_id
      and demo.project_id = p_project_id
      and demo.latest_render_id = p_render_id
      and demo.deleted_at is null;
  end if;

  return true;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."finalize_edit_render"(uuid, text, text, text, text, text, text, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."finalize_edit_render"(uuid, text, text, text, text, text, text, text) FROM PUBLIC;


-- source: public/functions/get_carousel_admin_analytics.sql
CREATE OR REPLACE FUNCTION public.get_carousel_admin_analytics (
  p_window_days integer DEFAULT 30
)
  RETURNS TABLE (
    scope                text,
    structure_id         text,
    content_format_id    text,
    generated_count      bigint,
    saved_count          bigint,
    scheduled_count      bigint,
    published_count      bigint,
    evaluated_post_count bigint,
    total_view_count     bigint,
    average_view_count   numeric,
    median_view_count    numeric
  )
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
begin
  if p_window_days < 1 or p_window_days > 365 then
    raise exception 'carousel_admin_analytics_window_invalid';
  end if;

  return query
  with structures(structure_id) as (
    values ('structure_1'::text), ('structure_2'::text)
  ),
  generated_events as (
    select
      generation.id::text as event_id,
      generation.structure_id,
      generation.content_format_id
    from public.carousel_generations as generation
    where generation.status = 'completed'
      and generation.business_profile_id is not null
      and generation.content_format_id is not null
      and generation.structure_id in ('structure_1', 'structure_2')
      and generation.created_at >=
        timezone('utc', now()) - make_interval(days => p_window_days)
  ),
  saved_events as (
    select distinct
      item.id::text as event_id,
      generation.structure_id,
      generation.content_format_id
    from public.library_items as item
    join public.library_carousel_slides as slide
      on slide.library_item_id = item.id
    join public.carousel_generations as generation
      on generation.id = slide.carousel_generation_id
    where item.source_type = 'generated_carousel'
      and generation.business_profile_id is not null
      and generation.content_format_id is not null
      and generation.structure_id in ('structure_1', 'structure_2')
      and item.created_at >=
        timezone('utc', now()) - make_interval(days => p_window_days)
  ),
  scheduled_events as (
    select distinct
      scheduled.id::text as event_id,
      generation.structure_id,
      generation.content_format_id
    from public.scheduled_posts as scheduled
    join public.library_items as item
      on item.id = scheduled.library_item_id
    join public.library_carousel_slides as slide
      on slide.library_item_id = item.id
    join public.carousel_generations as generation
      on generation.id = slide.carousel_generation_id
    where scheduled.source_kind = 'library_item'
      and scheduled.scheduled_for is not null
      and scheduled.status in (
        'scheduling',
        'scheduled',
        'publishing',
        'published',
        'partially_failed',
        'failed'
      )
      and generation.business_profile_id is not null
      and generation.content_format_id is not null
      and generation.structure_id in ('structure_1', 'structure_2')
      and scheduled.created_at >=
        timezone('utc', now()) - make_interval(days => p_window_days)
  ),
  published_events as (
    select distinct
      target.id::text as event_id,
      generation.structure_id,
      generation.content_format_id
    from public.scheduled_post_targets as target
    join public.scheduled_posts as scheduled
      on scheduled.id = target.scheduled_post_id
    join public.library_items as item
      on item.id = scheduled.library_item_id
    join public.library_carousel_slides as slide
      on slide.library_item_id = item.id
    join public.carousel_generations as generation
      on generation.id = slide.carousel_generation_id
    where scheduled.source_kind = 'library_item'
      and target.status = 'published'
      and target.published_at is not null
      and generation.business_profile_id is not null
      and generation.content_format_id is not null
      and generation.structure_id in ('structure_1', 'structure_2')
      and target.published_at >=
        timezone('utc', now()) - make_interval(days => p_window_days)
  ),
  view_events as (
    select
      observation.id::text as event_id,
      observation.structure_id,
      observation.content_format_id,
      observation.view_count
    from public.carousel_performance_observations as observation
    where observation.evaluated_at is not null
      and observation.view_count is not null
      and observation.structure_id in ('structure_1', 'structure_2')
      and observation.evaluated_at >=
        timezone('utc', now()) - make_interval(days => p_window_days)
  ),
  format_keys as (
    select generated_events.structure_id, generated_events.content_format_id
    from generated_events
    union
    select saved_events.structure_id, saved_events.content_format_id
    from saved_events
    union
    select scheduled_events.structure_id, scheduled_events.content_format_id
    from scheduled_events
    union
    select published_events.structure_id, published_events.content_format_id
    from published_events
    union
    select view_events.structure_id, view_events.content_format_id
    from view_events
  ),
  generated_by_format as (
    select
      generated_events.structure_id,
      generated_events.content_format_id,
      count(*)::bigint as event_count
    from generated_events
    group by generated_events.structure_id, generated_events.content_format_id
  ),
  saved_by_format as (
    select
      saved_events.structure_id,
      saved_events.content_format_id,
      count(*)::bigint as event_count
    from saved_events
    group by saved_events.structure_id, saved_events.content_format_id
  ),
  scheduled_by_format as (
    select
      scheduled_events.structure_id,
      scheduled_events.content_format_id,
      count(*)::bigint as event_count
    from scheduled_events
    group by scheduled_events.structure_id, scheduled_events.content_format_id
  ),
  published_by_format as (
    select
      published_events.structure_id,
      published_events.content_format_id,
      count(*)::bigint as event_count
    from published_events
    group by published_events.structure_id, published_events.content_format_id
  ),
  views_by_format as (
    select
      view_events.structure_id,
      view_events.content_format_id,
      count(*)::bigint as evaluated_count,
      sum(view_events.view_count)::bigint as total_views,
      avg(view_events.view_count)::numeric as average_views,
      percentile_cont(0.5) within group (
        order by view_events.view_count
      )::numeric as median_views
    from view_events
    group by view_events.structure_id, view_events.content_format_id
  ),
  format_rollup as (
    select
      'format'::text as analytics_scope,
      key.structure_id,
      key.content_format_id,
      coalesce(generated.event_count, 0::bigint) as generated_count,
      coalesce(saved.event_count, 0::bigint) as saved_count,
      coalesce(scheduled.event_count, 0::bigint) as scheduled_count,
      coalesce(published.event_count, 0::bigint) as published_count,
      coalesce(views.evaluated_count, 0::bigint) as evaluated_post_count,
      coalesce(views.total_views, 0::bigint) as total_view_count,
      views.average_views as average_view_count,
      views.median_views as median_view_count
    from format_keys as key
    left join generated_by_format as generated
      on generated.structure_id = key.structure_id
      and generated.content_format_id = key.content_format_id
    left join saved_by_format as saved
      on saved.structure_id = key.structure_id
      and saved.content_format_id = key.content_format_id
    left join scheduled_by_format as scheduled
      on scheduled.structure_id = key.structure_id
      and scheduled.content_format_id = key.content_format_id
    left join published_by_format as published
      on published.structure_id = key.structure_id
      and published.content_format_id = key.content_format_id
    left join views_by_format as views
      on views.structure_id = key.structure_id
      and views.content_format_id = key.content_format_id
  ),
  generated_by_structure as (
    select generated_events.structure_id, count(*)::bigint as event_count
    from generated_events
    group by generated_events.structure_id
  ),
  saved_by_structure as (
    select saved_events.structure_id, count(*)::bigint as event_count
    from saved_events
    group by saved_events.structure_id
  ),
  scheduled_by_structure as (
    select scheduled_events.structure_id, count(*)::bigint as event_count
    from scheduled_events
    group by scheduled_events.structure_id
  ),
  published_by_structure as (
    select published_events.structure_id, count(*)::bigint as event_count
    from published_events
    group by published_events.structure_id
  ),
  views_by_structure as (
    select
      view_events.structure_id,
      count(*)::bigint as evaluated_count,
      sum(view_events.view_count)::bigint as total_views,
      avg(view_events.view_count)::numeric as average_views,
      percentile_cont(0.5) within group (
        order by view_events.view_count
      )::numeric as median_views
    from view_events
    group by view_events.structure_id
  ),
  structure_rollup as (
    select
      'structure'::text as analytics_scope,
      structure.structure_id,
      null::text as content_format_id,
      coalesce(generated.event_count, 0::bigint) as generated_count,
      coalesce(saved.event_count, 0::bigint) as saved_count,
      coalesce(scheduled.event_count, 0::bigint) as scheduled_count,
      coalesce(published.event_count, 0::bigint) as published_count,
      coalesce(views.evaluated_count, 0::bigint) as evaluated_post_count,
      coalesce(views.total_views, 0::bigint) as total_view_count,
      views.average_views as average_view_count,
      views.median_views as median_view_count
    from structures as structure
    left join generated_by_structure as generated
      on generated.structure_id = structure.structure_id
    left join saved_by_structure as saved
      on saved.structure_id = structure.structure_id
    left join scheduled_by_structure as scheduled
      on scheduled.structure_id = structure.structure_id
    left join published_by_structure as published
      on published.structure_id = structure.structure_id
    left join views_by_structure as views
      on views.structure_id = structure.structure_id
  ),
  combined as (
    select * from structure_rollup
    union all
    select * from format_rollup
  )
  select
    combined.analytics_scope,
    combined.structure_id,
    combined.content_format_id,
    combined.generated_count,
    combined.saved_count,
    combined.scheduled_count,
    combined.published_count,
    combined.evaluated_post_count,
    combined.total_view_count,
    combined.average_view_count,
    combined.median_view_count
  from combined
  order by
    case when combined.analytics_scope = 'structure' then 0 else 1 end,
    combined.structure_id,
    combined.content_format_id nulls first;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_carousel_admin_analytics"(integer) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."get_carousel_admin_analytics"(integer) IS 'Service-only Phase 8 dashboard analytics. Structure and format identities remain paired, lifecycle counts come from their authoritative records, and views use frozen seven-day evidence only.';

REVOKE ALL ON FUNCTION "public"."get_carousel_admin_analytics"(integer) FROM PUBLIC;


-- source: public/functions/get_carousel_performance_aggregates.sql
CREATE OR REPLACE FUNCTION public.get_carousel_performance_aggregates (
  p_user_id             text,
  p_business_profile_id uuid
)
  RETURNS TABLE (
    scope                      text,
    content_format_id          text,
    hook_family_id             text,
    evaluated_post_count       bigint,
    average_view_count         numeric,
    median_view_count          numeric,
    view_standard_deviation    numeric,
    baseline_median_view_count numeric
  )
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_business_profile_id is null
     or not exists (
       select 1
       from public.business_profiles as profile
       where profile.id = p_business_profile_id
         and profile.user_id = p_user_id
     ) then
    return;
  end if;

  return query
  with ranked as (
    select
      observation.content_format_id,
      observation.hook_family_id,
      observation.view_count,
      row_number() over (
        partition by observation.content_format_id
        order by observation.published_at desc, observation.id desc
      ) as recency_rank
    from public.carousel_performance_observations as observation
    where observation.user_id = p_user_id
      and observation.business_profile_id = p_business_profile_id
      and observation.evaluated_at is not null
      and observation.view_count is not null
      and observation.published_at >= timezone('utc', now()) - interval '180 days'
  ),
  recent as (
    select ranked.content_format_id, ranked.hook_family_id, ranked.view_count
    from ranked
    where ranked.recency_rank <= 20
  ),
  baseline as (
    select
      percentile_cont(0.5) within group (order by recent.view_count)::numeric
        as median_views
    from recent
  ),
  format_stats as (
    select
      'format'::text as aggregate_scope,
      recent.content_format_id,
      null::text as hook_family_id,
      count(*)::bigint as post_count,
      avg(recent.view_count)::numeric as average_views,
      percentile_cont(0.5) within group (order by recent.view_count)::numeric
        as median_views,
      coalesce(stddev_pop(recent.view_count), 0)::numeric as view_stddev
    from recent
    group by recent.content_format_id
  ),
  hook_stats as (
    select
      'format_hook'::text as aggregate_scope,
      recent.content_format_id,
      recent.hook_family_id,
      count(*)::bigint as post_count,
      avg(recent.view_count)::numeric as average_views,
      percentile_cont(0.5) within group (order by recent.view_count)::numeric
        as median_views,
      coalesce(stddev_pop(recent.view_count), 0)::numeric as view_stddev
    from recent
    group by recent.content_format_id, recent.hook_family_id
  ),
  combined as (
    select * from format_stats
    union all
    select * from hook_stats
  )
  select
    combined.aggregate_scope,
    combined.content_format_id,
    combined.hook_family_id,
    combined.post_count,
    combined.average_views,
    combined.median_views,
    combined.view_stddev,
    baseline.median_views
  from combined
  cross join baseline
  order by
    combined.aggregate_scope,
    combined.content_format_id,
    combined.hook_family_id nulls first;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_carousel_performance_aggregates (
  p_user_id             text,
  p_business_profile_id uuid,
  p_structure_id        text
)
  RETURNS TABLE (
    scope                      text,
    content_format_id          text,
    hook_family_id             text,
    evaluated_post_count       bigint,
    average_view_count         numeric,
    median_view_count          numeric,
    view_standard_deviation    numeric,
    baseline_median_view_count numeric
  )
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_business_profile_id is null
     or p_structure_id not in ('structure_1', 'structure_2')
     or not exists (
       select 1
       from public.business_profiles as profile
       where profile.id = p_business_profile_id
         and profile.user_id = p_user_id
     ) then
    return;
  end if;

  return query
  with ranked as (
    select
      observation.content_format_id,
      observation.hook_family_id,
      observation.view_count,
      row_number() over (
        partition by observation.content_format_id
        order by observation.published_at desc, observation.id desc
      ) as recency_rank
    from public.carousel_performance_observations as observation
    where observation.user_id = p_user_id
      and observation.business_profile_id = p_business_profile_id
      and observation.structure_id = p_structure_id
      and observation.evaluated_at is not null
      and observation.view_count is not null
      and observation.published_at >= timezone('utc', now()) - interval '180 days'
  ),
  recent as (
    select ranked.content_format_id, ranked.hook_family_id, ranked.view_count
    from ranked
    where ranked.recency_rank <= 20
  ),
  baseline as (
    select
      percentile_cont(0.5) within group (order by recent.view_count)::numeric
        as median_views
    from recent
  ),
  format_stats as (
    select
      'format'::text as aggregate_scope,
      recent.content_format_id,
      null::text as hook_family_id,
      count(*)::bigint as post_count,
      avg(recent.view_count)::numeric as average_views,
      percentile_cont(0.5) within group (order by recent.view_count)::numeric
        as median_views,
      coalesce(stddev_pop(recent.view_count), 0)::numeric as view_stddev
    from recent
    group by recent.content_format_id
  ),
  hook_stats as (
    select
      'format_hook'::text as aggregate_scope,
      recent.content_format_id,
      recent.hook_family_id,
      count(*)::bigint as post_count,
      avg(recent.view_count)::numeric as average_views,
      percentile_cont(0.5) within group (order by recent.view_count)::numeric
        as median_views,
      coalesce(stddev_pop(recent.view_count), 0)::numeric as view_stddev
    from recent
    where recent.hook_family_id is not null
    group by recent.content_format_id, recent.hook_family_id
  ),
  combined as (
    select * from format_stats
    union all
    select * from hook_stats
  )
  select
    combined.aggregate_scope,
    combined.content_format_id,
    combined.hook_family_id,
    combined.post_count,
    combined.average_views,
    combined.median_views,
    combined.view_stddev,
    baseline.median_views
  from combined
  cross join baseline
  order by
    combined.aggregate_scope,
    combined.content_format_id,
    combined.hook_family_id nulls first;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_carousel_performance_aggregates"(text, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_carousel_performance_aggregates"(text, uuid, text) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."get_carousel_performance_aggregates"(text, uuid, text) IS 'Returns view-only learning evidence inside one business and one structure namespace. Structure 2 returns format aggregates only.';

REVOKE ALL ON FUNCTION "public"."get_carousel_performance_aggregates"(text, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."get_carousel_performance_aggregates"(text, uuid, text) FROM PUBLIC;


-- source: public/functions/get_hook_performance_pattern_aggregates.sql
CREATE OR REPLACE FUNCTION public.get_hook_performance_pattern_aggregates (
  p_user_id             text,
  p_business_profile_id uuid
)
  RETURNS TABLE (
    pattern_id                 text,
    campaign_purpose           text,
    observed_post_count        bigint,
    view_count                 bigint,
    share_count                bigint,
    save_count                 bigint,
    average_watch_time_seconds numeric,
    completion_rate            numeric,
    conversion_count           bigint,
    attributed_sales_amount    numeric,
    attributed_sales_currency  text
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0 or
     p_business_profile_id is null or
     not exists (
       select 1
       from public.business_profiles as profile
       where profile.id = p_business_profile_id
         and profile.user_id = p_user_id
     )
  then
    return;
  end if;

  return query
    select
      suggestion.pattern_id,
      suggestion.campaign_purpose,
      count(observation.id)::bigint as observed_post_count,
      sum(observation.view_count)::bigint as view_count,
      sum(observation.share_count)::bigint as share_count,
      sum(observation.save_count)::bigint as save_count,
      avg(observation.average_watch_time_seconds) as average_watch_time_seconds,
      avg(observation.completion_rate) as completion_rate,
      sum(observation.conversion_count)::bigint as conversion_count,
      sum(observation.attributed_sales_amount) as attributed_sales_amount,
      case
        when count(distinct observation.attributed_sales_currency) filter (
          where observation.attributed_sales_amount is not null
            and observation.attributed_sales_currency is not null
        ) = 1
        and count(*) filter (
          where observation.attributed_sales_amount is not null
            and observation.attributed_sales_currency is null
        ) = 0
          then min(observation.attributed_sales_currency) filter (
            where observation.attributed_sales_amount is not null
          )
        else null
      end as attributed_sales_currency
    from public.hook_performance_observations as observation
    join public.hook_video_suggestions as suggestion
      on suggestion.id = observation.hook_video_suggestion_id
      and suggestion.user_id = p_user_id
    where observation.user_id = p_user_id
      and suggestion.business_profile_id = p_business_profile_id
      and suggestion.suggestion_context in ('trending', 'composition')
      and suggestion.pattern_id is not null
    group by suggestion.pattern_id, suggestion.campaign_purpose;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_hook_performance_pattern_aggregates"(text, uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."get_hook_performance_pattern_aggregates"(text, uuid) FROM PUBLIC;


-- source: public/functions/get_hook_text_format_performance_profiles.sql
CREATE OR REPLACE FUNCTION public.get_hook_text_format_performance_profiles (
  p_user_id             text,
  p_business_profile_id uuid
)
  RETURNS TABLE (
    hook_text_format_id    text,
    campaign_purpose       text,
    times_generated        bigint,
    last_generated_at      timestamp with time zone,
    published_result_count bigint,
    recent_view_counts     bigint[],
    median_views           numeric,
    selection_weight       numeric,
    temporary_boost        numeric
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or not exists (
      select 1
      from public.business_profiles as profile
      where profile.id = p_business_profile_id
        and profile.user_id = p_user_id
    )
  then
    return;
  end if;

  with generation_stats as (
    select
      suggestion.hook_text_format_id,
      count(*)::bigint as times_generated,
      max(suggestion.created_at) as last_generated_at,
      (array_agg(
        suggestion.campaign_purpose
        order by suggestion.created_at desc
      ) filter (where suggestion.campaign_purpose is not null))[1]
        as campaign_purpose
    from public.hook_video_suggestions as suggestion
    where suggestion.user_id = p_user_id
      and suggestion.business_profile_id = p_business_profile_id
      and suggestion.hook_text_format_id is not null
      and suggestion.suggestion_context in ('trending', 'composition')
    group by suggestion.hook_text_format_id
  ), ranked_views as (
    select
      suggestion.hook_text_format_id,
      observation.view_count,
      observation.observed_at,
      row_number() over (
        partition by suggestion.hook_text_format_id
        order by observation.observed_at desc, observation.id desc
      ) as result_rank
    from public.hook_performance_observations as observation
    join public.hook_video_suggestions as suggestion
      on suggestion.id = observation.hook_video_suggestion_id
      and suggestion.user_id = p_user_id
    where observation.user_id = p_user_id
      and observation.platform = 'instagram'
      and observation.view_count is not null
      and suggestion.business_profile_id = p_business_profile_id
      and suggestion.hook_text_format_id is not null
  ), result_stats as (
    select
      ranked.hook_text_format_id,
      count(*)::bigint as published_result_count,
      array_agg(
        ranked.view_count order by ranked.observed_at desc
      )::bigint[] as recent_view_counts,
      percentile_cont(0.5) within group (
        order by ranked.view_count
      )::numeric as median_views,
      avg(ranked.view_count)::numeric as average_views,
      greatest(
        0::numeric,
        least(
          1::numeric,
          1 - coalesce(
            stddev_pop(ranked.view_count)::numeric /
              nullif(avg(ranked.view_count)::numeric, 0),
            0
          )
        )
      ) as consistency_score
    from ranked_views as ranked
    where ranked.result_rank <= 12
    group by ranked.hook_text_format_id
  ), combined as (
    select
      format.id as hook_text_format_id,
      generation.campaign_purpose,
      coalesce(generation.times_generated, 0)::bigint as times_generated,
      generation.last_generated_at,
      coalesce(results.published_result_count, 0)::bigint
        as published_result_count,
      coalesce(results.recent_view_counts, '{}'::bigint[])
        as recent_view_counts,
      results.median_views,
      results.average_views,
      coalesce(results.consistency_score, 0.5) as consistency_score
    from public.hook_text_formats as format
    left join generation_stats as generation
      on generation.hook_text_format_id = format.id
    left join result_stats as results
      on results.hook_text_format_id = format.id
    where format.enabled
      and format.global_status = 'global_v1'
  ), baseline as (
    select percentile_cont(0.5) within group (
      order by combined.median_views
    )::numeric as median_views
    from combined
    where combined.median_views is not null
  ), scored as (
    select
      combined.*,
      case
        when combined.median_views is not null
          and baseline.median_views > 0
          then combined.median_views / baseline.median_views
        else 1::numeric
      end as performance_score,
      least(1::numeric, combined.published_result_count::numeric / 5)
        as confidence_score
    from combined
    cross join baseline
  ), final_scores as (
    select
      scored.*,
      case
        when scored.published_result_count = 1
          and scored.performance_score >= 1.2 then 0.08::numeric
        else 0::numeric
      end as temporary_boost,
      greatest(
        0.8::numeric,
        least(
          1.3::numeric,
          1 +
          case
            when scored.published_result_count >= 2 then greatest(
              -0.12::numeric,
              least(
                0.22::numeric,
                (scored.performance_score - 1) * 0.16 *
                  least(
                    1::numeric,
                    greatest(
                      0::numeric,
                      (scored.published_result_count - 1)::numeric / 5
                    )
                  )
              )
            )
            else 0::numeric
          end +
          case
            when scored.published_result_count >= 3
              then (scored.consistency_score - 0.5) * 0.04
            else 0::numeric
          end
        )
      ) as selection_weight
    from scored
  )
  insert into public.user_hook_text_format_performance (
    user_id,
    business_profile_id,
    hook_text_format_id,
    campaign_purpose,
    times_used,
    recent_results,
    median_views,
    average_views,
    consistency_score,
    performance_score,
    confidence_score,
    selection_weight,
    temporary_boost,
    published_result_count,
    last_used_at,
    refreshed_at
  )
  select
    p_user_id,
    p_business_profile_id,
    final_scores.hook_text_format_id,
    final_scores.campaign_purpose,
    final_scores.times_generated::integer,
    to_jsonb(final_scores.recent_view_counts),
    final_scores.median_views,
    final_scores.average_views,
    final_scores.consistency_score,
    final_scores.performance_score,
    final_scores.confidence_score,
    final_scores.selection_weight,
    final_scores.temporary_boost,
    final_scores.published_result_count::integer,
    final_scores.last_generated_at,
    now()
  from final_scores
  on conflict on constraint user_hook_text_format_performance_pkey
  do update set
    campaign_purpose = excluded.campaign_purpose,
    times_used = excluded.times_used,
    recent_results = excluded.recent_results,
    median_views = excluded.median_views,
    average_views = excluded.average_views,
    consistency_score = excluded.consistency_score,
    performance_score = excluded.performance_score,
    confidence_score = excluded.confidence_score,
    selection_weight = excluded.selection_weight,
    temporary_boost = excluded.temporary_boost,
    published_result_count = excluded.published_result_count,
    last_used_at = excluded.last_used_at,
    refreshed_at = excluded.refreshed_at;

  return query
    select
      performance.hook_text_format_id,
      performance.campaign_purpose,
      performance.times_used::bigint,
      performance.last_used_at,
      performance.published_result_count::bigint,
      array(
        select jsonb_array_elements_text(performance.recent_results)::bigint
      ),
      performance.median_views,
      performance.selection_weight,
      performance.temporary_boost
    from public.user_hook_text_format_performance as performance
    where performance.user_id = p_user_id
      and performance.business_profile_id = p_business_profile_id
    order by performance.hook_text_format_id;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_hook_text_format_performance_profiles"(text, uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."get_hook_text_format_performance_profiles"(text, uuid) FROM PUBLIC;


-- source: public/functions/get_wall_text_format_performance_v1.sql
CREATE OR REPLACE FUNCTION public.get_wall_text_format_performance_v1 (
  p_user_id             text,
  p_business_profile_id uuid
)
  RETURNS TABLE (
    format_id              text,
    last_generated_at      timestamp with time zone,
    published_result_count bigint,
    recent_view_counts     bigint[],
    times_generated        bigint
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  with generated as (
    select
      assignment.assigned_format_id as format_id,
      max(assignment.created_at) as last_generated_at,
      count(*) as times_generated
    from public.wall_text_generation_assignments as assignment
    join public.wall_text_generation_batches as batch
      on batch.id = assignment.batch_id
    where batch.user_id = p_user_id
      and batch.business_profile_id = p_business_profile_id
      and assignment.assigned_format_id is not null
    group by assignment.assigned_format_id
  ), observed as (
    select
      history.format_id,
      count(*) as published_result_count,
      (array_agg(observation.view_count order by observation.observed_at desc))[1:12]
        as recent_view_counts
    from public.wall_text_performance_observations as observation
    join public.wall_text_content_history as history
      on history.id = observation.content_history_id
    where observation.user_id = p_user_id
      and observation.business_profile_id = p_business_profile_id
      and history.performance_eligible
      and history.format_id is not null
    group by history.format_id
  )
  select
    coalesce(generated.format_id, observed.format_id),
    generated.last_generated_at,
    coalesce(observed.published_result_count, 0),
    coalesce(observed.recent_view_counts, '{}'::bigint[]),
    coalesce(generated.times_generated, 0)
  from generated
  full outer join observed using (format_id);
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_wall_text_format_performance_v1"(text, uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."get_wall_text_format_performance_v1"(text, uuid) FROM PUBLIC;


-- source: public/functions/hook_copy_v5_candidate_is_valid.sql
CREATE OR REPLACE FUNCTION public.hook_copy_v5_candidate_is_valid (
  p_candidate jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_lines jsonb;
  v_text text;
  v_word_count integer;
  v_character_count integer;
  v_score integer;
begin
  if jsonb_typeof(p_candidate) <> 'object' then
    return false;
  end if;

  v_lines := p_candidate -> 'openingLines';
  v_text := trim(coalesce(p_candidate ->> 'hookText', ''));

  if jsonb_typeof(v_lines) <> 'array' or
     jsonb_array_length(v_lines) not between 1 and 3 or
     coalesce(
       (
         select string_agg(line.value #>> '{}', E'\n' order by line.ordinality)
         from jsonb_array_elements(v_lines)
           with ordinality as line(value, ordinality)
       ),
       ''
     ) <> v_text or
     exists (
       select 1
       from jsonb_array_elements(v_lines) as line(value)
       where jsonb_typeof(line.value) <> 'string'
         or char_length(trim(line.value #>> '{}')) not between 1 and 78
     ) then
    return false;
  end if;

  v_word_count := cardinality(regexp_split_to_array(v_text, '\s+'));
  v_character_count := char_length(replace(v_text, E'\n', ' '));
  v_score := (p_candidate #>> '{readabilityReview,scores,total}')::integer;

  return
    (p_candidate ->> 'candidateIndex') ~ '^\d+$'
    and (p_candidate ->> 'durationSeconds')::numeric > 0
    and (p_candidate ->> 'sourceDurationSeconds')::numeric > 0
    and (p_candidate ->> 'durationSeconds')::numeric <=
      (p_candidate ->> 'sourceDurationSeconds')::numeric
    and (p_candidate ->> 'trimStart')::numeric >= 0
    and (
      (p_candidate ->> 'trimEnd') is null or
      (p_candidate ->> 'trimEnd')::numeric >
        (p_candidate ->> 'trimStart')::numeric
    )
    and char_length(trim(coalesce(p_candidate ->> 'influencerId', '')))
      between 1 and 180
    and char_length(trim(coalesce(p_candidate ->> 'influencerName', '')))
      between 1 and 140
    and char_length(trim(coalesce(p_candidate ->> 'influencerVideoId', '')))
      between 1 and 180
    and char_length(trim(coalesce(p_candidate ->> 'influencerVideoTitle', '')))
      between 1 and 180
    and coalesce(p_candidate ->> 'sourceKind', '') in ('catalog', 'user')
    and coalesce(p_candidate ->> 'patternId', '') in (
      'mystery_discovery',
      'direct_capability',
      'problem_observation',
      'skeptical_challenge',
      'problem_reversal',
      'workflow_exposed',
      'outcome_without_friction',
      'professional_transformation'
    )
    and p_candidate ->> 'patternLibraryVersion' =
      'trending-hook-patterns-v3'
    and (
      (
        p_candidate ->> 'validatorVersion' =
          'trending-hook-validator-v3'
        and p_candidate #>> '{visualFit,overlayVersion}' =
          'hook-overlay-v3'
      )
      or
      (
        p_candidate ->> 'validatorVersion' =
          'trending-hook-validator-v4-fixed-type'
        and p_candidate #>> '{visualFit,overlayVersion}' =
          'hook-overlay-v4-fixed-type'
      )
    )
    and coalesce(p_candidate ->> 'inputContextHash', '') ~ '^[a-f0-9]{64}$'
    and coalesce(p_candidate ->> 'campaignPurpose', '') in (
      'product_discovery',
      'education',
      'conversion',
      'retargeting',
      'app_install'
    )
    and coalesce(p_candidate ->> 'industryPackId', '') in (
      'mobile_app',
      'ecommerce',
      'saas',
      'agency_services',
      'health_wellness',
      'finance',
      'education',
      'food_hospitality',
      'general'
    )
    and jsonb_typeof(p_candidate -> 'validation') = 'object'
    and p_candidate #>> '{validation,passed}' = 'true'
    and p_candidate #>> '{validation,evidenceBindingPassed}' = 'true'
    and jsonb_typeof(p_candidate #> '{validation,evidenceBindings}') = 'array'
    and jsonb_array_length(p_candidate #> '{validation,evidenceBindings}')
      between 1 and 2
    and p_candidate #>> '{validation,multipleMessagesPassed}' = 'true'
    and p_candidate #>> '{validation,demoExplanationPassed}' = 'true'
    and p_candidate #>> '{validation,secondaryBenefitPassed}' = 'true'
    and p_candidate #>> '{validation,aiLikeLanguagePassed}' = 'true'
    and p_candidate #>> '{validation,intentionalLineBreaksPassed}' = 'true'
    and p_candidate #>> '{validation,textFitPassed}' = 'true'
    and p_candidate #>> '{readabilityReview,truthful}' = 'true'
    and p_candidate #>> '{readabilityReview,claimSafe}' = 'true'
    and p_candidate #>> '{readabilityReview,humanVoice}' = 'true'
    and p_candidate #>> '{readabilityReview,openingOnly}' = 'true'
    and p_candidate #>> '{readabilityReview,singleIdea}' = 'true'
    and p_candidate #>> '{readabilityReview,readable}' = 'true'
    and p_candidate #>> '{readabilityReview,reactionMatch}' = 'true'
    and p_candidate #>> '{readabilityReview,scrollStopping}' = 'true'
    and v_score between 80 and 100
    and (p_candidate #>> '{readabilityReview,estimatedReadingSeconds}')::numeric > 0
    and (p_candidate #>> '{readabilityReview,estimatedReadingSeconds}')::numeric <=
      (p_candidate ->> 'durationSeconds')::numeric
    and jsonb_typeof(p_candidate -> 'visualFit') = 'object'
    and p_candidate #>> '{visualFit,fits}' = 'true'
    and (p_candidate #>> '{visualFit,semanticLineCount}')::integer between 1 and 3
    and (p_candidate #>> '{visualFit,renderedLineCount}')::integer between 1 and 3
    and (p_candidate #>> '{visualFit,wordCount}')::integer = v_word_count
    and (p_candidate #>> '{visualFit,characterCount}')::integer = v_character_count
    and v_word_count between 2 and 12
    and v_character_count between 8 and 78;
exception
  when others then
    return false;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."hook_copy_v5_candidate_is_valid"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."hook_copy_v5_candidate_is_valid"(jsonb) FROM PUBLIC;


-- source: public/functions/hook_copy_v6_candidate_is_valid.sql
CREATE OR REPLACE FUNCTION public.hook_copy_v6_candidate_is_valid (
  p_candidate jsonb
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO 'public', 'pg_temp'
  AS $function$
  select coalesce(
    public.hook_copy_v5_candidate_is_valid(p_candidate)
    and jsonb_typeof(p_candidate -> 'audioIntent') = 'object'
    and (p_candidate -> 'audioIntent')
      - array['mood', 'hookType', 'energy'] = '{}'::jsonb
    and p_candidate #>> '{audioIntent,mood}' in (
      'curious',
      'uplifting',
      'serious',
      'calm',
      'urgent',
      'playful'
    )
    and p_candidate #>> '{audioIntent,hookType}' in (
      'curiosity',
      'problem',
      'warning',
      'transformation',
      'benefit',
      'story',
      'authority'
    )
    and p_candidate #>> '{audioIntent,energy}' in (
      'low',
      'medium',
      'high'
    ),
    false
  )
$function$;

GRANT EXECUTE ON FUNCTION "public"."hook_copy_v6_candidate_is_valid"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."hook_copy_v6_candidate_is_valid"(jsonb) FROM PUBLIC;


-- source: public/functions/hook_copy_v7_candidate_is_valid.sql
CREATE OR REPLACE FUNCTION public.hook_copy_v7_candidate_is_valid (
  p_candidate jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_format_id text;
  v_variant_id text;
  v_legacy_candidate jsonb;
begin
  if jsonb_typeof(p_candidate) <> 'object'
    or p_candidate ? 'patternId'
    or p_candidate ? 'industryPackId'
    or coalesce(p_candidate ->> 'hookTextFormatLibraryVersion', '') <>
      'global-hook-text-formats-v1'
  then
    return false;
  end if;

  v_format_id := p_candidate ->> 'hookTextFormatId';
  v_variant_id := p_candidate ->> 'hookTextVariantId';

  if not exists (
    select 1
    from public.hook_text_formats as format
    join public.hook_text_format_variants as variant
      on variant.hook_text_format_id = format.id
    where format.id = v_format_id
      and variant.id = v_variant_id
      and format.enabled
      and variant.enabled
      and format.library_version = 'global-hook-text-formats-v1'
  ) then
    return false;
  end if;

  -- Reuse the already deployed semantic, visual-fit, audio-intent, truth, and
  -- line-count gates. The temporary legacy fields exist only inside this
  -- validator call and are never stored on a V7 suggestion.
  v_legacy_candidate := p_candidate || jsonb_build_object(
    'patternId', 'mystery_discovery',
    'patternLibraryVersion', 'trending-hook-patterns-v3',
    'industryPackId', 'general'
  );

  return public.hook_copy_v6_candidate_is_valid(v_legacy_candidate);
exception
  when others then
    return false;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."hook_copy_v7_candidate_is_valid"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."hook_copy_v7_candidate_is_valid"(jsonb) FROM PUBLIC;


-- source: public/functions/hook_performance_currency.sql
CREATE OR REPLACE FUNCTION public.hook_performance_currency (
  p_metrics jsonb,
  p_key     text
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO 'public', 'pg_temp'
  AS $function$
  select case
    when jsonb_typeof(p_metrics -> p_key) = 'string' and
         upper(p_metrics ->> p_key) ~ '^[A-Z]{3}$'
      then upper(p_metrics ->> p_key)
    else null
  end
$function$;

GRANT EXECUTE ON FUNCTION "public"."hook_performance_currency"(jsonb, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."hook_performance_currency"(jsonb, text) FROM PUBLIC;


-- source: public/functions/hook_performance_nonnegative_bigint.sql
CREATE OR REPLACE FUNCTION public.hook_performance_nonnegative_bigint (
  p_metrics jsonb,
  p_key     text
)
  RETURNS bigint
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_number numeric;
begin
  v_number := public.hook_performance_nonnegative_numeric(p_metrics, p_key);

  if v_number is null or
     trunc(v_number) <> v_number or
     v_number > 9223372036854775807 then
    return null;
  end if;

  return v_number::bigint;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."hook_performance_nonnegative_bigint"(jsonb, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."hook_performance_nonnegative_bigint"(jsonb, text) FROM PUBLIC;


-- source: public/functions/hook_performance_nonnegative_numeric.sql
CREATE OR REPLACE FUNCTION public.hook_performance_nonnegative_numeric (
  p_metrics jsonb,
  p_key     text
)
  RETURNS numeric
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_value jsonb;
  v_number numeric;
begin
  v_value := p_metrics -> p_key;

  if v_value is null or jsonb_typeof(v_value) <> 'number' then
    return null;
  end if;

  v_number := (v_value #>> '{}')::numeric;
  return case when v_number >= 0 then v_number else null end;
exception
  when numeric_value_out_of_range or invalid_text_representation then
    return null;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."hook_performance_nonnegative_numeric"(jsonb, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."hook_performance_nonnegative_numeric"(jsonb, text) FROM PUBLIC;


-- source: public/functions/hook_performance_rate.sql
CREATE OR REPLACE FUNCTION public.hook_performance_rate (
  p_metrics jsonb,
  p_key     text
)
  RETURNS numeric
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_number numeric;
begin
  v_number := public.hook_performance_nonnegative_numeric(p_metrics, p_key);
  return case when v_number between 0 and 1 then v_number else null end;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."hook_performance_rate"(jsonb, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."hook_performance_rate"(jsonb, text) FROM PUBLIC;


-- source: public/functions/increment_category_image_asset_usage.sql
CREATE OR REPLACE FUNCTION public.increment_category_image_asset_usage (
  asset_ids uuid[]
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  update public.category_image_assets
  set
    usage_count = category_image_assets.usage_count + asset_usage.times_used,
    updated_at = now()
  from (
    select asset_id, count(*)::int as times_used
    from unnest(asset_ids) as asset_id
    where asset_id is not null
    group by asset_id
  ) as asset_usage
  where category_image_assets.id = asset_usage.asset_id;
$function$;

GRANT EXECUTE ON FUNCTION "public"."increment_category_image_asset_usage"(uuid[]) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."increment_category_image_asset_usage"(uuid[]) FROM PUBLIC;


-- source: public/functions/insert_daily_carousel_feed_items_if_profile_current.sql
CREATE OR REPLACE FUNCTION public.insert_daily_carousel_feed_items_if_profile_current (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_items                    jsonb
)
  RETURNS SETOF public.daily_carousel_feed_items
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."insert_daily_carousel_feed_items_if_profile_current"(text, uuid, integer, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."insert_daily_carousel_feed_items_if_profile_current"(text, uuid, integer, jsonb) FROM PUBLIC;


-- source: public/functions/list_current_trending_feed_integrity_repairs.sql
CREATE OR REPLACE FUNCTION public.list_current_trending_feed_integrity_repairs (
  p_limit integer DEFAULT 25
)
  RETURNS TABLE (
    feed_id uuid,
    user_id text
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select feed.id, feed.user_id
  from public.daily_trending_feeds as feed
  where feed.local_date = (now() at time zone feed.timezone)::date
    and (
      select count(*)
      from public.daily_trending_feed_slots as slot
      where slot.feed_id = feed.id
    ) <> feed.daily_limit
  order by feed.updated_at, feed.id
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$function$;

GRANT EXECUTE ON FUNCTION "public"."list_current_trending_feed_integrity_repairs"(integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."list_current_trending_feed_integrity_repairs"(integer) FROM PUBLIC;


-- source: public/functions/list_due_social_publish_jobs.sql
CREATE OR REPLACE FUNCTION public.list_due_social_publish_jobs (
  p_limit               integer,
  p_stale_after_seconds integer
)
  RETURNS TABLE (
    job_id uuid
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select job.id as job_id
  from public.scheduled_post_targets as target
  join public.scheduled_posts as post
    on post.id = target.scheduled_post_id
    and post.user_id = target.user_id
  join public.background_jobs as job
    on job.id = target.publish_job_id
    and job.user_id = target.user_id
  where target.status in ('scheduling', 'scheduled', 'publishing')
    and post.status not in ('cancelled', 'published')
    and target.scheduled_for <= now()
    and job.job_type = 'publish_social_post'
    and job.input_json ->> 'targetId' = target.id::text
    and (
      (
        job.status = 'queued'
        and (job.next_attempt_at is null or job.next_attempt_at <= now())
      )
      or (
        job.status = 'processing'
        and coalesce(job.last_heartbeat_at, job.locked_at, job.updated_at) <
          now() - make_interval(
            secs => greatest(
              30,
              least(coalesce(p_stale_after_seconds, 600), 43200)
            )
          )
      )
    )
  order by target.scheduled_for, job.created_at
  limit greatest(1, least(coalesce(p_limit, 10), 100));
$function$;

GRANT EXECUTE ON FUNCTION "public"."list_due_social_publish_jobs"(integer, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."list_due_social_publish_jobs"(integer, integer) FROM PUBLIC;


-- source: public/functions/list_recoverable_background_jobs.sql
CREATE OR REPLACE FUNCTION public.list_recoverable_background_jobs (
  p_limit               integer DEFAULT 100,
  p_stale_after_seconds integer DEFAULT 900
)
  RETURNS SETOF public.background_jobs
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select job.*
  from public.background_jobs as job
  where (
    job.status in (
      'processing',
      'waiting_external_service',
      'rendering',
      'uploading_output',
      'cancel_requested'
    )
    and coalesce(job.last_heartbeat_at, job.locked_at, job.updated_at)
      < now() - make_interval(secs => greatest(60, least(p_stale_after_seconds, 43200)))
  ) or (
    job.status = 'queued'
    and coalesce(job.last_delivery_at, job.queued_at, job.updated_at)
      < now() - make_interval(secs => greatest(60, least(p_stale_after_seconds, 43200)))
  )
  order by coalesce(job.last_heartbeat_at, job.queued_at, job.updated_at), job.id
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$function$;

GRANT EXECUTE ON FUNCTION "public"."list_recoverable_background_jobs"(integer, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."list_recoverable_background_jobs"(integer, integer) FROM PUBLIC;


-- source: public/functions/mark_daily_trending_feed_formats_failed.sql
CREATE OR REPLACE FUNCTION public.mark_daily_trending_feed_formats_failed (
  p_feed_id uuid,
  p_formats text[],
  p_message text   DEFAULT NULL::text
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  feed_record public.daily_trending_feeds;
begin
  if coalesce(array_length(p_formats, 1), 0) = 0 then
    return;
  end if;

  if exists (
    select 1
    from unnest(p_formats) as requested_format
    where requested_format not in ('carousel', 'hook_video', 'wall_text')
  ) then
    raise exception 'invalid_daily_trending_format';
  end if;

  select *
  into feed_record
  from public.daily_trending_feeds
  where id = p_feed_id;

  if feed_record.id is null then
    raise exception 'daily_trending_feed_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(feed_record.user_id || ':' || feed_record.local_date::text, 0)
  );

  update public.daily_trending_feed_slots
  set state = 'failed', updated_at = now()
  where feed_id = p_feed_id
    and format = any(p_formats)
    and state in ('planned', 'preparing')
    and carousel_assignment_id is null
    and hook_video_assignment_id is null
    and wall_text_assignment_id is null;

  update public.daily_trending_feeds
  set
    status = case
      when not exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state <> 'decided'
      ) then 'completed'
      when exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state = 'ready'
      ) then 'ready'
      when exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state in ('planned', 'preparing')
      ) then 'preparing'
      else 'failed'
    end,
    last_error = case
      when exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state in ('ready', 'planned', 'preparing')
      ) then null
      else nullif(left(btrim(coalesce(p_message, '')), 1000), '')
    end,
    updated_at = now()
  where id = p_feed_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."mark_daily_trending_feed_formats_failed"(uuid, text[], text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."mark_daily_trending_feed_formats_failed"(uuid, text[], text) FROM PUBLIC;


-- source: public/functions/mark_daily_trending_feed_slot_decided.sql
CREATE OR REPLACE FUNCTION public.mark_daily_trending_feed_slot_decided (
  p_user_id       text,
  p_format        text,
  p_assignment_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  resolved_slot_id uuid;
  resolved_feed_id uuid;
begin
  if p_format not in ('carousel', 'hook_video', 'wall_text') then
    raise exception 'invalid_daily_trending_format';
  end if;

  select slot.id, slot.feed_id
  into resolved_slot_id, resolved_feed_id
  from public.daily_trending_feed_slots as slot
  join public.daily_trending_feeds as feed on feed.id = slot.feed_id
  where feed.user_id = p_user_id
    and slot.state = 'ready'
    and (
      (p_format = 'carousel' and slot.carousel_assignment_id = p_assignment_id)
      or (p_format = 'hook_video' and slot.hook_video_assignment_id = p_assignment_id)
      or (p_format = 'wall_text' and slot.wall_text_assignment_id = p_assignment_id)
    )
  order by feed.local_date desc
  limit 1
  for update of slot;

  if resolved_slot_id is null then
    return null;
  end if;

  update public.daily_trending_feed_slots
  set state = 'decided', updated_at = now()
  where id = resolved_slot_id;

  update public.daily_trending_feeds as feed
  set
    status = case
      when (
        select count(*)
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = resolved_feed_id
      ) = feed.daily_limit
      and not exists (
        select 1
        from public.daily_trending_feed_slots as remaining_slot
        where remaining_slot.feed_id = resolved_feed_id
          and remaining_slot.state <> 'decided'
      ) then 'completed'
      else feed.status
    end,
    updated_at = now()
  where feed.id = resolved_feed_id;

  return resolved_slot_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."mark_daily_trending_feed_slot_decided"(text, text, uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."mark_daily_trending_feed_slot_decided"(text, text, uuid) FROM PUBLIC;


-- source: public/functions/mark_social_publish_target_action_required.sql
CREATE OR REPLACE FUNCTION public.mark_social_publish_target_action_required (
  p_target_id     uuid,
  p_user_id       text,
  p_error_code    text,
  p_error_message text,
  p_metadata      jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_post_id uuid;
  v_now timestamptz := now();
begin
  update public.scheduled_post_targets as target
  set
    last_error_code = left(nullif(trim(p_error_code), ''), 160),
    last_error_message = left(nullif(trim(p_error_message), ''), 500),
    metadata = coalesce(p_metadata, target.metadata),
    next_retry_at = null,
    status = 'action_required',
    updated_at = v_now
  where target.id = p_target_id
    and target.user_id = p_user_id
    and target.status in ('scheduling', 'scheduled', 'publishing')
  returning target.scheduled_post_id into v_post_id;

  if v_post_id is null then
    return false;
  end if;

  update public.scheduled_posts as post
  set
    last_error_code = left(nullif(trim(p_error_code), ''), 160),
    status = case
      when exists (
        select 1
        from public.scheduled_post_targets as sibling
        where sibling.scheduled_post_id = post.id
          and sibling.status in (
            'draft',
            'scheduling',
            'scheduled',
            'publishing',
            'published'
          )
      ) then 'partially_failed'
      else 'failed'
    end,
    updated_at = v_now
  where post.id = v_post_id
    and post.user_id = p_user_id
    and post.status not in ('cancelled', 'published');

  return true;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."mark_social_publish_target_action_required"(uuid, text, text, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."mark_social_publish_target_action_required"(uuid, text, text, text, jsonb) FROM PUBLIC;


-- source: public/functions/persist_carousel_content_plan_brief_chunk.sql
CREATE OR REPLACE FUNCTION public.persist_carousel_content_plan_brief_chunk (
  p_user_id text,
  p_plan_id uuid,
  p_briefs  jsonb,
  p_items   jsonb
)
  RETURNS SETOF public.carousel_content_plan_items
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_brief_count integer;
  v_invalid_item_count integer;
  v_plan public.carousel_content_plans%rowtype;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_plan_id is null
     or p_briefs is null
     or p_items is null
     or jsonb_typeof(p_briefs) <> 'array'
     or jsonb_typeof(p_items) <> 'array' then
    raise exception 'carousel_content_plan_brief_chunk_input_invalid';
  end if;

  select plan.*
  into v_plan
  from public.carousel_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
    and plan.status = 'generating'
  for update;

  if not found then
    raise exception 'carousel_content_plan_brief_chunk_plan_not_generating';
  end if;

  select count(*)::integer
  into v_brief_count
  from jsonb_to_recordset(p_briefs) as brief(
    brief_index integer,
    creative_seed text,
    audience_context text,
    human_moment text,
    emotional_tension text,
    supported_angle text,
    preferred_format_family text,
    brief_fingerprint text
  );

  if v_brief_count not between 1 and 5
     or jsonb_array_length(p_items) <> v_brief_count * 5 then
    raise exception 'carousel_content_plan_brief_chunk_shape_invalid';
  end if;

  select count(*)::integer
  into v_invalid_item_count
  from (
    select item.brief_index
    from jsonb_to_recordset(p_items) as item(
      brief_index integer,
      creative_seed text,
      emotion text,
      sequence_index integer,
      day_number integer,
      day_slot_index integer,
      seed_fingerprint text
    )
    group by item.brief_index
    having count(*) <> 5
  ) as invalid_items;

  if v_invalid_item_count <> 0 then
    raise exception 'carousel_content_plan_brief_chunk_item_balance_invalid';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(
      brief_index integer,
      creative_seed text,
      emotion text,
      sequence_index integer,
      day_number integer,
      day_slot_index integer,
      seed_fingerprint text
    )
    left join jsonb_to_recordset(p_briefs) as brief(
      brief_index integer,
      creative_seed text,
      audience_context text,
      human_moment text,
      emotional_tension text,
      supported_angle text,
      preferred_format_family text,
      brief_fingerprint text
    ) using (brief_index)
    where brief.brief_index is null
  ) then
    raise exception 'carousel_content_plan_brief_chunk_item_parent_missing';
  end if;

  insert into public.carousel_content_plan_briefs (
    plan_id,
    user_id,
    brief_index,
    creative_seed,
    audience_context,
    human_moment,
    emotional_tension,
    supported_angle,
    preferred_format_family,
    brief_fingerprint
  )
  select
    p_plan_id,
    p_user_id,
    brief.brief_index,
    trim(brief.creative_seed),
    trim(brief.audience_context),
    trim(brief.human_moment),
    trim(brief.emotional_tension),
    trim(brief.supported_angle),
    trim(brief.preferred_format_family),
    trim(brief.brief_fingerprint)
  from jsonb_to_recordset(p_briefs) as brief(
    brief_index integer,
    creative_seed text,
    audience_context text,
    human_moment text,
    emotional_tension text,
    supported_angle text,
    preferred_format_family text,
    brief_fingerprint text
  );

  return query
  with inserted as (
    insert into public.carousel_content_plan_items (
      plan_id,
      user_id,
      creative_brief_id,
      sequence_index,
      day_number,
      day_slot_index,
      creative_seed,
      emotion,
      seed_fingerprint,
      status
    )
    select
      p_plan_id,
      p_user_id,
      brief.id,
      item.sequence_index,
      item.day_number,
      item.day_slot_index,
      trim(item.creative_seed),
      trim(item.emotion),
      trim(item.seed_fingerprint),
      'planned'
    from jsonb_to_recordset(p_items) as item(
      brief_index integer,
      creative_seed text,
      emotion text,
      sequence_index integer,
      day_number integer,
      day_slot_index integer,
      seed_fingerprint text
    )
    join public.carousel_content_plan_briefs as brief
      on brief.plan_id = p_plan_id
      and brief.user_id = p_user_id
      and brief.brief_index = item.brief_index
    returning *
  )
  select *
  from inserted
  order by sequence_index;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."persist_carousel_content_plan_brief_chunk"(text, uuid, jsonb, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."persist_carousel_content_plan_brief_chunk"(text, uuid, jsonb, jsonb) FROM PUBLIC;


-- source: public/functions/persist_trending_hook_copy_generation_slot_internal.sql
CREATE OR REPLACE FUNCTION public.persist_trending_hook_copy_generation_slot_internal (
  p_job_id                   uuid,
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_prompt_version           text,
  p_selection_version        text,
  p_generator_model          text,
  p_candidates               jsonb
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  candidate jsonb;
  candidate_count integer;
  existing_count integer;
  suggestion_id uuid;
  now_at timestamptz := now();
begin
  if p_job_id is null
    or char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or p_business_profile_version is null
    or p_business_profile_version <= 0
    or char_length(trim(coalesce(p_prompt_version, ''))) = 0
    or char_length(p_prompt_version) > 100
    or char_length(trim(coalesce(p_selection_version, ''))) = 0
    or char_length(p_selection_version) > 100
    or char_length(trim(coalesce(p_generator_model, ''))) = 0
    or char_length(p_generator_model) > 100
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'trending_hook_generation_invalid_scope';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 1 or candidate_count > 12 then
    raise exception 'trending_hook_generation_invalid_candidate_count';
  end if;

  if not exists (
    select 1
    from public.background_jobs as job
    where job.id = p_job_id
      and job.user_id = p_user_id
      and job.job_type = 'generate_trending_hook_copy'
  ) then
    raise exception 'trending_hook_generation_job_mismatch';
  end if;

  if not exists (
    select 1
    from public.business_profiles as profile
    where profile.id = p_business_profile_id
      and profile.user_id = p_user_id
      and profile.profile_version = p_business_profile_version
  ) then
    raise exception 'trending_hook_generation_profile_mismatch';
  end if;

  select count(*)
  into existing_count
  from public.hook_video_suggestions as suggestion
  where suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.suggestion_context = 'trending';

  if existing_count > 0 then
    if existing_count <> candidate_count then
      raise exception 'trending_hook_generation_partial_state';
    end if;

    return existing_count;
  end if;

  if (
    select count(distinct (item ->> 'candidateIndex')::integer)
    from jsonb_array_elements(p_candidates) as item
  ) <> candidate_count then
    raise exception 'trending_hook_generation_duplicate_candidate';
  end if;

  for candidate in
    select value
    from jsonb_array_elements(p_candidates)
  loop
    if jsonb_typeof(candidate) <> 'object'
      or (candidate ->> 'candidateIndex') is null
      or (candidate ->> 'candidateIndex')::integer < 0
      or (candidate ->> 'durationSeconds')::numeric <= 0
      or (candidate ->> 'sourceDurationSeconds')::numeric <= 0
      or (candidate ->> 'durationSeconds')::numeric
        > (candidate ->> 'sourceDurationSeconds')::numeric
      or (candidate ->> 'trimStart')::numeric < 0
      or char_length(trim(coalesce(candidate ->> 'hookText', '')))
        not between 4 and 120
      or char_length(trim(coalesce(candidate ->> 'influencerId', '')))
        not between 1 and 180
      or char_length(trim(coalesce(candidate ->> 'influencerName', '')))
        not between 1 and 140
      or char_length(trim(coalesce(candidate ->> 'influencerVideoId', '')))
        not between 1 and 180
      or char_length(trim(coalesce(candidate ->> 'influencerVideoTitle', '')))
        not between 1 and 180
      or coalesce(candidate ->> 'sourceKind', '') not in ('catalog', 'user')
      or jsonb_typeof(candidate -> 'readabilityReview') <> 'object'
      or candidate #>> '{readabilityReview,readable}' <> 'true'
      or candidate #>> '{readabilityReview,reactionMatch}' <> 'true'
      or candidate #>> '{readabilityReview,scrollStopping}' <> 'true'
      or (candidate #>> '{readabilityReview,estimatedReadingSeconds}')::numeric
        > (candidate ->> 'durationSeconds')::numeric
      or jsonb_typeof(candidate -> 'visualFit') <> 'object'
      or candidate #>> '{visualFit,fits}' <> 'true'
    then
      raise exception 'trending_hook_generation_invalid_candidate';
    end if;

    if (candidate ->> 'trimEnd') is not null
      and (candidate ->> 'trimEnd')::numeric
        <= (candidate ->> 'trimStart')::numeric
    then
      raise exception 'trending_hook_generation_invalid_trim';
    end if;
  end loop;

  update public.user_hook_video_assignments
  set
    completed_at = coalesce(completed_at, now_at),
    state = 'superseded',
    updated_at = now_at
  where user_id = p_user_id
    and business_profile_id = p_business_profile_id
    and business_profile_version = p_business_profile_version
    and state = 'active';

  for candidate in
    select value
    from jsonb_array_elements(p_candidates)
    order by (value ->> 'candidateIndex')::integer
  loop
    suggestion_id := gen_random_uuid();

    insert into public.hook_video_suggestions (
      id,
      user_id,
      business_profile_id,
      business_profile_version,
      generation_id,
      generation_job_id,
      candidate_index,
      suggestion_context,
      influencer_id,
      influencer_key,
      influencer_name,
      influencer_video_id,
      influencer_video_title,
      influencer_source,
      reaction_type,
      visual_group,
      demo_asset_id,
      text,
      duration_seconds,
      source_duration_seconds,
      trim_start,
      trim_end,
      thumbnail_url,
      prompt_version,
      selection_version,
      generator_model,
      readability_review,
      visual_fit
    )
    values (
      suggestion_id,
      p_user_id,
      p_business_profile_id,
      p_business_profile_version,
      p_job_id,
      p_job_id,
      (candidate ->> 'candidateIndex')::integer,
      'trending',
      trim(candidate ->> 'influencerId'),
      nullif(trim(candidate ->> 'influencerKey'), ''),
      trim(candidate ->> 'influencerName'),
      trim(candidate ->> 'influencerVideoId'),
      trim(candidate ->> 'influencerVideoTitle'),
      candidate ->> 'sourceKind',
      nullif(trim(candidate ->> 'reactionType'), ''),
      nullif(trim(candidate ->> 'visualGroup'), ''),
      null,
      trim(candidate ->> 'hookText'),
      (candidate ->> 'durationSeconds')::numeric,
      (candidate ->> 'sourceDurationSeconds')::numeric,
      (candidate ->> 'trimStart')::numeric,
      (candidate ->> 'trimEnd')::numeric,
      nullif(trim(candidate ->> 'thumbnailUrl'), ''),
      trim(p_prompt_version),
      trim(p_selection_version),
      trim(p_generator_model),
      candidate -> 'readabilityReview',
      candidate -> 'visualFit'
    );

    insert into public.user_hook_video_assignments (
      user_id,
      business_profile_id,
      business_profile_version,
      hook_suggestion_id,
      position,
      state
    )
    values (
      p_user_id,
      p_business_profile_id,
      p_business_profile_version,
      suggestion_id,
      (candidate ->> 'candidateIndex')::integer,
      'active'
    );
  end loop;

  return candidate_count;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."persist_trending_hook_copy_generation_slot_internal"(uuid, text, uuid, integer, text, text, text, jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "public"."persist_trending_hook_copy_generation_slot_internal"(uuid, text, uuid, integer, text, text, text, jsonb) FROM PUBLIC;


-- source: public/functions/persist_trending_hook_copy_generation_v4.sql
CREATE OR REPLACE FUNCTION public.persist_trending_hook_copy_generation_v4 (
  p_job_id                   uuid,
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_prompt_version           text,
  p_selection_version        text,
  p_generator_model          text,
  p_candidates               jsonb
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  candidate jsonb;
  candidate_count integer;
  persisted_count integer;
  slot_base integer;
begin
  if p_prompt_version <> 'trending-hook-copy-v4'
    or p_selection_version <> 'pattern-diversity-v4'
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'trending_hook_generation_invalid_v4_contract';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 1 or candidate_count > 12 then
    raise exception 'trending_hook_generation_invalid_candidate_count';
  end if;

  for candidate in
    select value
    from jsonb_array_elements(p_candidates)
  loop
    if jsonb_typeof(candidate) <> 'object'
      or jsonb_typeof(candidate -> 'openingLines') <> 'array'
      or jsonb_array_length(candidate -> 'openingLines') not between 1 and 2
      or exists (
        select 1
        from jsonb_array_elements(candidate -> 'openingLines') as line
        where jsonb_typeof(line.value) <> 'string'
          or char_length(trim(line.value #>> '{}')) not between 1 and 78
      )
      or coalesce(trim(candidate ->> 'hookText'), '') <> (
        select string_agg(line.value #>> '{}', E'\n' order by line.ordinality)
        from jsonb_array_elements(candidate -> 'openingLines')
          with ordinality as line(value, ordinality)
      )
      or coalesce(candidate ->> 'patternId', '') not in (
        'mystery_discovery',
        'direct_capability',
        'problem_observation',
        'skeptical_challenge',
        'problem_reversal',
        'workflow_exposed',
        'outcome_without_friction',
        'professional_transformation'
      )
      or candidate ->> 'patternLibraryVersion' <> 'trending-hook-patterns-v2'
      or candidate ->> 'validatorVersion' <> 'trending-hook-validator-v2'
      or coalesce(candidate ->> 'inputContextHash', '') !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(candidate -> 'validation') <> 'object'
      or candidate #>> '{validation,passed}' <> 'true'
      or candidate #>> '{validation,evidenceBindingPassed}' <> 'true'
      or jsonb_typeof(candidate #> '{validation,evidenceBindings}') <> 'array'
      or jsonb_array_length(candidate #> '{validation,evidenceBindings}') not between 1 and 2
      or candidate #>> '{validation,multipleMessagesPassed}' <> 'true'
      or candidate #>> '{validation,demoExplanationPassed}' <> 'true'
      or candidate #>> '{validation,secondaryBenefitPassed}' <> 'true'
      or candidate #>> '{validation,aiLikeLanguagePassed}' <> 'true'
      or candidate #>> '{validation,intentionalLineBreaksPassed}' <> 'true'
      or candidate #>> '{readabilityReview,truthful}' <> 'true'
      or candidate #>> '{readabilityReview,claimSafe}' <> 'true'
      or candidate #>> '{readabilityReview,humanVoice}' <> 'true'
      or candidate #>> '{readabilityReview,openingOnly}' <> 'true'
      or candidate #>> '{readabilityReview,singleIdea}' <> 'true'
      or candidate #>> '{readabilityReview,readable}' <> 'true'
      or candidate #>> '{readabilityReview,reactionMatch}' <> 'true'
      or candidate #>> '{readabilityReview,scrollStopping}' <> 'true'
      or (candidate #>> '{readabilityReview,scores,total}')::integer not between 80 and 100
      or candidate #>> '{visualFit,overlayVersion}' <> 'hook-overlay-v3'
      or candidate #>> '{visualFit,fits}' <> 'true'
      or (candidate #>> '{visualFit,semanticLineCount}')::integer not between 1 and 2
      or (candidate #>> '{visualFit,wordCount}')::integer > 12
      or (candidate #>> '{visualFit,characterCount}')::integer > 78
    then
      raise exception 'trending_hook_generation_invalid_v4_candidate';
    end if;
  end loop;

  persisted_count := public.persist_trending_hook_copy_generation(
    p_job_id,
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    p_prompt_version,
    p_selection_version,
    p_generator_model,
    p_candidates
  );

  select min(suggestion.candidate_index)
  into slot_base
  from public.hook_video_suggestions as suggestion
  where suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.suggestion_context = 'trending';

  if slot_base is null then
    raise exception 'trending_hook_generation_v4_rows_missing';
  end if;

  update public.hook_video_suggestions as suggestion
  set
    opening_lines = candidate.value -> 'openingLines',
    pattern_id = candidate.value ->> 'patternId',
    pattern_library_version = candidate.value ->> 'patternLibraryVersion',
    validator_version = candidate.value ->> 'validatorVersion',
    input_context_hash = candidate.value ->> 'inputContextHash',
    validation_metadata = candidate.value -> 'validation',
    quality_score = (candidate.value #>> '{readabilityReview,scores,total}')::integer
  from jsonb_array_elements(p_candidates) as candidate(value)
  where suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.candidate_index = slot_base + (candidate.value ->> 'candidateIndex')::integer;

  return persisted_count;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."persist_trending_hook_copy_generation_v4"(uuid, text, uuid, integer, text, text, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."persist_trending_hook_copy_generation_v4"(uuid, text, uuid, integer, text, text, text, jsonb) FROM PUBLIC;


-- source: public/functions/persist_trending_hook_copy_generation_v5.sql
CREATE OR REPLACE FUNCTION public.persist_trending_hook_copy_generation_v5 (
  p_job_id                   uuid,
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_prompt_version           text,
  p_selection_version        text,
  p_generator_model          text,
  p_candidates               jsonb
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  candidate jsonb;
  candidate_count integer;
  persisted_count integer;
  slot_base integer;
  slotted_candidates jsonb;
begin
  if p_prompt_version <> 'trending-hook-copy-v5'
    or p_selection_version <> 'purpose-industry-diversity-v5'
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'trending_hook_generation_invalid_v5_contract';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 1 or candidate_count > 12 then
    raise exception 'trending_hook_generation_invalid_candidate_count';
  end if;

  if not exists (
    select 1
    from public.background_jobs as job
    where job.id = p_job_id
      and job.user_id = p_user_id
      and job.job_type = 'generate_trending_hook_copy'
  ) or not exists (
    select 1
    from public.business_profiles as profile
    where profile.id = p_business_profile_id
      and profile.user_id = p_user_id
      and profile.profile_version = p_business_profile_version
  ) then
    raise exception 'trending_hook_generation_scope_mismatch';
  end if;

  for candidate in select value from jsonb_array_elements(p_candidates)
  loop
    if not public.hook_copy_v5_candidate_is_valid(candidate) then
      raise exception 'trending_hook_generation_invalid_v5_candidate';
    end if;
  end loop;

  if (
    select count(distinct (item.value ->> 'candidateIndex')::integer)
    from jsonb_array_elements(p_candidates) as item(value)
  ) <> candidate_count then
    raise exception 'trending_hook_generation_duplicate_candidate';
  end if;

  select count(*) into persisted_count
  from public.hook_video_suggestions as suggestion
  where suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.suggestion_context = 'trending';

  if persisted_count > 0 then
    if persisted_count <> candidate_count then
      raise exception 'trending_hook_generation_partial_state';
    end if;

    return persisted_count;
  end if;

  select coalesce(max(suggestion.candidate_index), -1) + 1
  into slot_base
  from public.hook_video_suggestions as suggestion
  where suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.suggestion_context = 'trending';

  select jsonb_agg(
    jsonb_set(
      item.value,
      '{candidateIndex}',
      to_jsonb(slot_base + (item.value ->> 'candidateIndex')::integer),
      false
    )
    order by item.ordinality
  )
  into slotted_candidates
  from jsonb_array_elements(p_candidates)
    with ordinality as item(value, ordinality);

  persisted_count := public.persist_trending_hook_copy_generation_slot_internal(
    p_job_id,
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    p_prompt_version,
    p_selection_version,
    p_generator_model,
    slotted_candidates
  );

  update public.hook_video_suggestions as suggestion
  set
    opening_lines = candidate.value -> 'openingLines',
    pattern_id = candidate.value ->> 'patternId',
    pattern_library_version = candidate.value ->> 'patternLibraryVersion',
    validator_version = candidate.value ->> 'validatorVersion',
    input_context_hash = candidate.value ->> 'inputContextHash',
    validation_metadata = candidate.value -> 'validation',
    quality_score = (candidate.value #>> '{readabilityReview,scores,total}')::integer,
    campaign_purpose = candidate.value ->> 'campaignPurpose',
    industry_pack_id = candidate.value ->> 'industryPackId'
  from jsonb_array_elements(p_candidates) as candidate(value)
  where suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.suggestion_context = 'trending'
    and suggestion.candidate_index =
      slot_base + (candidate.value ->> 'candidateIndex')::integer;

  update public.user_hook_video_assignments as assignment
  set
    position = suggestion.candidate_index - slot_base,
    updated_at = now()
  from public.hook_video_suggestions as suggestion
  where assignment.hook_suggestion_id = suggestion.id
    and suggestion.generation_job_id = p_job_id
    and assignment.user_id = p_user_id
    and assignment.business_profile_id = p_business_profile_id
    and assignment.business_profile_version = p_business_profile_version;

  return persisted_count;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."persist_trending_hook_copy_generation_v5"(uuid, text, uuid, integer, text, text, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."persist_trending_hook_copy_generation_v5"(uuid, text, uuid, integer, text, text, text, jsonb) FROM PUBLIC;


-- source: public/functions/persist_trending_hook_copy_generation_v6.sql
CREATE OR REPLACE FUNCTION public.persist_trending_hook_copy_generation_v6 (
  p_job_id                   uuid,
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_prompt_version           text,
  p_selection_version        text,
  p_generator_model          text,
  p_candidates               jsonb
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  candidate jsonb;
  candidate_count integer;
  persisted_count integer;
  updated_count integer;
begin
  if p_prompt_version <> 'trending-hook-copy-v6'
    or p_selection_version <> 'purpose-industry-diversity-v5'
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'trending_hook_generation_invalid_v6_contract';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 1 or candidate_count > 12 then
    raise exception 'trending_hook_generation_invalid_candidate_count';
  end if;

  if (
    select count(distinct (item.value ->> 'candidateIndex')::integer)
    from jsonb_array_elements(p_candidates) as item(value)
  ) <> candidate_count then
    raise exception 'trending_hook_generation_duplicate_candidate';
  end if;

  for candidate in select value from jsonb_array_elements(p_candidates)
  loop
    if not public.hook_copy_v6_candidate_is_valid(candidate) then
      raise exception 'trending_hook_generation_invalid_v6_candidate';
    end if;
  end loop;

  -- Reuse the proven v5 slot and assignment transaction, then add the new v6
  -- fields before this outer transaction can commit.
  persisted_count := public.persist_trending_hook_copy_generation_v5(
    p_job_id,
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    'trending-hook-copy-v5',
    p_selection_version,
    p_generator_model,
    p_candidates
  );

  update public.hook_video_suggestions as suggestion
  set
    audio_intent = candidate.value -> 'audioIntent',
    prompt_version = p_prompt_version
  from public.user_hook_video_assignments as assignment,
    jsonb_array_elements(p_candidates) as candidate(value)
  where assignment.hook_suggestion_id = suggestion.id
    and assignment.user_id = p_user_id
    and assignment.business_profile_id = p_business_profile_id
    and assignment.business_profile_version = p_business_profile_version
    and assignment.position =
      (candidate.value ->> 'candidateIndex')::integer
    and suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.suggestion_context = 'trending';

  get diagnostics updated_count = row_count;

  if updated_count <> candidate_count
    or persisted_count <> candidate_count
  then
    raise exception 'trending_hook_generation_v6_persistence_mismatch';
  end if;

  return persisted_count;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."persist_trending_hook_copy_generation_v6"(uuid, text, uuid, integer, text, text, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."persist_trending_hook_copy_generation_v6"(uuid, text, uuid, integer, text, text, text, jsonb) FROM PUBLIC;


-- source: public/functions/persist_trending_hook_copy_generation_v7.sql
CREATE OR REPLACE FUNCTION public.persist_trending_hook_copy_generation_v7 (
  p_job_id                   uuid,
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_prompt_version           text,
  p_selection_version        text,
  p_generator_model          text,
  p_candidates               jsonb
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  candidate jsonb;
  candidate_count integer;
  legacy_candidates jsonb;
  persisted_count integer;
  updated_count integer;
begin
  if p_prompt_version <> 'trending-hook-copy-v7'
    or p_selection_version not in (
      'global-format-rotation-v1',
      'reaction-format-map-v2'
    )
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'trending_hook_generation_invalid_v7_contract';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 1 or candidate_count > 12 or (
    select count(distinct (item.value ->> 'candidateIndex')::integer)
    from jsonb_array_elements(p_candidates) as item(value)
  ) <> candidate_count then
    raise exception 'trending_hook_generation_invalid_v7_candidates';
  end if;

  for candidate in select value from jsonb_array_elements(p_candidates)
  loop
    if not public.hook_copy_v7_candidate_is_valid(candidate) then
      raise exception 'trending_hook_generation_invalid_v7_candidate';
    end if;
  end loop;

  select jsonb_agg(
    item.value || jsonb_build_object(
      'patternId', 'mystery_discovery',
      'patternLibraryVersion', 'trending-hook-patterns-v3',
      'industryPackId', 'general'
    ) order by item.ordinality
  )
  into legacy_candidates
  from jsonb_array_elements(p_candidates)
    with ordinality as item(value, ordinality);

  persisted_count := public.persist_trending_hook_copy_generation_v6(
    p_job_id,
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    'trending-hook-copy-v6',
    'purpose-industry-diversity-v5',
    p_generator_model,
    legacy_candidates
  );

  update public.hook_video_suggestions as suggestion
  set
    hook_text_format_id = candidate.value ->> 'hookTextFormatId',
    hook_text_variant_id = candidate.value ->> 'hookTextVariantId',
    hook_text_format_library_version =
      candidate.value ->> 'hookTextFormatLibraryVersion',
    pattern_id = null,
    pattern_library_version = null,
    industry_pack_id = null,
    audio_intent = candidate.value -> 'audioIntent',
    prompt_version = p_prompt_version,
    selection_version = p_selection_version
  from public.user_hook_video_assignments as assignment,
    jsonb_array_elements(p_candidates) as candidate(value)
  where assignment.hook_suggestion_id = suggestion.id
    and assignment.user_id = p_user_id
    and assignment.business_profile_id = p_business_profile_id
    and assignment.business_profile_version = p_business_profile_version
    and assignment.position =
      (candidate.value ->> 'candidateIndex')::integer
    and suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.suggestion_context = 'trending';

  get diagnostics updated_count = row_count;

  if persisted_count <> candidate_count or updated_count <> candidate_count then
    raise exception 'trending_hook_generation_v7_persistence_mismatch';
  end if;

  return persisted_count;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."persist_trending_hook_copy_generation_v7"(uuid, text, uuid, integer, text, text, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."persist_trending_hook_copy_generation_v7"(uuid, text, uuid, integer, text, text, text, jsonb) FROM PUBLIC;


-- source: public/functions/persist_trending_hook_copy_generation.sql
CREATE OR REPLACE FUNCTION public.persist_trending_hook_copy_generation (
  p_job_id                   uuid,
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_prompt_version           text,
  p_selection_version        text,
  p_generator_model          text,
  p_candidates               jsonb
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  candidate jsonb;
  candidate_count integer;
  existing_count integer;
  persisted_count integer;
  slot_base integer;
  slotted_candidates jsonb;
begin
  if jsonb_typeof(p_candidates) <> 'array' then
    raise exception 'trending_hook_generation_invalid_candidate_batch';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 1 or candidate_count > 12 then
    raise exception 'trending_hook_generation_invalid_candidate_count';
  end if;

  if p_prompt_version = 'trending-hook-copy-v3' then
    for candidate in
      select value
      from jsonb_array_elements(p_candidates)
    loop
      if jsonb_typeof(candidate) <> 'object'
        or jsonb_typeof(candidate -> 'openingLines') <> 'array'
        or jsonb_array_length(candidate -> 'openingLines') not between 1 and 3
        or exists (
          select 1
          from jsonb_array_elements(candidate -> 'openingLines') as line
          where jsonb_typeof(line.value) <> 'string'
            or char_length(trim(line.value #>> '{}')) not between 1 and 100
        )
        or coalesce(trim(candidate ->> 'hookText'), '') <> (
          select string_agg(line.value #>> '{}', E'\n' order by line.ordinality)
          from jsonb_array_elements(candidate -> 'openingLines')
            with ordinality as line(value, ordinality)
        )
        or coalesce(candidate ->> 'patternId', '') not in (
          'mystery_discovery',
          'direct_capability',
          'painful_truth',
          'skeptical_challenge',
          'problem_reversal',
          'workflow_exposed',
          'outcome_without_friction',
          'professional_transformation'
        )
        or candidate ->> 'patternLibraryVersion' <> 'trending-hook-patterns-v1'
        or candidate ->> 'validatorVersion' <> 'trending-hook-validator-v1'
        or coalesce(candidate ->> 'inputContextHash', '') !~ '^[a-f0-9]{64}$'
        or jsonb_typeof(candidate -> 'validation') <> 'object'
        or candidate #>> '{validation,passed}' <> 'true'
        or candidate #>> '{readabilityReview,truthful}' <> 'true'
        or candidate #>> '{readabilityReview,claimSafe}' <> 'true'
        or (candidate #>> '{readabilityReview,scores,total}')::integer not between 80 and 100
        or candidate #>> '{visualFit,overlayVersion}' <> 'hook-overlay-v3'
        or candidate #>> '{visualFit,fits}' <> 'true'
      then
        raise exception 'trending_hook_generation_invalid_v3_candidate';
      end if;
    end loop;
  end if;

  select count(*)
  into existing_count
  from public.hook_video_suggestions as suggestion
  where suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.suggestion_context = 'trending';

  if existing_count > 0 then
    return existing_count;
  end if;

  select coalesce(max(suggestion.candidate_index), -1) + 1
  into slot_base
  from public.hook_video_suggestions as suggestion
  where suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.suggestion_context = 'trending';

  select jsonb_agg(
    jsonb_set(
      item.value,
      '{candidateIndex}',
      to_jsonb(slot_base + (item.value ->> 'candidateIndex')::integer),
      false
    )
    order by item.ordinality
  )
  into slotted_candidates
  from jsonb_array_elements(p_candidates)
    with ordinality as item(value, ordinality);

  persisted_count :=
    public.persist_trending_hook_copy_generation_slot_internal(
      p_job_id,
      p_user_id,
      p_business_profile_id,
      p_business_profile_version,
      p_prompt_version,
      p_selection_version,
      p_generator_model,
      slotted_candidates
    );

  if p_prompt_version = 'trending-hook-copy-v3' then
    update public.hook_video_suggestions as suggestion
    set
      opening_lines = candidate.value -> 'openingLines',
      pattern_id = candidate.value ->> 'patternId',
      pattern_library_version = candidate.value ->> 'patternLibraryVersion',
      validator_version = candidate.value ->> 'validatorVersion',
      input_context_hash = candidate.value ->> 'inputContextHash',
      validation_metadata = candidate.value -> 'validation',
      quality_score = (candidate.value #>> '{readabilityReview,scores,total}')::integer
    from jsonb_array_elements(p_candidates) as candidate(value)
    where suggestion.generation_job_id = p_job_id
      and suggestion.user_id = p_user_id
      and suggestion.candidate_index =
        slot_base + (candidate.value ->> 'candidateIndex')::integer;
  end if;

  update public.user_hook_video_assignments as assignment
  set
    position = suggestion.candidate_index - slot_base,
    updated_at = now()
  from public.hook_video_suggestions as suggestion
  where assignment.hook_suggestion_id = suggestion.id
    and suggestion.generation_job_id = p_job_id
    and assignment.user_id = p_user_id
    and assignment.business_profile_id = p_business_profile_id
    and assignment.business_profile_version = p_business_profile_version;

  return persisted_count;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."persist_trending_hook_copy_generation"(uuid, text, uuid, integer, text, text, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."persist_trending_hook_copy_generation"(uuid, text, uuid, integer, text, text, text, jsonb) FROM PUBLIC;


-- source: public/functions/persist_trending_hook_generation_chunk_v1.sql
CREATE OR REPLACE FUNCTION public.persist_trending_hook_generation_chunk_v1 (
  p_run_id                   uuid,
  p_chunk_id                 uuid,
  p_job_id                   uuid,
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_prompt_version           text,
  p_selection_version        text,
  p_generator_model          text,
  p_candidates               jsonb
)
  RETURNS TABLE (
    accepted_count        integer,
    already_persisted     boolean,
    completed_valid_count integer,
    remaining_valid_count integer,
    run_status            text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_run public.trending_hook_generation_runs%rowtype;
  v_chunk public.trending_hook_generation_run_chunks%rowtype;
  v_accepted_count integer;
  v_candidate_count integer;
  v_accepted_video_ids text[];
  v_remaining_before integer;
begin
  if p_run_id is null
    or p_chunk_id is null
    or p_job_id is null
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'trending_hook_generation_run_invalid_persistence_input';
  end if;

  select *
  into v_run
  from public.trending_hook_generation_runs as run
  where run.id = p_run_id
  for update;

  select *
  into v_chunk
  from public.trending_hook_generation_run_chunks as chunk
  where chunk.id = p_chunk_id
    and chunk.run_id = p_run_id
  for update;

  if not found then
    raise exception 'trending_hook_generation_chunk_not_found';
  end if;

  if v_chunk.status = 'completed' then
    return query
    select
      v_chunk.accepted_count,
      true,
      v_run.completed_valid_count,
      greatest(v_run.target_valid_count - v_run.completed_valid_count, 0),
      v_run.status;
    return;
  end if;

  if v_run.status not in ('queued', 'processing', 'continuation_pending')
    or v_chunk.background_job_id <> p_job_id
  then
    raise exception 'trending_hook_generation_run_scope_mismatch';
  end if;

  v_candidate_count := jsonb_array_length(p_candidates);
  v_remaining_before := v_run.target_valid_count - v_run.completed_valid_count;

  if v_candidate_count > v_remaining_before
    or v_candidate_count > v_chunk.candidate_count
    or (
      select count(distinct trim(candidate.value ->> 'influencerVideoId'))
      from jsonb_array_elements(p_candidates) as candidate(value)
    ) <> v_candidate_count
    or exists (
      select 1
      from jsonb_array_elements(p_candidates) as candidate(value)
      where not exists (
        select 1
        from public.trending_hook_generation_run_candidates as source_candidate
        where source_candidate.run_id = p_run_id
          and source_candidate.chunk_id = p_chunk_id
          and source_candidate.influencer_video_id = trim(candidate.value ->> 'influencerVideoId')
      )
    )
  then
    raise exception 'trending_hook_generation_run_invalid_persistence_candidates';
  end if;

  if v_candidate_count = 0 then
    v_accepted_count := 0;
  else
    v_accepted_count := public.persist_trending_hook_copy_generation_v7(
      p_job_id,
      p_user_id,
      p_business_profile_id,
      p_business_profile_version,
      p_prompt_version,
      p_selection_version,
      p_generator_model,
      p_candidates
    );
  end if;

  if v_accepted_count <> v_candidate_count then
    raise exception 'trending_hook_generation_run_persistence_mismatch';
  end if;

  select array_agg(trim(candidate.value ->> 'influencerVideoId'))
  into v_accepted_video_ids
  from jsonb_array_elements(p_candidates) as candidate(value);

  update public.trending_hook_generation_run_candidates as candidate
  set
    state = case
      when candidate.influencer_video_id = any(v_accepted_video_ids) then 'accepted'
      else 'rejected'
    end,
    attempted_at = now(),
    updated_at = now()
  where candidate.run_id = p_run_id
    and candidate.chunk_id = p_chunk_id
    and candidate.state = 'reserved';

  update public.trending_hook_generation_run_chunks
  set
    accepted_count = v_accepted_count,
    rejected_count = candidate_count - v_accepted_count,
    status = 'completed',
    completed_at = now(),
    last_error = null,
    updated_at = now()
  where id = p_chunk_id;

  update public.trending_hook_generation_runs as run
  set
    completed_valid_count = run.completed_valid_count + v_accepted_count,
    status = case
      when run.completed_valid_count + v_accepted_count >= run.target_valid_count then 'completed'
      else 'continuation_pending'
    end,
    completed_at = case
      when run.completed_valid_count + v_accepted_count >= run.target_valid_count then now()
      else null
    end,
    last_error = null,
    updated_at = now()
  where run.id = p_run_id
  returning run.* into v_run;

  return query
  select
    v_accepted_count,
    false,
    v_run.completed_valid_count,
    greatest(v_run.target_valid_count - v_run.completed_valid_count, 0),
    v_run.status;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."persist_trending_hook_generation_chunk_v1"(uuid, uuid, uuid, text, uuid, integer, text, text, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."persist_trending_hook_generation_chunk_v1"(uuid, uuid, uuid, text, uuid, integer, text, text, text, jsonb) FROM PUBLIC;


-- source: public/functions/persist_validated_hook_composition_generation_v6.sql
CREATE OR REPLACE FUNCTION public.persist_validated_hook_composition_generation_v6 (
  p_job_id                   uuid,
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_demo_asset_id            uuid,
  p_prompt_version           text,
  p_selection_version        text,
  p_generator_model          text,
  p_candidates               jsonb
)
  RETURNS TABLE (
    id   uuid,
    text text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  candidate jsonb;
  candidate_count integer;
  updated_count integer;
begin
  if p_prompt_version <> 'trending-hook-copy-v6'
    or p_selection_version <> 'purpose-industry-diversity-v5'
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'hook_composition_generation_invalid_v6_contract';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 4 or candidate_count > 8 then
    raise exception 'hook_composition_generation_invalid_candidate_count';
  end if;

  if (
    select count(distinct (item.value ->> 'candidateIndex')::integer)
    from jsonb_array_elements(p_candidates) as item(value)
  ) <> candidate_count then
    raise exception 'hook_composition_generation_duplicate_candidate';
  end if;

  for candidate in select value from jsonb_array_elements(p_candidates)
  loop
    if not public.hook_copy_v6_candidate_is_valid(candidate) then
      raise exception 'hook_composition_generation_invalid_v6_candidate';
    end if;
  end loop;

  perform public.persist_validated_hook_composition_generation(
    p_job_id,
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    p_demo_asset_id,
    'trending-hook-copy-v5',
    p_selection_version,
    p_generator_model,
    p_candidates
  );

  update public.hook_video_suggestions as suggestion
  set
    audio_intent = candidate.value -> 'audioIntent',
    prompt_version = p_prompt_version
  from jsonb_array_elements(p_candidates) as candidate(value)
  where suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.demo_asset_id = p_demo_asset_id
    and suggestion.suggestion_context = 'composition'
    and suggestion.candidate_index =
      (candidate.value ->> 'candidateIndex')::integer;

  get diagnostics updated_count = row_count;

  if updated_count <> candidate_count then
    raise exception 'hook_composition_generation_v6_persistence_mismatch';
  end if;

  return query
    select suggestion.id, suggestion.text
    from public.hook_video_suggestions as suggestion
    where suggestion.generation_job_id = p_job_id
      and suggestion.user_id = p_user_id
      and suggestion.suggestion_context = 'composition'
    order by suggestion.candidate_index, suggestion.created_at;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."persist_validated_hook_composition_generation_v6"(uuid, text, uuid, integer, uuid, text, text, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."persist_validated_hook_composition_generation_v6"(uuid, text, uuid, integer, uuid, text, text, text, jsonb) FROM PUBLIC;


-- source: public/functions/persist_validated_hook_composition_generation_v7.sql
CREATE OR REPLACE FUNCTION public.persist_validated_hook_composition_generation_v7 (
  p_job_id                   uuid,
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_demo_asset_id            uuid,
  p_prompt_version           text,
  p_selection_version        text,
  p_generator_model          text,
  p_candidates               jsonb
)
  RETURNS TABLE (
    id   uuid,
    text text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  candidate jsonb;
  candidate_count integer;
  legacy_candidates jsonb;
  updated_count integer;
begin
  if p_prompt_version <> 'trending-hook-copy-v7'
    or p_selection_version <> 'global-format-rotation-v1'
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'hook_composition_generation_invalid_v7_contract';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 4 or candidate_count > 8 or (
    select count(distinct (item.value ->> 'candidateIndex')::integer)
    from jsonb_array_elements(p_candidates) as item(value)
  ) <> candidate_count then
    raise exception 'hook_composition_generation_invalid_v7_candidates';
  end if;

  for candidate in select value from jsonb_array_elements(p_candidates)
  loop
    if not public.hook_copy_v7_candidate_is_valid(candidate) then
      raise exception 'hook_composition_generation_invalid_v7_candidate';
    end if;
  end loop;

  select jsonb_agg(
    item.value || jsonb_build_object(
      'patternId', 'mystery_discovery',
      'patternLibraryVersion', 'trending-hook-patterns-v3',
      'industryPackId', 'general'
    ) order by item.ordinality
  )
  into legacy_candidates
  from jsonb_array_elements(p_candidates)
    with ordinality as item(value, ordinality);

  perform public.persist_validated_hook_composition_generation_v6(
    p_job_id,
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    p_demo_asset_id,
    'trending-hook-copy-v6',
    'purpose-industry-diversity-v5',
    p_generator_model,
    legacy_candidates
  );

  update public.hook_video_suggestions as suggestion
  set
    hook_text_format_id = candidate.value ->> 'hookTextFormatId',
    hook_text_variant_id = candidate.value ->> 'hookTextVariantId',
    hook_text_format_library_version =
      candidate.value ->> 'hookTextFormatLibraryVersion',
    pattern_id = null,
    pattern_library_version = null,
    industry_pack_id = null,
    audio_intent = candidate.value -> 'audioIntent',
    prompt_version = p_prompt_version,
    selection_version = p_selection_version
  from jsonb_array_elements(p_candidates) as candidate(value)
  where suggestion.generation_job_id = p_job_id
    and suggestion.user_id = p_user_id
    and suggestion.business_profile_id = p_business_profile_id
    and suggestion.business_profile_version = p_business_profile_version
    and suggestion.demo_asset_id = p_demo_asset_id
    and suggestion.suggestion_context = 'composition'
    and suggestion.candidate_index =
      (candidate.value ->> 'candidateIndex')::integer;

  get diagnostics updated_count = row_count;

  if updated_count <> candidate_count then
    raise exception 'hook_composition_generation_v7_persistence_mismatch';
  end if;

  return query
    select suggestion.id, suggestion.text
    from public.hook_video_suggestions as suggestion
    where suggestion.generation_job_id = p_job_id
      and suggestion.user_id = p_user_id
      and suggestion.suggestion_context = 'composition'
    order by suggestion.candidate_index, suggestion.created_at;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."persist_validated_hook_composition_generation_v7"(uuid, text, uuid, integer, uuid, text, text, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."persist_validated_hook_composition_generation_v7"(uuid, text, uuid, integer, uuid, text, text, text, jsonb) FROM PUBLIC;


-- source: public/functions/persist_validated_hook_composition_generation.sql
CREATE OR REPLACE FUNCTION public.persist_validated_hook_composition_generation (
  p_job_id                   uuid,
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_demo_asset_id            uuid,
  p_prompt_version           text,
  p_selection_version        text,
  p_generator_model          text,
  p_candidates               jsonb
)
  RETURNS TABLE (
    id   uuid,
    text text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  candidate jsonb;
  candidate_count integer;
begin
  if p_prompt_version <> 'trending-hook-copy-v5'
    or p_selection_version <> 'purpose-industry-diversity-v5'
    or jsonb_typeof(p_candidates) <> 'array'
  then
    raise exception 'hook_composition_generation_invalid_v5_contract';
  end if;

  candidate_count := jsonb_array_length(p_candidates);

  if candidate_count < 4 or candidate_count > 8 then
    raise exception 'hook_composition_generation_invalid_candidate_count';
  end if;

  if not exists (
    select 1
    from public.background_jobs as job
    where job.id = p_job_id
      and job.user_id = p_user_id
      and job.job_type = 'hook_text_generation'
  ) or not exists (
    select 1
    from public.business_profiles as profile
    where profile.id = p_business_profile_id
      and profile.user_id = p_user_id
      and profile.profile_version = p_business_profile_version
  ) or not exists (
    select 1
    from public.media_assets as asset
    where asset.id = p_demo_asset_id
      and asset.user_id = p_user_id
  ) then
    raise exception 'hook_composition_generation_scope_mismatch';
  end if;

  if exists (
    select 1
    from public.hook_video_suggestions as suggestion
    where suggestion.generation_job_id = p_job_id
      and suggestion.user_id = p_user_id
      and suggestion.suggestion_context = 'composition'
  ) then
    return query
      select suggestion.id, suggestion.text
      from public.hook_video_suggestions as suggestion
      where suggestion.generation_job_id = p_job_id
        and suggestion.user_id = p_user_id
        and suggestion.suggestion_context = 'composition'
      order by suggestion.candidate_index, suggestion.created_at;
    return;
  end if;

  if (
    select count(distinct (item.value ->> 'candidateIndex')::integer)
    from jsonb_array_elements(p_candidates) as item(value)
  ) <> candidate_count then
    raise exception 'hook_composition_generation_duplicate_candidate';
  end if;

  for candidate in select value from jsonb_array_elements(p_candidates)
  loop
    if not public.hook_copy_v5_candidate_is_valid(candidate) then
      raise exception 'hook_composition_generation_invalid_v5_candidate';
    end if;
  end loop;

  insert into public.hook_video_suggestions (
    user_id,
    business_profile_id,
    business_profile_version,
    generation_id,
    generation_job_id,
    candidate_index,
    suggestion_context,
    influencer_id,
    influencer_key,
    influencer_name,
    influencer_video_id,
    influencer_video_title,
    influencer_source,
    reaction_type,
    visual_group,
    demo_asset_id,
    text,
    duration_seconds,
    source_duration_seconds,
    trim_start,
    trim_end,
    thumbnail_url,
    prompt_version,
    selection_version,
    generator_model,
    readability_review,
    visual_fit,
    opening_lines,
    pattern_id,
    pattern_library_version,
    validator_version,
    input_context_hash,
    validation_metadata,
    quality_score,
    campaign_purpose,
    industry_pack_id
  )
  select
    p_user_id,
    p_business_profile_id,
    p_business_profile_version,
    p_job_id,
    p_job_id,
    (candidate.value ->> 'candidateIndex')::integer,
    'composition',
    trim(candidate.value ->> 'influencerId'),
    nullif(trim(candidate.value ->> 'influencerKey'), ''),
    trim(candidate.value ->> 'influencerName'),
    trim(candidate.value ->> 'influencerVideoId'),
    trim(candidate.value ->> 'influencerVideoTitle'),
    candidate.value ->> 'sourceKind',
    nullif(trim(candidate.value ->> 'reactionType'), ''),
    nullif(trim(candidate.value ->> 'visualGroup'), ''),
    p_demo_asset_id,
    trim(candidate.value ->> 'hookText'),
    (candidate.value ->> 'durationSeconds')::numeric,
    (candidate.value ->> 'sourceDurationSeconds')::numeric,
    (candidate.value ->> 'trimStart')::numeric,
    (candidate.value ->> 'trimEnd')::numeric,
    nullif(trim(candidate.value ->> 'thumbnailUrl'), ''),
    p_prompt_version,
    p_selection_version,
    p_generator_model,
    candidate.value -> 'readabilityReview',
    candidate.value -> 'visualFit',
    candidate.value -> 'openingLines',
    candidate.value ->> 'patternId',
    candidate.value ->> 'patternLibraryVersion',
    candidate.value ->> 'validatorVersion',
    candidate.value ->> 'inputContextHash',
    candidate.value -> 'validation',
    (candidate.value #>> '{readabilityReview,scores,total}')::integer,
    candidate.value ->> 'campaignPurpose',
    candidate.value ->> 'industryPackId'
  from jsonb_array_elements(p_candidates) as candidate(value)
  order by (candidate.value ->> 'candidateIndex')::integer;

  return query
    select suggestion.id, suggestion.text
    from public.hook_video_suggestions as suggestion
    where suggestion.generation_job_id = p_job_id
      and suggestion.user_id = p_user_id
      and suggestion.suggestion_context = 'composition'
    order by suggestion.candidate_index, suggestion.created_at;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."persist_validated_hook_composition_generation"(uuid, text, uuid, integer, uuid, text, text, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."persist_validated_hook_composition_generation"(uuid, text, uuid, integer, uuid, text, text, text, jsonb) FROM PUBLIC;


-- source: public/functions/persist_wall_text_content_plan_brief_chunk.sql
CREATE OR REPLACE FUNCTION public.persist_wall_text_content_plan_brief_chunk (
  p_user_id text,
  p_plan_id uuid,
  p_briefs  jsonb,
  p_items   jsonb
)
  RETURNS SETOF public.wall_text_content_plan_items
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_brief_count integer;
  v_existing_item_count integer;
  v_invalid_item_count integer;
  v_plan public.wall_text_content_plans%rowtype;
begin
  if nullif(btrim(coalesce(p_user_id, '')), '') is null
     or p_plan_id is null
     or p_briefs is null
     or p_items is null
     or jsonb_typeof(p_briefs) <> 'array'
     or jsonb_typeof(p_items) <> 'array' then
    raise exception 'wall_text_content_plan_chunk_input_invalid';
  end if;

  select plan.* into v_plan
  from public.wall_text_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
    and plan.status = 'generating'
  for update;
  if not found then
    raise exception 'wall_text_content_plan_not_generating';
  end if;

  select count(*)::integer into v_brief_count
  from jsonb_to_recordset(p_briefs) as brief(
    brief_index integer,
    creative_seed text,
    audience_context text,
    human_moment text,
    emotional_tension text,
    supported_angle text,
    preferred_format_family text,
    brief_fingerprint text
  );

  if v_brief_count not between 1 and 5
     or jsonb_array_length(p_items) <> v_brief_count * 5 then
    raise exception 'wall_text_content_plan_chunk_shape_invalid';
  end if;

  select count(*)::integer into v_invalid_item_count
  from (
    select item.brief_index
    from jsonb_to_recordset(p_items) as item(
      brief_index integer,
      content_idea text,
      feeling text,
      sequence_index integer,
      idea_fingerprint text
    )
    group by item.brief_index
    having count(*) <> 5
  ) as invalid_items;

  if v_invalid_item_count <> 0 or exists (
    select 1
    from jsonb_to_recordset(p_items) as item(
      brief_index integer,
      content_idea text,
      feeling text,
      sequence_index integer,
      idea_fingerprint text
    )
    left join jsonb_to_recordset(p_briefs) as brief(
      brief_index integer,
      creative_seed text,
      audience_context text,
      human_moment text,
      emotional_tension text,
      supported_angle text,
      preferred_format_family text,
      brief_fingerprint text
    ) using (brief_index)
    where brief.brief_index is null
  ) then
    raise exception 'wall_text_content_plan_chunk_parent_invalid';
  end if;

  select count(*)::integer into v_existing_item_count
  from public.wall_text_content_plan_items as item
  where item.plan_id = p_plan_id;
  if v_existing_item_count + jsonb_array_length(p_items) > v_plan.target_item_count then
    raise exception 'wall_text_content_plan_chunk_exceeds_target';
  end if;

  insert into public.wall_text_content_plan_briefs (
    plan_id, user_id, brief_index, creative_seed, audience_context,
    human_moment, emotional_tension, supported_angle,
    preferred_format_family, brief_fingerprint
  )
  select
    p_plan_id, p_user_id, brief.brief_index, btrim(brief.creative_seed),
    btrim(brief.audience_context), btrim(brief.human_moment),
    btrim(brief.emotional_tension), btrim(brief.supported_angle),
    btrim(brief.preferred_format_family), btrim(brief.brief_fingerprint)
  from jsonb_to_recordset(p_briefs) as brief(
    brief_index integer,
    creative_seed text,
    audience_context text,
    human_moment text,
    emotional_tension text,
    supported_angle text,
    preferred_format_family text,
    brief_fingerprint text
  );

  return query
  with inserted as (
    insert into public.wall_text_content_plan_items (
      plan_id, user_id, creative_brief_id, sequence_index,
      content_idea, feeling, idea_fingerprint, status
    )
    select
      p_plan_id, p_user_id, brief.id, item.sequence_index,
      btrim(item.content_idea), btrim(item.feeling),
      btrim(item.idea_fingerprint), 'available'
    from jsonb_to_recordset(p_items) as item(
      brief_index integer,
      content_idea text,
      feeling text,
      sequence_index integer,
      idea_fingerprint text
    )
    join public.wall_text_content_plan_briefs as brief
      on brief.plan_id = p_plan_id
      and brief.user_id = p_user_id
      and brief.brief_index = item.brief_index
    returning *
  )
  select * from inserted order by sequence_index;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."persist_wall_text_content_plan_brief_chunk"(text, uuid, jsonb, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."persist_wall_text_content_plan_brief_chunk"(text, uuid, jsonb, jsonb) FROM PUBLIC;


-- source: public/functions/reconcile_daily_trending_feed_slot_integrity.sql
CREATE OR REPLACE FUNCTION public.reconcile_daily_trending_feed_slot_integrity (
  p_feed_id                      uuid,
  p_hook_video_assignment_ids    uuid[]  DEFAULT ARRAY[]::uuid[],
  p_hook_video_provider_resolved boolean DEFAULT false,
  p_wall_text_assignment_ids     uuid[]  DEFAULT ARRAY[]::uuid[],
  p_wall_text_provider_resolved  boolean DEFAULT false
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  feed_record public.daily_trending_feeds;
begin
  select *
  into feed_record
  from public.daily_trending_feeds
  where id = p_feed_id;

  if feed_record.id is null then
    raise exception 'daily_trending_feed_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(feed_record.user_id || ':' || feed_record.local_date::text, 0)
  );

  -- A binding can become invalid if its assignment was retired or deleted.
  update public.daily_trending_feed_slots as slot
  set
    carousel_assignment_id = null,
    hook_video_assignment_id = null,
    wall_text_assignment_id = null,
    state = 'planned',
    updated_at = now()
  where slot.feed_id = p_feed_id
    and slot.state = 'ready'
    and (
      (slot.format = 'carousel' and not exists (
        select 1
        from public.user_carousel_assignments as assignment
        where assignment.id = slot.carousel_assignment_id
          and assignment.user_id = feed_record.user_id
          and assignment.business_profile_id = feed_record.business_profile_id
          and assignment.business_profile_version = feed_record.business_profile_version
          and assignment.state in ('pending', 'in_progress')
      ))
      or (slot.format = 'hook_video' and not exists (
        select 1
        from public.user_hook_video_assignments as assignment
        where assignment.id = slot.hook_video_assignment_id
          and assignment.user_id = feed_record.user_id
          and assignment.business_profile_id = feed_record.business_profile_id
          and assignment.business_profile_version = feed_record.business_profile_version
          and assignment.state = 'active'
      ))
      or (slot.format = 'wall_text' and not exists (
        select 1
        from public.user_wall_text_assignments as assignment
        where assignment.id = slot.wall_text_assignment_id
          and assignment.user_id = feed_record.user_id
          and assignment.business_profile_id = feed_record.business_profile_id
          and assignment.business_profile_version = feed_record.business_profile_version
          and assignment.state = 'active'
      ))
    );

  -- Valid assignments whose assets no longer satisfy the provider contract
  -- are also replaced. This deliberately runs only after a successful provider
  -- read; provider errors leave all user-visible slots untouched.
  if p_hook_video_provider_resolved then
    update public.daily_trending_feed_slots as slot
    set
      carousel_assignment_id = null,
      hook_video_assignment_id = null,
      wall_text_assignment_id = null,
      state = 'planned',
      updated_at = now()
    where slot.feed_id = p_feed_id
      and slot.format = 'hook_video'
      and slot.state = 'ready'
      and not (slot.hook_video_assignment_id = any(p_hook_video_assignment_ids));
  end if;

  if p_wall_text_provider_resolved then
    update public.daily_trending_feed_slots as slot
    set
      carousel_assignment_id = null,
      hook_video_assignment_id = null,
      wall_text_assignment_id = null,
      state = 'planned',
      updated_at = now()
    where slot.feed_id = p_feed_id
      and slot.format = 'wall_text'
      and slot.state = 'ready'
      and not (slot.wall_text_assignment_id = any(p_wall_text_assignment_ids));
  end if;

  update public.daily_trending_feeds
  set
    status = case
      when (
        select count(*)
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
      ) = feed_record.daily_limit
      and not exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state <> 'decided'
      ) then 'completed'
      when exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state = 'ready'
      ) then 'ready'
      when exists (
        select 1
        from public.daily_trending_feed_slots as slot
        where slot.feed_id = p_feed_id
          and slot.state in ('planned', 'preparing')
      ) then 'preparing'
      else 'failed'
    end,
    last_error = null,
    updated_at = now()
  where id = p_feed_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."reconcile_daily_trending_feed_slot_integrity"(uuid, uuid[], boolean, uuid[], boolean) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."reconcile_daily_trending_feed_slot_integrity"(uuid, uuid[], boolean, uuid[], boolean) FROM PUBLIC;


-- source: public/functions/reconcile_social_schedule_state.sql
CREATE OR REPLACE FUNCTION public.reconcile_social_schedule_state (
  p_limit               integer,
  p_stale_after_seconds integer
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_cancelled_targets integer := 0;
  v_failed_targets integer := 0;
  v_now timestamptz := now();
  v_published_targets integer := 0;
  v_reconciled integer := 0;
  v_stale_targets integer := 0;
  v_stale_after_seconds integer := greatest(
    60,
    least(coalesce(p_stale_after_seconds, 300), 3600)
  );
begin
  with published_operation_targets as (
    select target.id
    from public.scheduled_post_targets as target
    join public.social_publish_operations as operation
      on operation.scheduled_post_target_id = target.id
      and operation.user_id = target.user_id
    where operation.status = 'published'
      and operation.platform_post_id is not null
      and (
        target.status <> 'published'
        or target.platform_post_id is distinct from operation.platform_post_id
        or target.platform_post_url is distinct from operation.platform_post_url
      )
    order by operation.published_at, target.id
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.scheduled_post_targets as target
  set
    last_error_code = null,
    last_error_message = null,
    last_reconciled_at = v_now,
    next_retry_at = null,
    platform_post_id = operation.platform_post_id,
    platform_post_url = operation.platform_post_url,
    published_at = coalesce(operation.published_at, v_now),
    status = 'published',
    updated_at = v_now
  from public.social_publish_operations as operation
  where target.id in (
      select published_target.id
      from published_operation_targets as published_target
    )
    and operation.scheduled_post_target_id = target.id
    and operation.user_id = target.user_id;

  get diagnostics v_published_targets = row_count;
  v_reconciled := v_reconciled + v_published_targets;

  update public.scheduled_posts as post
  set
    last_error_code = null,
    published_at = case
      when not exists (
        select 1
        from public.scheduled_post_targets as target
        where target.scheduled_post_id = post.id
          and target.status <> 'published'
      ) then v_now
      else post.published_at
    end,
    status = case
      when not exists (
        select 1
        from public.scheduled_post_targets as target
        where target.scheduled_post_id = post.id
          and target.status <> 'published'
      ) then 'published'
      when post.status = 'cancelled' then 'partially_failed'
      else post.status
    end,
    updated_at = v_now
  where exists (
    select 1
    from public.scheduled_post_targets as target
    where target.scheduled_post_id = post.id
      and target.status = 'published'
      and target.last_reconciled_at = v_now
  );

  with stale_targets as (
    select target.id
    from public.scheduled_post_targets as target
    where target.status = 'scheduling'
      and target.publish_job_id is not null
      and exists (
        select 1
        from public.background_jobs as job
        where job.id = target.publish_job_id
          and job.status in ('queued', 'processing')
      )
      and target.updated_at <
        v_now - make_interval(secs => v_stale_after_seconds)
    order by target.updated_at, target.id
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.scheduled_post_targets as target
  set
    last_error_code = 'scheduler_fallback_active',
    last_error_message = null,
    last_reconciled_at = v_now,
    status = 'scheduled',
    updated_at = v_now
  where target.id in (select stale_target.id from stale_targets as stale_target);

  get diagnostics v_stale_targets = row_count;
  v_reconciled := v_reconciled + v_stale_targets;

  with failed_job_targets as (
    select target.id
    from public.scheduled_post_targets as target
    join public.background_jobs as job
      on job.id = target.publish_job_id
      and job.user_id = target.user_id
    where target.status in ('scheduling', 'scheduled', 'publishing')
      and job.status = 'failed'
      and not exists (
        select 1
        from public.social_publish_operations as operation
        where operation.scheduled_post_target_id = target.id
          and operation.status = 'published'
      )
    order by job.updated_at, target.id
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.scheduled_post_targets as target
  set
    last_error_code = case
      when target.last_error_code is null
        or target.last_error_code = 'scheduler_fallback_active'
        then 'social_publish_failed'
      else target.last_error_code
    end,
    last_error_message = left(job.error_message, 500),
    last_reconciled_at = v_now,
    next_retry_at = null,
    status = 'failed',
    updated_at = v_now
  from public.background_jobs as job
  where target.id in (
      select failed_target.id
      from failed_job_targets as failed_target
    )
    and job.id = target.publish_job_id;

  get diagnostics v_failed_targets = row_count;
  v_reconciled := v_reconciled + v_failed_targets;

  update public.scheduled_posts as post
  set
    last_error_code = case
      when post.last_error_code is null
        or post.last_error_code = 'scheduler_fallback_active'
        then 'social_publish_failed'
      else post.last_error_code
    end,
    status = case
      when exists (
        select 1
        from public.scheduled_post_targets as target
        where target.scheduled_post_id = post.id
          and target.status <> 'failed'
      ) then 'partially_failed'
      else 'failed'
    end,
    updated_at = v_now
  where post.status <> 'cancelled'
    and exists (
      select 1
      from public.scheduled_post_targets as target
      where target.scheduled_post_id = post.id
        and target.status = 'failed'
        and target.last_reconciled_at = v_now
    );

  with cancelled_parent_targets as (
    select target.id
    from public.scheduled_post_targets as target
    join public.scheduled_posts as post
      on post.id = target.scheduled_post_id
      and post.user_id = target.user_id
    where post.status = 'cancelled'
      and target.status in (
        'draft',
        'scheduling',
        'scheduled',
        'publishing',
        'failed'
      )
      and not exists (
        select 1
        from public.social_publish_operations as operation
        where operation.scheduled_post_target_id = target.id
          and (
            operation.active_claim_token is not null
            or operation.status = 'published'
          )
      )
    order by target.updated_at, target.id
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.scheduled_post_targets as target
  set
    cancelled_at = coalesce(target.cancelled_at, v_now),
    last_reconciled_at = v_now,
    next_retry_at = null,
    status = 'cancelled',
    updated_at = v_now
  where target.id in (
    select cancelled_target.id
    from cancelled_parent_targets as cancelled_target
  );

  get diagnostics v_cancelled_targets = row_count;
  v_reconciled := v_reconciled + v_cancelled_targets;

  update public.background_jobs as job
  set
    claim_token = null,
    completed_at = v_now,
    next_attempt_at = null,
    status = 'cancelled',
    updated_at = v_now
  where job.status in ('queued', 'processing')
    and exists (
      select 1
      from public.scheduled_post_targets as target
      where target.publish_job_id = job.id
        and target.status = 'cancelled'
    );

  update public.scheduled_posts as post
  set
    last_error_code = case
      when exists (
        select 1
        from public.scheduled_post_targets as target
        where target.scheduled_post_id = post.id
          and target.last_error_code = 'scheduler_fallback_active'
      ) then 'scheduler_fallback_active'
      else null
    end,
    status = 'scheduled',
    updated_at = v_now
  where post.status = 'scheduling'
    and exists (
      select 1
      from public.scheduled_post_targets as target
      where target.scheduled_post_id = post.id
        and target.status = 'scheduled'
    )
    and not exists (
      select 1
      from public.scheduled_post_targets as target
      where target.scheduled_post_id = post.id
        and target.status <> 'scheduled'
    );

  return v_reconciled;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."reconcile_social_schedule_state"(integer, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."reconcile_social_schedule_state"(integer, integer) FROM PUBLIC;


-- source: public/functions/record_carousel_performance_observation.sql
CREATE OR REPLACE FUNCTION public.record_carousel_performance_observation (
  p_user_id              text,
  p_platform             text,
  p_social_connection_id uuid,
  p_platform_post_id     text,
  p_published_at         timestamp with time zone,
  p_observed_at          timestamp with time zone,
  p_view_count           bigint
)
  RETURNS TABLE (
    recorded  boolean,
    evaluated boolean
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_business_profile_id uuid;
  v_carousel_generation_id uuid;
  v_content_format_id text;
  v_due_at timestamptz;
  v_existing public.carousel_performance_observations%rowtype;
  v_format_version integer;
  v_hook_family_id text;
  v_published_at timestamptz;
  v_structure_id text;
  v_structure_version integer;
  v_target_id uuid;
  v_view_count bigint;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_platform <> 'instagram'
     or p_social_connection_id is null
     or nullif(trim(coalesce(p_platform_post_id, '')), '') is null
     or p_published_at is null
     or p_observed_at is null
     or (p_view_count is not null and p_view_count < 0) then
    raise exception 'carousel_performance_input_invalid';
  end if;

  select
    target.id,
    target.published_at,
    generation.id,
    generation.business_profile_id,
    generation.content_format_id,
    generation.hook_family_id,
    coalesce(generation.content_format_version, 1),
    generation.structure_id,
    generation.structure_version
  into
    v_target_id,
    v_published_at,
    v_carousel_generation_id,
    v_business_profile_id,
    v_content_format_id,
    v_hook_family_id,
    v_format_version,
    v_structure_id,
    v_structure_version
  from public.scheduled_post_targets as target
  join public.scheduled_posts as post
    on post.id = target.scheduled_post_id
    and post.user_id = p_user_id
    and post.source_kind = 'library_item'
  join public.library_items as item
    on item.id = post.library_item_id
    and item.user_id = p_user_id
    and item.source_type = 'generated_carousel'
    and item.deleted_at is null
  join public.carousel_generations as generation
    on generation.id::text = item.source_id
    and generation.user_id = p_user_id
    and generation.status = 'completed'
    and generation.business_profile_id is not null
    and generation.content_format_id is not null
    and (
      (
        generation.structure_id = 'structure_1'
        and generation.hook_family_id is not null
      )
      or
      (
        generation.structure_id = 'structure_2'
        and generation.hook_family_id is null
      )
    )
  where target.user_id = p_user_id
    and target.platform = p_platform
    and target.social_connection_id = p_social_connection_id
    and target.platform_post_id = trim(p_platform_post_id)
    and target.status = 'published'
    and target.published_at is not null
    and (
      item.metadata -> 'trendingCreativeEdit' is null
      or item.metadata -> 'trendingCreativeEdit' = 'null'::jsonb
    )
  order by target.published_at desc, target.created_at desc
  limit 1;

  if not found
     or abs(extract(epoch from (v_published_at - p_published_at))) > 86400
     or p_observed_at < v_published_at then
    return query select false, false;
    return;
  end if;

  v_due_at := v_published_at + interval '7 days';
  v_view_count := p_view_count;

  select observation.*
  into v_existing
  from public.carousel_performance_observations as observation
  where observation.scheduled_post_target_id = v_target_id
  for update;

  if not found then
    insert into public.carousel_performance_observations (
      user_id,
      business_profile_id,
      carousel_generation_id,
      scheduled_post_target_id,
      social_connection_id,
      platform,
      platform_post_id,
      content_format_id,
      hook_family_id,
      format_version,
      published_at,
      evaluation_due_at,
      snapshot_observed_at,
      evaluated_at,
      view_count,
      structure_id,
      structure_version
    ) values (
      p_user_id,
      v_business_profile_id,
      v_carousel_generation_id,
      v_target_id,
      p_social_connection_id,
      p_platform,
      trim(p_platform_post_id),
      v_content_format_id,
      v_hook_family_id,
      v_format_version,
      v_published_at,
      v_due_at,
      p_observed_at,
      case
        when p_observed_at between v_due_at and v_due_at + interval '24 hours'
          and v_view_count is not null
          then timezone('utc', now())
        else null
      end,
      v_view_count,
      v_structure_id,
      v_structure_version
    );

    return query select true, (
      p_observed_at between v_due_at and v_due_at + interval '24 hours'
      and v_view_count is not null
    );
    return;
  end if;

  if v_existing.evaluated_at is not null then
    return query select true, true;
    return;
  end if;

  if p_observed_at < v_due_at then
    if p_observed_at > v_existing.snapshot_observed_at then
      update public.carousel_performance_observations
      set
        snapshot_observed_at = p_observed_at,
        view_count = v_view_count,
        updated_at = timezone('utc', now())
      where scheduled_post_target_id = v_target_id;
    end if;

    return query select true, false;
    return;
  end if;

  if v_existing.snapshot_observed_at between
       v_due_at - interval '24 hours' and v_due_at
     and v_existing.view_count is not null
     and (
       p_observed_at > v_due_at + interval '24 hours'
       or v_view_count is null
       or v_due_at - v_existing.snapshot_observed_at
          <= p_observed_at - v_due_at
     ) then
    update public.carousel_performance_observations
    set
      evaluated_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
    where scheduled_post_target_id = v_target_id;

    return query select true, true;
    return;
  end if;

  if p_observed_at <= v_due_at + interval '24 hours'
     and v_view_count is not null then
    update public.carousel_performance_observations
    set
      snapshot_observed_at = p_observed_at,
      evaluated_at = timezone('utc', now()),
      view_count = v_view_count,
      updated_at = timezone('utc', now())
    where scheduled_post_target_id = v_target_id;

    return query select true, true;
    return;
  end if;

  return query select true, false;
end;
$function$;

GRANT EXECUTE
  ON FUNCTION "public"."record_carousel_performance_observation"(text, text, uuid, text, timestamp WITH time zone, timestamp WITH time zone, bigint)
  TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."record_carousel_performance_observation"(text, text, uuid, text, timestamp WITH time zone, timestamp WITH time zone, bigint) FROM PUBLIC;


-- source: public/functions/record_hook_performance_observation.sql
CREATE OR REPLACE FUNCTION public.record_hook_performance_observation (
  p_user_id              text,
  p_platform             text,
  p_social_connection_id uuid,
  p_platform_post_id     text,
  p_observed_at          timestamp with time zone,
  p_metrics              jsonb
)
  RETURNS TABLE (
    recorded boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_target public.scheduled_post_targets%rowtype;
  v_draft public.hook_video_drafts%rowtype;
begin
  if p_platform not in ('instagram', 'tiktok') or
     nullif(trim(p_platform_post_id), '') is null or
     jsonb_typeof(p_metrics) is distinct from 'object' then
    raise exception 'hook_performance_input_invalid';
  end if;

  select target.*
  into v_target
  from public.scheduled_post_targets target
  where target.user_id = p_user_id
    and target.platform = p_platform
    and target.social_connection_id = p_social_connection_id
    and target.platform_post_id = p_platform_post_id
    and target.status = 'published'
  order by target.published_at desc nulls last, target.created_at desc
  limit 1;

  if not found then
    return query select false;
    return;
  end if;

  select draft.*
  into v_draft
  from public.hook_video_drafts draft
  where draft.user_id = p_user_id
    and draft.scheduled_post_id = v_target.scheduled_post_id
  limit 1;

  if not found then
    return query select false;
    return;
  end if;

  insert into public.hook_performance_observations (
    user_id,
    hook_video_suggestion_id,
    hook_video_draft_id,
    scheduled_post_target_id,
    social_connection_id,
    platform,
    platform_post_id,
    source,
    view_count,
    reach_count,
    interaction_count,
    like_count,
    comment_count,
    share_count,
    save_count,
    watch_time_seconds,
    average_watch_time_seconds,
    completion_rate,
    click_count,
    conversion_count,
    attributed_sales_amount,
    attributed_sales_currency,
    observed_at
  ) values (
    p_user_id,
    v_draft.selected_hook_id,
    v_draft.id,
    v_target.id,
    p_social_connection_id,
    p_platform,
    trim(p_platform_post_id),
    'platform_api',
    public.hook_performance_nonnegative_bigint(p_metrics, 'viewCount'),
    public.hook_performance_nonnegative_bigint(p_metrics, 'reachCount'),
    public.hook_performance_nonnegative_bigint(p_metrics, 'interactionCount'),
    public.hook_performance_nonnegative_bigint(p_metrics, 'likeCount'),
    public.hook_performance_nonnegative_bigint(p_metrics, 'commentCount'),
    public.hook_performance_nonnegative_bigint(p_metrics, 'shareCount'),
    public.hook_performance_nonnegative_bigint(p_metrics, 'saveCount'),
    public.hook_performance_nonnegative_numeric(p_metrics, 'watchTimeSeconds'),
    public.hook_performance_nonnegative_numeric(p_metrics, 'averageWatchTimeSeconds'),
    public.hook_performance_rate(p_metrics, 'completionRate'),
    public.hook_performance_nonnegative_bigint(p_metrics, 'clickCount'),
    public.hook_performance_nonnegative_bigint(p_metrics, 'conversionCount'),
    public.hook_performance_nonnegative_numeric(p_metrics, 'attributedSalesAmount'),
    public.hook_performance_currency(p_metrics, 'attributedSalesCurrency'),
    p_observed_at
  )
  on conflict (scheduled_post_target_id) do update set
    platform_post_id = excluded.platform_post_id,
    view_count = coalesce(excluded.view_count, hook_performance_observations.view_count),
    reach_count = coalesce(excluded.reach_count, hook_performance_observations.reach_count),
    interaction_count = coalesce(excluded.interaction_count, hook_performance_observations.interaction_count),
    like_count = coalesce(excluded.like_count, hook_performance_observations.like_count),
    comment_count = coalesce(excluded.comment_count, hook_performance_observations.comment_count),
    share_count = coalesce(excluded.share_count, hook_performance_observations.share_count),
    save_count = coalesce(excluded.save_count, hook_performance_observations.save_count),
    watch_time_seconds = coalesce(excluded.watch_time_seconds, hook_performance_observations.watch_time_seconds),
    average_watch_time_seconds = coalesce(excluded.average_watch_time_seconds, hook_performance_observations.average_watch_time_seconds),
    completion_rate = coalesce(excluded.completion_rate, hook_performance_observations.completion_rate),
    click_count = coalesce(excluded.click_count, hook_performance_observations.click_count),
    conversion_count = coalesce(excluded.conversion_count, hook_performance_observations.conversion_count),
    attributed_sales_amount = coalesce(excluded.attributed_sales_amount, hook_performance_observations.attributed_sales_amount),
    attributed_sales_currency = coalesce(excluded.attributed_sales_currency, hook_performance_observations.attributed_sales_currency),
    observed_at = greatest(excluded.observed_at, hook_performance_observations.observed_at),
    updated_at = now();

  return query select true;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."record_hook_performance_observation"(text, text, uuid, text, timestamp WITH time zone, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."record_hook_performance_observation"(text, text, uuid, text, timestamp WITH time zone, jsonb) FROM PUBLIC;


-- source: public/functions/record_ignored_dodo_webhook_event.sql
CREATE OR REPLACE FUNCTION public.record_ignored_dodo_webhook_event (
  p_webhook_id      text,
  p_event_type      text,
  p_event_timestamp timestamp with time zone,
  p_payload         jsonb,
  p_reason          text
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."record_ignored_dodo_webhook_event"(text, text, timestamp WITH time zone, jsonb, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."record_ignored_dodo_webhook_event"(text, text, timestamp WITH time zone, jsonb, text) FROM PUBLIC;


-- source: public/functions/record_trending_creative_decision.sql
CREATE OR REPLACE FUNCTION public.record_trending_creative_decision (
  p_user_id       text,
  p_format        text,
  p_assignment_id uuid,
  p_creative_id   uuid,
  p_decision      text
)
  RETURNS SETOF public.trending_creative_decisions
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  recorded public.trending_creative_decisions;
  assignment_is_active boolean := false;
  assignment_exists boolean := false;
  decided_at_value timestamptz := now();
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_format not in ('carousel', 'hook_video', 'wall_text')
    or p_assignment_id is null
    or p_creative_id is null
    or p_decision not in ('accepted', 'rejected')
  then
    raise exception 'trending_creative_decision_invalid_scope';
  end if;

  case p_format
    when 'carousel' then
      select
        true,
        assignment.state in ('pending', 'in_progress')
      into assignment_exists, assignment_is_active
      from public.user_carousel_assignments as assignment
      where assignment.id = p_assignment_id
        and assignment.user_id = p_user_id
        and assignment.carousel_id = p_creative_id
      for update;
    when 'hook_video' then
      select
        true,
        assignment.state = 'active'
      into assignment_exists, assignment_is_active
      from public.user_hook_video_assignments as assignment
      where assignment.id = p_assignment_id
        and assignment.user_id = p_user_id
        and assignment.hook_suggestion_id = p_creative_id
      for update;
    when 'wall_text' then
      select
        true,
        assignment.state = 'active'
      into assignment_exists, assignment_is_active
      from public.user_wall_text_assignments as assignment
      where assignment.id = p_assignment_id
        and assignment.user_id = p_user_id
        and assignment.wall_text_creative_id = p_creative_id
      for update;
  end case;

  if not coalesce(assignment_exists, false) then
    raise exception 'trending_creative_decision_assignment_not_found';
  end if;

  select decision.*
  into recorded
  from public.trending_creative_decisions as decision
  where decision.user_id = p_user_id
    and decision.format = p_format
    and decision.creative_id = p_creative_id;

  if found then
    if recorded.assignment_id <> p_assignment_id
      or recorded.decision <> p_decision
    then
      raise exception 'trending_creative_decision_conflict';
    end if;

    return next recorded;
    return;
  end if;

  if not coalesce(assignment_is_active, false) then
    raise exception 'trending_creative_decision_assignment_inactive';
  end if;

  insert into public.trending_creative_decisions (
    assignment_id,
    creative_id,
    decided_at,
    decision,
    format,
    user_id
  )
  values (
    p_assignment_id,
    p_creative_id,
    decided_at_value,
    p_decision,
    p_format,
    p_user_id
  )
  returning * into recorded;

  case p_format
    when 'carousel' then
      update public.user_carousel_assignments
      set
        completed_at = decided_at_value,
        completion_action = case
          when p_decision = 'accepted' then 'accepted'
          else 'skipped'
        end,
        state = case
          when p_decision = 'accepted' then 'accepted'
          else 'completed_skipped'
        end,
        updated_at = decided_at_value
      where id = p_assignment_id;
    when 'hook_video' then
      update public.user_hook_video_assignments
      set
        completed_at = decided_at_value,
        last_opened_at = case
          when p_decision = 'accepted' then decided_at_value
          else last_opened_at
        end,
        state = case
          when p_decision = 'accepted' then 'selected'
          else 'completed_skipped'
        end,
        updated_at = decided_at_value
      where id = p_assignment_id;
    when 'wall_text' then
      update public.user_wall_text_assignments
      set
        completed_at = decided_at_value,
        last_opened_at = case
          when p_decision = 'accepted' then decided_at_value
          else last_opened_at
        end,
        state = case
          when p_decision = 'accepted' then 'selected'
          else 'completed_skipped'
        end,
        updated_at = decided_at_value
      where id = p_assignment_id;
  end case;

  return next recorded;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."record_trending_creative_decision"(text, text, uuid, uuid, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."record_trending_creative_decision"(text, text, uuid, uuid, text) FROM PUBLIC;


-- source: public/functions/record_wall_text_generation_chunk_failure_v1.sql
CREATE OR REPLACE FUNCTION public.record_wall_text_generation_chunk_failure_v1 (
  p_user_id       text,
  p_chunk_id      uuid,
  p_claim_token   uuid,
  p_error_code    text,
  p_error_message text,
  p_retryable     boolean
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  batch_id_value uuid;
begin
  select chunk.batch_id into batch_id_value
  from public.wall_text_generation_chunks as chunk
  join public.wall_text_generation_batches as batch on batch.id = chunk.batch_id
  where chunk.id = p_chunk_id
    and batch.user_id = p_user_id
    and chunk.status = 'processing'
    and chunk.claim_token = p_claim_token
  for update of chunk;
  if not found then
    raise exception 'wall_text_generation_chunk_stale_claim';
  end if;

  update public.wall_text_generation_chunks
  set content_retry_count = case when not p_retryable then 1 else content_retry_count end,
      last_error_code = left(btrim(p_error_code), 120),
      last_error_message = left(btrim(p_error_message), 1000),
      claim_token = null, locked_at = null,
      status = case when p_retryable then 'retry_pending' else 'failed' end,
      updated_at = timezone('utc', now())
  where id = p_chunk_id and status <> 'completed';

  update public.wall_text_generation_assignments
  set last_failure_code = left(btrim(p_error_code), 120),
      status = case when p_retryable then 'retry_pending' else 'failed' end,
      updated_at = timezone('utc', now())
  where chunk_id = p_chunk_id and status <> 'completed';

  if not p_retryable then
    update public.wall_text_content_plan_items as item
    set status = 'retired', retired_at = timezone('utc', now()),
        retirement_reason = left(btrim(p_error_code), 120), updated_at = timezone('utc', now())
    from public.wall_text_generation_assignments as assignment
    where assignment.chunk_id = p_chunk_id
      and assignment.status = 'failed'
      and assignment.wall_text_content_plan_item_id = item.id
      and item.user_id = p_user_id
      and item.status = 'reserved';

    update public.wall_text_generation_batches
    set status = 'failed', updated_at = timezone('utc', now())
    where id = batch_id_value and status <> 'completed';
  end if;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."record_wall_text_generation_chunk_failure_v1"(text, uuid, uuid, text, text, boolean) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."record_wall_text_generation_chunk_failure_v1"(text, uuid, uuid, text, text, boolean) FROM PUBLIC;


-- source: public/functions/record_wall_text_performance_observation_v1.sql
CREATE OR REPLACE FUNCTION public.record_wall_text_performance_observation_v1 (
  p_user_id              text,
  p_platform             text,
  p_social_connection_id uuid,
  p_platform_post_id     text,
  p_published_at         timestamp with time zone,
  p_observed_at          timestamp with time zone,
  p_view_count           bigint
)
  RETURNS TABLE (
    recorded  boolean,
    evaluated boolean
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_business_profile_id uuid;
  v_content_history_id uuid;
  v_creative_id uuid;
  v_generation_assignment_id uuid;
  v_published_at timestamptz;
  v_target_id uuid;
begin
  if nullif(btrim(coalesce(p_user_id, '')), '') is null
    or p_platform <> 'instagram'
    or p_social_connection_id is null
    or nullif(btrim(coalesce(p_platform_post_id, '')), '') is null
    or p_published_at is null
    or p_observed_at is null
    or (p_view_count is not null and p_view_count < 0)
  then
    raise exception 'wall_text_performance_input_invalid';
  end if;

  select
    target.id,
    target.published_at,
    creative.id,
    creative.business_profile_id,
    history.id,
    generation_assignment.id
  into
    v_target_id,
    v_published_at,
    v_creative_id,
    v_business_profile_id,
    v_content_history_id,
    v_generation_assignment_id
  from public.scheduled_post_targets as target
  join public.scheduled_posts as post
    on post.id = target.scheduled_post_id
    and post.user_id = p_user_id
    and post.source_kind = 'media_asset'
  join public.media_assets as media
    on media.id = post.media_asset_id
    and media.user_id = p_user_id
    and media.source_type = 'wall_text_render'
    and media.status = 'ready'
  join public.wall_text_creatives as creative
    on creative.id::text = media.metadata ->> 'creativeId'
    and creative.user_id = p_user_id
  join public.wall_text_content_history as history
    on history.user_id = p_user_id
    and history.business_profile_id = creative.business_profile_id
    and history.content_hash = media.metadata ->> 'contentHash'
  left join public.wall_text_generation_assignments as generation_assignment
    on generation_assignment.wall_text_creative_id = creative.id
  where target.user_id = p_user_id
    and target.platform = p_platform
    and target.social_connection_id = p_social_connection_id
    and target.platform_post_id = btrim(p_platform_post_id)
    and target.status = 'published'
    and target.published_at is not null
    and coalesce((media.metadata ->> 'formatLearningEligible')::boolean, false)
    and history.performance_eligible
  order by target.published_at desc, target.created_at desc
  limit 1;

  if not found
    or abs(extract(epoch from (v_published_at - p_published_at))) > 86400
  then
    return query select false, false;
    return;
  end if;

  if p_observed_at < v_published_at + interval '72 hours'
    or p_observed_at > v_published_at + interval '96 hours'
    or p_view_count is null
  then
    return query select true, false;
    return;
  end if;

  insert into public.wall_text_performance_observations (
    user_id, business_profile_id, wall_text_creative_id,
    content_history_id, generation_assignment_id, scheduled_post_target_id,
    social_connection_id, platform, platform_post_id, published_at,
    observed_at, view_count
  ) values (
    p_user_id, v_business_profile_id, v_creative_id, v_content_history_id,
    v_generation_assignment_id, v_target_id, p_social_connection_id,
    p_platform, btrim(p_platform_post_id), v_published_at,
    p_observed_at, p_view_count
  ) on conflict (scheduled_post_target_id) do nothing;

  return query select true, true;
end;
$function$;

GRANT EXECUTE
  ON FUNCTION "public"."record_wall_text_performance_observation_v1"(text, text, uuid, text, timestamp WITH time zone, timestamp WITH time zone, bigint)
  TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."record_wall_text_performance_observation_v1"(text, text, uuid, text, timestamp WITH time zone, timestamp WITH time zone, bigint) FROM PUBLIC;


-- source: public/functions/recover_background_job.sql
CREATE OR REPLACE FUNCTION public.recover_background_job (
  p_job_id uuid
)
  RETURNS SETOF public.background_jobs
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_current public.background_jobs%rowtype;
  v_now timestamptz := now();
  v_next_status text;
begin
  select job.*
  into v_current
  from public.background_jobs as job
  where job.id = p_job_id
    and job.status in (
      'queued',
      'processing',
      'waiting_external_service',
      'rendering',
      'uploading_output',
      'cancel_requested',
      'stalled'
    )
  for update;

  if not found then
    return;
  end if;

  if v_current.status = 'cancel_requested' then
    v_next_status := 'cancelled';
  elsif v_current.attempt_count + 1 >= v_current.max_attempts then
    v_next_status := 'failed';
  else
    v_next_status := 'queued';
  end if;

  update public.background_jobs as job
  set
    attempt_count = case
      when v_next_status = 'cancelled' then job.attempt_count
      else job.attempt_count + 1
    end,
    status = v_next_status,
    stage = case
      when v_next_status = 'queued' then 'recovered'
      when v_next_status = 'cancelled' then 'cancelled'
      else 'failed'
    end,
    progress = null,
    error_code = case
      when v_next_status = 'failed' then 'WORKER_STALLED'
      else null
    end,
    error_message = case
      when v_next_status = 'failed' then 'Background job exceeded its recovery attempts.'
      else null
    end,
    failed_at = case when v_next_status = 'failed' then v_now else null end,
    completed_at = case when v_next_status = 'cancelled' then v_now else null end,
    queued_at = case when v_next_status = 'queued' then v_now else job.queued_at end,
    next_attempt_at = null,
    queue_message_id = null,
    last_delivery_at = null,
    last_heartbeat_at = null,
    locked_at = null,
    claim_token = null,
    worker_id = null,
    worker_execution_id = null,
    updated_at = v_now
  where job.id = p_job_id;

  perform public.append_background_job_event(
    p_job_id,
    case
      when v_next_status = 'queued' then 'job_recovered'
      when v_next_status = 'cancelled' then 'job_cancelled_during_recovery'
      else 'job_recovery_exhausted'
    end,
    jsonb_build_object(
      'fromStatus', v_current.status,
      'attemptCount', v_current.attempt_count,
      'maxAttempts', v_current.max_attempts
    )
  );

  return query
  select job.* from public.background_jobs as job where job.id = p_job_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."recover_background_job"(uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."recover_background_job"(uuid) FROM PUBLIC;


-- source: public/functions/refresh_billing_credit_balance.sql
CREATE OR REPLACE FUNCTION public.refresh_billing_credit_balance (
  p_user_id text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."refresh_billing_credit_balance"(text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."refresh_billing_credit_balance"(text) FROM PUBLIC;


-- source: public/functions/release_carousel_content_plan_reservation.sql
CREATE OR REPLACE FUNCTION public.release_carousel_content_plan_reservation (
  p_user_id         text,
  p_reservation_key text,
  p_release_reason  text
)
  RETURNS integer
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."release_carousel_content_plan_reservation"(text, text, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."release_carousel_content_plan_reservation"(text, text, text) FROM PUBLIC;


-- source: public/functions/release_social_connection_token_refresh.sql
CREATE OR REPLACE FUNCTION public.release_social_connection_token_refresh (
  p_connection_id uuid,
  p_user_id       text,
  p_claim_token   uuid,
  p_error_code    text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_updated_count integer;
begin
  update public.social_connections as connection
  set
    last_error_code = left(nullif(trim(p_error_code), ''), 160),
    status = case
      when p_error_code in (
        'access_token_invalid',
        'account_mismatch',
        'invalid_grant',
        'invalid_refresh_token',
        'refresh_token_expired'
      ) then 'expired'
      else connection.status
    end,
    token_refresh_claim_token = null,
    token_refresh_claimed_at = null,
    updated_at = now()
  where connection.id = p_connection_id
    and connection.user_id = p_user_id
    and connection.token_refresh_claim_token = p_claim_token;

  get diagnostics v_updated_count = row_count;
  return v_updated_count > 0;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."release_social_connection_token_refresh"(uuid, text, uuid, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."release_social_connection_token_refresh"(uuid, text, uuid, text) FROM PUBLIC;


-- source: public/functions/release_unattached_trending_hook_generation_chunk_v1.sql
CREATE OR REPLACE FUNCTION public.release_unattached_trending_hook_generation_chunk_v1 (
  p_chunk_id      uuid,
  p_error_message text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_chunk public.trending_hook_generation_run_chunks%rowtype;
begin
  if p_chunk_id is null then
    return false;
  end if;

  select *
  into v_chunk
  from public.trending_hook_generation_run_chunks as chunk
  where chunk.id = p_chunk_id
  for update;

  if not found
    or v_chunk.status <> 'reserved'
    or v_chunk.background_job_id is not null
  then
    return false;
  end if;

  update public.trending_hook_generation_run_candidates
  set
    state = 'pending',
    chunk_id = null,
    updated_at = now()
  where run_id = v_chunk.run_id
    and chunk_id = v_chunk.id
    and state = 'reserved';

  update public.trending_hook_generation_run_chunks
  set
    status = 'failed',
    last_error = left(coalesce(p_error_message, 'The Hook generation task could not be attached.'), 1_000),
    updated_at = now()
  where id = v_chunk.id;

  update public.trending_hook_generation_runs
  set
    status = 'continuation_pending',
    last_error = left(coalesce(p_error_message, 'The Hook generation task could not be attached.'), 1_000),
    updated_at = now()
  where id = v_chunk.run_id
    and status in ('queued', 'processing', 'continuation_pending');

  return true;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."release_unattached_trending_hook_generation_chunk_v1"(uuid, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."release_unattached_trending_hook_generation_chunk_v1"(uuid, text) FROM PUBLIC;


-- source: public/functions/release_video_render_execution_slot.sql
CREATE OR REPLACE FUNCTION public.release_video_render_execution_slot (
  p_job_id      uuid,
  p_claim_token uuid
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  with released as (
    update public.video_render_execution_slots as slot
    set
      background_job_id = null,
      claim_token = null,
      claimed_at = null,
      updated_at = now(),
      worker_execution_id = null
    where slot.background_job_id = p_job_id
      and slot.claim_token = p_claim_token
      and slot.worker_execution_id is null
    returning 1
  )
  select exists(select 1 from released);
$function$;

GRANT EXECUTE ON FUNCTION "public"."release_video_render_execution_slot"(uuid, uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."release_video_render_execution_slot"(uuid, uuid) FROM PUBLIC;


-- source: public/functions/replace_wall_text_creative_copy_v2.sql
CREATE OR REPLACE FUNCTION public.replace_wall_text_creative_copy_v2 (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_generator_model          text,
  p_updates                  jsonb
)
  RETURNS SETOF public.wall_text_creatives
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  expected_count integer;
  matched_count integer;
  replacement_generation_id uuid := gen_random_uuid();
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or p_business_profile_version is null
    or p_business_profile_version <= 0
    or char_length(trim(coalesce(p_generator_model, ''))) = 0
  then
    raise exception 'wall_text_regeneration_invalid_scope';
  end if;

  if jsonb_typeof(p_updates) <> 'array' then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  expected_count := jsonb_array_length(p_updates);

  if expected_count < 1 or expected_count > 12 then
    raise exception 'wall_text_regeneration_invalid_count';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_updates) as update_item
    where jsonb_typeof(update_item) is distinct from 'object'
      or jsonb_typeof(update_item -> 'text_content') is distinct from 'object'
      or jsonb_typeof(update_item -> 'layout') is distinct from 'object'
      or update_item ->> 'id' is null
      or update_item ->> 'candidate_index' is null
  ) then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  if (
    select count(distinct update_item ->> 'id')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  or (
    select count(distinct update_item ->> 'candidate_index')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  then
    raise exception 'wall_text_regeneration_duplicate_updates';
  end if;

  select count(*)
  into matched_count
  from public.wall_text_creatives as creative
  join jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
    on update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  if matched_count <> expected_count then
    raise exception 'wall_text_regeneration_mismatch';
  end if;

  update public.wall_text_creatives as creative
  set
    error_message = null,
    generation_id = replacement_generation_id,
    generator_model = trim(p_generator_model),
    generator_version = 'business-profile-wall-text-v2',
    layout = update_item.layout,
    status = 'preview_ready',
    text_content = update_item.text_content,
    updated_at = now()
  from jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
  where update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
    and creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  return query
  select creative.*
  from public.wall_text_creatives as creative
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version
    and creative.status = 'preview_ready'
  order by creative.candidate_index;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."replace_wall_text_creative_copy_v2"(text, uuid, integer, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."replace_wall_text_creative_copy_v2"(text, uuid, integer, text, jsonb) FROM PUBLIC;


-- source: public/functions/replace_wall_text_creative_copy_v3.sql
CREATE OR REPLACE FUNCTION public.replace_wall_text_creative_copy_v3 (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_generator_model          text,
  p_updates                  jsonb
)
  RETURNS SETOF public.wall_text_creatives
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  expected_count integer;
  matched_count integer;
  replacement_generation_id uuid := gen_random_uuid();
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or p_business_profile_version is null
    or p_business_profile_version <= 0
    or char_length(trim(coalesce(p_generator_model, ''))) = 0
  then
    raise exception 'wall_text_regeneration_invalid_scope';
  end if;

  if jsonb_typeof(p_updates) <> 'array' then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  expected_count := jsonb_array_length(p_updates);

  if expected_count < 1 or expected_count > 12 then
    raise exception 'wall_text_regeneration_invalid_count';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_updates) as update_item
    where jsonb_typeof(update_item) is distinct from 'object'
      or jsonb_typeof(update_item -> 'text_content') is distinct from 'object'
      or jsonb_typeof(update_item -> 'layout') is distinct from 'object'
      or update_item ->> 'id' is null
      or update_item ->> 'candidate_index' is null
  ) then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  if (
    select count(distinct update_item ->> 'id')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  or (
    select count(distinct update_item ->> 'candidate_index')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  then
    raise exception 'wall_text_regeneration_duplicate_updates';
  end if;

  select count(*)
  into matched_count
  from public.wall_text_creatives as creative
  join jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
    on update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  if matched_count <> expected_count then
    raise exception 'wall_text_regeneration_mismatch';
  end if;

  update public.wall_text_creatives as creative
  set
    error_message = null,
    generation_id = replacement_generation_id,
    generator_model = trim(p_generator_model),
    generator_version = 'business-profile-wall-text-v3',
    layout = update_item.layout,
    status = 'preview_ready',
    text_content = update_item.text_content,
    updated_at = now()
  from jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
  where update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
    and creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  return query
  select creative.*
  from public.wall_text_creatives as creative
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version
    and creative.status = 'preview_ready'
  order by creative.candidate_index;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."replace_wall_text_creative_copy_v3"(text, uuid, integer, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."replace_wall_text_creative_copy_v3"(text, uuid, integer, text, jsonb) FROM PUBLIC;


-- source: public/functions/replace_wall_text_creative_copy_v4.sql
CREATE OR REPLACE FUNCTION public.replace_wall_text_creative_copy_v4 (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_generator_model          text,
  p_updates                  jsonb
)
  RETURNS SETOF public.wall_text_creatives
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  expected_count integer;
  matched_count integer;
  replacement_generation_id uuid := gen_random_uuid();
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or p_business_profile_version is null
    or p_business_profile_version <= 0
    or char_length(trim(coalesce(p_generator_model, ''))) = 0
  then
    raise exception 'wall_text_regeneration_invalid_scope';
  end if;

  if jsonb_typeof(p_updates) <> 'array' then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  expected_count := jsonb_array_length(p_updates);

  if expected_count < 1 or expected_count > 12 then
    raise exception 'wall_text_regeneration_invalid_count';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_updates) as update_item
    where jsonb_typeof(update_item) is distinct from 'object'
      or jsonb_typeof(update_item -> 'text_content') is distinct from 'object'
      or jsonb_typeof(update_item -> 'layout') is distinct from 'object'
      or update_item ->> 'id' is null
      or update_item ->> 'candidate_index' is null
  ) then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  if (
    select count(distinct update_item ->> 'id')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  or (
    select count(distinct update_item ->> 'candidate_index')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  then
    raise exception 'wall_text_regeneration_duplicate_updates';
  end if;

  select count(*)
  into matched_count
  from public.wall_text_creatives as creative
  join jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
    on update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  if matched_count <> expected_count then
    raise exception 'wall_text_regeneration_mismatch';
  end if;

  update public.wall_text_creatives as creative
  set
    error_message = null,
    generation_id = replacement_generation_id,
    generator_model = trim(p_generator_model),
    generator_version = 'business-profile-wall-text-v4',
    layout = update_item.layout,
    status = 'preview_ready',
    text_content = update_item.text_content,
    updated_at = now()
  from jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
  where update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
    and creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  return query
  select creative.*
  from public.wall_text_creatives as creative
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version
    and creative.status = 'preview_ready'
  order by creative.candidate_index;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."replace_wall_text_creative_copy_v4"(text, uuid, integer, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."replace_wall_text_creative_copy_v4"(text, uuid, integer, text, jsonb) FROM PUBLIC;


-- source: public/functions/replace_wall_text_creative_copy_v5.sql
CREATE OR REPLACE FUNCTION public.replace_wall_text_creative_copy_v5 (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_generator_model          text,
  p_updates                  jsonb
)
  RETURNS SETOF public.wall_text_creatives
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  expected_count integer;
  matched_count integer;
  replacement_generation_id uuid := gen_random_uuid();
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or p_business_profile_version is null
    or p_business_profile_version <= 0
    or char_length(trim(coalesce(p_generator_model, ''))) = 0
  then
    raise exception 'wall_text_regeneration_invalid_scope';
  end if;

  if jsonb_typeof(p_updates) <> 'array' then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  expected_count := jsonb_array_length(p_updates);

  if expected_count < 1 or expected_count > 12 then
    raise exception 'wall_text_regeneration_invalid_count';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_updates) as update_item
    where jsonb_typeof(update_item) is distinct from 'object'
      or jsonb_typeof(update_item -> 'text_content') is distinct from 'object'
      or jsonb_typeof(update_item -> 'layout') is distinct from 'object'
      or update_item ->> 'id' is null
      or update_item ->> 'candidate_index' is null
  ) then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  if (
    select count(distinct update_item ->> 'id')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  or (
    select count(distinct update_item ->> 'candidate_index')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  then
    raise exception 'wall_text_regeneration_duplicate_updates';
  end if;

  select count(*)
  into matched_count
  from public.wall_text_creatives as creative
  join jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
    on update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  if matched_count <> expected_count then
    raise exception 'wall_text_regeneration_mismatch';
  end if;

  update public.wall_text_creatives as creative
  set
    error_message = null,
    generation_id = replacement_generation_id,
    generator_model = trim(p_generator_model),
    generator_version = 'business-profile-wall-text-v5',
    layout = update_item.layout,
    status = 'preview_ready',
    text_content = update_item.text_content,
    updated_at = now()
  from jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
  where update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
    and creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  return query
  select creative.*
  from public.wall_text_creatives as creative
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version
    and creative.status = 'preview_ready'
  order by creative.candidate_index;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."replace_wall_text_creative_copy_v5"(text, uuid, integer, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."replace_wall_text_creative_copy_v5"(text, uuid, integer, text, jsonb) FROM PUBLIC;


-- source: public/functions/replace_wall_text_creative_copy_v6.sql
CREATE OR REPLACE FUNCTION public.replace_wall_text_creative_copy_v6 (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_generator_model          text,
  p_updates                  jsonb
)
  RETURNS SETOF public.wall_text_creatives
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  expected_count integer;
  matched_count integer;
  replacement_generation_id uuid := gen_random_uuid();
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or p_business_profile_version is null
    or p_business_profile_version <= 0
    or char_length(trim(coalesce(p_generator_model, ''))) = 0
  then
    raise exception 'wall_text_regeneration_invalid_scope';
  end if;

  if jsonb_typeof(p_updates) <> 'array' then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  expected_count := jsonb_array_length(p_updates);

  if expected_count < 1 or expected_count > 12 then
    raise exception 'wall_text_regeneration_invalid_count';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_updates) as update_item
    where jsonb_typeof(update_item) is distinct from 'object'
      or jsonb_typeof(update_item -> 'text_content') is distinct from 'object'
      or jsonb_typeof(update_item -> 'layout') is distinct from 'object'
      or update_item ->> 'id' is null
      or update_item ->> 'candidate_index' is null
  ) then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  if (
    select count(distinct update_item ->> 'id')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  or (
    select count(distinct update_item ->> 'candidate_index')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  then
    raise exception 'wall_text_regeneration_duplicate_updates';
  end if;

  select count(*)
  into matched_count
  from public.wall_text_creatives as creative
  join jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
    on update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  if matched_count <> expected_count then
    raise exception 'wall_text_regeneration_mismatch';
  end if;

  update public.wall_text_creatives as creative
  set
    error_message = null,
    generation_id = replacement_generation_id,
    generator_model = trim(p_generator_model),
    generator_version = 'business-profile-wall-text-v6',
    layout = update_item.layout,
    status = 'preview_ready',
    text_content = update_item.text_content,
    updated_at = now()
  from jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
  where update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
    and creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  return query
  select creative.*
  from public.wall_text_creatives as creative
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version
    and creative.status = 'preview_ready'
  order by creative.candidate_index;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."replace_wall_text_creative_copy_v6"(text, uuid, integer, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."replace_wall_text_creative_copy_v6"(text, uuid, integer, text, jsonb) FROM PUBLIC;


-- source: public/functions/replace_wall_text_creative_copy_v8.sql
CREATE OR REPLACE FUNCTION public.replace_wall_text_creative_copy_v8 (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_generator_model          text,
  p_updates                  jsonb
)
  RETURNS SETOF public.wall_text_creatives
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  expected_count integer;
  matched_count integer;
  replacement_generation_id uuid := gen_random_uuid();
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or p_business_profile_version is null
    or p_business_profile_version <= 0
    or char_length(trim(coalesce(p_generator_model, ''))) = 0
  then
    raise exception 'wall_text_regeneration_invalid_scope';
  end if;

  if jsonb_typeof(p_updates) <> 'array' then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  expected_count := jsonb_array_length(p_updates);

  if expected_count < 1 or expected_count > 50 then
    raise exception 'wall_text_regeneration_invalid_count';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_updates) as update_item
    where jsonb_typeof(update_item) is distinct from 'object'
      or jsonb_typeof(update_item -> 'text_content') is distinct from 'object'
      or jsonb_typeof(update_item -> 'layout') is distinct from 'object'
      or update_item ->> 'id' is null
      or update_item ->> 'candidate_index' is null
  ) then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  if (
    select count(distinct update_item ->> 'id')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  or (
    select count(distinct update_item ->> 'candidate_index')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  then
    raise exception 'wall_text_regeneration_duplicate_updates';
  end if;

  select count(*)
  into matched_count
  from public.wall_text_creatives as creative
  join jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
    on update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  if matched_count <> expected_count then
    raise exception 'wall_text_regeneration_mismatch';
  end if;

  update public.wall_text_creatives as creative
  set
    error_message = null,
    generation_id = replacement_generation_id,
    generator_model = trim(p_generator_model),
    generator_version = 'business-profile-wall-text-v8',
    layout = update_item.layout,
    status = 'preview_ready',
    text_content = update_item.text_content,
    updated_at = now()
  from jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
  where update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
    and creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  return query
  select creative.*
  from public.wall_text_creatives as creative
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version
    and creative.status = 'preview_ready'
  order by creative.candidate_index;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."replace_wall_text_creative_copy_v8"(text, uuid, integer, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."replace_wall_text_creative_copy_v8"(text, uuid, integer, text, jsonb) FROM PUBLIC;


-- source: public/functions/replace_wall_text_creative_copy_v9.sql
CREATE OR REPLACE FUNCTION public.replace_wall_text_creative_copy_v9 (
  p_user_id                  text,
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_generator_model          text,
  p_updates                  jsonb
)
  RETURNS SETOF public.wall_text_creatives
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  expected_count integer;
  matched_count integer;
  replacement_generation_id uuid := gen_random_uuid();
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_business_profile_id is null
    or p_business_profile_version is null
    or p_business_profile_version <= 0
    or char_length(trim(coalesce(p_generator_model, ''))) = 0
  then
    raise exception 'wall_text_regeneration_invalid_scope';
  end if;

  if jsonb_typeof(p_updates) <> 'array' then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  expected_count := jsonb_array_length(p_updates);

  if expected_count < 1 or expected_count > 50 then
    raise exception 'wall_text_regeneration_invalid_count';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_updates) as update_item
    where jsonb_typeof(update_item) is distinct from 'object'
      or jsonb_typeof(update_item -> 'text_content') is distinct from 'object'
      or jsonb_typeof(update_item -> 'layout') is distinct from 'object'
      or update_item ->> 'id' is null
      or update_item ->> 'candidate_index' is null
  ) then
    raise exception 'wall_text_regeneration_invalid_updates';
  end if;

  if (
    select count(distinct update_item ->> 'id')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  or (
    select count(distinct update_item ->> 'candidate_index')
    from jsonb_array_elements(p_updates) as update_item
  ) <> expected_count
  then
    raise exception 'wall_text_regeneration_duplicate_updates';
  end if;

  select count(*)
  into matched_count
  from public.wall_text_creatives as creative
  join jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
    on update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  if matched_count <> expected_count then
    raise exception 'wall_text_regeneration_mismatch';
  end if;

  update public.wall_text_creatives as creative
  set
    error_message = null,
    generation_id = replacement_generation_id,
    generator_model = trim(p_generator_model),
    generator_version = 'business-profile-wall-text-v9',
    layout = update_item.layout,
    status = 'preview_ready',
    text_content = update_item.text_content,
    updated_at = now()
  from jsonb_to_recordset(p_updates) as update_item(
    id uuid,
    candidate_index integer,
    layout jsonb,
    text_content jsonb
  )
  where update_item.id = creative.id
    and update_item.candidate_index = creative.candidate_index
    and creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version;

  return query
  select creative.*
  from public.wall_text_creatives as creative
  where creative.user_id = p_user_id
    and creative.business_profile_id = p_business_profile_id
    and creative.business_profile_version = p_business_profile_version
    and creative.status = 'preview_ready'
  order by creative.candidate_index;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."replace_wall_text_creative_copy_v9"(text, uuid, integer, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."replace_wall_text_creative_copy_v9"(text, uuid, integer, text, jsonb) FROM PUBLIC;


-- source: public/functions/replan_daily_trending_unbound_slots.sql
CREATE OR REPLACE FUNCTION public.replan_daily_trending_unbound_slots (
  p_user_id            text,
  p_feed_id            uuid,
  p_positions          integer[],
  p_formats            text[],
  p_carousel_percent   integer,
  p_wall_text_percent  integer,
  p_hook_video_percent integer,
  p_preference_version integer
)
  RETURNS integer
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  changed_count integer := 0;
  requested record;
begin
  if coalesce(array_length(p_positions, 1), 0) <> coalesce(array_length(p_formats, 1), 0) then
    raise exception 'invalid_daily_trending_replan_size';
  end if;

  if p_carousel_percent + p_wall_text_percent + p_hook_video_percent <> 100
    or p_carousel_percent not between 0 and 100
    or p_wall_text_percent not between 0 and 50
    or p_hook_video_percent not between 0 and 50
  then
    raise exception 'invalid_daily_trending_mix';
  end if;

  if not exists (
    select 1
    from public.daily_trending_feeds as feed
    where feed.id = p_feed_id
      and feed.user_id = p_user_id
  ) then
    raise exception 'daily_trending_feed_not_found';
  end if;

  if exists (
    select 1
    from unnest(p_formats) as requested_format
    where requested_format not in ('carousel', 'hook_video', 'wall_text')
  ) then
    raise exception 'invalid_daily_trending_format';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id || ':' || p_feed_id::text, 0));

  for requested in
    select position, format
    from unnest(p_positions, p_formats) as requested_slot(position, format)
  loop
    update public.daily_trending_feed_slots
    set
      format = requested.format,
      state = 'planned',
      updated_at = now()
    where feed_id = p_feed_id
      and position = requested.position
      and state in ('planned', 'failed')
      and carousel_assignment_id is null
      and hook_video_assignment_id is null
      and wall_text_assignment_id is null;

    changed_count := changed_count + case when found then 1 else 0 end;
  end loop;

  update public.daily_trending_feeds
  set
    carousel_percent = p_carousel_percent,
    wall_text_percent = p_wall_text_percent,
    hook_video_percent = p_hook_video_percent,
    preference_version = p_preference_version,
    status = case when changed_count > 0 then 'preparing' else status end,
    updated_at = now()
  where id = p_feed_id
    and user_id = p_user_id;

  return changed_count;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."replan_daily_trending_unbound_slots"(text, uuid, integer[], text[], integer, integer, integer, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."replan_daily_trending_unbound_slots"(text, uuid, integer[], text[], integer, integer, integer, integer) FROM PUBLIC;


-- source: public/functions/request_background_job_cancel.sql
CREATE OR REPLACE FUNCTION public.request_background_job_cancel (
  p_job_id  uuid,
  p_user_id text
)
  RETURNS SETOF public.background_jobs
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_current public.background_jobs%rowtype;
  v_next_status text;
  v_now timestamptz := now();
begin
  select job.*
  into v_current
  from public.background_jobs as job
  where job.id = p_job_id
    and job.user_id = p_user_id
  for update;

  if not found then
    return;
  end if;

  if v_current.status in ('completed', 'failed', 'cancelled') then
    return next v_current;
    return;
  end if;

  v_next_status := case
    when v_current.status in ('created', 'queued', 'stalled') then 'cancelled'
    else 'cancel_requested'
  end;

  update public.background_jobs as job
  set
    status = v_next_status,
    stage = v_next_status,
    cancel_requested_at = v_now,
    completed_at = case when v_next_status = 'cancelled' then v_now else job.completed_at end,
    claim_token = case when v_next_status = 'cancelled' then null else job.claim_token end,
    locked_at = case when v_next_status = 'cancelled' then null else job.locked_at end,
    worker_id = case when v_next_status = 'cancelled' then null else job.worker_id end,
    worker_execution_id = case when v_next_status = 'cancelled' then null else job.worker_execution_id end,
    updated_at = v_now
  where job.id = p_job_id;

  perform public.append_background_job_event(
    p_job_id,
    case when v_next_status = 'cancelled' then 'job_cancelled' else 'cancellation_requested' end,
    jsonb_build_object('fromStatus', v_current.status)
  );

  return query
  select job.* from public.background_jobs as job where job.id = p_job_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."request_background_job_cancel"(uuid, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."request_background_job_cancel"(uuid, text) FROM PUBLIC;


-- source: public/functions/reschedule_trending_feed_reconciliation.sql
CREATE OR REPLACE FUNCTION public.reschedule_trending_feed_reconciliation (
  p_source_job_id uuid,
  p_error_message text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  delay_seconds integer;
begin
  select case least(outbox.attempt_count, 6)
    when 1 then 60
    when 2 then 120
    when 3 then 240
    when 4 then 480
    when 5 then 900
    else 1800
  end
  into delay_seconds
  from public.trending_feed_reconciliation_outbox as outbox
  where outbox.source_job_id = p_source_job_id
    and outbox.status = 'processing'
  for update;

  if delay_seconds is null then
    return false;
  end if;

  update public.trending_feed_reconciliation_outbox as outbox
  set
    status = 'pending',
    locked_at = null,
    last_error = left(
      coalesce(nullif(btrim(p_error_message), ''), 'Trending reconciliation failed.'),
      1000
    ),
    next_attempt_at = now() + make_interval(secs => delay_seconds),
    updated_at = now()
  where outbox.source_job_id = p_source_job_id
    and outbox.status = 'processing';

  return found;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."reschedule_trending_feed_reconciliation"(uuid, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."reschedule_trending_feed_reconciliation"(uuid, text) FROM PUBLIC;


-- source: public/functions/reschedule_trending_hook_generation_chunk_dispatch_v1.sql
CREATE OR REPLACE FUNCTION public.reschedule_trending_hook_generation_chunk_dispatch_v1 (
  p_dispatch_id   uuid,
  p_claim_token   uuid,
  p_error_message text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_rescheduled boolean := false;
begin
  update public.trending_hook_generation_dispatch_outbox
  set
    status = 'pending',
    next_attempt_at = now() + make_interval(
      mins => least(greatest(attempt_count, 1) * 5, 30)
    ),
    claim_token = null,
    claimed_at = null,
    last_error = left(coalesce(nullif(trim(p_error_message), ''), 'Could not dispatch the reserved Hook chunk.'), 2000),
    updated_at = now()
  where id = p_dispatch_id
    and claim_token = p_claim_token
    and status = 'processing'
  returning true into v_rescheduled;

  return v_rescheduled;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."reschedule_trending_hook_generation_chunk_dispatch_v1"(uuid, uuid, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."reschedule_trending_hook_generation_chunk_dispatch_v1"(uuid, uuid, text) FROM PUBLIC;


-- source: public/functions/reserve_billing_credits.sql
CREATE OR REPLACE FUNCTION public.reserve_billing_credits (
  p_user_id         text,
  p_idempotency_key text,
  p_job_type        text,
  p_amount          integer
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."reserve_billing_credits"(text, text, text, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."reserve_billing_credits"(text, text, text, integer) FROM PUBLIC;


-- source: public/functions/reserve_carousel_content_plan_items.sql
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."reserve_carousel_content_plan_items"(text, uuid, integer, integer, text, integer) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."reserve_carousel_content_plan_items"(text, uuid, integer, integer, text, integer) IS 'Atomically and idempotently reserves an arbitrary requested count from the current shared pool. Day numbers do not limit selection.';

REVOKE ALL ON FUNCTION "public"."reserve_carousel_content_plan_items"(text, uuid, integer, integer, text, integer) FROM PUBLIC;


-- source: public/functions/reserve_carousel_experiment_batches.sql
CREATE OR REPLACE FUNCTION public.reserve_carousel_experiment_batches (
  p_business_profile_id      uuid,
  p_business_profile_version integer,
  p_generation_batch_id      uuid,
  p_batch_count              integer
)
  RETURNS SETOF public.carousel_experiment_batches
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_existing_count integer;
  v_next_sequence integer;
  v_next_rotation_sequence integer;
  v_offset integer;
  v_structure_batch_sequence integer;
  v_structure_id text;
  v_structure_mode text;
  v_structure_rotation_sequence integer;
  v_structure_selection_mode text;
begin
  if p_batch_count < 1 or p_batch_count > 10 then
    raise exception 'carousel_experiment_batch_count_invalid';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_business_profile_id::text, 246813579)
  );

  select settings.structure_mode
  into v_structure_mode
  from public.carousel_global_settings as settings
  where settings.singleton = true;

  if v_structure_mode is null
     or v_structure_mode not in (
       'rotate',
       'structure_1_only',
       'structure_2_only'
     ) then
    raise exception 'carousel_global_structure_mode_invalid';
  end if;

  select count(*)::integer
  into v_existing_count
  from public.carousel_experiment_batches as batch
  where batch.generation_batch_id = p_generation_batch_id
    and batch.business_profile_id = p_business_profile_id
    and batch.business_profile_version = p_business_profile_version;

  if v_existing_count > p_batch_count then
    raise exception 'carousel_experiment_batch_count_cannot_shrink';
  end if;

  select coalesce(max(batch.batch_sequence), -1) + 1
  into v_next_sequence
  from public.carousel_experiment_batches as batch
  where batch.business_profile_id = p_business_profile_id;

  select coalesce(max(batch.structure_rotation_sequence), -1) + 1
  into v_next_rotation_sequence
  from public.carousel_experiment_batches as batch
  where batch.business_profile_id = p_business_profile_id
    and batch.structure_rotation_sequence is not null;

  for v_offset in v_existing_count..(p_batch_count - 1) loop
    if v_structure_mode = 'rotate' then
      v_structure_rotation_sequence := v_next_rotation_sequence;
      v_structure_id := case
        when v_structure_rotation_sequence % 2 = 0 then 'structure_1'
        else 'structure_2'
      end;
      v_structure_selection_mode := 'rotation';
      v_next_rotation_sequence := v_next_rotation_sequence + 1;
    else
      v_structure_rotation_sequence := null;
      v_structure_id := case
        when v_structure_mode = 'structure_2_only' then 'structure_2'
        else 'structure_1'
      end;
      v_structure_selection_mode := 'global_override';
    end if;

    select coalesce(max(batch.structure_batch_sequence), -1) + 1
    into v_structure_batch_sequence
    from public.carousel_experiment_batches as batch
    where batch.business_profile_id = p_business_profile_id
      and batch.structure_id = v_structure_id;

    insert into public.carousel_experiment_batches (
      business_profile_id,
      business_profile_version,
      generation_batch_id,
      batch_sequence,
      cycle_number,
      cycle_batch_position,
      structure_id,
      structure_version,
      structure_selection_mode,
      structure_mode_snapshot,
      structure_batch_sequence,
      structure_rotation_sequence
    ) values (
      p_business_profile_id,
      p_business_profile_version,
      p_generation_batch_id,
      v_next_sequence + (v_offset - v_existing_count),
      case
        when v_structure_id = 'structure_1'
          then (v_structure_batch_sequence / 3) + 1
        else null
      end,
      case
        when v_structure_id = 'structure_1'
          then v_structure_batch_sequence % 3
        else null
      end,
      v_structure_id,
      1,
      v_structure_selection_mode,
      v_structure_mode,
      v_structure_batch_sequence,
      v_structure_rotation_sequence
    );
  end loop;

  return query
  select batch.*
  from public.carousel_experiment_batches as batch
  where batch.generation_batch_id = p_generation_batch_id
    and batch.business_profile_id = p_business_profile_id
    and batch.business_profile_version = p_business_profile_version
  order by batch.batch_sequence asc;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."reserve_carousel_experiment_batches"(uuid, integer, uuid, integer) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."reserve_carousel_experiment_batches"(uuid, integer, uuid, integer) IS 'Atomically reserves complete five-Carousel batches. Rotate mode alternates Structure 1 and Structure 2 per business; global overrides select one structure without consuming rotation sequence.';

REVOKE ALL ON FUNCTION "public"."reserve_carousel_experiment_batches"(uuid, integer, uuid, integer) FROM PUBLIC;


-- source: public/functions/reserve_carousel_role_assets_v1.sql
CREATE OR REPLACE FUNCTION public.reserve_carousel_role_assets_v1 (
  p_business_profile_id uuid,
  p_carousel_id         uuid,
  p_category_slug       text,
  p_use_product_asset   boolean DEFAULT false
)
  RETURNS TABLE (
    slide_number       integer,
    asset_id           uuid,
    library_asset_id   text,
    category_slug      text,
    asset_role         text,
    cycle_number       integer,
    base_s3_key        text,
    base_url           text,
    source_file_sha256 text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_asset public.category_image_assets%rowtype;
  v_asset_count integer;
  v_cycle integer;
  v_existing_count integer;
  v_human_first boolean;
  v_index integer;
  v_last_asset_id uuid;
  v_pool_roles text[];
  v_product_available boolean;
  v_role text;
  v_roles text[];
  v_selected_asset_ids uuid[] := '{}'::uuid[];
  v_user_id text;
begin
  if p_category_slug is null
    or p_category_slug not in ('gym', 'food', 'productivity', 'dating', 'travel', 'skin')
  then
    raise exception 'carousel_image_library_category_not_supported:%', p_category_slug;
  end if;

  select generation.user_id
  into v_user_id
  from public.carousel_generations as generation
  where generation.id = p_carousel_id
    and generation.business_profile_id = p_business_profile_id;

  if v_user_id is null then
    raise exception 'carousel_image_reservation_owner_mismatch';
  end if;

  select count(*)::integer
  into v_existing_count
  from public.carousel_image_usage as image_usage
  where image_usage.carousel_id = p_carousel_id
    and image_usage.usage_type = 'assigned';

  if v_existing_count > 0 then
    if v_existing_count <> 5 then
      raise exception 'carousel_image_reservation_is_partial:%', v_existing_count;
    end if;

    return query
    select
      image_usage.slide_number,
      image_asset.id,
      image_asset.library_asset_id,
      image_asset.category_slug,
      image_usage.asset_role,
      image_usage.cycle_number,
      image_asset.base_s3_key,
      image_asset.base_url,
      image_asset.source_file_sha256
    from public.carousel_image_usage as image_usage
    join public.category_image_assets as image_asset
      on image_asset.id = image_usage.asset_id
    where image_usage.carousel_id = p_carousel_id
      and image_usage.usage_type = 'assigned'
    order by image_usage.slide_number;
    return;
  end if;

  select exists (
    select 1
    from public.category_image_assets as image_asset
    where image_asset.category_slug = p_category_slug
      and image_asset.asset_role = 'product_asset'
      and image_asset.owner_business_profile_id = p_business_profile_id
      and image_asset.is_active
      and image_asset.status = 'ready'
      and image_asset.subject_review_status = 'approved'
      and image_asset.runtime_exclusion_reason is null
  )
  into v_product_available;

  v_product_available := p_use_product_asset and v_product_available;
  v_human_first := get_byte(decode(md5(p_carousel_id::text), 'hex'), 0) < 128;
  v_roles := case
    when v_human_first then array['hook', 'human', 'static', 'human', 'static']::text[]
    else array['hook', 'static', 'human', 'static', 'human']::text[]
  end;

  if v_product_available then
    if v_human_first then
      v_roles[5] := 'product_asset';
    else
      v_roles[4] := 'product_asset';
    end if;
  end if;

  v_pool_roles := case
    when v_product_available
      then array['hook', 'human', 'static', 'product_asset']::text[]
    else array['hook', 'human', 'static']::text[]
  end;

  foreach v_role in array v_pool_roles
  loop
    insert into public.carousel_image_rotation_pools (
      business_profile_id,
      category_slug,
      asset_role
    )
    values (
      p_business_profile_id,
      p_category_slug,
      v_role
    )
    on conflict on constraint carousel_image_rotation_pools_pkey do nothing;
  end loop;

  perform 1
  from public.carousel_image_rotation_pools as rotation_pool
  where rotation_pool.business_profile_id = p_business_profile_id
    and rotation_pool.category_slug = p_category_slug
    and rotation_pool.asset_role = any(v_roles)
  order by rotation_pool.asset_role
  for update;

  select count(*)::integer
  into v_existing_count
  from public.carousel_image_usage as image_usage
  where image_usage.carousel_id = p_carousel_id
    and image_usage.usage_type = 'assigned';

  if v_existing_count > 0 then
    if v_existing_count <> 5 then
      raise exception 'carousel_image_reservation_is_partial:%', v_existing_count;
    end if;

    return query
    select
      image_usage.slide_number,
      image_asset.id,
      image_asset.library_asset_id,
      image_asset.category_slug,
      image_usage.asset_role,
      image_usage.cycle_number,
      image_asset.base_s3_key,
      image_asset.base_url,
      image_asset.source_file_sha256
    from public.carousel_image_usage as image_usage
    join public.category_image_assets as image_asset
      on image_asset.id = image_usage.asset_id
    where image_usage.carousel_id = p_carousel_id
      and image_usage.usage_type = 'assigned'
    order by image_usage.slide_number;
    return;
  end if;

  foreach v_role in array array['hook', 'human', 'static']::text[]
  loop
    select count(*)::integer
    into v_asset_count
    from public.category_image_assets as image_asset
    where image_asset.category_slug = p_category_slug
      and image_asset.asset_role = v_role
      and image_asset.owner_business_profile_id is null
      and image_asset.is_active
      and image_asset.status = 'ready'
      and image_asset.subject_review_status = 'approved'
      and image_asset.runtime_exclusion_reason is null;

    if (
      v_role = 'hook' and v_asset_count < 1
    ) or (
      v_role = 'human' and v_asset_count < 2
    ) or (
      v_role = 'static'
      and v_asset_count < case when v_product_available then 1 else 2 end
    ) then
      raise exception 'carousel_image_role_pool_too_small:%:%:%',
        p_category_slug,
        v_role,
        v_asset_count;
    end if;
  end loop;

  for v_index in 1..5
  loop
    v_role := v_roles[v_index];

    select rotation_pool.cycle_number, rotation_pool.last_asset_id
    into v_cycle, v_last_asset_id
    from public.carousel_image_rotation_pools as rotation_pool
    where rotation_pool.business_profile_id = p_business_profile_id
      and rotation_pool.category_slug = p_category_slug
      and rotation_pool.asset_role = v_role
    for update;

    select image_asset.*
    into v_asset
    from public.category_image_assets as image_asset
    where image_asset.category_slug = p_category_slug
      and image_asset.asset_role = v_role
      and (
        (
          v_role = 'product_asset'
          and image_asset.owner_business_profile_id = p_business_profile_id
        )
        or (
          v_role <> 'product_asset'
          and image_asset.owner_business_profile_id is null
        )
      )
      and image_asset.is_active
      and image_asset.status = 'ready'
      and image_asset.subject_review_status = 'approved'
      and image_asset.runtime_exclusion_reason is null
      and not (image_asset.id = any(v_selected_asset_ids))
      and not exists (
        select 1
        from public.carousel_image_usage as image_usage
        where image_usage.business_profile_id = p_business_profile_id
          and image_usage.category_slug = p_category_slug
          and image_usage.asset_role = v_role
          and image_usage.cycle_number = v_cycle
          and image_usage.asset_id = image_asset.id
          and image_usage.usage_type = 'assigned'
      )
    order by md5(
      p_business_profile_id::text
      || ':' || p_category_slug
      || ':' || v_role
      || ':' || v_cycle::text
      || ':' || image_asset.id::text
    ), image_asset.id
    limit 1;

    if v_asset.id is null then
      v_cycle := v_cycle + 1;

      update public.carousel_image_rotation_pools as rotation_pool
      set cycle_number = v_cycle, updated_at = now()
      where rotation_pool.business_profile_id = p_business_profile_id
        and rotation_pool.category_slug = p_category_slug
        and rotation_pool.asset_role = v_role;

      select image_asset.*
      into v_asset
      from public.category_image_assets as image_asset
      where image_asset.category_slug = p_category_slug
        and image_asset.asset_role = v_role
        and (
          (
            v_role = 'product_asset'
            and image_asset.owner_business_profile_id = p_business_profile_id
          )
          or (
            v_role <> 'product_asset'
            and image_asset.owner_business_profile_id is null
          )
        )
        and image_asset.is_active
        and image_asset.status = 'ready'
        and image_asset.subject_review_status = 'approved'
        and image_asset.runtime_exclusion_reason is null
        and not (image_asset.id = any(v_selected_asset_ids))
      order by
        (image_asset.id = v_last_asset_id),
        md5(
          p_business_profile_id::text
          || ':' || p_category_slug
          || ':' || v_role
          || ':' || v_cycle::text
          || ':' || image_asset.id::text
        ),
        image_asset.id
      limit 1;
    end if;

    if v_asset.id is null then
      raise exception 'carousel_image_role_pool_cannot_complete:%:%',
        p_category_slug,
        v_role;
    end if;

    insert into public.carousel_image_usage (
      user_id,
      business_profile_id,
      asset_id,
      duplicate_family_id,
      carousel_id,
      category_slug,
      asset_role,
      cycle_number,
      slide_number,
      usage_type,
      reuse_reason
    )
    values (
      v_user_id,
      p_business_profile_id,
      v_asset.id,
      v_asset.source_file_sha256,
      p_carousel_id,
      p_category_slug,
      v_role,
      v_cycle,
      v_index,
      'assigned',
      case when v_cycle > 1 then 'shuffle_bag_cycle' else null end
    );

    update public.carousel_image_rotation_pools as rotation_pool
    set last_asset_id = v_asset.id, updated_at = now()
    where rotation_pool.business_profile_id = p_business_profile_id
      and rotation_pool.category_slug = p_category_slug
      and rotation_pool.asset_role = v_role;

    v_selected_asset_ids := array_append(v_selected_asset_ids, v_asset.id);
  end loop;

  update public.category_image_assets as image_asset
  set usage_count = image_asset.usage_count + 1, updated_at = now()
  where image_asset.id = any(v_selected_asset_ids);

  return query
  select
    image_usage.slide_number,
    image_asset.id,
    image_asset.library_asset_id,
    image_asset.category_slug,
    image_usage.asset_role,
    image_usage.cycle_number,
    image_asset.base_s3_key,
    image_asset.base_url,
    image_asset.source_file_sha256
  from public.carousel_image_usage as image_usage
  join public.category_image_assets as image_asset
    on image_asset.id = image_usage.asset_id
  where image_usage.carousel_id = p_carousel_id
    and image_usage.usage_type = 'assigned'
  order by image_usage.slide_number;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."reserve_carousel_role_assets_v1"(uuid, uuid, text, boolean) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."reserve_carousel_role_assets_v1"(uuid, uuid, text, boolean) FROM PUBLIC;


-- source: public/functions/reserve_carousel_role_assets_v2.sql
CREATE OR REPLACE FUNCTION public.reserve_carousel_role_assets_v2 (
  p_business_profile_id   uuid,
  p_carousel_id           uuid,
  p_primary_category_slug text,
  p_slide_plan            jsonb,
  p_use_product_asset     boolean DEFAULT false
)
  RETURNS TABLE (
    slide_number            integer,
    asset_id                uuid,
    library_asset_id        text,
    category_slug           text,
    requested_category_slug text,
    primary_category_slug   text,
    asset_role              text,
    selection_type          text,
    relevance_level         text,
    relevance_reason        text,
    cycle_number            integer,
    base_s3_key             text,
    base_url                text,
    source_file_sha256      text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_actual_categories text[] := array[null, null, null, null, null]::text[];
  v_actual_levels text[] := array[null, null, null, null, null]::text[];
  v_actual_reasons text[] := array[null, null, null, null, null]::text[];
  v_actual_roles text[] := array[null, null, null, null, null]::text[];
  v_actual_selection_types text[] := array[null, null, null, null, null]::text[];
  v_asset public.category_image_assets%rowtype;
  v_asset_count integer;
  v_category text;
  v_cycle integer;
  v_existing_count integer;
  v_index integer;
  v_last_asset_id uuid;
  v_plan_item jsonb;
  v_product_available boolean;
  v_product_index integer;
  v_related_count integer := 0;
  v_requested_categories text[] := array[null, null, null, null, null]::text[];
  v_requested_levels text[] := array[null, null, null, null, null]::text[];
  v_requested_reasons text[] := array[null, null, null, null, null]::text[];
  v_requested_roles text[] := array[null, null, null, null, null]::text[];
  v_requested_selection_types text[] := array[null, null, null, null, null]::text[];
  v_role text;
  v_selected_asset_ids uuid[] := '{}'::uuid[];
  v_slide_number integer;
  v_user_id text;
begin
  if p_primary_category_slug is null
    or p_primary_category_slug not in (
      'gym', 'food', 'productivity', 'dating', 'travel', 'skin'
    )
  then
    raise exception 'carousel_image_library_category_not_supported:%',
      p_primary_category_slug;
  end if;

  select generation.user_id
  into v_user_id
  from public.carousel_generations as generation
  where generation.id = p_carousel_id
    and generation.business_profile_id = p_business_profile_id;

  if v_user_id is null then
    raise exception 'carousel_image_reservation_owner_mismatch';
  end if;

  select count(*)::integer
  into v_existing_count
  from public.carousel_image_usage as image_usage
  where image_usage.carousel_id = p_carousel_id
    and image_usage.usage_type = 'assigned';

  if v_existing_count > 0 then
    if v_existing_count <> 5 then
      raise exception 'carousel_image_reservation_is_partial:%', v_existing_count;
    end if;

    return query
    select
      image_usage.slide_number,
      image_asset.id,
      image_asset.library_asset_id,
      image_asset.category_slug,
      coalesce(image_usage.requested_category_slug, image_usage.category_slug),
      coalesce(image_usage.primary_category_slug, p_primary_category_slug),
      image_usage.asset_role,
      coalesce(image_usage.selection_type, 'primary'),
      coalesce(image_usage.relevance_level, 'none'),
      image_usage.relevance_reason,
      image_usage.cycle_number,
      image_asset.base_s3_key,
      image_asset.base_url,
      image_asset.source_file_sha256
    from public.carousel_image_usage as image_usage
    join public.category_image_assets as image_asset
      on image_asset.id = image_usage.asset_id
    where image_usage.carousel_id = p_carousel_id
      and image_usage.usage_type = 'assigned'
    order by image_usage.slide_number;
    return;
  end if;

  if p_slide_plan is null
    or jsonb_typeof(p_slide_plan) <> 'array'
    or jsonb_array_length(p_slide_plan) <> 5
  then
    raise exception 'carousel_image_slide_plan_requires_five_items';
  end if;

  for v_index in 1..5
  loop
    v_plan_item := p_slide_plan -> (v_index - 1);

    if jsonb_typeof(v_plan_item) <> 'object' then
      raise exception 'carousel_image_slide_plan_item_invalid:%', v_index;
    end if;

    begin
      v_slide_number := (v_plan_item ->> 'slide_number')::integer;
    exception
      when invalid_text_representation then
        raise exception 'carousel_image_slide_plan_number_invalid:%', v_index;
    end;

    if v_slide_number is null or v_slide_number <> v_index then
      raise exception 'carousel_image_slide_plan_order_invalid:%:%',
        v_index,
        v_slide_number;
    end if;

    v_requested_categories[v_index] := v_plan_item ->> 'category_slug';
    v_requested_roles[v_index] := v_plan_item ->> 'asset_role';
    v_requested_selection_types[v_index] := v_plan_item ->> 'selection_type';
    v_requested_levels[v_index] := v_plan_item ->> 'relevance_level';
    v_requested_reasons[v_index] := nullif(
      left(coalesce(v_plan_item ->> 'relevance_reason', ''), 500),
      ''
    );

    if v_requested_categories[v_index] is null
      or v_requested_categories[v_index] not in (
        'gym', 'food', 'productivity', 'dating', 'travel', 'skin'
      )
    then
      raise exception 'carousel_image_slide_category_invalid:%:%',
        v_index,
        v_requested_categories[v_index];
    end if;

    if v_requested_roles[v_index] is null
      or v_requested_roles[v_index] not in ('hook', 'human', 'static')
    then
      raise exception 'carousel_image_slide_role_invalid:%:%',
        v_index,
        v_requested_roles[v_index];
    end if;

    if v_requested_selection_types[v_index] is null
      or v_requested_selection_types[v_index] not in ('primary', 'related')
    then
      raise exception 'carousel_image_slide_selection_type_invalid:%:%',
        v_index,
        v_requested_selection_types[v_index];
    end if;

    if v_requested_levels[v_index] is null
      or v_requested_levels[v_index] not in (
        'none', 'light', 'moderate', 'strong'
      )
    then
      raise exception 'carousel_image_slide_relevance_invalid:%:%',
        v_index,
        v_requested_levels[v_index];
    end if;

    if v_requested_categories[v_index] = p_primary_category_slug then
      if v_requested_selection_types[v_index] <> 'primary'
        or v_requested_levels[v_index] <> 'none'
      then
        raise exception 'carousel_image_primary_slide_metadata_invalid:%', v_index;
      end if;
    else
      if v_requested_roles[v_index] <> 'static'
        or v_requested_selection_types[v_index] <> 'related'
        or v_requested_levels[v_index] = 'none'
      then
        raise exception 'carousel_image_related_slide_metadata_invalid:%', v_index;
      end if;

      if not (
        (p_primary_category_slug = 'gym' and v_requested_categories[v_index] = 'food')
        or (p_primary_category_slug = 'food' and v_requested_categories[v_index] = 'gym')
        or (p_primary_category_slug = 'travel' and v_requested_categories[v_index] = 'food')
      ) then
        raise exception 'carousel_image_related_category_not_allowed:%:%',
          p_primary_category_slug,
          v_requested_categories[v_index];
      end if;

      v_related_count := v_related_count + 1;
    end if;
  end loop;

  if not (
    v_requested_roles = array['hook', 'human', 'static', 'human', 'static']::text[]
    or v_requested_roles = array['hook', 'static', 'human', 'static', 'human']::text[]
  ) then
    raise exception 'carousel_image_slide_role_ratio_invalid';
  end if;

  if v_requested_categories[1] <> p_primary_category_slug
    or v_requested_roles[1] <> 'hook'
    or v_requested_selection_types[1] <> 'primary'
    or v_related_count > 2
  then
    raise exception 'carousel_image_slide_plan_primary_boundary_invalid';
  end if;

  if (
    select count(*)
    from generate_subscripts(v_requested_categories, 1) as subscript_position(position)
    where subscript_position.position > 1
      and v_requested_categories[subscript_position.position] = p_primary_category_slug
  ) < 2 then
    raise exception 'carousel_image_slide_plan_primary_tail_too_small';
  end if;

  select exists (
    select 1
    from public.category_image_assets as image_asset
    where image_asset.category_slug = p_primary_category_slug
      and image_asset.asset_role = 'product_asset'
      and image_asset.owner_business_profile_id = p_business_profile_id
      and image_asset.library_asset_id is not null
      and image_asset.is_active
      and image_asset.status = 'ready'
      and image_asset.subject_review_status = 'approved'
      and image_asset.runtime_exclusion_reason is null
  )
  into v_product_available;

  v_product_available := p_use_product_asset and v_product_available;
  v_actual_categories := v_requested_categories;
  v_actual_roles := v_requested_roles;
  v_actual_selection_types := v_requested_selection_types;
  v_actual_levels := v_requested_levels;
  v_actual_reasons := v_requested_reasons;

  if v_product_available then
    for v_index in reverse 5..1
    loop
      if v_actual_roles[v_index] = 'static' then
        v_product_index := v_index;
        exit;
      end if;
    end loop;

    if v_product_index is null then
      raise exception 'carousel_image_product_slot_missing';
    end if;

    v_actual_categories[v_product_index] := p_primary_category_slug;
    v_actual_roles[v_product_index] := 'product_asset';
    v_actual_selection_types[v_product_index] := 'product';
    v_actual_levels[v_product_index] := 'none';
    v_actual_reasons[v_product_index] := null;
    v_requested_categories[v_product_index] := p_primary_category_slug;
  end if;

  for v_index in 1..5
  loop
    insert into public.carousel_image_rotation_pools (
      business_profile_id,
      category_slug,
      asset_role
    )
    values (
      p_business_profile_id,
      v_actual_categories[v_index],
      v_actual_roles[v_index]
    )
    on conflict on constraint carousel_image_rotation_pools_pkey do nothing;
  end loop;

  insert into public.carousel_image_rotation_pools (
    business_profile_id,
    category_slug,
    asset_role
  )
  values (
    p_business_profile_id,
    p_primary_category_slug,
    'static'
  )
  on conflict on constraint carousel_image_rotation_pools_pkey do nothing;

  perform 1
  from public.carousel_image_rotation_pools as rotation_pool
  where rotation_pool.business_profile_id = p_business_profile_id
    and (
      (
        rotation_pool.category_slug = p_primary_category_slug
        and rotation_pool.asset_role in ('hook', 'human', 'static', 'product_asset')
      )
      or (
        rotation_pool.asset_role = 'static'
        and rotation_pool.category_slug = any(v_actual_categories)
      )
    )
  order by rotation_pool.category_slug, rotation_pool.asset_role
  for update;

  select count(*)::integer
  into v_existing_count
  from public.carousel_image_usage as image_usage
  where image_usage.carousel_id = p_carousel_id
    and image_usage.usage_type = 'assigned';

  if v_existing_count > 0 then
    if v_existing_count <> 5 then
      raise exception 'carousel_image_reservation_is_partial:%', v_existing_count;
    end if;

    return query
    select
      image_usage.slide_number,
      image_asset.id,
      image_asset.library_asset_id,
      image_asset.category_slug,
      coalesce(image_usage.requested_category_slug, image_usage.category_slug),
      coalesce(image_usage.primary_category_slug, p_primary_category_slug),
      image_usage.asset_role,
      coalesce(image_usage.selection_type, 'primary'),
      coalesce(image_usage.relevance_level, 'none'),
      image_usage.relevance_reason,
      image_usage.cycle_number,
      image_asset.base_s3_key,
      image_asset.base_url,
      image_asset.source_file_sha256
    from public.carousel_image_usage as image_usage
    join public.category_image_assets as image_asset
      on image_asset.id = image_usage.asset_id
    where image_usage.carousel_id = p_carousel_id
      and image_usage.usage_type = 'assigned'
    order by image_usage.slide_number;
    return;
  end if;

  foreach v_role in array array['hook', 'human', 'static']::text[]
  loop
    select count(*)::integer
    into v_asset_count
    from public.category_image_assets as image_asset
    where image_asset.category_slug = p_primary_category_slug
      and image_asset.asset_role = v_role
      and image_asset.owner_business_profile_id is null
      and image_asset.library_asset_id is not null
      and image_asset.is_active
      and image_asset.status = 'ready'
      and image_asset.subject_review_status = 'approved'
      and image_asset.runtime_exclusion_reason is null;

    if (
      v_role = 'hook' and v_asset_count < 1
    ) or (
      v_role = 'human' and v_asset_count < 2
    ) or (
      v_role = 'static'
      and v_asset_count < case when v_product_available then 1 else 2 end
    ) then
      raise exception 'carousel_image_role_pool_too_small:%:%:%',
        p_primary_category_slug,
        v_role,
        v_asset_count;
    end if;
  end loop;

  for v_index in 1..5
  loop
    v_category := v_actual_categories[v_index];
    v_role := v_actual_roles[v_index];

    if v_role = 'static' and v_category <> p_primary_category_slug then
      if not exists (
        select 1
        from public.category_image_assets as image_asset
        where image_asset.category_slug = v_category
          and image_asset.asset_role = 'static'
          and image_asset.owner_business_profile_id is null
          and image_asset.library_asset_id is not null
          and image_asset.is_active
          and image_asset.status = 'ready'
          and image_asset.subject_review_status = 'approved'
          and image_asset.runtime_exclusion_reason is null
          and not (image_asset.id = any(v_selected_asset_ids))
      ) then
        v_category := p_primary_category_slug;
        v_actual_categories[v_index] := p_primary_category_slug;
        v_actual_selection_types[v_index] := 'related_fallback';
      end if;
    end if;

    select rotation_pool.cycle_number, rotation_pool.last_asset_id
    into v_cycle, v_last_asset_id
    from public.carousel_image_rotation_pools as rotation_pool
    where rotation_pool.business_profile_id = p_business_profile_id
      and rotation_pool.category_slug = v_category
      and rotation_pool.asset_role = v_role
    for update;

    select image_asset.*
    into v_asset
    from public.category_image_assets as image_asset
    where image_asset.category_slug = v_category
      and image_asset.asset_role = v_role
      and (
        (
          v_role = 'product_asset'
          and image_asset.owner_business_profile_id = p_business_profile_id
        )
        or (
          v_role <> 'product_asset'
          and image_asset.owner_business_profile_id is null
        )
      )
      and image_asset.library_asset_id is not null
      and image_asset.is_active
      and image_asset.status = 'ready'
      and image_asset.subject_review_status = 'approved'
      and image_asset.runtime_exclusion_reason is null
      and not (image_asset.id = any(v_selected_asset_ids))
      and not exists (
        select 1
        from public.carousel_image_usage as image_usage
        where image_usage.business_profile_id = p_business_profile_id
          and image_usage.category_slug = v_category
          and image_usage.asset_role = v_role
          and image_usage.cycle_number = v_cycle
          and image_usage.asset_id = image_asset.id
          and image_usage.usage_type = 'assigned'
      )
    order by md5(
      p_business_profile_id::text
      || ':' || v_category
      || ':' || v_role
      || ':' || v_cycle::text
      || ':' || image_asset.id::text
    ), image_asset.id
    limit 1;

    if v_asset.id is null then
      v_cycle := v_cycle + 1;

      update public.carousel_image_rotation_pools as rotation_pool
      set cycle_number = v_cycle, updated_at = now()
      where rotation_pool.business_profile_id = p_business_profile_id
        and rotation_pool.category_slug = v_category
        and rotation_pool.asset_role = v_role;

      select image_asset.*
      into v_asset
      from public.category_image_assets as image_asset
      where image_asset.category_slug = v_category
        and image_asset.asset_role = v_role
        and (
          (
            v_role = 'product_asset'
            and image_asset.owner_business_profile_id = p_business_profile_id
          )
          or (
            v_role <> 'product_asset'
            and image_asset.owner_business_profile_id is null
          )
        )
        and image_asset.library_asset_id is not null
        and image_asset.is_active
        and image_asset.status = 'ready'
        and image_asset.subject_review_status = 'approved'
        and image_asset.runtime_exclusion_reason is null
        and not (image_asset.id = any(v_selected_asset_ids))
      order by
        (image_asset.id = v_last_asset_id),
        md5(
          p_business_profile_id::text
          || ':' || v_category
          || ':' || v_role
          || ':' || v_cycle::text
          || ':' || image_asset.id::text
        ),
        image_asset.id
      limit 1;
    end if;

    if v_asset.id is null then
      raise exception 'carousel_image_role_pool_cannot_complete:%:%',
        v_category,
        v_role;
    end if;

    insert into public.carousel_image_usage (
      user_id,
      business_profile_id,
      asset_id,
      duplicate_family_id,
      carousel_id,
      category_slug,
      requested_category_slug,
      primary_category_slug,
      asset_role,
      selection_type,
      relevance_level,
      relevance_reason,
      cycle_number,
      slide_number,
      usage_type,
      reuse_reason
    )
    values (
      v_user_id,
      p_business_profile_id,
      v_asset.id,
      v_asset.source_file_sha256,
      p_carousel_id,
      v_category,
      v_requested_categories[v_index],
      p_primary_category_slug,
      v_role,
      v_actual_selection_types[v_index],
      v_actual_levels[v_index],
      v_actual_reasons[v_index],
      v_cycle,
      v_index,
      'assigned',
      case when v_cycle > 1 then 'shuffle_bag_cycle' else null end
    );

    update public.carousel_image_rotation_pools as rotation_pool
    set last_asset_id = v_asset.id, updated_at = now()
    where rotation_pool.business_profile_id = p_business_profile_id
      and rotation_pool.category_slug = v_category
      and rotation_pool.asset_role = v_role;

    v_selected_asset_ids := array_append(v_selected_asset_ids, v_asset.id);
  end loop;

  update public.category_image_assets as image_asset
  set usage_count = image_asset.usage_count + 1, updated_at = now()
  where image_asset.id = any(v_selected_asset_ids);

  return query
  select
    image_usage.slide_number,
    image_asset.id,
    image_asset.library_asset_id,
    image_asset.category_slug,
    image_usage.requested_category_slug,
    image_usage.primary_category_slug,
    image_usage.asset_role,
    image_usage.selection_type,
    image_usage.relevance_level,
    image_usage.relevance_reason,
    image_usage.cycle_number,
    image_asset.base_s3_key,
    image_asset.base_url,
    image_asset.source_file_sha256
  from public.carousel_image_usage as image_usage
  join public.category_image_assets as image_asset
    on image_asset.id = image_usage.asset_id
  where image_usage.carousel_id = p_carousel_id
    and image_usage.usage_type = 'assigned'
  order by image_usage.slide_number;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."reserve_carousel_role_assets_v2"(uuid, uuid, text, jsonb, boolean) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."reserve_carousel_role_assets_v2"(uuid, uuid, text, jsonb, boolean) FROM PUBLIC;


-- source: public/functions/reserve_daily_carousel_refill_batch_if_profile_current.sql
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."reserve_daily_carousel_refill_batch_if_profile_current"(text, uuid, integer, uuid, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."reserve_daily_carousel_refill_batch_if_profile_current"(text, uuid, integer, uuid, integer) FROM PUBLIC;


-- source: public/functions/reserve_missing_initial_trending_hook_generation_chunks_v1.sql
CREATE OR REPLACE FUNCTION public.reserve_missing_initial_trending_hook_generation_chunks_v1 (
  p_limit integer DEFAULT 25
)
  RETURNS TABLE (
    run_id   uuid,
    chunk_id uuid,
    user_id  text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_run record;
  v_reserved record;
begin
  for v_run in
    select
      run.id,
      run.user_id
    from public.trending_hook_generation_runs as run
    where run.status = 'queued'
      and not exists (
        select 1
        from public.trending_hook_generation_run_chunks as chunk
        where chunk.run_id = run.id
      )
    order by run.created_at, run.id
    limit v_limit
    for update of run skip locked
  loop
    select *
    into v_reserved
    from public.reserve_trending_hook_generation_chunk_v1(v_run.id, 6);

    if v_reserved.chunk_id is not null then
      return query
      select
        v_reserved.run_id,
        v_reserved.chunk_id,
        v_run.user_id;
    end if;
  end loop;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."reserve_missing_initial_trending_hook_generation_chunks_v1"(integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."reserve_missing_initial_trending_hook_generation_chunks_v1"(integer) FROM PUBLIC;


-- source: public/functions/reserve_trending_hook_generation_chunk_v1.sql
CREATE OR REPLACE FUNCTION public.reserve_trending_hook_generation_chunk_v1 (
  p_run_id     uuid,
  p_chunk_size integer DEFAULT 6
)
  RETURNS TABLE (
    run_id                uuid,
    run_status            text,
    chunk_id              uuid,
    chunk_number          integer,
    candidate_payloads    jsonb,
    target_valid_count    integer,
    completed_valid_count integer,
    remaining_valid_count integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
declare
  v_run public.trending_hook_generation_runs%rowtype;
  v_chunk public.trending_hook_generation_run_chunks%rowtype;
  v_candidate_ids uuid[];
  v_candidate_payloads jsonb;
  v_chunk_number integer;
begin
  if p_run_id is null or coalesce(p_chunk_size, 0) not between 1 and 12 then
    raise exception 'trending_hook_generation_chunk_invalid_input';
  end if;

  select *
  into v_run
  from public.trending_hook_generation_runs as run
  where run.id = p_run_id
  for update;

  if not found then
    raise exception 'trending_hook_generation_run_not_found';
  end if;

  if v_run.status in ('completed', 'source_exhausted', 'superseded', 'failed') then
    return query
    select
      v_run.id,
      v_run.status,
      null::uuid,
      null::integer,
      '[]'::jsonb,
      v_run.target_valid_count,
      v_run.completed_valid_count,
      greatest(v_run.target_valid_count - v_run.completed_valid_count, 0);
    return;
  end if;

  select *
  into v_chunk
  from public.trending_hook_generation_run_chunks as chunk
  where chunk.run_id = v_run.id
    and chunk.status = 'reserved'
  order by chunk.chunk_number desc
  limit 1
  for update;

  if found then
    select coalesce(jsonb_agg(candidate.candidate_payload order by candidate.candidate_order), '[]'::jsonb)
    into v_candidate_payloads
    from public.trending_hook_generation_run_candidates as candidate
    where candidate.run_id = v_run.id
      and candidate.chunk_id = v_chunk.id;

    return query
    select
      v_run.id,
      v_run.status,
      v_chunk.id,
      v_chunk.chunk_number,
      v_candidate_payloads,
      v_run.target_valid_count,
      v_run.completed_valid_count,
      greatest(v_run.target_valid_count - v_run.completed_valid_count, 0);
    return;
  end if;

  select
    array_agg(candidate.id order by candidate.candidate_order),
    jsonb_agg(candidate.candidate_payload order by candidate.candidate_order)
  into v_candidate_ids, v_candidate_payloads
  from (
    select *
    from public.trending_hook_generation_run_candidates as candidate
    where candidate.run_id = v_run.id
      and candidate.state = 'pending'
    order by candidate.candidate_order
    limit p_chunk_size
    for update skip locked
  ) as candidate;

  if coalesce(array_length(v_candidate_ids, 1), 0) = 0 then
    update public.trending_hook_generation_runs
    set
      status = 'source_exhausted',
      last_error = 'No unused eligible Hook-video candidates remain for this generation run.',
      updated_at = now()
    where id = v_run.id
    returning * into v_run;

    return query
    select
      v_run.id,
      v_run.status,
      null::uuid,
      null::integer,
      '[]'::jsonb,
      v_run.target_valid_count,
      v_run.completed_valid_count,
      greatest(v_run.target_valid_count - v_run.completed_valid_count, 0);
    return;
  end if;

  select coalesce(max(chunk.chunk_number), 0) + 1
  into v_chunk_number
  from public.trending_hook_generation_run_chunks as chunk
  where chunk.run_id = v_run.id;

  insert into public.trending_hook_generation_run_chunks (
    run_id,
    chunk_number,
    candidate_count,
    status
  ) values (
    v_run.id,
    v_chunk_number,
    array_length(v_candidate_ids, 1),
    'reserved'
  )
  returning * into v_chunk;

  update public.trending_hook_generation_run_candidates
  set
    state = 'reserved',
    chunk_id = v_chunk.id,
    updated_at = now()
  where id = any(v_candidate_ids);

  update public.trending_hook_generation_runs
  set
    status = 'queued',
    last_error = null,
    updated_at = now()
  where id = v_run.id
  returning * into v_run;

  return query
  select
    v_run.id,
    v_run.status,
    v_chunk.id,
    v_chunk.chunk_number,
    v_candidate_payloads,
    v_run.target_valid_count,
    v_run.completed_valid_count,
    greatest(v_run.target_valid_count - v_run.completed_valid_count, 0);
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."reserve_trending_hook_generation_chunk_v1"(uuid, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."reserve_trending_hook_generation_chunk_v1"(uuid, integer) FROM PUBLIC;


-- source: public/functions/reserve_wall_text_generation_batch_v1.sql
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
  if jsonb_typeof(p_assignments) <> 'array'
    or assignment_count < 1
    or assignment_count > 50 then
    raise exception 'wall_text_batch_invalid_assignments';
  end if;

  select count(*) into ordinary_assignment_count
  from jsonb_array_elements(p_assignments) as item(value)
  where item.value ->> 'sourceKind' <> 'instagram_reel';

  perform 1
  from public.business_profiles as profile
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
    where item ->> 'assignedFormatId' is not null
      and item ->> 'sourceKind' <> 'instagram_reel'
    group by item ->> 'assignedFormatId'
    having count(*) > floor(ordinary_assignment_count * 0.5)
  ) then
    raise exception 'wall_text_batch_format_share_exceeded';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignments) as item(value)
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
      and (
        item.value ->> 'instagramReelTemplateId' is not null
        or item.value ->> 'instagramReelTemplateVersion' is not null
        or item.value ->> 'instagramReferenceText' is not null
        or item.value ->> 'instagramReferenceTextHash' is not null
        or item.value ->> 'instagramLockedAudioAssetId' is not null
        or item.value ->> 'instagramAudioFitMode' is not null
      )
  ) then
    raise exception 'wall_text_non_instagram_snapshot_invalid';
  end if;

  select greatest(
    coalesce((
      select max(creative.candidate_index) + 1
      from public.wall_text_creatives as creative
      where creative.user_id = p_user_id
        and creative.business_profile_id = p_business_profile_id
        and creative.business_profile_version = p_business_profile_version
    ), 0),
    coalesce((
      select max(batch.candidate_index_start + batch.requested_count)
      from public.wall_text_generation_batches as batch
      where batch.user_id = p_user_id
        and batch.business_profile_id = p_business_profile_id
        and batch.business_profile_version = p_business_profile_version
    ), 0)
  ) into candidate_start;

  -- A plan is optional during rollout. If no complete batch of ready private
  -- ideas exists, the original Wall generation path proceeds unchanged.
  select plan.id into v_content_plan_id
  from public.wall_text_content_plans as plan
  where plan.user_id = p_user_id
    and plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.status in ('generating', 'active')
    and timezone(plan.timezone, timezone('utc', now()))::date
      between plan.period_start_date and plan.period_end_date
  order by plan.plan_version desc
  limit 1
  for update;

  if found then
    select array_agg(available.id order by available.sequence_index)
    into v_plan_item_ids
    from (
      select item.id, item.sequence_index
      from public.wall_text_content_plan_items as item
      where item.plan_id = v_content_plan_id
        and item.user_id = p_user_id
        and item.status = 'available'
      order by item.sequence_index
      limit assignment_count
      for update skip locked
    ) as available;

    if coalesce(cardinality(v_plan_item_ids), 0) <> assignment_count then
      v_content_plan_id := null;
      v_plan_item_ids := null;
    end if;
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
    item.value ->> 'instagramReferenceText',
    item.value ->> 'instagramReferenceTextHash',
    item.value ->> 'instagramLockedAudioAssetId',
    item.value ->> 'instagramAudioFitMode',
    (item.value ->> 'durationSeconds')::numeric, item.value -> 'layout',
    (item.value ->> 'targetWords')::integer, (item.value ->> 'maxWords')::integer,
    coalesce(item.value -> 'focus', '{}'::jsonb), v_content_plan_id,
    planned_item.item_id
  from jsonb_array_elements(p_assignments) with ordinality as item(value, ordinality)
  join public.wall_text_generation_chunks as chunk
    on chunk.batch_id = batch_record.id
    and chunk.chunk_index = floor((item.ordinality - 1) / 10.0)::integer
  left join unnest(v_plan_item_ids) with ordinality as planned_item(item_id, item_ordinal)
    on planned_item.item_ordinal = item.ordinality;

  if v_content_plan_id is not null then
    update public.wall_text_content_plan_items as item
    set status = 'reserved', reserved_at = timezone('utc', now()), updated_at = timezone('utc', now())
    where item.plan_id = v_content_plan_id
      and item.user_id = p_user_id
      and item.id = any(v_plan_item_ids)
      and item.status = 'available';

    if (
      select count(*)
      from public.wall_text_content_plan_items as item
      where item.plan_id = v_content_plan_id
        and item.user_id = p_user_id
        and item.id = any(v_plan_item_ids)
        and item.status = 'reserved'
    ) <> assignment_count then
      raise exception 'wall_text_content_plan_reservation_incomplete';
    end if;
  end if;

  return next batch_record;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."reserve_wall_text_generation_batch_v1"(text, uuid, integer, text, text, text, text, text, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."reserve_wall_text_generation_batch_v1"(text, uuid, integer, text, text, text, text, text, text, jsonb) FROM PUBLIC;


-- source: public/functions/resolve_billing_credit_cycle.sql
CREATE OR REPLACE FUNCTION public.resolve_billing_credit_cycle (
  p_anchor timestamp with time zone,
  p_at     timestamp with time zone
)
  RETURNS TABLE (
    period_start timestamp with time zone,
    period_end   timestamp with time zone
  )
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."resolve_billing_credit_cycle"(timestamp WITH time zone, timestamp WITH time zone) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."resolve_billing_credit_cycle"(timestamp WITH time zone, timestamp WITH time zone) FROM PUBLIC;


-- source: public/functions/restart_failed_daily_trending_feed_slots.sql
CREATE OR REPLACE FUNCTION public.restart_failed_daily_trending_feed_slots (
  p_feed_id uuid,
  p_user_id text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  feed_record public.daily_trending_feeds;
  restarted_count integer := 0;
  retry_key uuid;
begin
  select *
  into feed_record
  from public.daily_trending_feeds as feed
  where feed.id = p_feed_id
    and feed.user_id = p_user_id
  for update;

  if feed_record.id is null then
    raise exception 'daily_trending_feed_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(feed_record.user_id || ':' || feed_record.local_date::text, 0)
  );

  update public.daily_trending_feed_slots as slot
  set state = 'planned', updated_at = now()
  where slot.feed_id = p_feed_id
    and slot.state = 'failed'
    and slot.carousel_assignment_id is null
    and slot.hook_video_assignment_id is null
    and slot.wall_text_assignment_id is null;

  get diagnostics restarted_count = row_count;

  if restarted_count = 0 then
    return null;
  end if;

  retry_key := gen_random_uuid();

  update public.daily_trending_feeds
  set
    status = 'preparing',
    last_error = null,
    wall_text_retry_key = retry_key,
    updated_at = now()
  where id = p_feed_id;

  return retry_key;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."restart_failed_daily_trending_feed_slots"(uuid, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."restart_failed_daily_trending_feed_slots"(uuid, text) FROM PUBLIC;


-- source: public/functions/retry_background_job.sql
CREATE OR REPLACE FUNCTION public.retry_background_job (
  p_job_id  uuid,
  p_user_id text
)
  RETURNS SETOF public.background_jobs
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_current public.background_jobs%rowtype;
  v_now timestamptz := now();
begin
  select job.*
  into v_current
  from public.background_jobs as job
  where job.id = p_job_id
    and job.user_id = p_user_id
  for update;

  if not found then
    return;
  end if;

  if v_current.status not in ('failed', 'stalled') then
    raise exception 'background job is not retryable';
  end if;

  if v_current.attempt_count >= v_current.max_attempts then
    raise exception 'background job maximum attempts exceeded';
  end if;

  update public.background_jobs as job
  set
    status = 'queued',
    stage = 'queued',
    progress = null,
    error_code = null,
    error_message = null,
    failed_at = null,
    completed_at = null,
    cancel_requested_at = null,
    queued_at = v_now,
    next_attempt_at = null,
    queue_message_id = null,
    last_delivery_at = null,
    last_heartbeat_at = null,
    locked_at = null,
    claim_token = null,
    worker_id = null,
    worker_execution_id = null,
    updated_at = v_now
  where job.id = p_job_id;

  perform public.append_background_job_event(
    p_job_id,
    'job_retried',
    jsonb_build_object('attemptCount', v_current.attempt_count)
  );

  return query
  select job.* from public.background_jobs as job where job.id = p_job_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."retry_background_job"(uuid, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."retry_background_job"(uuid, text) FROM PUBLIC;


-- source: public/functions/retry_social_publish_target.sql
CREATE OR REPLACE FUNCTION public.retry_social_publish_target (
  p_post_id   uuid,
  p_target_id uuid,
  p_user_id   text
)
  RETURNS TABLE (
    outcome text,
    job_id  uuid
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_active_job_id uuid;
  v_active_job_status text;
  v_connection_id uuid;
  v_last_error_code text;
  v_library_item_id uuid;
  v_media_asset_id uuid;
  v_now timestamptz := now();
  v_operation_post_id text;
  v_operation_post_url text;
  v_operation_published_at timestamptz;
  v_platform text;
  v_post_status text;
  v_source_kind text;
  v_previous_job_id uuid;
  v_project_id text;
  v_target_status text;
begin
  select
    post.status,
    post.project_id,
    post.media_asset_id,
    post.library_item_id,
    post.source_kind
  into
    v_post_status,
    v_project_id,
    v_media_asset_id,
    v_library_item_id,
    v_source_kind
  from public.scheduled_posts as post
  where post.id = p_post_id
    and post.user_id = p_user_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;

  select
    target.status,
    target.platform,
    target.social_connection_id,
    target.last_error_code,
    target.publish_job_id
  into
    v_target_status,
    v_platform,
    v_connection_id,
    v_last_error_code,
    v_previous_job_id
  from public.scheduled_post_targets as target
  where target.id = p_target_id
    and target.scheduled_post_id = p_post_id
    and target.user_id = p_user_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;

  if v_post_status = 'cancelled' or v_target_status = 'cancelled' then
    return query select 'cancelled'::text, null::uuid;
    return;
  end if;

  select
    operation.platform_post_id,
    operation.platform_post_url,
    operation.published_at
  into
    v_operation_post_id,
    v_operation_post_url,
    v_operation_published_at
  from public.social_publish_operations as operation
  where operation.scheduled_post_target_id = p_target_id
    and operation.user_id = p_user_id
    and operation.status = 'published'
    and operation.platform_post_id is not null
  limit 1;

  if v_operation_post_id is not null then
    update public.scheduled_post_targets as target
    set
      last_error_code = null,
      last_error_message = null,
      last_reconciled_at = v_now,
      next_retry_at = null,
      platform_post_id = v_operation_post_id,
      platform_post_url = v_operation_post_url,
      published_at = coalesce(v_operation_published_at, v_now),
      status = 'published',
      updated_at = v_now
    where target.id = p_target_id
      and target.user_id = p_user_id;

    update public.scheduled_posts as post
    set
      last_error_code = (
        select sibling.last_error_code
        from public.scheduled_post_targets as sibling
        where sibling.scheduled_post_id = post.id
          and sibling.status in ('failed', 'action_required')
        order by sibling.updated_at desc
        limit 1
      ),
      published_at = case
        when not exists (
          select 1
          from public.scheduled_post_targets as sibling
          where sibling.scheduled_post_id = post.id
            and sibling.status <> 'published'
        ) then coalesce(post.published_at, v_now)
        else post.published_at
      end,
      status = case
        when not exists (
          select 1
          from public.scheduled_post_targets as sibling
          where sibling.scheduled_post_id = post.id
            and sibling.status <> 'published'
        ) then 'published'
        when exists (
          select 1
          from public.scheduled_post_targets as sibling
          where sibling.scheduled_post_id = post.id
            and sibling.status in (
              'failed',
              'action_required',
              'cancelled',
              'skipped'
            )
        ) then 'partially_failed'
        when exists (
          select 1
          from public.scheduled_post_targets as sibling
          where sibling.scheduled_post_id = post.id
            and sibling.status = 'publishing'
        ) then 'publishing'
        else 'scheduled'
      end,
      updated_at = v_now
    where post.id = p_post_id
      and post.user_id = p_user_id;

    return query select 'already_published'::text, v_previous_job_id;
    return;
  end if;

  if v_target_status = 'published' then
    return query select 'already_published'::text, v_previous_job_id;
    return;
  end if;

  if v_target_status = 'action_required' then
    return query select 'action_required'::text, null::uuid;
    return;
  end if;

  if v_target_status in ('scheduled', 'scheduling', 'publishing', 'failed') then
    select job.id, job.status
    into v_active_job_id, v_active_job_status
    from public.background_jobs as job
    where job.user_id = p_user_id
      and job.job_type = 'publish_social_post'
      and job.status in ('queued', 'processing')
      and (
        job.id = v_previous_job_id
        or job.input_json ->> 'targetId' = p_target_id::text
      )
    order by
      case when job.id = v_previous_job_id then 0 else 1 end,
      job.created_at desc
    limit 1
    for update;
  end if;

  if v_active_job_id is not null then
    update public.scheduled_post_targets as target
    set
      last_error_code = null,
      last_error_message = null,
      next_retry_at = null,
      publish_job_id = v_active_job_id,
      status = case
        when v_active_job_status = 'processing' then 'publishing'
        else 'scheduled'
      end,
      updated_at = v_now
    where target.id = p_target_id
      and target.user_id = p_user_id;

    update public.scheduled_posts as post
    set
      last_error_code = (
        select sibling.last_error_code
        from public.scheduled_post_targets as sibling
        where sibling.scheduled_post_id = post.id
          and sibling.status in ('failed', 'action_required')
        order by sibling.updated_at desc
        limit 1
      ),
      status = case
        when exists (
          select 1
          from public.scheduled_post_targets as sibling
          where sibling.scheduled_post_id = post.id
            and sibling.status in ('failed', 'action_required')
        ) then 'partially_failed'
        when v_active_job_status = 'processing' then 'publishing'
        else 'scheduled'
      end,
      updated_at = v_now
    where post.id = p_post_id
      and post.user_id = p_user_id
      and post.status <> 'cancelled';

    return query select 'already_queued'::text, v_active_job_id;
    return;
  end if;

  if v_target_status <> 'failed' or v_post_status = 'published' then
    return query select 'not_retryable'::text, null::uuid;
    return;
  end if;

  if v_last_error_code = 'scheduler_create_failed' then
    return query select 'scheduling_retry_required'::text, null::uuid;
    return;
  end if;

  if v_previous_job_id is null then
    return query select 'not_retryable'::text, null::uuid;
    return;
  end if;

  if v_source_kind = 'library_item' then
    if v_platform not in ('instagram', 'tiktok') or not exists (
      select 1
      from public.library_items as item
      where item.id = v_library_item_id
        and item.user_id = p_user_id
        and item.source_type = 'generated_carousel'
        and item.media_type = 'carousel'
        and item.status = 'ready'
        and item.deleted_at is null
        and (
          select count(*)
          from public.library_carousel_slides as slide
          where slide.library_item_id = item.id
            and slide.rendered_url like 'https://%'
        ) between 2 and case when v_platform = 'instagram' then 10 else 35 end
        and not exists (
          select 1
          from public.library_carousel_slides as slide
          where slide.library_item_id = item.id
            and slide.rendered_url not like 'https://%'
        )
    ) then
      return query select 'media_unavailable'::text, null::uuid;
      return;
    end if;
  elsif not exists (
    select 1
    from public.media_assets as media
    where media.id = v_media_asset_id
      and media.user_id = p_user_id
      and media.status = 'ready'
      and media.collection = 'video'
      and media.source_type in (
        'combined_render',
        'demo_upload',
        'upload',
        'generated_video',
        'edit_export'
      )
  ) then
    return query select 'media_unavailable'::text, null::uuid;
    return;
  end if;

  if not exists (
    select 1
    from public.social_connections as connection
    where connection.id = v_connection_id
      and connection.user_id = p_user_id
      and connection.platform = v_platform
      and connection.status = 'connected'
      and connection.revoked_at is null
      and (
        connection.expires_at is null
        or connection.expires_at > v_now
        or (
          v_platform in ('tiktok', 'youtube')
          and connection.refresh_token_ciphertext is not null
          and (
            connection.refresh_expires_at is null
            or connection.refresh_expires_at > v_now
          )
        )
      )
  ) then
    return query select 'connection_unavailable'::text, null::uuid;
    return;
  end if;

  insert into public.background_jobs (
    input_json,
    job_type,
    next_attempt_at,
    project_id,
    queue_name,
    status,
    updated_at,
    user_id
  ) values (
    jsonb_build_object('targetId', p_target_id::text),
    'publish_social_post',
    v_now,
    v_project_id,
    'social-publish',
    'queued',
    v_now,
    p_user_id
  )
  returning id into v_active_job_id;

  update public.scheduled_post_targets as target
  set
    last_error_code = null,
    last_error_message = null,
    last_reconciled_at = v_now,
    next_retry_at = null,
    publish_job_id = v_active_job_id,
    scheduled_for = v_now,
    status = 'scheduled',
    updated_at = v_now
  where target.id = p_target_id
    and target.user_id = p_user_id;

  update public.scheduled_posts as post
  set
    last_error_code = (
      select sibling.last_error_code
      from public.scheduled_post_targets as sibling
      where sibling.scheduled_post_id = post.id
        and sibling.status in ('failed', 'action_required')
      order by sibling.updated_at desc
      limit 1
    ),
    status = case
      when exists (
        select 1
        from public.scheduled_post_targets as sibling
        where sibling.scheduled_post_id = post.id
          and sibling.status in ('failed', 'action_required')
      ) then 'partially_failed'
      else 'scheduled'
    end,
    updated_at = v_now
  where post.id = p_post_id
    and post.user_id = p_user_id
    and post.status <> 'cancelled';

  return query select 'retry_created'::text, v_active_job_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."retry_social_publish_target"(uuid, uuid, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."retry_social_publish_target"(uuid, uuid, text) FROM PUBLIC;


-- source: public/functions/revoke_social_connection.sql
CREATE OR REPLACE FUNCTION public.revoke_social_connection (
  p_connection_id uuid,
  p_user_id       text,
  p_revoked_at    timestamp with time zone
)
  RETURNS SETOF public.social_connections
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_post_ids uuid[] := '{}'::uuid[];
begin
  update public.social_connections as connection
  set
    revoked_at = p_revoked_at,
    status = 'revoked',
    token_refresh_claim_token = null,
    token_refresh_claimed_at = null,
    updated_at = p_revoked_at
  where connection.id = p_connection_id
    and connection.user_id = p_user_id
    and connection.revoked_at is null;

  with updated_targets as (
    update public.scheduled_post_targets as target
    set
      last_error_code = 'social_connection_revoked',
      last_error_message = 'Reconnect this account before publishing this post.',
      next_retry_at = null,
      status = 'action_required',
      updated_at = p_revoked_at
    where target.social_connection_id = p_connection_id
      and target.user_id = p_user_id
      and target.status in ('draft', 'scheduling', 'scheduled', 'publishing')
    returning target.scheduled_post_id
  )
  select coalesce(array_agg(distinct scheduled_post_id), '{}'::uuid[])
  into v_post_ids
  from updated_targets;

  update public.scheduled_posts as post
  set
    last_error_code = 'social_connection_revoked',
    status = case
      when exists (
        select 1
        from public.scheduled_post_targets as sibling
        where sibling.scheduled_post_id = post.id
          and sibling.status in (
            'draft',
            'scheduling',
            'scheduled',
            'publishing',
            'published'
          )
      ) then 'partially_failed'
      else 'failed'
    end,
    updated_at = p_revoked_at
  where post.id = any(v_post_ids)
    and post.user_id = p_user_id
    and post.status not in ('cancelled', 'published');

  return query
  select connection.*
  from public.social_connections as connection
  where connection.id = p_connection_id
    and connection.user_id = p_user_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."revoke_social_connection"(uuid, text, timestamp WITH time zone) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."revoke_social_connection"(uuid, text, timestamp WITH time zone) FROM PUBLIC;


-- source: public/functions/save_generated_carousel_library_item.sql
CREATE OR REPLACE FUNCTION public.save_generated_carousel_library_item (
  p_user_id       text,
  p_project_id    text,
  p_source_id     text,
  p_title         text,
  p_cover_url     text,
  p_thumbnail_url text,
  p_metadata      jsonb,
  p_slides        jsonb
)
  RETURNS TABLE (
    item_id uuid,
    created boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_item_id uuid;
  v_slide jsonb;
  v_created boolean := false;
begin
  select item.id
  into v_item_id
  from public.library_items as item
  where item.user_id = p_user_id
    and item.source_type = 'generated_carousel'
    and item.source_id = p_source_id
    and item.deleted_at is null
  limit 1
  for update;

  if v_item_id is null then
    insert into public.library_items (
      user_id,
      project_id,
      source_type,
      source_id,
      media_type,
      title,
      cover_url,
      thumbnail_url,
      metadata
    )
    values (
      p_user_id,
      p_project_id,
      'generated_carousel',
      p_source_id,
      'carousel',
      p_title,
      p_cover_url,
      p_thumbnail_url,
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into v_item_id;

    v_created := true;
  else
    update public.library_items
    set
      cover_url = p_cover_url,
      metadata = coalesce(p_metadata, '{}'::jsonb),
      project_id = p_project_id,
      status = 'ready',
      thumbnail_url = p_thumbnail_url,
      title = p_title,
      updated_at = now()
    where id = v_item_id;

    delete from public.library_carousel_slides
    where library_item_id = v_item_id;
  end if;

  for v_slide in
    select value
    from jsonb_array_elements(coalesce(p_slides, '[]'::jsonb))
  loop
    insert into public.library_carousel_slides (
      library_item_id,
      carousel_generation_id,
      carousel_slide_id,
      slide_number,
      slide_type,
      headline,
      subtext,
      rendered_url,
      rendered_s3_key,
      metadata
    )
    values (
      v_item_id,
      (v_slide ->> 'carouselGenerationId')::uuid,
      nullif(v_slide ->> 'carouselSlideId', '')::uuid,
      (v_slide ->> 'slideNumber')::integer,
      nullif(v_slide ->> 'slideType', ''),
      nullif(v_slide ->> 'headline', ''),
      nullif(v_slide ->> 'subtext', ''),
      v_slide ->> 'renderedUrl',
      nullif(v_slide ->> 'renderedS3Key', ''),
      coalesce(v_slide -> 'metadata', '{}'::jsonb)
    );
  end loop;

  return query select v_item_id, v_created;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."save_generated_carousel_library_item"(text, text, text, text, text, text, jsonb, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."save_generated_carousel_library_item"(text, text, text, text, text, text, jsonb, jsonb) FROM PUBLIC;


-- source: public/functions/save_trending_content_mix_preference.sql
CREATE OR REPLACE FUNCTION public.save_trending_content_mix_preference (
  p_user_id            text,
  p_carousel_percent   integer,
  p_wall_text_percent  integer,
  p_hook_video_percent integer
)
  RETURNS integer
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
declare
  resolved_version integer;
begin
  if p_user_id is null or char_length(trim(p_user_id)) = 0 then
    raise exception 'invalid_trending_mix_user';
  end if;

  if p_carousel_percent + p_wall_text_percent + p_hook_video_percent <> 100
    or p_carousel_percent not between 0 and 100
    or p_wall_text_percent not between 0 and 100
    or p_hook_video_percent not between 0 and 100
  then
    raise exception 'invalid_trending_content_mix';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('trending-mix:' || p_user_id, 0));

  insert into public.trending_content_mix_preferences (
    user_id,
    carousel_percent,
    wall_text_percent,
    hook_video_percent,
    preference_version,
    updated_at
  )
  values (
    p_user_id,
    p_carousel_percent,
    p_wall_text_percent,
    p_hook_video_percent,
    1,
    now()
  )
  on conflict (user_id) do update
  set
    carousel_percent = excluded.carousel_percent,
    wall_text_percent = excluded.wall_text_percent,
    hook_video_percent = excluded.hook_video_percent,
    preference_version = public.trending_content_mix_preferences.preference_version + 1,
    updated_at = now()
  returning preference_version into resolved_version;

  return resolved_version;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."save_trending_content_mix_preference"(text, integer, integer, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."save_trending_content_mix_preference"(text, integer, integer, integer) FROM PUBLIC;


-- source: public/functions/save_wall_text_audio_selection.sql
CREATE OR REPLACE FUNCTION public.save_wall_text_audio_selection (
  p_user_id                 text,
  p_wall_text_creative_id   uuid,
  p_creative_edit_id        uuid,
  p_creative_edit_revision  integer,
  p_content_fingerprint     text,
  p_video_duration_seconds  numeric,
  p_audio_asset_id          text,
  p_audio_intent            jsonb,
  p_fit_mode                text,
  p_cue_start_seconds       numeric,
  p_output_duration_seconds numeric,
  p_fade_out_seconds        numeric,
  p_match_score             numeric,
  p_matching_version        text
)
  RETURNS SETOF public.wall_text_audio_selections
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if p_creative_edit_id is null then
    return query
    insert into public.wall_text_audio_selections (
      user_id,
      wall_text_creative_id,
      creative_edit_id,
      creative_edit_revision,
      content_fingerprint,
      video_duration_seconds,
      audio_asset_id,
      audio_intent,
      fit_mode,
      cue_start_seconds,
      output_duration_seconds,
      fade_out_seconds,
      match_score,
      matching_version
    )
    values (
      p_user_id,
      p_wall_text_creative_id,
      null,
      null,
      p_content_fingerprint,
      p_video_duration_seconds,
      p_audio_asset_id,
      p_audio_intent,
      p_fit_mode,
      p_cue_start_seconds,
      p_output_duration_seconds,
      p_fade_out_seconds,
      p_match_score,
      p_matching_version
    )
    on conflict (user_id, wall_text_creative_id)
      where creative_edit_id is null
    do update set
      content_fingerprint = excluded.content_fingerprint,
      video_duration_seconds = excluded.video_duration_seconds,
      audio_asset_id = excluded.audio_asset_id,
      audio_intent = excluded.audio_intent,
      fit_mode = excluded.fit_mode,
      cue_start_seconds = excluded.cue_start_seconds,
      output_duration_seconds = excluded.output_duration_seconds,
      fade_out_seconds = excluded.fade_out_seconds,
      match_score = excluded.match_score,
      matching_version = excluded.matching_version,
      updated_at = now()
    returning *;
  else
    return query
    insert into public.wall_text_audio_selections (
      user_id,
      wall_text_creative_id,
      creative_edit_id,
      creative_edit_revision,
      content_fingerprint,
      video_duration_seconds,
      audio_asset_id,
      audio_intent,
      fit_mode,
      cue_start_seconds,
      output_duration_seconds,
      fade_out_seconds,
      match_score,
      matching_version
    )
    values (
      p_user_id,
      p_wall_text_creative_id,
      p_creative_edit_id,
      p_creative_edit_revision,
      p_content_fingerprint,
      p_video_duration_seconds,
      p_audio_asset_id,
      p_audio_intent,
      p_fit_mode,
      p_cue_start_seconds,
      p_output_duration_seconds,
      p_fade_out_seconds,
      p_match_score,
      p_matching_version
    )
    on conflict (user_id, creative_edit_id, creative_edit_revision)
      where creative_edit_id is not null
    do update set
      wall_text_creative_id = excluded.wall_text_creative_id,
      content_fingerprint = excluded.content_fingerprint,
      video_duration_seconds = excluded.video_duration_seconds,
      audio_asset_id = excluded.audio_asset_id,
      audio_intent = excluded.audio_intent,
      fit_mode = excluded.fit_mode,
      cue_start_seconds = excluded.cue_start_seconds,
      output_duration_seconds = excluded.output_duration_seconds,
      fade_out_seconds = excluded.fade_out_seconds,
      match_score = excluded.match_score,
      matching_version = excluded.matching_version,
      updated_at = now()
    returning *;
  end if;
end;
$function$;

GRANT EXECUTE
  ON FUNCTION "public"."save_wall_text_audio_selection"(text, uuid, uuid, integer, text, numeric, text, jsonb, text, numeric, numeric, numeric, numeric, text)
  TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."save_wall_text_audio_selection"(text, uuid, uuid, integer, text, numeric, text, jsonb, text, numeric, numeric, numeric, numeric, text) FROM PUBLIC;


-- source: public/functions/save_wall_text_edit_with_history_v1.sql
CREATE OR REPLACE FUNCTION public.save_wall_text_edit_with_history_v1 (
  p_user_id                 text,
  p_assignment_id           uuid,
  p_creative_id             uuid,
  p_expected_revision       integer,
  p_content_json            jsonb,
  p_position_json           jsonb,
  p_source_selection_kind   text,
  p_source_group_id         uuid,
  p_source_media_asset_id   uuid,
  p_resolved_media_asset_id uuid,
  p_edit_classification     text,
  p_normalized_text         text,
  p_content_hash            text,
  p_similarity_signature    jsonb
)
  RETURNS SETOF public.trending_creative_edits
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  existing_edit public.trending_creative_edits;
  saved_edit public.trending_creative_edits;
  creative_record public.wall_text_creatives;
  next_revision integer;
  original_format_id text;
  learning_eligible boolean;
begin
  if p_edit_classification not in ('none', 'minor', 'major') then
    raise exception 'wall_text_edit_classification_invalid';
  end if;

  select creative.* into creative_record
  from public.wall_text_creatives as creative
  join public.user_wall_text_assignments as assignment
    on assignment.wall_text_creative_id = creative.id
  where creative.id = p_creative_id
    and creative.user_id = p_user_id
    and assignment.id = p_assignment_id
    and assignment.user_id = p_user_id
  for update of creative;
  if not found then
    raise exception 'wall_text_edit_unavailable';
  end if;

  select edit.* into existing_edit
  from public.trending_creative_edits as edit
  where edit.user_id = p_user_id
    and edit.format = 'wall_text'
    and edit.creative_id = p_creative_id
  for update;

  if coalesce(existing_edit.revision, 0) <> p_expected_revision then
    raise exception 'wall_text_edit_revision_conflict';
  end if;
  next_revision := coalesce(existing_edit.revision, 0) + 1;
  original_format_id := creative_record.text_content ->> 'formatId';
  learning_eligible :=
    p_edit_classification in ('none', 'minor')
    and original_format_id is not null
    and creative_record.source_kind <> 'instagram_reel';

  if existing_edit.id is null then
    insert into public.trending_creative_edits (
      user_id, assignment_id, creative_id, format, revision, content_json,
      position_json, source_selection_kind, source_group_id,
      source_media_asset_id, resolved_media_asset_id, render_status,
      wall_text_edit_classification, wall_text_format_learning_eligible,
      wall_text_content_hash
    ) values (
      p_user_id, p_assignment_id, p_creative_id, 'wall_text', next_revision,
      p_content_json, p_position_json, p_source_selection_kind,
      p_source_group_id, p_source_media_asset_id, p_resolved_media_asset_id,
      'draft', p_edit_classification, learning_eligible, p_content_hash
    ) returning * into saved_edit;
  else
    update public.trending_creative_edits
    set
      assignment_id = p_assignment_id,
      revision = next_revision,
      content_json = p_content_json,
      position_json = p_position_json,
      source_selection_kind = p_source_selection_kind,
      source_group_id = p_source_group_id,
      source_media_asset_id = p_source_media_asset_id,
      resolved_media_asset_id = p_resolved_media_asset_id,
      render_status = 'draft',
      render_job_id = null,
      render_output_json = null,
      render_error = null,
      wall_text_edit_classification = p_edit_classification,
      wall_text_format_learning_eligible = learning_eligible,
      wall_text_content_hash = p_content_hash,
      updated_at = now()
    where id = existing_edit.id
    returning * into saved_edit;
  end if;

  insert into public.wall_text_content_history (
    user_id, business_profile_id, wall_text_creative_id, creative_edit_id,
    creative_edit_revision, normalized_text, content_hash,
    normalization_version, similarity_signature, similarity_version,
    format_id, format_version, format_attribution, performance_eligible,
    performance_exclusion_reason
  ) values (
    p_user_id, creative_record.business_profile_id, p_creative_id,
    saved_edit.id, saved_edit.revision, p_normalized_text, p_content_hash,
    'wall-text-normalization-v1', p_similarity_signature,
    'wall-text-duplicate-signature-v1', original_format_id, 1,
    case when p_edit_classification = 'major'
      then 'major_edit' else 'minor_edit' end,
    learning_eligible,
    case when learning_eligible then null
      else 'manual_edit_changed_format_or_template' end
  )
  on conflict (user_id, business_profile_id, content_hash) do nothing;

  return next saved_edit;
end;
$function$;

GRANT EXECUTE
  ON FUNCTION "public"."save_wall_text_edit_with_history_v1"(text, uuid, uuid, integer, jsonb, jsonb, text, uuid, uuid, uuid, text, text, text, jsonb)
  TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."save_wall_text_edit_with_history_v1"(text, uuid, uuid, integer, jsonb, jsonb, text, uuid, uuid, uuid, text, text, text, jsonb) FROM PUBLIC;


-- source: public/functions/save_wall_text_generation_candidate_v1.sql
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
    update public.wall_text_content_plan_items as item
    set status = 'consumed', consumed_at = timezone('utc', now()), updated_at = timezone('utc', now())
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
      wall_text_creative_id = saved_creative.id, updated_at = timezone('utc', now())
  where id = assignment_record.id;

  if not exists (
    select 1 from public.wall_text_generation_assignments as pending
    where pending.chunk_id = assignment_record.chunk_id and pending.status <> 'completed'
  ) then
    update public.wall_text_generation_chunks
    set status = 'completed', claim_token = null, locked_at = null,
        completed_at = timezone('utc', now()), updated_at = timezone('utc', now())
    where id = assignment_record.chunk_id;
  end if;

  if not exists (
    select 1 from public.wall_text_generation_assignments as pending
    where pending.batch_id = assignment_record.batch_id and pending.status <> 'completed'
  ) then
    update public.wall_text_generation_batches
    set status = 'completed', completed_at = timezone('utc', now()), updated_at = timezone('utc', now())
    where id = assignment_record.batch_id;
  else
    update public.wall_text_generation_batches
    set status = 'processing', updated_at = timezone('utc', now())
    where id = assignment_record.batch_id and status = 'pending';
  end if;

  return next saved_creative;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."save_wall_text_generation_candidate_v1"(text, uuid, uuid, uuid, text, jsonb, jsonb, text, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."save_wall_text_generation_candidate_v1"(text, uuid, uuid, uuid, text, jsonb, jsonb, text, text, jsonb) FROM PUBLIC;


-- source: public/functions/set_carousel_structure_mode.sql
CREATE OR REPLACE FUNCTION public.set_carousel_structure_mode (
  p_structure_mode     text,
  p_updated_by_user_id text
)
  RETURNS SETOF public.carousel_global_settings
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if p_structure_mode not in (
       'rotate',
       'structure_1_only',
       'structure_2_only'
     )
     or nullif(trim(coalesce(p_updated_by_user_id, '')), '') is null then
    raise exception 'carousel_admin_structure_mode_input_invalid';
  end if;

  update public.carousel_global_settings as settings
  set
    structure_mode = p_structure_mode,
    structure_config_version = settings.structure_config_version + 1,
    updated_by_user_id = trim(p_updated_by_user_id),
    updated_at = timezone('utc', now())
  where settings.singleton = true
    and settings.structure_mode is distinct from p_structure_mode;

  return query
  select settings.*
  from public.carousel_global_settings as settings
  where settings.singleton = true;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."set_carousel_structure_mode"(text, text) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."set_carousel_structure_mode"(text, text) IS 'Service-only, idempotent owner control for future five-Carousel batch routing. Changing the mode increments the configuration version; choosing the current mode leaves it unchanged.';

REVOKE ALL ON FUNCTION "public"."set_carousel_structure_mode"(text, text) FROM PUBLIC;


-- source: public/functions/settle_billing_credit_reservation.sql
CREATE OR REPLACE FUNCTION public.settle_billing_credit_reservation (
  p_user_id           text,
  p_idempotency_key   text,
  p_background_job_id uuid,
  p_commit            boolean
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."settle_billing_credit_reservation"(text, text, uuid, boolean) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."settle_billing_credit_reservation"(text, text, uuid, boolean) FROM PUBLIC;


-- source: public/functions/take_over_carousel_experiment_batch_with_structure_2.sql
CREATE OR REPLACE FUNCTION public.take_over_carousel_experiment_batch_with_structure_2 (
  p_experiment_batch_id    uuid,
  p_failure_reason         text,
  p_planning_attempt_count integer
)
  RETURNS SETOF public.carousel_experiment_batches
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_assignment_count integer;
  v_batch public.carousel_experiment_batches%rowtype;
  v_format_ids text[] := array[
    'wrong_belief',
    'perfect_plan_breaks',
    'stopped_behavior',
    'terrible_at',
    'result_without_sacrifice',
    'identity_transformation',
    'new_rule',
    'wrong_villain'
  ];
  v_generation_count integer;
  v_history_snapshot jsonb;
  v_next_structure_sequence integer;
begin
  if p_experiment_batch_id is null
     or p_planning_attempt_count <> 2
     or nullif(trim(coalesce(p_failure_reason, '')), '') is null then
    raise exception 'carousel_structure_takeover_input_invalid';
  end if;

  select batch.*
  into v_batch
  from public.carousel_experiment_batches as batch
  where batch.id = p_experiment_batch_id;

  if not found then
    raise exception 'carousel_structure_takeover_batch_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_batch.business_profile_id::text, 246813579)
  );

  select batch.*
  into v_batch
  from public.carousel_experiment_batches as batch
  where batch.id = p_experiment_batch_id
  for update;

  if v_batch.structure_resolution_mode = 'planning_fallback'
     and v_batch.requested_structure_id = 'structure_1'
     and v_batch.structure_id = 'structure_2' then
    return query
    select batch.*
    from public.carousel_experiment_batches as batch
    where batch.id = p_experiment_batch_id;
    return;
  end if;

  if v_batch.structure_resolution_mode <> 'requested'
     or v_batch.requested_structure_id <> 'structure_1'
     or v_batch.structure_id <> 'structure_1'
     or v_batch.requested_carousel_count <> 5
     or v_batch.status not in ('reserved', 'queued', 'processing', 'failed') then
    raise exception 'carousel_structure_takeover_batch_not_eligible';
  end if;

  select count(*)::integer
  into v_generation_count
  from public.carousel_generations as generation
  where generation.carousel_experiment_batch_id = p_experiment_batch_id;

  select count(*)::integer
  into v_assignment_count
  from public.carousel_experiment_assignments as assignment
  where assignment.experiment_batch_id = p_experiment_batch_id;

  if v_generation_count <> 5
     or v_assignment_count <> 5
     or exists (
       select 1
       from public.carousel_generations as generation
       where generation.carousel_experiment_batch_id = p_experiment_batch_id
         and (
           generation.status = 'completed'
           or generation.content_plan_normalized is not null
           or generation.carousel_experiment_assignment_id is null
           or not exists (
             select 1
             from public.carousel_experiment_assignments as assignment
             where assignment.id = generation.carousel_experiment_assignment_id
               and assignment.experiment_batch_id = p_experiment_batch_id
               and assignment.carousel_generation_id = generation.id
           )
         )
     )
     or exists (
       select 1
       from public.carousel_slides as slide
       join public.carousel_generations as generation
         on generation.id = slide.carousel_generation_id
       where generation.carousel_experiment_batch_id = p_experiment_batch_id
     )
     or exists (
       select 1
       from public.carousel_performance_observations as observation
       join public.carousel_generations as generation
         on generation.id = observation.carousel_generation_id
       where generation.carousel_experiment_batch_id = p_experiment_batch_id
     ) then
    raise exception 'carousel_structure_takeover_batch_has_generation_output';
  end if;

  select coalesce(jsonb_agg(history.history_summary), '[]'::jsonb)
  into v_history_snapshot
  from (
    select generation.content_plan_normalized -> 'historySummary'
      as history_summary
    from public.carousel_generations as generation
    where generation.business_profile_id = v_batch.business_profile_id
      and generation.structure_id = 'structure_2'
      and generation.status = 'completed'
      and generation.generation_batch_id <> v_batch.generation_batch_id
      and jsonb_typeof(generation.content_plan_normalized -> 'historySummary') = 'object'
    order by generation.created_at desc, generation.candidate_index desc
    limit 10
  ) as history;

  select coalesce(max(batch.structure_batch_sequence), -1) + 1
  into v_next_structure_sequence
  from public.carousel_experiment_batches as batch
  where batch.business_profile_id = v_batch.business_profile_id
    and batch.structure_id = 'structure_2';

  perform set_config(
    'app.carousel_structure_takeover_batch_id',
    p_experiment_batch_id::text,
    true
  );

  update public.carousel_experiment_assignments as assignment
  set
    assigned_format_id = v_format_ids[
      ((v_next_structure_sequence * 5 + assignment.slot_index) % 8) + 1
    ],
    actual_format_id = v_format_ids[
      ((v_next_structure_sequence * 5 + assignment.slot_index) % 8) + 1
    ],
    format_version = 1,
    hook_family_id = null,
    replacement_for_format_id = null,
    status = 'queued',
    rotation_candidate_format_id = v_format_ids[
      ((v_next_structure_sequence * 5 + assignment.slot_index) % 8) + 1
    ],
    format_selection_mode = 'controlled_rotation',
    format_selection_multiplier = 1,
    hook_selection_mode = null,
    hook_selection_multiplier = null,
    structure_id = 'structure_2',
    structure_version = 1,
    updated_at = timezone('utc', now())
  where assignment.experiment_batch_id = p_experiment_batch_id;

  update public.carousel_generations as generation
  set
    content_angle = null,
    content_assigned_format_id = assignment.assigned_format_id,
    content_audience_id = null,
    content_format_id = assignment.actual_format_id,
    content_format_version = assignment.format_version,
    content_goal_id = null,
    content_grammar_version = 'carousel-structure-2-formats-v1',
    content_history_snapshot = v_history_snapshot,
    content_plan_fallback_reason = null,
    content_plan_normalized = null,
    content_plan_raw_response = null,
    content_plan_source = null,
    content_plan_validation = null,
    content_planner_model = null,
    content_planner_version = null,
    content_problem_id = null,
    content_selector_version = 'carousel-structure-2-selector-v1-eight-format-rotation',
    content_topic = null,
    content_topic_id = null,
    error_message = null,
    hook_family_id = null,
    renderer_version = null,
    status = 'processing',
    structure_id = 'structure_2',
    structure_version = 1,
    updated_at = timezone('utc', now())
  from public.carousel_experiment_assignments as assignment
  where generation.carousel_experiment_batch_id = p_experiment_batch_id
    and assignment.id = generation.carousel_experiment_assignment_id
    and assignment.experiment_batch_id = p_experiment_batch_id;

  update public.carousel_experiment_batches
  set
    cycle_number = null,
    cycle_batch_position = null,
    status = 'processing',
    structure_id = 'structure_2',
    structure_version = 1,
    structure_batch_sequence = v_next_structure_sequence,
    structure_resolution_mode = 'planning_fallback',
    structure_planning_attempt_count = 2,
    structure_fallback_reason = left(trim(p_failure_reason), 1000),
    structure_resolved_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = p_experiment_batch_id;

  return query
  select batch.*
  from public.carousel_experiment_batches as batch
  where batch.id = p_experiment_batch_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."take_over_carousel_experiment_batch_with_structure_2"(uuid, text, integer) TO "postgres", "service_role";

COMMENT ON FUNCTION "public"."take_over_carousel_experiment_batch_with_structure_2"(uuid, text, integer) IS 'Idempotently resolves one untouched five-item Structure 1 batch to Structure 2 after exactly two failed planning attempts. It preserves the original global rotation slot and atomically advances only Structure 2 format history.';

REVOKE ALL ON FUNCTION "public"."take_over_carousel_experiment_batch_with_structure_2"(uuid, text, integer) FROM PUBLIC;


-- source: public/functions/transition_background_job.sql
CREATE OR REPLACE FUNCTION public.transition_background_job (
  p_job_id           uuid,
  p_claim_token      uuid,
  p_status           text,
  p_stage            text     DEFAULT NULL::text,
  p_progress         smallint DEFAULT NULL::smallint,
  p_output_reference text     DEFAULT NULL::text,
  p_error_code       text     DEFAULT NULL::text,
  p_error_message    text     DEFAULT NULL::text,
  p_event_type       text     DEFAULT 'status_changed'::text,
  p_metadata         jsonb    DEFAULT '{}'::jsonb
)
  RETURNS SETOF public.background_jobs
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_current public.background_jobs%rowtype;
  v_now timestamptz := now();
begin
  select job.*
  into v_current
  from public.background_jobs as job
  where job.id = p_job_id
  for update;

  if not found then
    return;
  end if;

  if p_claim_token is not null and v_current.claim_token is distinct from p_claim_token then
    return;
  end if;

  if not (
    v_current.status = p_status
    or (v_current.status = 'created' and p_status in ('queued', 'cancelled'))
    or (v_current.status = 'queued' and p_status in ('processing', 'cancelled', 'failed', 'stalled'))
    or (
      v_current.status in (
        'processing',
        'waiting_external_service',
        'rendering',
        'uploading_output'
      )
      and p_status in (
        'queued',
        'processing',
        'waiting_external_service',
        'rendering',
        'uploading_output',
        'completed',
        'failed',
        'cancel_requested',
        'cancelled',
        'stalled'
      )
    )
    or (v_current.status = 'cancel_requested' and p_status in ('cancelled', 'failed'))
    or (v_current.status = 'stalled' and p_status in ('queued', 'failed', 'cancelled'))
    or (v_current.status = 'failed' and p_status = 'queued')
  ) then
    raise exception 'invalid background job transition: % -> %',
      v_current.status,
      p_status;
  end if;

  update public.background_jobs as job
  set
    status = p_status,
    stage = case
      when p_stage is not null then left(trim(p_stage), 120)
      else job.stage
    end,
    progress = p_progress,
    output_reference = coalesce(p_output_reference, job.output_reference),
    error_code = case
      when p_status in ('failed', 'stalled') then left(nullif(trim(p_error_code), ''), 120)
      when p_status in ('queued', 'processing', 'completed', 'cancelled') then null
      else job.error_code
    end,
    error_message = case
      when p_status in ('failed', 'stalled') then left(nullif(trim(p_error_message), ''), 1000)
      when p_status in ('queued', 'processing', 'completed', 'cancelled') then null
      else job.error_message
    end,
    queued_at = case when p_status = 'queued' then v_now else job.queued_at end,
    started_at = case
      when p_status in ('processing', 'waiting_external_service', 'rendering', 'uploading_output')
        then coalesce(job.started_at, v_now)
      else job.started_at
    end,
    completed_at = case when p_status in ('completed', 'cancelled') then v_now else job.completed_at end,
    failed_at = case when p_status in ('failed', 'stalled') then v_now else job.failed_at end,
    last_heartbeat_at = case
      when p_status in ('processing', 'waiting_external_service', 'rendering', 'uploading_output')
        then v_now
      else job.last_heartbeat_at
    end,
    claim_token = case
      when p_status in ('queued', 'completed', 'failed', 'cancelled', 'stalled') then null
      else job.claim_token
    end,
    locked_at = case
      when p_status in ('queued', 'completed', 'failed', 'cancelled', 'stalled') then null
      else job.locked_at
    end,
    worker_id = case
      when p_status in ('queued', 'completed', 'failed', 'cancelled', 'stalled') then null
      else job.worker_id
    end,
    worker_execution_id = case
      when p_status in ('queued', 'completed', 'failed', 'cancelled', 'stalled') then null
      else job.worker_execution_id
    end,
    updated_at = v_now
  where job.id = p_job_id;

  perform public.append_background_job_event(
    p_job_id,
    p_event_type,
    p_metadata || jsonb_build_object(
      'fromStatus', v_current.status,
      'toStatus', p_status,
      'stage', p_stage
    )
  );

  return query
  select job.*
  from public.background_jobs as job
  where job.id = p_job_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."transition_background_job"(uuid, uuid, text, text, smallint, text, text, text, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."transition_background_job"(uuid, uuid, text, text, smallint, text, text, text, text, jsonb) FROM PUBLIC;

-- Static, non-user reference data captured from the verified production baseline.
-- Media catalogs, user rows, billing rows, jobs, and outboxes are intentionally excluded.

insert into public.hook_formats
select * from jsonb_populate_recordset(null::public.hook_formats, '[{"id":"airplane_reaction","display_name":"Airplane reaction","description":"Influencer reacting while seated in an airplane cabin or beside an airplane window.","audio_mode":"dynamic","status":"active","created_at":"2026-08-20T10:43:15.739Z","updated_at":"2026-08-20T10:43:15.739Z"},{"id":"bedroom_reaction","display_name":"Bedroom reaction","description":"Influencer reacting in a bedroom or bed setting.","audio_mode":"dynamic","status":"active","created_at":"2026-08-09T14:36:46.802Z","updated_at":"2026-08-09T14:36:46.802Z"},{"id":"cafe_reaction","display_name":"Cafe reaction","description":"Influencer seated in a cafe or restaurant environment.","audio_mode":"dynamic","status":"active","created_at":"2026-08-09T14:36:46.802Z","updated_at":"2026-08-09T14:36:46.802Z"},{"id":"desk_laptop_reaction","display_name":"Desk or laptop reaction","description":"Influencer reacting while a laptop or desk setup is visually prominent.","audio_mode":"dynamic","status":"active","created_at":"2026-08-09T14:36:46.802Z","updated_at":"2026-08-09T14:36:46.802Z"},{"id":"fitness_workspace_reaction","display_name":"Fitness workspace reaction","description":"Fitness-styled influencer moving beside a laptop or workspace.","audio_mode":"dynamic","status":"active","created_at":"2026-08-09T14:36:46.802Z","updated_at":"2026-08-09T14:36:46.802Z"},{"id":"headphones_reaction","display_name":"Headphones reaction","description":"Headphones are a prominent part of the influencer reaction.","audio_mode":"dynamic","status":"active","created_at":"2026-08-09T14:36:46.802Z","updated_at":"2026-08-09T14:36:46.802Z"},{"id":"indoor_selfie_closeup","display_name":"Indoor selfie close-up","description":"Indoor face-led selfie or close-up reaction without a dominant prop.","audio_mode":"dynamic","status":"active","created_at":"2026-08-09T14:36:46.802Z","updated_at":"2026-08-09T14:36:46.802Z"},{"id":"indoor_selfie_medium","display_name":"Indoor selfie medium","description":"Indoor medium-framed reaction showing more torso or surrounding room.","audio_mode":"dynamic","status":"active","created_at":"2026-08-09T14:36:46.802Z","updated_at":"2026-08-09T14:36:46.802Z"},{"id":"office_selfie","display_name":"Office selfie","description":"Influencer in a recognizable office or shared-workspace setting.","audio_mode":"dynamic","status":"active","created_at":"2026-08-09T14:36:46.802Z","updated_at":"2026-08-09T14:36:46.802Z"},{"id":"phone_reaction","display_name":"Phone reaction","description":"A phone is visibly involved in the influencer reaction.","audio_mode":"dynamic","status":"active","created_at":"2026-08-09T14:36:46.802Z","updated_at":"2026-08-09T14:36:46.802Z"},{"id":"sofa_reaction","display_name":"Sofa reaction","description":"Influencer reacting while seated on a sofa or lounge chair.","audio_mode":"dynamic","status":"active","created_at":"2026-08-09T14:36:46.802Z","updated_at":"2026-08-09T14:36:46.802Z"}]'::jsonb);

insert into public.hook_text_formats
select * from jsonb_populate_recordset(null::public.hook_text_formats, '[{"id":"GF_001","family":"extreme_gratitude","name":"Extreme gratitude","canonical_template":"I could {KISS/MARRY} the {PERSON} who showed me THIS","required_variables":[],"optional_variables":["person"],"psychology":["gratitude","surprise","curiosity"],"initial_confidence":"tier_a","global_status":"global_v1","allowed_tones":["casual","shock"],"generation_rules":{"neverInventFacts":true,"rhetoricalFirstPersonAllowed":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_002","family":"pain_vs_hidden_solution","name":"Pain vs hidden solution","canonical_template":"Imagine {PAIN} when THIS exists","required_variables":["pain"],"optional_variables":["hidden_solution"],"psychology":["pain","curiosity","fomo"],"initial_confidence":"tier_a","global_status":"global_v1","allowed_tones":["casual","shock"],"generation_rules":{"neverInventFacts":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_003","family":"delayed_discovery","name":"Delayed discovery","canonical_template":"{TIME/EXPERIENCE} doing {THING} and I JUST found this","required_variables":["verified_time_or_experience","activity"],"optional_variables":[],"psychology":["regret","curiosity","discovery"],"initial_confidence":"tier_a","global_status":"global_v1","allowed_tones":["casual","shock"],"generation_rules":{"neverInventPersonalHistory":true,"requiresSuppliedNumberOrDuration":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_004","family":"forbidden_advantage","name":"Forbidden advantage","canonical_template":"How is this {LEGAL/POSSIBLE}?","required_variables":[],"optional_variables":["capability"],"psychology":["forbidden_information","shock","curiosity"],"initial_confidence":"tier_a","global_status":"global_v1","allowed_tones":["shock"],"generation_rules":{"rhetoricalOnly":true,"restrictedForSensitiveBusinesses":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_005","family":"secret_gatekeeping","name":"Secret or gatekeeping","canonical_template":"{GROUP} does not want you to know about this","required_variables":["audience"],"optional_variables":["group"],"psychology":["secrecy","information_asymmetry","curiosity"],"initial_confidence":"tier_a","global_status":"global_v1","allowed_tones":["casual","shock"],"generation_rules":{"neverInventCompetitors":true,"preferNonAccusatoryVariant":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_006","family":"pov_mini_story","name":"POV mini-story","canonical_template":"POV: {RELATABLE_SITUATION}","required_variables":[],"optional_variables":["pain","audience","outcome"],"psychology":["self_identification","story","curiosity"],"initial_confidence":"tier_a","global_status":"global_v1","allowed_tones":["casual","story"],"generation_rules":{"neverInventFacts":true,"singleScenarioOnly":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_007","family":"audience_callout","name":"Audience callout","canonical_template":"{AUDIENCE} are gonna {LOVE/KISS} me after seeing this","required_variables":["audience"],"optional_variables":[],"psychology":["identity","recognition","gratitude"],"initial_confidence":"tier_b","global_status":"global_v1","allowed_tones":["casual","playful"],"generation_rules":{"neverPromiseResults":true,"rhetoricalFirstPersonAllowed":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_008","family":"identity_pain","name":"Identity pain","canonical_template":"{PAINFUL_IDENTITY_OR_STATE} plus discovery","required_variables":["pain"],"optional_variables":[],"psychology":["identity","pain","recognition"],"initial_confidence":"tier_b","global_status":"global_v1","allowed_tones":["casual","serious"],"generation_rules":{"neverInventSpeakerSituation":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_009","family":"old_way_vs_new_way","name":"Old way vs new way","canonical_template":"{OLD_METHOD} X {NEW_METHOD} check","required_variables":["old_method","new_method"],"optional_variables":[],"psychology":["contrast","simplicity","transformation"],"initial_confidence":"tier_b","global_status":"global_v1","allowed_tones":["clear","casual"],"generation_rules":{"neverAddSpeedOrResultClaims":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_010","family":"combination_equation","name":"Combination or equation","canonical_template":"{THING_A} + {THING_B} = {OUTCOME}","required_variables":["thing_a","thing_b","outcome"],"optional_variables":[],"psychology":["combination","simplicity","curiosity"],"initial_confidence":"tier_b","global_status":"global_v1","allowed_tones":["clear","playful"],"generation_rules":{"neverInventFinancialResults":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_011","family":"specific_transformation","name":"Specific transformation","canonical_template":"{RESULT} in {TIME/NUMBER}","required_variables":["verified_result","verified_time_or_number"],"optional_variables":[],"psychology":["specificity","transformation","proof"],"initial_confidence":"tier_a","global_status":"global_v1","allowed_tones":["clear","shock"],"generation_rules":{"neverInferNumbers":true,"requiresSuppliedNumberOrDuration":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_012","family":"conversational_disbelief","name":"Conversational disbelief","canonical_template":"I am sorry... THIS can {THING} now??","required_variables":[],"optional_variables":["capability","problem_reframe"],"psychology":["disbelief","conversation","curiosity"],"initial_confidence":"tier_b","global_status":"global_v1","allowed_tones":["casual","shock"],"generation_rules":{"neverInventFacts":true,"rhetoricalFirstPersonAllowed":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_013","family":"wdym_surprise","name":"WDYM surprise","canonical_template":"WDYM {SURPRISING_THING_OR_OUTCOME}?","required_variables":[],"optional_variables":["audience","pain","capability","outcome"],"psychology":["slang","surprise","curiosity"],"initial_confidence":"tier_c","global_status":"retired","allowed_tones":["casual","playful"],"generation_rules":{"neverInventFacts":true,"avoidFormalAudiences":true},"library_version":"global-hook-text-formats-v1","enabled":false,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-27T17:29:32.550Z"},{"id":"GF_014","family":"credit_owe_outcome","name":"Credit or owe outcome","canonical_template":"I owe {OUTCOME} to {PERSON/THING} that showed me this","required_variables":["verified_outcome","verified_source"],"optional_variables":[],"psychology":["attribution","gratitude","outcome"],"initial_confidence":"tier_b","global_status":"global_v1","allowed_tones":["casual","story"],"generation_rules":{"neverInventTestimonials":true,"requiresVerifiedOutcome":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_015","family":"discovery_opener","name":"Discovery opener","canonical_template":"I/FINALLY/JUST found {THING}","required_variables":[],"optional_variables":["capability","solution"],"psychology":["discovery","novelty","curiosity"],"initial_confidence":"tier_a","global_status":"global_v1","allowed_tones":["casual","story"],"generation_rules":{"neverInventPersonalHistory":true,"rhetoricalFirstPersonAllowed":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_016","family":"replacement_discovery","name":"Replacement discovery","canonical_template":"Is THIS the new {KNOWN_TOOL_OR_METHOD}?!","required_variables":["comparison"],"optional_variables":["capability"],"psychology":["comparison","disruption","curiosity"],"initial_confidence":"tier_b","global_status":"global_v1","allowed_tones":["casual","shock"],"generation_rules":{"neverClaimEquivalence":true,"requiresSuppliedComparison":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_017","family":"audience_threat","name":"Are we cooked","canonical_template":"{AUDIENCE}, are we cooked?","required_variables":["audience"],"optional_variables":[],"psychology":["identity","threat","curiosity"],"initial_confidence":"tier_c","global_status":"retired","allowed_tones":["casual","playful"],"generation_rules":{"rhetoricalOnly":true,"avoidFormalAudiences":true},"library_version":"global-hook-text-formats-v1","enabled":false,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-27T17:29:32.550Z"},{"id":"GF_018","family":"speed_challenge","name":"Speed challenge","canonical_template":"Making {DESIRED_RESULT} in {TIME} without {EFFORT}","required_variables":["verified_result","verified_time","painful_effort"],"optional_variables":[],"psychology":["challenge","speed","transformation"],"initial_confidence":"tier_b","global_status":"global_v1","allowed_tones":["casual","shock"],"generation_rules":{"neverInventResults":true,"requiresSuppliedNumberOrDuration":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_019","family":"clear_playful_surprise","name":"Clear playful surprise","canonical_template":"Wait, what? {SURPRISING_CAPABILITY}?","required_variables":["capability"],"optional_variables":[],"psychology":["playful_surprise","clarity","curiosity"],"initial_confidence":"tier_b","global_status":"global_v1","allowed_tones":["casual","clear","playful"],"generation_rules":{"reactionType":"amusement_laughter","neverInventFacts":true,"neverUseAbbreviations":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-27T17:29:32.550Z","updated_at":"2026-08-27T17:29:32.550Z"},{"id":"GF_020","family":"skeptical_challenge","name":"Skeptical challenge","canonical_template":"Why are we still {OLD_METHOD}?","required_variables":["old_method_or_workflow_pain"],"optional_variables":[],"psychology":["skepticism","recognition","curiosity"],"initial_confidence":"tier_b","global_status":"global_v1","allowed_tones":["casual","clear","serious"],"generation_rules":{"reactionType":"confusion_skepticism","neverInventFacts":true,"neverUseThreatSlang":true},"library_version":"global-hook-text-formats-v1","enabled":true,"created_at":"2026-08-27T17:29:32.550Z","updated_at":"2026-08-27T17:29:32.550Z"}]'::jsonb);

insert into public.hook_text_format_variants
select * from jsonb_populate_recordset(null::public.hook_text_format_variants, '[{"id":"GF_001_A","hook_text_format_id":"GF_001","template":"I could literally KISS whoever showed me this","instruction":"Use KISS as an obvious playful reaction.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_001_B","hook_text_format_id":"GF_001","template":"I could MARRY whoever showed me this","instruction":"Use MARRY as an obvious playful reaction.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_002_A","hook_text_format_id":"GF_002","template":"Imagine {current_pain} when this exists","instruction":"Use the direct Imagine structure.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_002_B","hook_text_format_id":"GF_002","template":"Imagine still {current_pain} when this exists","instruction":"Use a still-doing-the-pain variation.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_003_A","hook_text_format_id":"GF_003","template":"{experience} doing {activity} and I JUST found this","instruction":"Use only supplied experience.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_003_B","hook_text_format_id":"GF_003","template":"{time} doing this and I only just found THIS","instruction":"Use only supplied time.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_004_A","hook_text_format_id":"GF_004","template":"How is this even possible?","instruction":"Frame as surprising possibility.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_004_B","hook_text_format_id":"GF_004","template":"This feels illegal to know","instruction":"Use illegal only as obvious hyperbole.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_005_A","hook_text_format_id":"GF_005","template":"Do not tell {audience} about this","instruction":"Address a supplied audience without accusation.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_005_B","hook_text_format_id":"GF_005","template":"I finally understand why {group} gatekeeps this","instruction":"Require a supplied group.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_006_A","hook_text_format_id":"GF_006","template":"POV: {pain_scenario}","instruction":"Use one supplied pain scenario.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_006_B","hook_text_format_id":"GF_006","template":"POV: {discovery_or_outcome_scenario}","instruction":"Use one supplied discovery or outcome scenario.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_007_A","hook_text_format_id":"GF_007","template":"{audience} are gonna love me after seeing this","instruction":"Use love as rhetorical reaction.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_007_B","hook_text_format_id":"GF_007","template":"{audience} are gonna KISS me after seeing this","instruction":"Use KISS only for a casual audience.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_008_A","hook_text_format_id":"GF_008","template":"{painful_identity_or_state}","instruction":"State the supplied painful identity directly.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_008_B","hook_text_format_id":"GF_008","template":"Imagine being {painful_state}","instruction":"Use Imagine plus the supplied state.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_009_A","hook_text_format_id":"GF_009","template":"{old_method} X {new_method} check","instruction":"Use compact visual contrast.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_009_B","hook_text_format_id":"GF_009","template":"Still {old_method} when {new_method} exists?","instruction":"Use natural sentence contrast.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_010_A","hook_text_format_id":"GF_010","template":"{thing_a} + {thing_b} = {outcome}","instruction":"Use two supplied things and one supplied outcome.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_011_A","hook_text_format_id":"GF_011","template":"{verified_result} in {verified_time_or_number}","instruction":"Use only supplied values.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_011_B","hook_text_format_id":"GF_011","template":"{verified_before} to {verified_after} in {verified_time}","instruction":"Use only supplied before, after, and time.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_012_A","hook_text_format_id":"GF_012","template":"I am sorry... THIS can {capability} now??","instruction":"Use one supplied capability.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_012_B","hook_text_format_id":"GF_012","template":"I am sorry... THIS is how {supplied_idea} works now??","instruction":"Use one supplied process or outcome.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_013_A","hook_text_format_id":"GF_013","template":"WDYM {surprising_supplied_idea}?","instruction":"Use one supplied surprising idea.","enabled":false,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-27T17:29:32.550Z"},{"id":"GF_014_A","hook_text_format_id":"GF_014","template":"I owe {verified_outcome} to {verified_source}","instruction":"Use only supplied outcome and source.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_015_A","hook_text_format_id":"GF_015","template":"I just found {supplied_thing}","instruction":"Use one supplied idea.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_015_B","hook_text_format_id":"GF_015","template":"FINALLY found {supplied_thing}","instruction":"Use one supplied idea.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_016_A","hook_text_format_id":"GF_016","template":"Is THIS the new {known_tool_or_method}?!","instruction":"Use only a supplied comparison.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_016_B","hook_text_format_id":"GF_016","template":"I''m sorry... is THIS the new {known_tool_or_method}?!","instruction":"Use I''m sorry only with the supplied comparison.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_017_A","hook_text_format_id":"GF_017","template":"{audience}, are we cooked?","instruction":"Use only a supplied audience and rhetorical concern.","enabled":false,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-27T17:29:32.550Z"},{"id":"GF_018_A","hook_text_format_id":"GF_018","template":"Making {verified_result} in {verified_time} without {painful_effort}","instruction":"Use only supplied result, time, and effort.","enabled":true,"created_at":"2026-08-18T00:31:55.101Z","updated_at":"2026-08-18T00:31:55.101Z"},{"id":"GF_019_A","hook_text_format_id":"GF_019","template":"Wait, what? {verified_capability}?","instruction":"Use the complete, plain-language surprise before one verified capability.","enabled":true,"created_at":"2026-08-27T17:29:32.550Z","updated_at":"2026-08-27T17:29:32.550Z"},{"id":"GF_020_A","hook_text_format_id":"GF_020","template":"Why are we still {verified_old_method}?","instruction":"Ask why the supplied old method or workflow pain is still accepted.","enabled":true,"created_at":"2026-08-27T17:29:32.550Z","updated_at":"2026-08-27T17:29:32.550Z"}]'::jsonb);

insert into public.hook_text_format_evidence
select * from jsonb_populate_recordset(null::public.hook_text_format_evidence, '[{"id":"97d6b844-6e38-4cf8-b18f-f80ae5200113","hook_text_format_id":"GF_001","observed_hook_text":"I could literally KISS the startup guy that sent me this","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"aa45e828-36c9-4efc-af5e-967c932c8287","hook_text_format_id":"GF_002","observed_hook_text":"Imagine stressing over ZERO app downloads when this exists","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"7e35b5d4-0739-44fe-a003-bd941474a83c","hook_text_format_id":"GF_003","observed_hook_text":"9 years using Canva and I JUST found this","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"a7e77118-299a-4db4-b987-64c62fb5fa8a","hook_text_format_id":"GF_004","observed_hook_text":"How is this even legal?","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"7ecec4cf-9902-4e29-b1ef-ac76b7121944","hook_text_format_id":"GF_005","observed_hook_text":"Do not tell anyone how apps are blowing up from a single post","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"c191ab90-8437-44c7-b5e3-64a600f13611","hook_text_format_id":"GF_006","observed_hook_text":"POV: you gave the app founder a chance and he sent THIS","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"85eb66eb-9dfb-46d0-bbb8-cf125a43dfa9","hook_text_format_id":"GF_007","observed_hook_text":"Unemployed people are gonna KISS me after seeing this","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"9b4be2d9-40d1-4b9c-803d-8e28ae9e2771","hook_text_format_id":"GF_008","observed_hook_text":"My 9-5 is my only income","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"1ae62c2c-2aec-4e3c-b65a-74c15359c274","hook_text_format_id":"GF_009","observed_hook_text":"Part time job X Kids YouTube + AI check","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"a871075c-d070-417a-804d-33a8e32094bd","hook_text_format_id":"GF_010","observed_hook_text":"AI + YouTube = $$$","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"c8854698-f7a8-4fc0-a8b5-6d7d6d5a0ea1","hook_text_format_id":"GF_011","observed_hook_text":"$1,200 in 6 minutes","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"ab277a55-7923-42d4-a03f-a210ceb85b14","hook_text_format_id":"GF_012","observed_hook_text":"I am sorry is THIS the new CapCut?!","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"f68e2b9f-495e-4d1f-9739-6c5de45217ec","hook_text_format_id":"GF_013","observed_hook_text":"WDYM my random app found its people overnight","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"c65b7b7e-820f-4a25-8b81-f17cee7eefd2","hook_text_format_id":"GF_014","observed_hook_text":"I owe my entire bank balance to the guy who showed me THIS","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"96796a88-0b40-4c53-93f1-0e19573c2e5d","hook_text_format_id":"GF_015","observed_hook_text":"FINALLY found a game where you have to stalk a missing girl''s phone","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"bf0da49e-db9e-47f2-8cc1-c65d5ce0e66c","hook_text_format_id":"GF_016","observed_hook_text":"Is THIS the new Canva?!","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"6cf3e0f1-f4aa-4b71-812f-a0ff9abd0b9c","hook_text_format_id":"GF_017","observed_hook_text":"game devs, are we cooked?","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"},{"id":"635cb4f9-1e37-4ea1-b0e7-ff4300e6d0e8","hook_text_format_id":"GF_018","observed_hook_text":"Making your monthly salary in one day without yapping","source_reference":"final-18-format-classification","source_platform":"instagram","evidence_version":"global-v1-corpus","created_at":"2026-08-18T00:31:55.101Z"}]'::jsonb);

insert into public.carousel_global_settings
select * from jsonb_populate_recordset(null::public.carousel_global_settings, '[{"singleton":true,"structure_mode":"rotate","structure_config_version":2,"updated_by_user_id":"deployment:093a2febc1f3","created_at":"2026-08-18T00:32:28.083Z","updated_at":"2026-08-18T02:54:58.549Z"}]'::jsonb);


do $baseline_validation$
declare
  actual_tables integer;
  actual_functions integer;
  actual_triggers integer;
  actual_rls_tables integer;
begin
  select count(*)::integer
  into actual_tables
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p');

  select count(*)::integer
  into actual_functions
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public';

  select count(*)::integer
  into actual_triggers
  from pg_catalog.pg_trigger as trigger
  join pg_catalog.pg_class as relation on relation.oid = trigger.tgrelid
  join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and not trigger.tgisinternal;

  select count(*)::integer
  into actual_rls_tables
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p')
    and relation.relrowsecurity;

  if actual_tables <> 98
    or actual_functions <> 155
    or actual_triggers <> 37
    or actual_rls_tables <> 98
  then
    raise exception 'baseline_object_count_mismatch: tables=%, functions=%, triggers=%, rls_tables=%',
      actual_tables, actual_functions, actual_triggers, actual_rls_tables;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'hook_video_drafts_scheduled_post_fk'
      and convalidated
  ) then
    raise exception 'baseline_missing_hook_video_schedule_foreign_key';
  end if;

  if position(
    'carousel' in lower(
      pg_catalog.pg_get_functiondef(
        'public.retry_social_publish_target(uuid,uuid,text)'::regprocedure
      )
    )
  ) = 0 then
    raise exception 'baseline_missing_carousel_publish_retry_behavior';
  end if;

  if (select count(*) from public.hook_formats) <> 11 then
    raise exception 'baseline_reference_count_mismatch:hook_formats';
  end if;

  if (select count(*) from public.hook_text_formats) <> 20 then
    raise exception 'baseline_reference_count_mismatch:hook_text_formats';
  end if;

  if (select count(*) from public.hook_text_format_variants) <> 33 then
    raise exception 'baseline_reference_count_mismatch:hook_text_format_variants';
  end if;

  if (select count(*) from public.hook_text_format_evidence) <> 18 then
    raise exception 'baseline_reference_count_mismatch:hook_text_format_evidence';
  end if;

  if (select count(*) from public.carousel_global_settings) <> 1 then
    raise exception 'baseline_reference_count_mismatch:carousel_global_settings';
  end if;
end;
$baseline_validation$;

select json_build_object(
  'tables', 98,
  'functions', 155,
  'triggers', 37,
  'rls_tables', 98,
  'foreign_key_verified', true,
  'carousel_retry_verified', true
) as baseline_validation;

reset check_function_bodies;
