-- Wall generation failures can contain provider request ids, private creative
-- context, and validation evidence. Retain that data for operators only; it
-- must not be returned from the public background-job API.
CREATE TABLE public.wall_text_failure_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id text NOT NULL,
  background_job_id uuid REFERENCES public.background_jobs(id) ON DELETE SET NULL,
  content_plan_id uuid REFERENCES public.wall_text_content_plans(id) ON DELETE SET NULL,
  generation_batch_id uuid REFERENCES public.wall_text_generation_batches(id) ON DELETE SET NULL,
  generation_chunk_id uuid REFERENCES public.wall_text_generation_chunks(id) ON DELETE SET NULL,
  request_key text,
  stage text NOT NULL CHECK (stage IN (
    'planner', 'writer', 'reviewer', 'parser', 'persistence', 'reservation', 'render', 'unknown'
  )),
  error_code text NOT NULL,
  error_message text NOT NULL,
  retryable boolean NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object')
);

CREATE INDEX wall_text_failure_diagnostics_user_created_idx
  ON public.wall_text_failure_diagnostics (user_id, created_at DESC);
CREATE INDEX wall_text_failure_diagnostics_chunk_created_idx
  ON public.wall_text_failure_diagnostics (generation_chunk_id, created_at DESC)
  WHERE generation_chunk_id IS NOT NULL;

ALTER TABLE public.wall_text_failure_diagnostics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.wall_text_failure_diagnostics FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.wall_text_failure_diagnostics TO service_role;

CREATE OR REPLACE FUNCTION public.record_wall_text_failure_diagnostic_v1(
  p_user_id text,
  p_stage text,
  p_error_code text,
  p_error_message text,
  p_retryable boolean,
  p_details jsonb,
  p_request_key text DEFAULT NULL,
  p_background_job_id uuid DEFAULT NULL,
  p_content_plan_id uuid DEFAULT NULL,
  p_generation_batch_id uuid DEFAULT NULL,
  p_generation_chunk_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_job_id uuid := p_background_job_id;
  v_batch_id uuid := p_generation_batch_id;
  v_id uuid;
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' THEN
    RAISE EXCEPTION 'wall_text_failure_diagnostic_user_required';
  END IF;
  IF p_stage NOT IN ('planner', 'writer', 'reviewer', 'parser', 'persistence', 'reservation', 'render', 'unknown') THEN
    RAISE EXCEPTION 'wall_text_failure_diagnostic_invalid_stage';
  END IF;
  IF p_details IS NULL OR jsonb_typeof(p_details) <> 'object' OR octet_length(p_details::text) > 8000 THEN
    RAISE EXCEPTION 'wall_text_failure_diagnostic_invalid_details';
  END IF;

  IF v_job_id IS NOT NULL THEN
    PERFORM 1 FROM public.background_jobs AS job
    WHERE job.id = v_job_id
      AND job.user_id = p_user_id
      AND job.job_type IN ('wall_text_generation', 'wall_text_content_plan_generation');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'wall_text_failure_diagnostic_job_unavailable';
    END IF;
  ELSIF p_request_key IS NOT NULL AND btrim(p_request_key) <> '' THEN
    SELECT job.id INTO v_job_id
    FROM public.background_jobs AS job
    WHERE job.user_id = p_user_id
      AND job.idempotency_key = p_request_key
      AND job.job_type IN ('wall_text_generation', 'wall_text_content_plan_generation')
    ORDER BY job.created_at DESC
    LIMIT 1;
  END IF;

  IF p_content_plan_id IS NOT NULL THEN
    PERFORM 1 FROM public.wall_text_content_plans AS plan
    WHERE plan.id = p_content_plan_id AND plan.user_id = p_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'wall_text_failure_diagnostic_plan_unavailable';
    END IF;
  END IF;

  IF p_generation_chunk_id IS NOT NULL THEN
    SELECT chunk.batch_id INTO v_batch_id
    FROM public.wall_text_generation_chunks AS chunk
    JOIN public.wall_text_generation_batches AS batch ON batch.id = chunk.batch_id
    WHERE chunk.id = p_generation_chunk_id AND batch.user_id = p_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'wall_text_failure_diagnostic_chunk_unavailable';
    END IF;
  END IF;

  IF v_batch_id IS NOT NULL THEN
    PERFORM 1 FROM public.wall_text_generation_batches AS batch
    WHERE batch.id = v_batch_id AND batch.user_id = p_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'wall_text_failure_diagnostic_batch_unavailable';
    END IF;
  END IF;

  IF v_job_id IS NULL AND p_content_plan_id IS NULL AND v_batch_id IS NULL THEN
    RAISE EXCEPTION 'wall_text_failure_diagnostic_owner_required';
  END IF;

  INSERT INTO public.wall_text_failure_diagnostics (
    user_id, background_job_id, content_plan_id, generation_batch_id,
    generation_chunk_id, request_key, stage, error_code, error_message,
    retryable, details
  ) VALUES (
    p_user_id, v_job_id, p_content_plan_id, v_batch_id,
    p_generation_chunk_id, nullif(left(p_request_key, 200), ''), p_stage,
    left(coalesce(p_error_code, 'wall_text_failure_unknown'), 120),
    left(coalesce(p_error_message, 'Wall generation failed without an error message.'), 4000),
    p_retryable, p_details
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_wall_text_failure_diagnostic_v1(text, text, text, text, boolean, jsonb, text, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_wall_text_failure_diagnostic_v1(text, text, text, text, boolean, jsonb, text, uuid, uuid, uuid, uuid) TO service_role;

-- Terminal cleanup used to overwrite a chunk's first, specific error with the
-- parent job's generic HTTP failure. Preserve already-recorded evidence.
CREATE OR REPLACE FUNCTION public.terminalize_wall_text_generation_for_job(p_job_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v_job public.background_jobs%rowtype;
  v_batch public.wall_text_generation_batches%rowtype;
  v_now timestamptz := clock_timestamp();
  v_count integer := 0;
  v_code text;
BEGIN
  SELECT job.* INTO v_job FROM public.background_jobs AS job
  WHERE job.id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.job_type <> 'wall_text_generation' THEN RETURN 0; END IF;
  IF NOT (v_job.status = 'cancelled' OR (v_job.status = 'failed' AND (
    v_job.attempt_count >= v_job.max_attempts OR coalesce(v_job.error_code IN (
      'wall_text_persistence_rejected', 'wall_text_render_fit_rejected',
      'wall_text_runtime_configuration_error', 'wall_text_dependency_unavailable',
      'content_retry_exhausted', 'model_output_refusal',
      'wall_text_provider_invalid_request', 'wall_text_provider_authentication_failed',
      'wall_text_provider_billing_limit'
    ), false)
  ))) THEN RETURN 0; END IF;
  v_code := coalesce(v_job.error_code, 'wall_text_parent_terminal');

  FOR v_batch IN
    SELECT batch.* FROM public.wall_text_generation_batches AS batch
    WHERE batch.user_id = v_job.user_id
      AND batch.request_key = v_job.idempotency_key
      AND batch.request_key = v_job.input_json->>'requestKey'
      AND batch.user_id = v_job.input_json->>'userId'
      AND batch.business_profile_id::text = v_job.input_json->>'businessProfileId'
      AND batch.business_profile_version::text = v_job.input_json->>'businessProfileVersion'
      AND batch.status <> 'completed'
  LOOP
    PERFORM 1 FROM public.wall_text_generation_chunks AS chunk
    WHERE chunk.batch_id = v_batch.id ORDER BY chunk.id FOR UPDATE;
    UPDATE public.wall_text_generation_chunks AS chunk
    SET status = 'failed', claim_token = NULL, locked_at = NULL,
        last_error_code = coalesce(nullif(chunk.last_error_code, ''), v_code),
        last_error_message = coalesce(
          nullif(chunk.last_error_message, ''),
          nullif(left(v_job.error_message, 1000), '')
        ),
        completed_at = coalesce(chunk.completed_at, v_now), updated_at = v_now
    WHERE chunk.batch_id = v_batch.id AND chunk.status <> 'completed';
    UPDATE public.wall_text_generation_assignments AS assignment
    SET status = 'failed',
        last_failure_code = coalesce(nullif(assignment.last_failure_code, ''), v_code),
        updated_at = v_now
    WHERE assignment.batch_id = v_batch.id AND assignment.status <> 'completed';
    UPDATE public.wall_text_content_plan_items AS item
    SET status = 'retired', retired_at = v_now, retirement_reason = v_code, updated_at = v_now
    WHERE item.user_id = v_job.user_id AND item.status = 'reserved'
      AND EXISTS (
        SELECT 1 FROM public.wall_text_generation_assignments AS assignment
        WHERE assignment.batch_id = v_batch.id AND assignment.status = 'failed'
          AND assignment.wall_text_content_plan_item_id = item.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.wall_text_generation_assignments AS other_assignment
        JOIN public.wall_text_generation_batches AS other_batch ON other_batch.id = other_assignment.batch_id
        WHERE other_assignment.wall_text_content_plan_item_id = item.id
          AND other_assignment.batch_id <> v_batch.id
          AND other_assignment.status IN ('pending', 'processing', 'retry_pending')
          AND other_batch.status IN ('pending', 'processing')
      );
    UPDATE public.wall_text_generation_batches AS batch
    SET status = 'failed', completed_at = coalesce(batch.completed_at, v_now), updated_at = v_now
    WHERE batch.id = v_batch.id AND batch.status <> 'completed';
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$function$;

NOTIFY pgrst, 'reload schema';
