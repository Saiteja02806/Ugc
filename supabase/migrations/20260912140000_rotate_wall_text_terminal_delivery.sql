-- A terminal copy rejection can leave a daily Wall writer with some usable
-- creatives and some retired plan items.  The worker finishes successfully
-- after requesting recovery so the normal reconciliation outbox can attach
-- those usable creatives.  Give that reconciliation a fresh delivery intent
-- instead of making it rediscover the failed writer forever.
CREATE OR REPLACE FUNCTION public.request_wall_text_daily_terminal_replacement_v1(
  p_user_id text,
  p_feed_id uuid,
  p_failed_job_id uuid,
  p_expected_recovery_key text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_feed public.daily_trending_feeds;
  v_intent public.wall_text_daily_delivery_intents;
  v_job public.background_jobs;
  v_retry_key uuid;
BEGIN
  -- Match the daily-plan writer's lock ordering: profile advisory lock before
  -- the feed row. This also makes repeated worker deliveries idempotent.
  SELECT feed.* INTO v_feed
  FROM public.daily_trending_feeds AS feed
  WHERE feed.id = p_feed_id
    AND feed.user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_feed.user_id || ':' || v_feed.local_date::text, 0)
  );

  SELECT feed.* INTO v_feed
  FROM public.daily_trending_feeds AS feed
  WHERE feed.id = p_feed_id
    AND feed.user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- An older worker must never rotate a newer retry. Daily writers use the
  -- retry key as their durable ownership fence.
  IF coalesce(v_feed.wall_text_retry_key::text, v_feed.id::text)
       IS DISTINCT FROM nullif(btrim(coalesce(p_expected_recovery_key, '')), '') THEN
    RETURN NULL;
  END IF;

  SELECT intent.* INTO v_intent
  FROM public.wall_text_daily_delivery_intents AS intent
  WHERE intent.feed_id = v_feed.id
    AND intent.user_id = p_user_id
    AND intent.job_id = p_failed_job_id
    AND intent.retry_key = coalesce(v_feed.wall_text_retry_key::text, '');
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT job.* INTO v_job
  FROM public.background_jobs AS job
  WHERE job.id = p_failed_job_id
    AND job.user_id = p_user_id
    AND job.job_type = 'wall_text_generation'
    AND job.input_json ->> 'dailyFeedId' = v_feed.id::text
  FOR SHARE;
  IF NOT FOUND OR v_job.status IN ('completed', 'failed', 'cancelled') THEN
    RETURN NULL;
  END IF;

  -- Do not manufacture a replacement for a feed that was already filled or
  -- explicitly decided while the writer was running.
  IF NOT EXISTS (
    SELECT 1
    FROM public.daily_trending_feed_slots AS slot
    WHERE slot.feed_id = v_feed.id
      AND slot.format = 'wall_text'
      AND slot.state <> 'decided'
      AND slot.wall_text_assignment_id IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  v_retry_key := gen_random_uuid();
  UPDATE public.daily_trending_feeds AS feed
  SET
    status = 'preparing',
    last_error = NULL,
    wall_text_retry_key = v_retry_key,
    updated_at = timezone('utc', now())
  WHERE feed.id = v_feed.id
    AND feed.user_id = p_user_id;

  RETURN v_retry_key;
END;
$function$;

REVOKE ALL ON FUNCTION public.request_wall_text_daily_terminal_replacement_v1(text, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_wall_text_daily_terminal_replacement_v1(text, uuid, uuid, text)
  TO service_role;

SELECT pg_notify('pgrst', 'reload schema');
