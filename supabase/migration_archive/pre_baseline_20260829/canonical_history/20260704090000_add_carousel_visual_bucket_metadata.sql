alter table public.category_image_assets
  add column if not exists visual_bucket text,
  add column if not exists bucket_type text,
  add column if not exists primary_vertical text,
  add column if not exists usable_verticals jsonb not null default '[]'::jsonb,
  add column if not exists best_for_slide_types jsonb not null default '[]'::jsonb,
  add column if not exists mood_tags jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_visual_bucket_format_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_visual_bucket_format_chk
      check (
        visual_bucket is null or visual_bucket ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_bucket_type_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_bucket_type_chk
      check (bucket_type is null or bucket_type in ('universal', 'vertical'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_primary_vertical_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_primary_vertical_chk
      check (
        primary_vertical is null or primary_vertical in (
          'fitness-health',
          'productivity',
          'saas-work',
          'wellness'
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_usable_verticals_array_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_usable_verticals_array_chk
      check (jsonb_typeof(usable_verticals) = 'array')
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_best_for_slide_types_array_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_best_for_slide_types_array_chk
      check (jsonb_typeof(best_for_slide_types) = 'array')
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_mood_tags_array_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_mood_tags_array_chk
      check (jsonb_typeof(mood_tags) = 'array')
      not valid;
  end if;
end $$;

alter table public.category_image_assets
  validate constraint category_image_assets_visual_bucket_format_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_bucket_type_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_primary_vertical_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_usable_verticals_array_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_best_for_slide_types_array_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_mood_tags_array_chk;

create index if not exists category_image_assets_ready_bucket_idx
  on public.category_image_assets (
    category_slug,
    status,
    visual_bucket,
    usage_count,
    created_at
  );

create index if not exists category_image_assets_usable_verticals_gin_idx
  on public.category_image_assets using gin (usable_verticals);

create index if not exists category_image_assets_best_for_slide_types_gin_idx
  on public.category_image_assets using gin (best_for_slide_types);
