begin;

create temporary table carousel_role_test_target on commit drop as
select generation.id, generation.business_profile_id
from public.carousel_generations as generation
where generation.business_profile_id is not null
  and not exists (
    select 1
    from public.carousel_image_usage as image_usage
    where image_usage.carousel_id = generation.id
      and image_usage.usage_type = 'assigned'
  )
order by generation.created_at desc
limit 1;

do $$
begin
  if not exists (select 1 from carousel_role_test_target) then
    raise exception 'carousel_role_live_test_has_no_generation_target';
  end if;
end;
$$;

create temporary table carousel_role_first_reservation on commit drop as
select reservation.*
from carousel_role_test_target as test_target
cross join lateral public.reserve_carousel_role_assets_v1(
  test_target.business_profile_id,
  test_target.id,
  'gym',
  false
) as reservation;

create temporary table carousel_role_second_reservation on commit drop as
select reservation.*
from carousel_role_test_target as test_target
cross join lateral public.reserve_carousel_role_assets_v1(
  test_target.business_profile_id,
  test_target.id,
  'gym',
  false
) as reservation;

do $$
declare
  v_hook_count integer;
  v_human_count integer;
  v_row_count integer;
  v_static_count integer;
  v_unique_asset_count integer;
begin
  select
    count(*)::integer,
    count(distinct asset_id)::integer,
    count(*) filter (where asset_role = 'hook')::integer,
    count(*) filter (where asset_role = 'human')::integer,
    count(*) filter (where asset_role = 'static')::integer
  into
    v_row_count,
    v_unique_asset_count,
    v_hook_count,
    v_human_count,
    v_static_count
  from carousel_role_first_reservation;

  if v_row_count <> 5
    or v_unique_asset_count <> 5
    or v_hook_count <> 1
    or v_human_count <> 2
    or v_static_count <> 2
  then
    raise exception 'carousel_role_live_test_ratio_failed:%:%:%:%:%',
      v_row_count,
      v_unique_asset_count,
      v_hook_count,
      v_human_count,
      v_static_count;
  end if;

  if not exists (
    select 1
    from carousel_role_first_reservation
    where slide_number = 1 and asset_role = 'hook'
  ) then
    raise exception 'carousel_role_live_test_slide_one_is_not_hook';
  end if;

  if exists (
    select 1
    from carousel_role_first_reservation as first_slide
    join carousel_role_first_reservation as next_slide
      on next_slide.slide_number = first_slide.slide_number + 1
    where first_slide.slide_number >= 2
      and first_slide.asset_role = next_slide.asset_role
  ) then
    raise exception 'carousel_role_live_test_body_roles_do_not_alternate';
  end if;

  if exists (
    (
      select * from carousel_role_first_reservation
      except
      select * from carousel_role_second_reservation
    )
    union all
    (
      select * from carousel_role_second_reservation
      except
      select * from carousel_role_first_reservation
    )
  ) then
    raise exception 'carousel_role_live_test_idempotency_failed';
  end if;
end;
$$;

select json_build_object(
  'assets', count(*),
  'hook', count(*) filter (where asset_role = 'hook'),
  'human', count(*) filter (where asset_role = 'human'),
  'static', count(*) filter (where asset_role = 'static'),
  'slide_one_role', max(asset_role) filter (where slide_number = 1),
  'idempotent', true,
  'rolled_back', true
) as verification
from carousel_role_first_reservation;

rollback;
