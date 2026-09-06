-- Keep the reservation function compatible with five-slide jobs that were
-- already queued when this migration runs. New app and worker code generates
-- only six slides; accepting five here prevents the prescribed migration-first
-- rollout from leaving an in-flight job without its reserved images.
do $migration$
declare
  v_function_definition text;
  v_original_plan_validation text := $validation$
  if p_slide_plan is null
    or jsonb_typeof(p_slide_plan) <> 'array'
    or jsonb_array_length(p_slide_plan) <> 5
  then
    raise exception 'carousel_image_slide_plan_requires_five_items';
  end if;
$validation$;
  v_compatible_plan_validation text := $validation$
  -- carousel_six_slide_reservation:20260905044832
  -- p_slide_plan was validated before any existing reservation is returned.
$validation$;
  v_original_role_validation text := $roles$
  if not (
    v_requested_roles = array['hook', 'human', 'static', 'human', 'static']::text[]
    or v_requested_roles = array['hook', 'static', 'human', 'static', 'human']::text[]
  ) then
    raise exception 'carousel_image_slide_role_ratio_invalid';
  end if;
$roles$;
  v_compatible_role_validation text := $roles$
  if not (
    (v_slide_count = 5 and (
      v_requested_roles = array['hook', 'human', 'static', 'human', 'static']::text[]
      or v_requested_roles = array['hook', 'static', 'human', 'static', 'human']::text[]
    ))
    or (v_slide_count = 6 and (
      v_requested_roles = array['hook', 'human', 'static', 'human', 'static', 'static']::text[]
      or v_requested_roles = array['hook', 'static', 'human', 'static', 'human', 'static']::text[]
    ))
  ) then
    raise exception 'carousel_image_slide_role_ratio_invalid';
  end if;
$roles$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.reserve_carousel_role_assets_v2(uuid,uuid,text,jsonb,boolean)'::regprocedure
  )
  into v_function_definition;

  if position('carousel_six_slide_reservation:20260905044832' in v_function_definition) > 0 then
    return;
  end if;

  if position(v_original_plan_validation in v_function_definition) = 0
    or position(v_original_role_validation in v_function_definition) = 0
    or position('v_existing_count <> 5' in v_function_definition) = 0
  then
    raise exception 'carousel_six_slide_reservation_baseline_not_found';
  end if;

  v_function_definition := replace(
    v_function_definition,
    '  select generation.user_id',
    $prefix$
  if p_slide_plan is null
    or jsonb_typeof(p_slide_plan) <> 'array'
  then
    raise exception 'carousel_image_slide_plan_requires_five_or_six_items';
  end if;

  v_slide_count := jsonb_array_length(p_slide_plan);
  if v_slide_count not in (5, 6) then
    raise exception 'carousel_image_slide_plan_requires_five_or_six_items';
  end if;

  select generation.user_id$prefix$
  );
  v_function_definition := replace(
    v_function_definition,
    'declare',
    'declare' || E'\n  -- carousel_six_slide_reservation:20260905044832\n  v_slide_count integer;'
  );
  v_function_definition := replace(
    v_function_definition,
    'array[null, null, null, null, null]::text[]',
    'array_fill(null::text, array[v_slide_count])'
  );
  v_function_definition := replace(
    v_function_definition,
    'v_existing_count <> 5',
    'v_existing_count <> v_slide_count'
  );
  v_function_definition := replace(
    v_function_definition,
    v_original_plan_validation,
    v_compatible_plan_validation
  );
  v_function_definition := replace(
    v_function_definition,
    'for v_index in 1..5',
    'for v_index in 1..v_slide_count'
  );
  v_function_definition := replace(
    v_function_definition,
    'for v_index in reverse 5..1',
    'for v_index in reverse v_slide_count..1'
  );
  v_function_definition := replace(
    v_function_definition,
    v_original_role_validation,
    v_compatible_role_validation
  );
  v_function_definition := replace(
    v_function_definition,
    'v_asset_count < case when v_product_available then 1 else 2 end',
    'v_asset_count < case when v_product_available then v_slide_count - 4 else v_slide_count - 3 end'
  );

  execute v_function_definition;
end;
$migration$;

revoke all on function public.reserve_carousel_role_assets_v2(uuid, uuid, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.reserve_carousel_role_assets_v2(uuid, uuid, text, jsonb, boolean)
  to postgres, service_role;

alter table public.carousel_slides
  drop constraint if exists carousel_slides_story_role_check;

alter table public.carousel_slides
  add constraint carousel_slides_story_role_check
  check (
    story_role is null
    or story_role = any (
      array[
        'recognition'::text,
        'failure_scene'::text,
        'reframe'::text,
        'product_turning_point'::text,
        'proof_reflection_cta'::text,
        'takeaway_cta'::text
      ]
    )
  );

comment on column public.carousel_generations.content_format_id is
  'Backend-reserved six-slide content structure. This is separate from format, which stores the canvas ratio.';

select pg_notify('pgrst', 'reload schema');
