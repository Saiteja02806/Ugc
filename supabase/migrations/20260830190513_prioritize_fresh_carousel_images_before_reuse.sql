-- A Carousel must exhaust every approved image that is new to this business
-- profile before it reuses an older image. The existing shuffle-bag cycle
-- still governs reuse after that fresh pool is empty.
--
-- This is deliberately a guarded, additive replacement: the production
-- baseline already owns the complete reservation function, so replacing only
-- its known selection block avoids duplicating an error-prone, long function
-- body in a later migration. The guard fails safely if the baseline contract
-- changes instead of silently weakening Carousel source selection.

do $migration$
declare
  v_function_definition text;
  v_existing_selector text := $selector$
    select image_asset.*
    into v_asset
    from public.category_image_assets as image_asset
    where image_asset.category_slug = v_category
      and image_asset.asset_role = v_role
      and (
        (
          v_role = 'product_asset'
          and image_asset.owner_business_profile_id = p_business_profile_id
        )
        or (
          v_role <> 'product_asset'
          and image_asset.owner_business_profile_id is null
        )
      )
      and image_asset.library_asset_id is not null
      and image_asset.is_active
      and image_asset.status = 'ready'
      and image_asset.subject_review_status = 'approved'
      and image_asset.runtime_exclusion_reason is null
      and not (image_asset.id = any(v_selected_asset_ids))
      and not exists (
        select 1
        from public.carousel_image_usage as image_usage
        where image_usage.business_profile_id = p_business_profile_id
          and image_usage.category_slug = v_category
          and image_usage.asset_role = v_role
          and image_usage.cycle_number = v_cycle
          and image_usage.asset_id = image_asset.id
          and image_usage.usage_type = 'assigned'
      )
    order by md5(
      p_business_profile_id::text
      || ':' || v_category
      || ':' || v_role
      || ':' || v_cycle::text
      || ':' || image_asset.id::text
    ), image_asset.id
    limit 1;
$selector$;
  v_fresh_selector text := $selector$
    -- carousel_fresh_first:20260830214000
    -- A later upload has no assignment for this business profile, so it is
    -- claimed before the shuffle-bag considers any older image for reuse.
    select image_asset.*
    into v_asset
    from public.category_image_assets as image_asset
    where image_asset.category_slug = v_category
      and image_asset.asset_role = v_role
      and (
        (
          v_role = 'product_asset'
          and image_asset.owner_business_profile_id = p_business_profile_id
        )
        or (
          v_role <> 'product_asset'
          and image_asset.owner_business_profile_id is null
        )
      )
      and image_asset.library_asset_id is not null
      and image_asset.is_active
      and image_asset.status = 'ready'
      and image_asset.subject_review_status = 'approved'
      and image_asset.runtime_exclusion_reason is null
      and not (image_asset.id = any(v_selected_asset_ids))
      and not exists (
        select 1
        from public.carousel_image_usage as image_usage
        where image_usage.business_profile_id = p_business_profile_id
          and image_usage.asset_id = image_asset.id
          and image_usage.usage_type = 'assigned'
      )
    order by image_asset.created_at desc, image_asset.id
    limit 1;

    if v_asset.id is null then
$selector$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.reserve_carousel_role_assets_v2(uuid,uuid,text,jsonb,boolean)'::regprocedure
  )
  into v_function_definition;

  if position('carousel_fresh_first:20260830214000' in v_function_definition) > 0 then
    return;
  end if;

  if position(v_existing_selector in v_function_definition) = 0 then
    raise exception
      'carousel_fresh_first_baseline_selector_not_found';
  end if;

  v_function_definition := replace(
    v_function_definition,
    v_existing_selector,
    v_fresh_selector || v_existing_selector || E'\n    end if;'
  );

  execute v_function_definition;
end;
$migration$;

revoke all on function public.reserve_carousel_role_assets_v2(uuid, uuid, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.reserve_carousel_role_assets_v2(uuid, uuid, text, jsonb, boolean)
  to postgres, service_role;
