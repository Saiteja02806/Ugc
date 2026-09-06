-- 20260905044832 made the reservation arrays dynamic, but it placed their
-- array_fill expressions in the DECLARE block. PostgreSQL evaluates those
-- initializers before v_slide_count is assigned in BEGIN, which makes every
-- reservation fail with "dimension values cannot be null". Keep the
-- migration-compatible 5/6 slide contract, but initialize the arrays only
-- after validating and assigning the requested slide count.
do $migration$
declare
  v_function_definition text;
  v_count_assignment text :=
    '  v_slide_count := jsonb_array_length(p_slide_plan);';
  v_initialized_marker text :=
    '-- carousel_six_slide_arrays_initialized:20260906091416';
begin
  select pg_catalog.pg_get_functiondef(
    'public.reserve_carousel_role_assets_v2(uuid,uuid,text,jsonb,boolean)'::regprocedure
  )
  into v_function_definition;

  if position(v_initialized_marker in v_function_definition) > 0 then
    return;
  end if;

  if position('carousel_six_slide_reservation:20260905044832' in v_function_definition) = 0
    or position(v_count_assignment in v_function_definition) = 0
    or position('v_actual_categories text[] := array_fill(null::text, array[v_slide_count]);' in v_function_definition) = 0
    or position('v_requested_selection_types text[] := array_fill(null::text, array[v_slide_count]);' in v_function_definition) = 0
  then
    raise exception 'carousel_six_slide_reservation_initialization_baseline_not_found';
  end if;

  v_function_definition := regexp_replace(
    v_function_definition,
    E'^  (v_(?:actual|requested)_(?:categories|levels|reasons|roles|selection_types)) text\\[\\] := array_fill\\(null::text, array\\[v_slide_count\\]\\);$',
    E'  \\1 text[];',
    'gm'
  );

  if position('array_fill(null::text, array[v_slide_count])' in v_function_definition) > 0 then
    raise exception 'carousel_six_slide_reservation_array_initializer_rewrite_incomplete';
  end if;

  v_function_definition := replace(
    v_function_definition,
    v_count_assignment,
    v_count_assignment || E'\n'
      || '  ' || v_initialized_marker || E'\n'
      || '  v_actual_categories := array_fill(null::text, array[v_slide_count]);' || E'\n'
      || '  v_actual_levels := array_fill(null::text, array[v_slide_count]);' || E'\n'
      || '  v_actual_reasons := array_fill(null::text, array[v_slide_count]);' || E'\n'
      || '  v_actual_roles := array_fill(null::text, array[v_slide_count]);' || E'\n'
      || '  v_actual_selection_types := array_fill(null::text, array[v_slide_count]);' || E'\n'
      || '  v_requested_categories := array_fill(null::text, array[v_slide_count]);' || E'\n'
      || '  v_requested_levels := array_fill(null::text, array[v_slide_count]);' || E'\n'
      || '  v_requested_reasons := array_fill(null::text, array[v_slide_count]);' || E'\n'
      || '  v_requested_roles := array_fill(null::text, array[v_slide_count]);' || E'\n'
      || '  v_requested_selection_types := array_fill(null::text, array[v_slide_count]);'
  );

  execute v_function_definition;
end;
$migration$;

select pg_notify('pgrst', 'reload schema');
