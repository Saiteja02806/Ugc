-- Keep now() as timestamptz until it is converted to the plan's local time.
-- Converting to UTC timestamp first reverses the offset and can reject a
-- valid first-day plan as pending. Preserve the existing function and grants.
DO $migration$
DECLARE
  v_function regprocedure := 'public.reserve_wall_text_generation_batch_v1(text,uuid,integer,text,text,text,text,text,text,jsonb)'::regprocedure;
  v_definition text := pg_catalog.pg_get_functiondef(v_function);
  v_old text := 'timezone(plan.timezone, timezone(''utc'', now()))::date';
  v_new text := 'timezone(plan.timezone, now())::date';
BEGIN
  IF (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one Wall plan date predicate; inspect function drift before applying';
  END IF;
  EXECUTE replace(v_definition, v_old, v_new);
END;
$migration$;
