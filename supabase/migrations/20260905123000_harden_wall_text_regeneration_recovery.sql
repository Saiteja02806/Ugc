-- Idempotent callers normally ask for the same durable job more than once.
-- The existing expression index cannot be named as a PostgREST upsert target,
-- so a plain INSERT produces a noisy 409 before the app can reread the row.
-- Resolve that race inside Postgres instead: insert once, or return the row
-- that owns the same user/type/idempotency key.
CREATE OR REPLACE FUNCTION public.create_or_get_background_job_v1(
  p_idempotency_key text,
  p_input_json      jsonb,
  p_input_reference text,
  p_job_type        text,
  p_max_attempts    integer,
  p_project_id      text,
  p_queue_name      text,
  p_user_id         text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.background_jobs%ROWTYPE;
  v_created boolean := false;
  v_idempotency_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
BEGIN
  IF jsonb_typeof(p_input_json) IS DISTINCT FROM 'object'
     OR nullif(btrim(coalesce(p_job_type, '')), '') IS NULL
     OR nullif(btrim(coalesce(p_queue_name, '')), '') IS NULL
     OR p_max_attempts IS NULL
     OR p_max_attempts < 1
     OR p_max_attempts > 20 THEN
    RAISE EXCEPTION 'background_job_create_input_invalid';
  END IF;

  IF v_idempotency_key IS NULL THEN
    INSERT INTO public.background_jobs (
      input_json,
      input_reference,
      idempotency_key,
      job_type,
      max_attempts,
      project_id,
      queue_name,
      queue_provider,
      queued_at,
      stage,
      status,
      updated_at,
      user_id
    ) VALUES (
      p_input_json,
      p_input_reference,
      NULL,
      p_job_type,
      p_max_attempts,
      p_project_id,
      p_queue_name,
      'gcp',
      timezone('utc', now()),
      'queued',
      'queued',
      timezone('utc', now()),
      p_user_id
    )
    RETURNING * INTO v_job;

    v_created := true;
  ELSE
    INSERT INTO public.background_jobs (
      input_json,
      input_reference,
      idempotency_key,
      job_type,
      max_attempts,
      project_id,
      queue_name,
      queue_provider,
      queued_at,
      stage,
      status,
      updated_at,
      user_id
    ) VALUES (
      p_input_json,
      p_input_reference,
      v_idempotency_key,
      p_job_type,
      p_max_attempts,
      p_project_id,
      p_queue_name,
      'gcp',
      timezone('utc', now()),
      'queued',
      'queued',
      timezone('utc', now()),
      p_user_id
    )
    ON CONFLICT DO NOTHING
    RETURNING * INTO v_job;

    v_created := FOUND;

    IF NOT v_created THEN
      SELECT job.*
      INTO v_job
      FROM public.background_jobs AS job
      WHERE coalesce(job.user_id, '') = coalesce(p_user_id, '')
        AND job.job_type = p_job_type
        AND job.idempotency_key = v_idempotency_key
      FOR SHARE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'background_job_idempotency_conflict_unresolved';
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'created', v_created,
    'job', to_jsonb(v_job)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_or_get_background_job_v1(
  text, jsonb, text, text, integer, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_or_get_background_job_v1(
  text, jsonb, text, text, integer, text, text, text
) TO service_role;

-- The Wall replacement RPC accepts no more than fifty rows in one call.
-- Application-side chunking handles larger historical sets without changing
-- this database contract, while deterministic old invalid-count jobs become
-- terminal instead of being recreated by reconciliation.
SELECT pg_notify('pgrst', 'reload schema');
