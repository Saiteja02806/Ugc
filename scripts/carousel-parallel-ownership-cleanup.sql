-- Replace only this value with the fixture_user returned by the seed script.
-- Execute even after an interrupted canary. Never use a real customer's UID.
begin;
set local ugc.carousel_canary_user = 'REPLACE_WITH_FIXTURE_USER';
set local lock_timeout = '5s';
do $$
declare owner_id text := current_setting('ugc.carousel_canary_user'); profile_id uuid;
begin
  if owner_id !~ '^carousel-capacity-canary-[a-f0-9-]{36}$' then
    raise exception 'Synthetic fixture owner required';
  end if;
  select id into profile_id from public.business_profiles where user_id=owner_id and project_id='carousel-capacity-canary';
  if profile_id is null then raise exception 'Synthetic fixture not found'; end if;
  -- Subtract only this fixture's increments, preserving concurrent real usage.
  update public.category_image_assets a set usage_count=a.usage_count-u.n
  from (select asset_id,count(*)::integer n from public.carousel_image_usage
    where business_profile_id=profile_id and user_id=owner_id and usage_type='assigned' group by asset_id) u
  where a.id=u.asset_id;
  delete from public.carousel_image_usage where business_profile_id=profile_id and user_id=owner_id;
  delete from public.carousel_image_rotation_pools where business_profile_id=profile_id;
  delete from public.carousel_generations where user_id=owner_id;
  delete from public.carousel_experiment_assignments where experiment_batch_id in
    (select id from public.carousel_experiment_batches where business_profile_id=profile_id);
  delete from public.carousel_experiment_batches where business_profile_id=profile_id;
  delete from public.carousel_content_plan_items where user_id=owner_id;
  delete from public.carousel_content_plan_reservations where user_id=owner_id;
  delete from public.carousel_content_plans where user_id=owner_id;
  delete from public.business_profiles where id=profile_id and user_id=owner_id;
  delete from public.background_jobs where user_id=owner_id;
  if exists(select 1 from public.background_jobs where user_id=owner_id)
    or exists(select 1 from public.carousel_generations where user_id=owner_id)
    or exists(select 1 from public.business_profiles where user_id=owner_id) then
    raise exception 'Synthetic cleanup incomplete';
  end if;
end $$;
commit;
