-- Completed ideas remain reusable when another candidate in the same writer
-- batch failed. Patch only the two terminal-reservation eligibility predicates;
-- retain locking, owner checks, exact-request replay and usage history.
DO $migration$
DECLARE
  v_definition text;
  v_old_predicate text := $$previous_reservation.status in ('completed', 'expired_partial')$$;
  v_new_predicate text := $$previous_reservation.status in ('completed', 'expired_partial', 'released_partial')$$;
  v_old_count integer;
  v_new_count integer;
BEGIN
  v_definition := pg_get_functiondef(
    'public.reserve_carousel_content_plan_items(text,uuid,integer,integer,text,integer)'::regprocedure
  );
  v_old_count := (length(v_definition) - length(replace(v_definition, v_old_predicate, '')))
    / length(v_old_predicate);
  v_new_count := (length(v_definition) - length(replace(v_definition, v_new_predicate, '')))
    / length(v_new_predicate);

  -- Reapplying this migration is safe. Fail closed if the installed allocator
  -- has changed rather than replacing unrelated function behavior.
  IF v_old_count = 0 AND v_new_count = 2 THEN
    RETURN;
  END IF;
  IF v_old_count <> 2 OR v_new_count <> 0 THEN
    RAISE EXCEPTION 'carousel_content_plan_partial_reuse_predicates_changed';
  END IF;

  EXECUTE replace(v_definition, v_old_predicate, v_new_predicate);
END;
$migration$;
