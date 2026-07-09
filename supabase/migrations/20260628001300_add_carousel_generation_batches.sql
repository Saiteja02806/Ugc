alter table public.carousel_generations
  add column if not exists generation_batch_id uuid not null default gen_random_uuid(),
  add column if not exists candidate_index int not null default 0 check (candidate_index >= 0),
  add column if not exists candidate_count int not null default 1 check (candidate_count between 1 and 50);

create index if not exists carousel_generations_batch_candidate_idx
  on public.carousel_generations (generation_batch_id, candidate_index);

create or replace function public.increment_category_image_asset_usage(asset_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.category_image_assets
  set
    usage_count = category_image_assets.usage_count + asset_usage.times_used,
    updated_at = now()
  from (
    select asset_id, count(*)::int as times_used
    from unnest(asset_ids) as asset_id
    where asset_id is not null
    group by asset_id
  ) as asset_usage
  where category_image_assets.id = asset_usage.asset_id;
$$;

revoke all on function public.increment_category_image_asset_usage(uuid[]) from public;
revoke all on function public.increment_category_image_asset_usage(uuid[]) from anon;
revoke all on function public.increment_category_image_asset_usage(uuid[]) from authenticated;
grant execute on function public.increment_category_image_asset_usage(uuid[]) to service_role;
