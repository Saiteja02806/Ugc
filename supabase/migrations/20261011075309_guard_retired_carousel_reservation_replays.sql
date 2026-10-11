-- Source retirement must also fence an already-reserved generation retry.
-- New reservations already require active, ready, approved sources. Both
-- idempotent replay branches previously bypassed those eligibility checks.
-- Keep all original assigned usage, cycle state, source rows and rendered
-- history: the caller must create a successor instead of recycling that proof.
-- This changes only public.reserve_carousel_role_assets_v2; using the current
-- pg_get_functiondef preserves its signature, owner, ACL and search_path.
do $migration$
declare
  v_function_definition text;
  v_replay_count integer;
  v_replay_return text := $replay$
    return query
    select
      image_usage.slide_number,$replay$;
  v_replay_guard text := $guard$
    -- carousel_reserved_source_retirement_guard:20261011075309
    if exists (
      select 1
      from public.carousel_image_usage as image_usage
      left join public.category_image_assets as image_asset
        on image_asset.id = image_usage.asset_id
      where image_usage.carousel_id = p_carousel_id
        and image_usage.usage_type = 'assigned'
        and (
          image_asset.id is null
          or image_asset.is_active is distinct from true
          or image_asset.status is distinct from 'ready'
          or image_asset.subject_review_status is distinct from 'approved'
          or image_asset.runtime_exclusion_reason is not null
          or image_asset.library_asset_id is null
        )
    ) then
      raise exception 'carousel_image_reserved_source_retired';
    end if;

$guard$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.reserve_carousel_role_assets_v2(uuid,uuid,text,jsonb,boolean)'::regprocedure
  )
  into v_function_definition;

  if position('carousel_reserved_source_retirement_guard:20261011075309' in v_function_definition) > 0 then
    if (
      length(v_function_definition) - length(replace(
        v_function_definition,
        'carousel_reserved_source_retirement_guard:20261011075309',
        ''
      ))
    ) / length('carousel_reserved_source_retirement_guard:20261011075309') <> 2 then
      raise exception 'carousel_reserved_source_retirement_guard_is_partial';
    end if;
    return;
  end if;

  if position('carousel_six_slide_reservation:20260905044832' in v_function_definition) = 0
    or position('carousel_six_slide_arrays_initialized:20260906091416' in v_function_definition) = 0
    or position('carousel_fresh_first:20260830214000' in v_function_definition) = 0
  then
    raise exception 'carousel_reserved_source_retirement_baseline_not_found';
  end if;

  v_replay_count := (
    length(v_function_definition)
    - length(replace(v_function_definition, v_replay_return, ''))
  ) / length(v_replay_return);
  if v_replay_count <> 2 then
    raise exception 'carousel_reserved_source_retirement_replay_branches_not_found:%',
      v_replay_count;
  end if;

  -- The unindented final return is intentionally not patched: its new
  -- reservation selectors already enforce the exact same eligibility gates.
  v_function_definition := replace(
    v_function_definition,
    v_replay_return,
    v_replay_guard || v_replay_return
  );
  execute v_function_definition;
end;
$migration$;

select pg_notify('pgrst', 'reload schema');
