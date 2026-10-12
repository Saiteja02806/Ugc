-- No usage, slides, assignments or stored renders are rewritten.
set lock_timeout = '5s';
-- Explicit reviewed extra categories share the same canonical bytes and identity.
create or replace function public.carousel_role_asset_matches_category(
  p_asset public.category_image_assets, p_category text
) returns boolean language sql immutable parallel safe set search_path = ''
as $function$
  select p_asset.category_slug = p_category or (
    p_asset.owner_business_profile_id is null
    and p_asset.asset_role in ('hook','human','static')
    and p_asset.source_metadata -> 'reviewedRoleCategories' ? p_category
    and p_category in ('gym','food','productivity','dating','travel','skin')
  );
$function$;
revoke all on function public.carousel_role_asset_matches_category(public.category_image_assets,text) from public, anon, authenticated;
grant execute on function public.carousel_role_asset_matches_category(public.category_image_assets,text) to service_role;

CREATE OR REPLACE FUNCTION public.reserve_carousel_role_assets_v2(p_business_profile_id uuid, p_carousel_id uuid, p_primary_category_slug text, p_slide_plan jsonb, p_use_product_asset boolean DEFAULT false)
 RETURNS TABLE(slide_number integer, asset_id uuid, library_asset_id text, category_slug text, requested_category_slug text, primary_category_slug text, asset_role text, selection_type text, relevance_level text, relevance_reason text, cycle_number integer, base_s3_key text, base_url text, source_file_sha256 text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  -- carousel_six_slide_reservation:20260905044832
  -- carousel_delivery_aware_rotation:20261011100000
  v_slide_count integer;
  v_feed_date date;
  v_profile_version integer;
  v_same_cycle boolean;
  v_actual_categories text[];
  v_actual_levels text[];
  v_actual_reasons text[];
  v_actual_roles text[];
  v_actual_selection_types text[];
  v_asset public.category_image_assets%rowtype;
  v_asset_count integer;
  v_category text;
  v_cycle integer;
  v_existing_count integer;
  v_index integer;
  v_last_asset_id uuid;
  v_plan_item jsonb;
  v_product_available boolean;
  v_product_index integer;
  v_related_count integer := 0;
  v_requested_categories text[];
  v_requested_levels text[];
  v_requested_reasons text[];
  v_requested_roles text[];
  v_requested_selection_types text[];
  v_role text;
  v_selected_asset_ids uuid[] := '{}'::uuid[];
  v_slide_number integer;
  v_user_id text;
begin
  if p_primary_category_slug is null
    or p_primary_category_slug not in (
      'gym', 'food', 'productivity', 'dating', 'travel', 'skin'
    )
  then
    raise exception 'carousel_image_library_category_not_supported:%',
      p_primary_category_slug;
  end if;


  if p_slide_plan is null
    or jsonb_typeof(p_slide_plan) <> 'array'
  then
    raise exception 'carousel_image_slide_plan_requires_five_or_six_items';
  end if;

  v_slide_count := jsonb_array_length(p_slide_plan);
  -- carousel_six_slide_arrays_initialized:20260906091416
  v_actual_categories := array_fill(null::text, array[v_slide_count]);
  v_actual_levels := array_fill(null::text, array[v_slide_count]);
  v_actual_reasons := array_fill(null::text, array[v_slide_count]);
  v_actual_roles := array_fill(null::text, array[v_slide_count]);
  v_actual_selection_types := array_fill(null::text, array[v_slide_count]);
  v_requested_categories := array_fill(null::text, array[v_slide_count]);
  v_requested_levels := array_fill(null::text, array[v_slide_count]);
  v_requested_reasons := array_fill(null::text, array[v_slide_count]);
  v_requested_roles := array_fill(null::text, array[v_slide_count]);
  v_requested_selection_types := array_fill(null::text, array[v_slide_count]);
  if v_slide_count not in (5, 6) then
    raise exception 'carousel_image_slide_plan_requires_five_or_six_items';
  end if;

  select generation.user_id, generation.business_profile_version,
    coalesce(generation.available_on_local_date, generation.created_at::date)
  into v_user_id, v_profile_version, v_feed_date
  from public.carousel_generations as generation
  where generation.id = p_carousel_id
    and generation.business_profile_id = p_business_profile_id;

  if v_user_id is null then
    raise exception 'carousel_image_reservation_owner_mismatch';
  end if;

  select count(*)::integer
  into v_existing_count
  from public.carousel_image_usage as image_usage
  where image_usage.carousel_id = p_carousel_id
    and image_usage.usage_type = 'assigned';

  if v_existing_count > 0 then
    if v_existing_count <> v_slide_count then
      raise exception 'carousel_image_reservation_is_partial:%', v_existing_count;
    end if;

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


    return query
    select
      image_usage.slide_number,
      image_asset.id,
      image_asset.library_asset_id,
      image_usage.category_slug,
      coalesce(image_usage.requested_category_slug, image_usage.category_slug),
      coalesce(image_usage.primary_category_slug, p_primary_category_slug),
      image_usage.asset_role,
      coalesce(image_usage.selection_type, 'primary'),
      coalesce(image_usage.relevance_level, 'none'),
      image_usage.relevance_reason,
      image_usage.cycle_number,
      image_asset.base_s3_key,
      image_asset.base_url,
      image_asset.source_file_sha256
    from public.carousel_image_usage as image_usage
    join public.category_image_assets as image_asset
      on image_asset.id = image_usage.asset_id
    where image_usage.carousel_id = p_carousel_id
      and image_usage.usage_type = 'assigned'
    order by image_usage.slide_number;
    return;
  end if;

  -- carousel_six_slide_reservation:20260905044832
  -- p_slide_plan was validated before any existing reservation is returned.

  for v_index in 1..v_slide_count
  loop
    v_plan_item := p_slide_plan -> (v_index - 1);

    if jsonb_typeof(v_plan_item) <> 'object' then
      raise exception 'carousel_image_slide_plan_item_invalid:%', v_index;
    end if;

    begin
      v_slide_number := (v_plan_item ->> 'slide_number')::integer;
    exception
      when invalid_text_representation then
        raise exception 'carousel_image_slide_plan_number_invalid:%', v_index;
    end;

    if v_slide_number is null or v_slide_number <> v_index then
      raise exception 'carousel_image_slide_plan_order_invalid:%:%',
        v_index,
        v_slide_number;
    end if;

    v_requested_categories[v_index] := v_plan_item ->> 'category_slug';
    v_requested_roles[v_index] := v_plan_item ->> 'asset_role';
    v_requested_selection_types[v_index] := v_plan_item ->> 'selection_type';
    v_requested_levels[v_index] := v_plan_item ->> 'relevance_level';
    v_requested_reasons[v_index] := nullif(
      left(coalesce(v_plan_item ->> 'relevance_reason', ''), 500),
      ''
    );

    if v_requested_categories[v_index] is null
      or v_requested_categories[v_index] not in (
        'gym', 'food', 'productivity', 'dating', 'travel', 'skin'
      )
    then
      raise exception 'carousel_image_slide_category_invalid:%:%',
        v_index,
        v_requested_categories[v_index];
    end if;

    if v_requested_roles[v_index] is null
      or v_requested_roles[v_index] not in ('hook', 'human', 'static')
    then
      raise exception 'carousel_image_slide_role_invalid:%:%',
        v_index,
        v_requested_roles[v_index];
    end if;

    if v_requested_selection_types[v_index] is null
      or v_requested_selection_types[v_index] not in ('primary', 'related')
    then
      raise exception 'carousel_image_slide_selection_type_invalid:%:%',
        v_index,
        v_requested_selection_types[v_index];
    end if;

    if v_requested_levels[v_index] is null
      or v_requested_levels[v_index] not in (
        'none', 'light', 'moderate', 'strong'
      )
    then
      raise exception 'carousel_image_slide_relevance_invalid:%:%',
        v_index,
        v_requested_levels[v_index];
    end if;

    if v_requested_categories[v_index] = p_primary_category_slug then
      if v_requested_selection_types[v_index] <> 'primary'
        or v_requested_levels[v_index] <> 'none'
      then
        raise exception 'carousel_image_primary_slide_metadata_invalid:%', v_index;
      end if;
    else
      if v_requested_roles[v_index] <> 'static'
        or v_requested_selection_types[v_index] <> 'related'
        or v_requested_levels[v_index] = 'none'
      then
        raise exception 'carousel_image_related_slide_metadata_invalid:%', v_index;
      end if;

      if not (
        (p_primary_category_slug = 'gym' and v_requested_categories[v_index] = 'food')
        or (p_primary_category_slug = 'food' and v_requested_categories[v_index] = 'gym')
        or (p_primary_category_slug = 'travel' and v_requested_categories[v_index] = 'food')
      ) then
        raise exception 'carousel_image_related_category_not_allowed:%:%',
          p_primary_category_slug,
          v_requested_categories[v_index];
      end if;

      v_related_count := v_related_count + 1;
    end if;
  end loop;

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

  if v_requested_categories[1] <> p_primary_category_slug
    or v_requested_roles[1] <> 'hook'
    or v_requested_selection_types[1] <> 'primary'
    or v_related_count > 2
  then
    raise exception 'carousel_image_slide_plan_primary_boundary_invalid';
  end if;

  if (
    select count(*)
    from generate_subscripts(v_requested_categories, 1) as subscript_position(position)
    where subscript_position.position > 1
      and v_requested_categories[subscript_position.position] = p_primary_category_slug
  ) < 2 then
    raise exception 'carousel_image_slide_plan_primary_tail_too_small';
  end if;

  select exists (
    select 1
    from public.category_image_assets as image_asset
    where public.carousel_role_asset_matches_category(image_asset, p_primary_category_slug)
      and image_asset.asset_role = 'product_asset'
      and image_asset.owner_business_profile_id = p_business_profile_id
      and image_asset.library_asset_id is not null
      and image_asset.is_active
      and image_asset.status = 'ready'
      and image_asset.subject_review_status = 'approved'
      and image_asset.runtime_exclusion_reason is null
  )
  into v_product_available;

  v_product_available := p_use_product_asset and v_product_available;
  v_actual_categories := v_requested_categories;
  v_actual_roles := v_requested_roles;
  v_actual_selection_types := v_requested_selection_types;
  v_actual_levels := v_requested_levels;
  v_actual_reasons := v_requested_reasons;

  if v_product_available then
    for v_index in reverse v_slide_count..1
    loop
      if v_actual_roles[v_index] = 'static' then
        v_product_index := v_index;
        exit;
      end if;
    end loop;

    if v_product_index is null then
      raise exception 'carousel_image_product_slot_missing';
    end if;

    v_actual_categories[v_product_index] := p_primary_category_slug;
    v_actual_roles[v_product_index] := 'product_asset';
    v_actual_selection_types[v_product_index] := 'product';
    v_actual_levels[v_product_index] := 'none';
    v_actual_reasons[v_product_index] := null;
    v_requested_categories[v_product_index] := p_primary_category_slug;
  end if;

  for v_index in 1..v_slide_count
  loop
    insert into public.carousel_image_rotation_pools (
      business_profile_id,
      category_slug,
      asset_role
    )
    values (
      p_business_profile_id,
      v_actual_categories[v_index],
      v_actual_roles[v_index]
    )
    on conflict on constraint carousel_image_rotation_pools_pkey do nothing;
  end loop;

  insert into public.carousel_image_rotation_pools (
    business_profile_id,
    category_slug,
    asset_role
  )
  values (
    p_business_profile_id,
    p_primary_category_slug,
    'static'
  )
  on conflict on constraint carousel_image_rotation_pools_pkey do nothing;

  perform 1
  from public.carousel_image_rotation_pools as rotation_pool
  where rotation_pool.business_profile_id = p_business_profile_id
    and (
      (
        rotation_pool.category_slug = p_primary_category_slug
        and rotation_pool.asset_role in ('hook', 'human', 'static', 'product_asset')
      )
      or (
        rotation_pool.asset_role = 'static'
        and rotation_pool.category_slug = any(v_actual_categories)
      )
    )
  order by rotation_pool.category_slug, rotation_pool.asset_role
  for update;

  select count(*)::integer
  into v_existing_count
  from public.carousel_image_usage as image_usage
  where image_usage.carousel_id = p_carousel_id
    and image_usage.usage_type = 'assigned';

  if v_existing_count > 0 then
    if v_existing_count <> v_slide_count then
      raise exception 'carousel_image_reservation_is_partial:%', v_existing_count;
    end if;

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


    return query
    select
      image_usage.slide_number,
      image_asset.id,
      image_asset.library_asset_id,
      image_usage.category_slug,
      coalesce(image_usage.requested_category_slug, image_usage.category_slug),
      coalesce(image_usage.primary_category_slug, p_primary_category_slug),
      image_usage.asset_role,
      coalesce(image_usage.selection_type, 'primary'),
      coalesce(image_usage.relevance_level, 'none'),
      image_usage.relevance_reason,
      image_usage.cycle_number,
      image_asset.base_s3_key,
      image_asset.base_url,
      image_asset.source_file_sha256
    from public.carousel_image_usage as image_usage
    join public.category_image_assets as image_asset
      on image_asset.id = image_usage.asset_id
    where image_usage.carousel_id = p_carousel_id
      and image_usage.usage_type = 'assigned'
    order by image_usage.slide_number;
    return;
  end if;

  foreach v_role in array array['hook', 'human', 'static']::text[]
  loop
    select count(*)::integer
    into v_asset_count
    from public.category_image_assets as image_asset
    where public.carousel_role_asset_matches_category(image_asset, p_primary_category_slug)
      and image_asset.asset_role = v_role
      and image_asset.owner_business_profile_id is null
      and image_asset.library_asset_id is not null
      and image_asset.is_active
      and image_asset.status = 'ready'
      and image_asset.subject_review_status = 'approved'
      and image_asset.runtime_exclusion_reason is null;

    if (
      v_role = 'hook' and v_asset_count < 1
    ) or (
      v_role = 'human' and v_asset_count < 2
    ) or (
      v_role = 'static'
      and v_asset_count < case when v_product_available then v_slide_count - 4 else v_slide_count - 3 end
    ) then
      raise exception 'carousel_image_role_pool_too_small:%:%:%',
        p_primary_category_slug,
        v_role,
        v_asset_count;
    end if;
  end loop;

  for v_index in 1..v_slide_count
  loop
    v_category := v_actual_categories[v_index];
    v_role := v_actual_roles[v_index];

    if v_role = 'static' and v_category <> p_primary_category_slug then
      if not exists (
        select 1
        from public.category_image_assets as image_asset
        where public.carousel_role_asset_matches_category(image_asset, v_category)
          and image_asset.asset_role = 'static'
          and image_asset.owner_business_profile_id is null
          and image_asset.library_asset_id is not null
          and image_asset.is_active
          and image_asset.status = 'ready'
          and image_asset.subject_review_status = 'approved'
          and image_asset.runtime_exclusion_reason is null
          and not (image_asset.id = any(v_selected_asset_ids))
      ) then
        v_category := p_primary_category_slug;
        v_actual_categories[v_index] := p_primary_category_slug;
        v_actual_selection_types[v_index] := 'related_fallback';
      end if;
    end if;

    select rotation_pool.cycle_number, rotation_pool.last_asset_id
    into v_cycle, v_last_asset_id
    from public.carousel_image_rotation_pools as rotation_pool
    where rotation_pool.business_profile_id = p_business_profile_id
      and rotation_pool.category_slug = v_category
      and rotation_pool.asset_role = v_role
    for update;

    -- carousel_fresh_first:20260830214000
    -- Prefer delivery diversity while leaving every historical reservation intact.
    -- Outstanding inventory is protected; terminal failures can be selected again.
    with history as (
      select u.asset_id,
        count(*) filter (where g.status = 'completed' and (
          exists (select 1 from public.daily_carousel_feed_items i where i.assignment_id = a.id)
          or exists (select 1 from public.daily_trending_feed_slots s where s.carousel_assignment_id = a.id)
        )) as deliveries,
        max(a.first_assigned_at) filter (where g.status = 'completed' and (
          exists (select 1 from public.daily_carousel_feed_items i where i.assignment_id = a.id)
          or exists (select 1 from public.daily_trending_feed_slots s where s.carousel_assignment_id = a.id)
        )) as last_delivery,
        bool_or(g.status <> 'failed' and (
          g.status <> 'completed' or (a.id is null and g.business_profile_version = v_profile_version)
        )) as outstanding,
        bool_or(g.status <> 'failed' and coalesce(g.available_on_local_date, g.created_at::date) = v_feed_date) as same_day,
        bool_or(u.category_slug = v_category and u.asset_role = v_role and u.cycle_number = v_cycle) as same_cycle
      from public.carousel_image_usage u
      join public.carousel_generations g on g.id = u.carousel_id
      left join public.user_carousel_assignments a on a.carousel_id = g.id
      where u.business_profile_id = p_business_profile_id and u.usage_type = 'assigned'
      group by u.asset_id
    )
    select image_asset.* into v_asset
    from public.category_image_assets image_asset
    left join history h on h.asset_id = image_asset.id
    where public.carousel_role_asset_matches_category(image_asset, v_category)
      and image_asset.asset_role = v_role
      and ((v_role = 'product_asset' and image_asset.owner_business_profile_id = p_business_profile_id)
        or (v_role <> 'product_asset' and image_asset.owner_business_profile_id is null))
      and image_asset.library_asset_id is not null
      and image_asset.is_active and image_asset.status = 'ready'
      and image_asset.subject_review_status = 'approved'
      and image_asset.runtime_exclusion_reason is null
      and not (image_asset.id = any(v_selected_asset_ids))
    order by
      coalesce(h.outstanding, false),
      coalesce(h.same_day, false),
      coalesce(h.deliveries, 0),
      h.last_delivery asc nulls first,
      coalesce(h.same_cycle, false),
      (image_asset.id = v_last_asset_id),
      md5(p_business_profile_id::text || ':' || v_category || ':' || v_role || ':' || v_cycle::text || ':' || image_asset.id::text),
      image_asset.id
    limit 1;

    select exists (
      select 1 from public.carousel_image_usage u
      where u.business_profile_id = p_business_profile_id
        and u.category_slug = v_category and u.asset_role = v_role
        and u.cycle_number = v_cycle and u.asset_id = v_asset.id
        and u.usage_type = 'assigned'
    ) into v_same_cycle;
    if v_same_cycle then
      -- Advance instead of deleting an old failed reservation or violating uniqueness.
      v_cycle := v_cycle + 1;
      update public.carousel_image_rotation_pools p
      set cycle_number = v_cycle, updated_at = now()
      where p.business_profile_id = p_business_profile_id
        and p.category_slug = v_category and p.asset_role = v_role;
    end if;

    if v_asset.id is null then
      raise exception 'carousel_image_role_pool_cannot_complete:%:%',
        v_category,
        v_role;
    end if;

    insert into public.carousel_image_usage (
      user_id,
      business_profile_id,
      asset_id,
      duplicate_family_id,
      carousel_id,
      category_slug,
      requested_category_slug,
      primary_category_slug,
      asset_role,
      selection_type,
      relevance_level,
      relevance_reason,
      cycle_number,
      slide_number,
      usage_type,
      reuse_reason
    )
    values (
      v_user_id,
      p_business_profile_id,
      v_asset.id,
      v_asset.source_file_sha256,
      p_carousel_id,
      v_category,
      v_requested_categories[v_index],
      p_primary_category_slug,
      v_role,
      v_actual_selection_types[v_index],
      v_actual_levels[v_index],
      v_actual_reasons[v_index],
      v_cycle,
      v_index,
      'assigned',
      case when v_cycle > 1 then 'shuffle_bag_cycle' else null end
    );

    update public.carousel_image_rotation_pools as rotation_pool
    set last_asset_id = v_asset.id, updated_at = now()
    where rotation_pool.business_profile_id = p_business_profile_id
      and rotation_pool.category_slug = v_category
      and rotation_pool.asset_role = v_role;

    v_selected_asset_ids := array_append(v_selected_asset_ids, v_asset.id);
  end loop;

  update public.category_image_assets as image_asset
  set usage_count = image_asset.usage_count + 1, updated_at = now()
  where image_asset.id = any(v_selected_asset_ids);

  return query
  select
    image_usage.slide_number,
    image_asset.id,
    image_asset.library_asset_id,
    image_usage.category_slug,
    image_usage.requested_category_slug,
    image_usage.primary_category_slug,
    image_usage.asset_role,
    image_usage.selection_type,
    image_usage.relevance_level,
    image_usage.relevance_reason,
    image_usage.cycle_number,
    image_asset.base_s3_key,
    image_asset.base_url,
    image_asset.source_file_sha256
  from public.carousel_image_usage as image_usage
  join public.category_image_assets as image_asset
    on image_asset.id = image_usage.asset_id
  where image_usage.carousel_id = p_carousel_id
    and image_usage.usage_type = 'assigned'
  order by image_usage.slide_number;
end;
$function$

;
revoke all on function public.reserve_carousel_role_assets_v2(uuid,uuid,text,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.reserve_carousel_role_assets_v2(uuid,uuid,text,jsonb,boolean) to service_role;
create index if not exists carousel_image_usage_profile_delivery_idx
  on public.carousel_image_usage (business_profile_id, asset_id, carousel_id)
  where usage_type = 'assigned';
-- This exact source exists in both user-supplied category folders. Preserve its canonical Gym role.
update public.category_image_assets
set source_metadata = coalesce(source_metadata, '{}'::jsonb) || jsonb_build_object('reviewedRoleCategories', jsonb_build_array('gym','productivity'))
where source_file_sha256 = '694c5027f68fd06a1a1195d627009b06873e17205f90fe480be53f097e6b3de4'
  and category_slug = 'gym' and asset_role = 'hook' and owner_business_profile_id is null
  and is_active and status = 'ready' and subject_review_status = 'approved'
  and runtime_exclusion_reason is null;
