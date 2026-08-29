alter table public.category_image_assets
  add column if not exists runtime_exclusion_reason text,
  add column if not exists near_duplicate_group text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_runtime_exclusion_reason_format_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_runtime_exclusion_reason_format_chk
      check (
        runtime_exclusion_reason is null
        or runtime_exclusion_reason ~ '^[a-z0-9]+(_[a-z0-9]+)*$'
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_near_duplicate_group_format_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_near_duplicate_group_format_chk
      check (
        near_duplicate_group is null
        or near_duplicate_group ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      )
      not valid;
  end if;
end $$;

alter table public.category_image_assets
  validate constraint category_image_assets_runtime_exclusion_reason_format_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_near_duplicate_group_format_chk;

create index if not exists category_image_assets_ready_near_duplicate_idx
  on public.category_image_assets (
    category_slug,
    status,
    near_duplicate_group,
    usage_count,
    created_at
  );
