-- Reopen only legacy daily Wall deliveries that were marked completed even
-- though their own response was shorter than the slots they reserved. A new
-- retry key deliberately leaves the immutable completed job untouched and
-- lets the repaired application create one fresh, idempotent delivery job.
UPDATE public.daily_trending_feeds AS feed
SET
  status = 'preparing',
  last_error = NULL,
  wall_text_retry_key = gen_random_uuid(),
  updated_at = timezone('utc', now())
WHERE EXISTS (
  SELECT 1
  FROM public.wall_text_daily_delivery_intents AS intent
  JOIN public.background_jobs AS job
    ON job.id = intent.job_id
    AND job.user_id = intent.user_id
  WHERE intent.feed_id = feed.id
    AND intent.user_id = feed.user_id
    -- Only supersede the current intent; a later healthy retry remains valid.
    AND intent.retry_key = coalesce(feed.wall_text_retry_key::text, '')
    AND job.job_type = 'wall_text_generation'
    AND job.status = 'completed'
    AND jsonb_typeof(job.output_json -> 'ideaCount') = 'number'
    AND (job.output_json ->> 'ideaCount')::numeric < intent.slot_count
    AND EXISTS (
      SELECT 1
      FROM public.daily_trending_feed_slots AS slot
      WHERE slot.feed_id = feed.id
        AND slot.id = ANY(intent.slot_ids)
        AND slot.state <> 'decided'
        AND slot.wall_text_assignment_id IS NULL
    )
);
