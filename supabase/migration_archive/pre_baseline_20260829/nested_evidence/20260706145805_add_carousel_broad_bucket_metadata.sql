alter table public.category_image_assets
  add column if not exists broad_visual_bucket text,
  add column if not exists bucket_taxonomy_version text,
  add column if not exists object_tags jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_broad_visual_bucket_format_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_broad_visual_bucket_format_chk
      check (
        broad_visual_bucket is null
        or broad_visual_bucket ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_object_tags_array_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_object_tags_array_chk
      check (jsonb_typeof(object_tags) = 'array')
      not valid;
  end if;
end $$;

alter table public.category_image_assets
  validate constraint category_image_assets_broad_visual_bucket_format_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_object_tags_array_chk;

create index if not exists category_image_assets_ready_broad_bucket_idx
  on public.category_image_assets (
    category_slug,
    status,
    broad_visual_bucket,
    usage_count,
    created_at
  );

create index if not exists category_image_assets_object_tags_gin_idx
  on public.category_image_assets using gin (object_tags);
