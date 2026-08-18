alter table public.category_image_assets
  add column if not exists library_asset_id text,
  add column if not exists asset_role text,
  add column if not exists is_active boolean not null default false,
  add column if not exists owner_business_profile_id uuid
    references public.business_profiles(id) on delete cascade;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_library_asset_id_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_library_asset_id_chk
      check (
        library_asset_id is null
        or library_asset_id ~ '^[a-z0-9][a-z0-9_]{2,95}$'
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_asset_role_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_asset_role_chk
      check (
        asset_role is null
        or asset_role in ('hook', 'human', 'static', 'product_asset')
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_product_owner_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_product_owner_chk
      check (
        asset_role is null
        or (
          asset_role = 'product_asset'
          and owner_business_profile_id is not null
        )
        or (
          asset_role <> 'product_asset'
          and owner_business_profile_id is null
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_active_review_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_active_review_chk
      check (
        not is_active
        or (
          library_asset_id is not null
          and asset_role is not null
          and source_file_sha256 is not null
          and status = 'ready'
          and subject_review_status = 'approved'
          and runtime_exclusion_reason is null
        )
      )
      not valid;
  end if;
end $$;

create unique index if not exists category_image_assets_library_asset_id_uidx
  on public.category_image_assets (library_asset_id)
  where library_asset_id is not null;

create unique index if not exists category_image_assets_role_source_hash_uidx
  on public.category_image_assets (source_file_sha256)
  where library_asset_id is not null
    and source_file_sha256 is not null;

create index if not exists category_image_assets_role_pool_idx
  on public.category_image_assets (
    category_slug,
    asset_role,
    is_active,
    status,
    subject_review_status,
    id
  )
  where library_asset_id is not null;

create index if not exists category_image_assets_product_owner_idx
  on public.category_image_assets (
    owner_business_profile_id,
    category_slug,
    is_active,
    id
  )
  where asset_role = 'product_asset';

create table if not exists public.carousel_image_rotation_pools (
  business_profile_id uuid not null
    references public.business_profiles(id) on delete cascade,
  category_slug text not null,
  asset_role text not null
    check (asset_role in ('hook', 'human', 'static', 'product_asset')),
  cycle_number integer not null default 1
    check (cycle_number > 0),
  last_asset_id uuid
    references public.category_image_assets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_profile_id, category_slug, asset_role)
);

alter table public.carousel_image_rotation_pools enable row level security;

revoke all privileges on table public.carousel_image_rotation_pools
  from anon, authenticated;

grant select, insert, update on table public.carousel_image_rotation_pools
  to service_role;

alter table public.carousel_image_usage
  add column if not exists business_profile_id uuid
    references public.business_profiles(id) on delete cascade,
  add column if not exists category_slug text,
  add column if not exists asset_role text,
  add column if not exists cycle_number integer,
  add column if not exists slide_number integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'carousel_image_usage_role_assignment_chk'
      and conrelid = 'public.carousel_image_usage'::regclass
  ) then
    alter table public.carousel_image_usage
      add constraint carousel_image_usage_role_assignment_chk
      check (
        usage_type <> 'assigned'
        or (
          business_profile_id is not null
          and category_slug is not null
          and asset_role in ('hook', 'human', 'static', 'product_asset')
          and cycle_number > 0
          and slide_number between 1 and 5
          and carousel_id is not null
        )
      )
      not valid;
  end if;
end $$;

create unique index if not exists carousel_image_usage_cycle_asset_uidx
  on public.carousel_image_usage (
    business_profile_id,
    category_slug,
    asset_role,
    cycle_number,
    asset_id
  )
  where usage_type = 'assigned'
    and business_profile_id is not null;

create unique index if not exists carousel_image_usage_carousel_asset_uidx
  on public.carousel_image_usage (carousel_id, asset_id)
  where usage_type = 'assigned'
    and carousel_id is not null
    and business_profile_id is not null;

create unique index if not exists carousel_image_usage_carousel_slide_uidx
  on public.carousel_image_usage (carousel_id, slide_number)
  where usage_type = 'assigned'
    and carousel_id is not null
    and business_profile_id is not null;

create or replace function public.reserve_carousel_role_assets_v1(
  p_business_profile_id uuid,
  p_carousel_id uuid,
  p_category_slug text,
  p_use_product_asset boolean default false
)
returns table (
  slide_number integer,
  asset_id uuid,
  library_asset_id text,
  category_slug text,
  asset_role text,
  cycle_number integer,
  base_s3_key text,
  base_url text,
  source_file_sha256 text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_asset public.category_image_assets%rowtype;
  v_asset_count integer;
  v_cycle integer;
  v_existing_count integer;
  v_human_first boolean;
  v_index integer;
  v_last_asset_id uuid;
  v_pool_roles text[];
  v_product_available boolean;
  v_role text;
  v_roles text[];
  v_selected_asset_ids uuid[] := '{}'::uuid[];
  v_user_id text;
begin
  if p_category_slug is null
    or p_category_slug not in ('gym', 'food', 'productivity', 'dating', 'travel', 'skin')
  then
    raise exception 'carousel_image_library_category_not_supported:%', p_category_slug;
  end if;

  select generation.user_id
  into v_user_id
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
    if v_existing_count <> 5 then
      raise exception 'carousel_image_reservation_is_partial:%', v_existing_count;
    end if;

    return query
    select
      image_usage.slide_number,
      image_asset.id,
      image_asset.library_asset_id,
      image_asset.category_slug,
      image_usage.asset_role,
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

  select exists (
    select 1
    from public.category_image_assets as image_asset
    where image_asset.category_slug = p_category_slug
      and image_asset.asset_role = 'product_asset'
      and image_asset.owner_business_profile_id = p_business_profile_id
      and image_asset.is_active
      and image_asset.status = 'ready'
      and image_asset.subject_review_status = 'approved'
      and image_asset.runtime_exclusion_reason is null
  )
  into v_product_available;

  v_product_available := p_use_product_asset and v_product_available;
  v_human_first := get_byte(decode(md5(p_carousel_id::text), 'hex'), 0) < 128;
  v_roles := case
    when v_human_first then array['hook', 'human', 'static', 'human', 'static']::text[]
    else array['hook', 'static', 'human', 'static', 'human']::text[]
  end;

  if v_product_available then
    if v_human_first then
      v_roles[5] := 'product_asset';
    else
      v_roles[4] := 'product_asset';
    end if;
  end if;

  v_pool_roles := case
    when v_product_available
      then array['hook', 'human', 'static', 'product_asset']::text[]
    else array['hook', 'human', 'static']::text[]
  end;

  foreach v_role in array v_pool_roles
  loop
    insert into public.carousel_image_rotation_pools (
      business_profile_id,
      category_slug,
      asset_role
    )
    values (
      p_business_profile_id,
      p_category_slug,
      v_role
    )
    on conflict on constraint carousel_image_rotation_pools_pkey do nothing;
  end loop;

  perform 1
  from public.carousel_image_rotation_pools as rotation_pool
  where rotation_pool.business_profile_id = p_business_profile_id
    and rotation_pool.category_slug = p_category_slug
    and rotation_pool.asset_role = any(v_roles)
  order by rotation_pool.asset_role
  for update;

  select count(*)::integer
  into v_existing_count
  from public.carousel_image_usage as image_usage
  where image_usage.carousel_id = p_carousel_id
    and image_usage.usage_type = 'assigned';

  if v_existing_count > 0 then
    if v_existing_count <> 5 then
      raise exception 'carousel_image_reservation_is_partial:%', v_existing_count;
    end if;

    return query
    select
      image_usage.slide_number,
      image_asset.id,
      image_asset.library_asset_id,
      image_asset.category_slug,
      image_usage.asset_role,
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
    where image_asset.category_slug = p_category_slug
      and image_asset.asset_role = v_role
      and image_asset.owner_business_profile_id is null
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
      and v_asset_count < case when v_product_available then 1 else 2 end
    ) then
      raise exception 'carousel_image_role_pool_too_small:%:%:%',
        p_category_slug,
        v_role,
        v_asset_count;
    end if;
  end loop;

  for v_index in 1..5
  loop
    v_role := v_roles[v_index];

    select rotation_pool.cycle_number, rotation_pool.last_asset_id
    into v_cycle, v_last_asset_id
    from public.carousel_image_rotation_pools as rotation_pool
    where rotation_pool.business_profile_id = p_business_profile_id
      and rotation_pool.category_slug = p_category_slug
      and rotation_pool.asset_role = v_role
    for update;

    select image_asset.*
    into v_asset
    from public.category_image_assets as image_asset
    where image_asset.category_slug = p_category_slug
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
      and image_asset.is_active
      and image_asset.status = 'ready'
      and image_asset.subject_review_status = 'approved'
      and image_asset.runtime_exclusion_reason is null
      and not (image_asset.id = any(v_selected_asset_ids))
      and not exists (
        select 1
        from public.carousel_image_usage as image_usage
        where image_usage.business_profile_id = p_business_profile_id
          and image_usage.category_slug = p_category_slug
          and image_usage.asset_role = v_role
          and image_usage.cycle_number = v_cycle
          and image_usage.asset_id = image_asset.id
          and image_usage.usage_type = 'assigned'
      )
    order by md5(
      p_business_profile_id::text
      || ':' || p_category_slug
      || ':' || v_role
      || ':' || v_cycle::text
      || ':' || image_asset.id::text
    ), image_asset.id
    limit 1;

    if v_asset.id is null then
      v_cycle := v_cycle + 1;

      update public.carousel_image_rotation_pools as rotation_pool
      set cycle_number = v_cycle, updated_at = now()
      where rotation_pool.business_profile_id = p_business_profile_id
        and rotation_pool.category_slug = p_category_slug
        and rotation_pool.asset_role = v_role;

      select image_asset.*
      into v_asset
      from public.category_image_assets as image_asset
      where image_asset.category_slug = p_category_slug
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
        and image_asset.is_active
        and image_asset.status = 'ready'
        and image_asset.subject_review_status = 'approved'
        and image_asset.runtime_exclusion_reason is null
        and not (image_asset.id = any(v_selected_asset_ids))
      order by
        (image_asset.id = v_last_asset_id),
        md5(
          p_business_profile_id::text
          || ':' || p_category_slug
          || ':' || v_role
          || ':' || v_cycle::text
          || ':' || image_asset.id::text
        ),
        image_asset.id
      limit 1;
    end if;

    if v_asset.id is null then
      raise exception 'carousel_image_role_pool_cannot_complete:%:%',
        p_category_slug,
        v_role;
    end if;

    insert into public.carousel_image_usage (
      user_id,
      business_profile_id,
      asset_id,
      duplicate_family_id,
      carousel_id,
      category_slug,
      asset_role,
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
      p_category_slug,
      v_role,
      v_cycle,
      v_index,
      'assigned',
      case when v_cycle > 1 then 'shuffle_bag_cycle' else null end
    );

    update public.carousel_image_rotation_pools as rotation_pool
    set last_asset_id = v_asset.id, updated_at = now()
    where rotation_pool.business_profile_id = p_business_profile_id
      and rotation_pool.category_slug = p_category_slug
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
    image_asset.category_slug,
    image_usage.asset_role,
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
$$;

revoke all on function public.reserve_carousel_role_assets_v1(
  uuid,
  uuid,
  text,
  boolean
) from public, anon, authenticated;

grant execute on function public.reserve_carousel_role_assets_v1(
  uuid,
  uuid,
  text,
  boolean
) to service_role;

select pg_notify('pgrst', 'reload schema');
