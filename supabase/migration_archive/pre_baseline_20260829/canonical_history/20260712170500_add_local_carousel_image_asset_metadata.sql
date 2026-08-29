alter table public.category_image_assets
  add column if not exists asset_scope text not null default 'category',
  add column if not exists usable_profiles jsonb not null default '[]'::jsonb,
  add column if not exists asset_variant text not null default 'canonical',
  add column if not exists canonical_asset_id uuid
    references public.category_image_assets(id) on delete set null,
  add column if not exists source_original_s3_key text,
  add column if not exists source_original_url text,
  add column if not exists source_folder text,
  add column if not exists source_filename text,
  add column if not exists source_file_sha256 text,
  add column if not exists source_perceptual_hash text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists license_information text;

update public.category_image_assets
set asset_scope = 'shared'
where category_slug = 'shared'
  and asset_scope = 'category';

do $$
declare
  source_provider_constraint record;
begin
  for source_provider_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.category_image_assets'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%source_provider%'
  loop
    execute format(
      'alter table public.category_image_assets drop constraint %I',
      source_provider_constraint.conname
    );
  end loop;
end $$;

alter table public.category_image_assets
  add constraint category_image_assets_source_provider_chk
  check (source_provider in ('pexels', 'local'))
  not valid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_asset_scope_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_asset_scope_chk
      check (asset_scope in ('category', 'shared'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_usable_profiles_array_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_usable_profiles_array_chk
      check (jsonb_typeof(usable_profiles) = 'array')
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_asset_variant_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_asset_variant_chk
      check (
        asset_variant in (
          'canonical',
          'derived_crop',
          'cropped_only',
          'flat',
          'preview',
          'duplicate'
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_source_original_url_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_source_original_url_chk
      check (
        source_original_url is null
        or source_original_url ~ '^https?://'
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_source_file_sha256_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_source_file_sha256_chk
      check (
        source_file_sha256 is null
        or source_file_sha256 ~ '^[a-f0-9]{64}$'
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_source_perceptual_hash_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_source_perceptual_hash_chk
      check (
        source_perceptual_hash is null
        or source_perceptual_hash ~ '^[a-f0-9]{16,128}$'
        or source_perceptual_hash ~ '^[01]{16,256}$'
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_source_metadata_object_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_source_metadata_object_chk
      check (jsonb_typeof(source_metadata) = 'object')
      not valid;
  end if;
end $$;

alter table public.category_image_assets
  validate constraint category_image_assets_source_provider_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_asset_scope_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_usable_profiles_array_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_asset_variant_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_source_original_url_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_source_file_sha256_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_source_perceptual_hash_chk;

alter table public.category_image_assets
  validate constraint category_image_assets_source_metadata_object_chk;

create index if not exists category_image_assets_asset_scope_idx
  on public.category_image_assets (asset_scope, category_slug, status);

create index if not exists category_image_assets_canonical_asset_idx
  on public.category_image_assets (canonical_asset_id)
  where canonical_asset_id is not null;

create index if not exists category_image_assets_source_file_sha256_idx
  on public.category_image_assets (source_file_sha256)
  where source_file_sha256 is not null;

create index if not exists category_image_assets_source_perceptual_hash_idx
  on public.category_image_assets (source_perceptual_hash)
  where source_perceptual_hash is not null;

create index if not exists category_image_assets_usable_profiles_gin_idx
  on public.category_image_assets using gin (usable_profiles);

create table if not exists public.carousel_image_usage (
  id uuid primary key default gen_random_uuid(),

  user_id text not null,
  asset_id uuid not null
    references public.category_image_assets(id) on delete restrict,
  duplicate_family_id text,
  carousel_id uuid
    references public.carousel_generations(id) on delete set null,
  slide_id uuid
    references public.carousel_slides(id) on delete set null,
  feed_date date,

  usage_type text not null
    check (usage_type in ('assigned', 'shown', 'saved', 'published')),
  reuse_reason text,

  used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists carousel_image_usage_user_asset_used_idx
  on public.carousel_image_usage (user_id, asset_id, used_at desc);

create index if not exists carousel_image_usage_user_family_used_idx
  on public.carousel_image_usage (user_id, duplicate_family_id, used_at desc)
  where duplicate_family_id is not null;

create index if not exists carousel_image_usage_feed_idx
  on public.carousel_image_usage (user_id, feed_date, usage_type, used_at desc)
  where feed_date is not null;

create index if not exists carousel_image_usage_carousel_idx
  on public.carousel_image_usage (carousel_id, slide_id)
  where carousel_id is not null;

alter table public.carousel_image_usage enable row level security;

revoke all privileges on table public.carousel_image_usage
  from anon, authenticated;

grant select, insert, update on table public.carousel_image_usage
  to service_role;

select pg_notify('pgrst', 'reload schema');
