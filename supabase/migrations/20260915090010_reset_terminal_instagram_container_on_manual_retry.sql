-- Historical production migration restored for ledger parity. This is the
-- same idempotent retry-trigger definition already represented by the later
-- 20260915144500 migration.
CREATE OR REPLACE FUNCTION public.reset_terminal_instagram_container_on_manual_retry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM 'failed'
    OR OLD.last_error_code IS DISTINCT FROM 'instagram_media_processing_failed'
    OR NEW.platform IS DISTINCT FROM 'instagram'
    OR NEW.status IS DISTINCT FROM 'scheduled'
    OR NEW.publish_job_id IS NOT DISTINCT FROM OLD.publish_job_id
    OR NEW.publish_job_id IS NULL
  THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.background_jobs AS job
    WHERE job.id = NEW.publish_job_id
      AND job.user_id = NEW.user_id
      AND job.job_type = 'publish_social_post'
      AND job.status = 'queued'
      AND job.input_json ->> 'targetId' = NEW.id::text
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE public.social_publish_operations AS operation
  SET
    last_error_code = NULL,
    last_error_message = NULL,
    provider_operation_id = NULL,
    provider_operation_kind = NULL,
    status = 'pending',
    updated_at = pg_catalog.now()
  WHERE operation.scheduled_post_target_id = NEW.id
    AND operation.user_id = NEW.user_id
    AND operation.platform = 'instagram'
    AND operation.status <> 'published'
    AND operation.platform_post_id IS NULL
    AND operation.published_at IS NULL
    AND operation.active_job_id IS NULL
    AND operation.active_claim_token IS NULL
    AND operation.provider_operation_kind = 'instagram_container'
    AND operation.provider_operation_id IS NOT NULL;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS reset_terminal_instagram_container_on_manual_retry
  ON public.scheduled_post_targets;

CREATE TRIGGER reset_terminal_instagram_container_on_manual_retry
BEFORE UPDATE OF status, publish_job_id
ON public.scheduled_post_targets
FOR EACH ROW
EXECUTE FUNCTION public.reset_terminal_instagram_container_on_manual_retry();

REVOKE ALL ON FUNCTION public.reset_terminal_instagram_container_on_manual_retry()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_terminal_instagram_container_on_manual_retry()
  TO service_role;
