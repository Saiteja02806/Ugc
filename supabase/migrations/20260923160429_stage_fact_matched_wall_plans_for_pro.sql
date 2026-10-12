-- One-time Wall-of-Text plan upgrade for the stored `starter` subscription
-- tier (the product-facing Pro tier). This migration only creates guarded
-- functions; it does not select, modify, or enqueue any customer plan.

-- A staged replacement is allowed to coexist with the active serving plan.
-- Ordinary daily requests must keep using the active plan until the staged
-- replacement has finished all 200 items and activation supersedes it.
CREATE OR REPLACE FUNCTION public.ensure_wall_text_content_plan(
  p_user_id text,
  p_project_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_timezone text,
  p_business_description text,
  p_planning_context jsonb,
  p_target_item_count integer,
  p_planner_model text,
  p_planner_prompt_version text
)
RETURNS public.wall_text_content_plans
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_current_date date;
  v_next_plan_version integer;
  v_now timestamptz := timezone('utc', now());
  v_owner_status text;
  v_plan public.wall_text_content_plans%rowtype;
  v_reopen_plan boolean := false;
BEGIN
  IF nullif(btrim(coalesce(p_user_id, '')), '') IS NULL
     OR nullif(btrim(coalesce(p_project_id, '')), '') IS NULL
     OR p_business_profile_id IS NULL
     OR p_business_profile_version IS NULL
     OR p_business_profile_version <= 0
     OR nullif(btrim(coalesce(p_timezone, '')), '') IS NULL
     OR nullif(btrim(coalesce(p_business_description, '')), '') IS NULL
     OR char_length(btrim(p_business_description)) > 4000
     OR p_planning_context IS NULL
     OR jsonb_typeof(p_planning_context) <> 'object'
     OR p_target_item_count <> 200
     OR nullif(btrim(coalesce(p_planner_model, '')), '') IS NULL
     OR nullif(btrim(coalesce(p_planner_prompt_version, '')), '') IS NULL THEN
    RAISE EXCEPTION 'wall_text_content_plan_ensure_input_invalid';
  END IF;

  BEGIN
    v_current_date := timezone(btrim(p_timezone), v_now)::date;
  EXCEPTION
    WHEN invalid_parameter_value THEN
      RAISE EXCEPTION 'wall_text_content_plan_timezone_invalid';
  END;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'wall-text-content-plan:' || p_user_id || ':' || p_business_profile_id::text,
      819325101
    )
  );

  PERFORM 1
  FROM public.business_profiles AS profile
  WHERE profile.id = p_business_profile_id
    AND profile.user_id = p_user_id
    AND profile.project_id = p_project_id
    AND profile.profile_version = p_business_profile_version
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'business_profile_version_changed';
  END IF;

  SELECT plan.*
  INTO v_plan
  FROM public.wall_text_content_plans AS plan
  WHERE plan.user_id = p_user_id
    AND plan.business_profile_id = p_business_profile_id
    AND plan.business_profile_version = p_business_profile_version
    AND plan.status IN ('generating', 'active', 'failed')
    AND v_current_date BETWEEN plan.period_start_date AND plan.period_end_date
  ORDER BY
    CASE plan.status
      WHEN 'active' THEN 0
      WHEN 'generating' THEN 1
      ELSE 2
    END,
    plan.period_start_date DESC,
    plan.plan_version DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_plan.status = 'failed' THEN
      v_reopen_plan := true;
    ELSIF v_plan.status = 'generating'
      AND v_plan.generation_job_id IS NOT NULL THEN
      SELECT job.status
      INTO v_owner_status
      FROM public.background_jobs AS job
      WHERE job.id = v_plan.generation_job_id;

      IF v_owner_status IN ('failed', 'cancelled') THEN
        v_reopen_plan := true;
      END IF;
    END IF;

    IF v_reopen_plan
       AND v_plan.early_delivery_enabled
       AND v_plan.generation_attempt >= 3 THEN
      RETURN v_plan;
    END IF;

    IF v_reopen_plan THEN
      UPDATE public.wall_text_content_plans AS plan
      SET
        status = 'generating',
        activated_at = NULL,
        failed_at = NULL,
        failure_reason = NULL,
        generation_attempt = plan.generation_attempt + 1,
        generation_completed_at = NULL,
        generation_job_id = NULL,
        generation_started_at = NULL,
        superseded_at = NULL,
        superseded_by_plan_id = NULL,
        updated_at = v_now
      WHERE plan.id = v_plan.id
      RETURNING plan.* INTO v_plan;
    END IF;

    RETURN v_plan;
  END IF;

  SELECT coalesce(max(plan.plan_version), 0) + 1
  INTO v_next_plan_version
  FROM public.wall_text_content_plans AS plan
  WHERE plan.business_profile_id = p_business_profile_id
    AND plan.business_profile_version = p_business_profile_version
    AND plan.period_start_date = v_current_date;

  INSERT INTO public.wall_text_content_plans (
    user_id, project_id, business_profile_id, business_profile_version,
    period_start_date, period_end_date, timezone, plan_version,
    business_description, planning_context, target_item_count,
    planner_model, planner_prompt_version
  ) VALUES (
    p_user_id, p_project_id, p_business_profile_id, p_business_profile_version,
    v_current_date, v_current_date + 29, btrim(p_timezone), v_next_plan_version,
    btrim(p_business_description), p_planning_context, p_target_item_count,
    btrim(p_planner_model), btrim(p_planner_prompt_version)
  ) RETURNING * INTO v_plan;

  RETURN v_plan;
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_wall_text_fact_matched_plan_replacement_v1(
  p_user_id text,
  p_project_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_timezone text,
  p_business_description text,
  p_planning_context jsonb,
  p_target_item_count integer,
  p_planner_model text,
  p_planner_prompt_version text
)
RETURNS public.wall_text_content_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_active_plan public.wall_text_content_plans%rowtype;
  v_current_date date;
  v_existing_replacement public.wall_text_content_plans%rowtype;
  v_next_plan_version integer;
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF nullif(btrim(coalesce(p_user_id, '')), '') IS NULL
     OR nullif(btrim(coalesce(p_project_id, '')), '') IS NULL
     OR p_business_profile_id IS NULL
     OR p_business_profile_version IS NULL
     OR p_business_profile_version <= 0
     OR nullif(btrim(coalesce(p_timezone, '')), '') IS NULL
     OR nullif(btrim(coalesce(p_business_description, '')), '') IS NULL
     OR char_length(btrim(p_business_description)) > 4000
     OR p_planning_context IS NULL
     OR jsonb_typeof(p_planning_context) <> 'object'
     OR p_target_item_count <> 200
     OR nullif(btrim(coalesce(p_planner_model, '')), '') IS NULL
     OR position('fact-first' IN coalesce(p_planner_prompt_version, '')) = 0 THEN
    RAISE EXCEPTION 'wall_text_fact_matched_replacement_input_invalid';
  END IF;

  BEGIN
    v_current_date := timezone(btrim(p_timezone), v_now)::date;
  EXCEPTION
    WHEN invalid_parameter_value THEN
      RAISE EXCEPTION 'wall_text_content_plan_timezone_invalid';
  END;

  -- The stored Starter tier is product-facing Pro. Free and Creator users are
  -- rejected here even if an accidental caller reaches the service-only RPC.
  PERFORM 1
  FROM public.billing_subscriptions AS subscription
  WHERE subscription.user_id = p_user_id
    AND subscription.status = 'active'
    AND subscription.plan_key = 'starter';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'wall_text_fact_matched_replacement_requires_active_pro';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'wall-text-content-plan:' || p_user_id || ':' || p_business_profile_id::text,
      819325101
    )
  );

  PERFORM 1
  FROM public.business_profiles AS profile
  WHERE profile.id = p_business_profile_id
    AND profile.user_id = p_user_id
    AND profile.project_id = p_project_id
    AND profile.profile_version = p_business_profile_version
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'business_profile_version_changed';
  END IF;

  -- Retrying the dispatcher must find the already-staged plan instead of
  -- creating another 200-item plan or another background job.
  SELECT plan.*
  INTO v_existing_replacement
  FROM public.wall_text_content_plans AS plan
  WHERE plan.user_id = p_user_id
    AND plan.business_profile_id = p_business_profile_id
    AND plan.business_profile_version = p_business_profile_version
    AND plan.status = 'generating'
    AND plan.planner_prompt_version = btrim(p_planner_prompt_version)
    AND v_current_date BETWEEN plan.period_start_date AND plan.period_end_date
  ORDER BY plan.period_start_date DESC, plan.plan_version DESC
  LIMIT 1
  FOR UPDATE;
  IF FOUND THEN
    RETURN v_existing_replacement;
  END IF;

  SELECT plan.*
  INTO v_active_plan
  FROM public.wall_text_content_plans AS plan
  WHERE plan.user_id = p_user_id
    AND plan.business_profile_id = p_business_profile_id
    AND plan.business_profile_version = p_business_profile_version
    AND plan.status = 'active'
    AND v_current_date BETWEEN plan.period_start_date AND plan.period_end_date
  ORDER BY plan.period_start_date DESC, plan.plan_version DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'wall_text_fact_matched_replacement_no_active_plan';
  END IF;

  -- Already upgraded is a successful no-op. The dispatcher will see an active
  -- plan and will never enqueue another planner job.
  IF position('fact-first' IN v_active_plan.planner_prompt_version) > 0 THEN
    RETURN v_active_plan;
  END IF;

  SELECT coalesce(max(plan.plan_version), 0) + 1
  INTO v_next_plan_version
  FROM public.wall_text_content_plans AS plan
  WHERE plan.business_profile_id = p_business_profile_id
    AND plan.business_profile_version = p_business_profile_version
    AND plan.period_start_date = v_current_date;

  INSERT INTO public.wall_text_content_plans (
    user_id, project_id, business_profile_id, business_profile_version,
    period_start_date, period_end_date, timezone, plan_version,
    business_description, planning_context, target_item_count,
    planner_model, planner_prompt_version
  ) VALUES (
    p_user_id, p_project_id, p_business_profile_id, p_business_profile_version,
    v_current_date, v_current_date + 29, btrim(p_timezone), v_next_plan_version,
    btrim(p_business_description), p_planning_context, p_target_item_count,
    btrim(p_planner_model), btrim(p_planner_prompt_version)
  ) RETURNING * INTO v_existing_replacement;

  RETURN v_existing_replacement;
END;
$function$;

REVOKE ALL ON FUNCTION public.start_wall_text_fact_matched_plan_replacement_v1(
  text, text, uuid, integer, text, text, jsonb, integer, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_wall_text_fact_matched_plan_replacement_v1(
  text, text, uuid, integer, text, text, jsonb, integer, text, text
) TO service_role;

SELECT pg_notify('pgrst', 'reload schema');
