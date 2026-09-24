-- A background job can be explicitly rerun after it has already completed
-- once. Its original outbox row is intentionally retained for auditability,
-- but must become due again when that re-run reaches a new completed state.
-- Without this handoff, a recovered Wall job can rotate its daily retry key
-- and leave the newly empty positions without a follow-up preparation pass.
CREATE OR REPLACE FUNCTION public.reopen_completed_trending_feed_reconciliation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status
    OR NEW.status <> 'completed'
    OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.trending_feed_reconciliation_outbox AS outbox
  SET
    status = 'pending',
    next_attempt_at = timezone('utc', now()),
    locked_at = NULL,
    completed_at = NULL,
    last_error = NULL,
    updated_at = timezone('utc', now())
  WHERE outbox.source_job_id = NEW.id
    AND outbox.status = 'completed';

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.reopen_completed_trending_feed_reconciliation()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reopen_completed_trending_feed_reconciliation
  ON public.background_jobs;

CREATE TRIGGER reopen_completed_trending_feed_reconciliation
AFTER UPDATE OF status ON public.background_jobs
FOR EACH ROW
EXECUTE FUNCTION public.reopen_completed_trending_feed_reconciliation();
